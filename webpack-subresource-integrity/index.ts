/**
 * Copyright (c) 2015-present, Waysact Pty Ltd
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "crypto";
import type { Compiler, Compilation } from "webpack";
import { RuntimeModule, Template, sources } from "webpack";
import {
  SubresourceIntegrityPluginResolvedOptions,
  getHtmlWebpackPluginHooksType,
} from "./types";
import { Plugin } from "./plugin";
import { Reporter } from "./reporter";
import {
  findChunks,
  placeholderPrefix,
  generateSriHashPlaceholders,
  sriHashVariableReference,
} from "./util";

interface StatsObjectWithIntegrity {
  integrity: string;
}

const thisPluginName = "webpack-subresource-integrity";

// https://www.w3.org/TR/2016/REC-SRI-20160623/#cryptographic-hash-functions
const standardHashFuncNames = ["sha256", "sha384", "sha512"];

let getHtmlWebpackPluginHooks: getHtmlWebpackPluginHooksType | null = null;

/**
 * @public
 */
export interface SubresourceIntegrityPluginOptions {
  readonly hashFuncNames?: [string, ...string[]];
  readonly enabled?: "auto" | true | false;
  readonly hashLoading?: "eager" | "lazy";
  readonly skipChunkNames?: string[]
}

class AddLazySriRuntimeModule extends RuntimeModule {
  private sriHashes: unknown;

  constructor(sriHashes: unknown, chunkName: string | number) {
    super(
      `webpack-subresource-integrity lazy hashes for direct children of chunk ${chunkName}`
    );
    this.sriHashes = sriHashes;
  }

  generate() {
    return Template.asString([
      `Object.assign(${sriHashVariableReference}, ${JSON.stringify(
        this.sriHashes
      )});`,
    ]);
  }
}

/**
 * The webpack-subresource-integrity plugin.
 *
 * @public
 */
export class SubresourceIntegrityPlugin {
  private readonly options: SubresourceIntegrityPluginResolvedOptions;

  /**
   * Create a new instance.
   *
   * @public
   */
  constructor(options: SubresourceIntegrityPluginOptions = {}) {
    if (typeof (options as unknown) !== "object") {
      throw new Error(
        "webpack-subresource-integrity: argument must be an object"
      );
    }

    this.options = {
      hashFuncNames: ["sha384"],
      enabled: "auto",
      hashLoading: "eager",
      ...options,
    };
  }

  /**
   * @internal
   */
  private isEnabled(compilation: Compilation): boolean {
    if (this.options.enabled === "auto") {
      return compilation.options.mode !== "development";
    }

    return this.options.enabled;
  }

  /**
   * @internal
   */
  private setup = (compilation: Compilation): void => {
    const reporter = new Reporter(compilation, thisPluginName);

    if (
      !this.validateOptions(compilation, reporter) ||
      !this.isEnabled(compilation)
    ) {
      return;
    }

    const plugin = new Plugin(compilation, this.options, reporter);

    if (
      typeof compilation.outputOptions.chunkLoading === "string" &&
      ["require", "async-node"].includes(compilation.outputOptions.chunkLoading)
    ) {
      reporter.warnOnce("This plugin is not useful for non-web targets.");
      return;
    }

    compilation.hooks.beforeRuntimeRequirements.tap(thisPluginName, () => {
      plugin.beforeRuntimeRequirements();
    });

    compilation.hooks.processAssets.tap(
      {
        name: thisPluginName,
        stage:
          compilation.compiler.webpack.Compilation
            .PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
      },
      (records: Record<string, sources.Source>) => {
        return plugin.processAssets(records);
      }
    );

    compilation.hooks.afterProcessAssets.tap(
      thisPluginName,
      (records: Record<string, sources.Source>) => {
        for (const chunk of compilation.chunks.values()) {
          for (const chunkFile of chunk.files) {
            if (
              chunkFile in records &&
              records[chunkFile].source().includes(placeholderPrefix)
            ) {
              reporter.errorOnce(
                `Asset ${chunkFile} contains unresolved integrity placeholders`
              );
            }
          }
        }
      }
    );

    compilation.compiler.webpack.optimize.RealContentHashPlugin.getCompilationHooks(
      compilation
    ).updateHash.tap(thisPluginName, (input, oldHash) => {
      // FIXME: remove type hack pending https://github.com/webpack/webpack/pull/12642#issuecomment-784744910
      return plugin.updateHash(input, oldHash) as unknown as string;
    });

    if (getHtmlWebpackPluginHooks) {
      getHtmlWebpackPluginHooks(
        compilation
      ).beforeAssetTagGeneration.tapPromise(
        thisPluginName,
        async (pluginArgs) => {
          plugin.handleHwpPluginArgs(pluginArgs);
          return pluginArgs;
        }
      );

      getHtmlWebpackPluginHooks(compilation).alterAssetTagGroups.tapPromise(
        {
          name: thisPluginName,
          stage: 10000,
        },
        async (data) => {
          plugin.handleHwpBodyTags(data);
          return data;
        }
      );
    }

    const { mainTemplate } = compilation;

    mainTemplate.hooks.jsonpScript.tap(thisPluginName, (source: string) =>
      plugin.addAttribute("script", source)
    );

    mainTemplate.hooks.linkPreload.tap(thisPluginName, (source: string) =>
      plugin.addAttribute("link", source)
    );

    mainTemplate.hooks.localVars.tap(thisPluginName, (source, chunk) => {
      const allChunks =
        this.options.hashLoading === "lazy"
          ? plugin.getChildChunksToAddToChunkManifest(chunk)
          : findChunks(chunk);
      const includedChunks = chunk.getChunkMaps(false).hash;

      if (Object.keys(includedChunks).length > 0) {
        return compilation.compiler.webpack.Template.asString([
          source,
          `${sriHashVariableReference} = ` +
            JSON.stringify(
              generateSriHashPlaceholders(
                Array.from(allChunks).filter(
                  (depChunk) =>
                    depChunk.id !== null &&
                    includedChunks[depChunk.id.toString()]
                ),
                this.options.hashFuncNames
              )
            ) +
            ";",
        ]);
      }

      return source;
    });

    if (this.options.hashLoading === "lazy") {
      compilation.hooks.additionalChunkRuntimeRequirements.tap(
        thisPluginName,
        (chunk) => {
          const childChunks = plugin.getChildChunksToAddToChunkManifest(chunk);
          if (childChunks.size > 0 && !chunk.hasRuntime()) {
            compilation.addRuntimeModule(
              chunk,
              new AddLazySriRuntimeModule(
                generateSriHashPlaceholders(
                  childChunks,
                  this.options.hashFuncNames
                ),
                chunk.name ?? chunk.id
              )
            );
          }
        }
      );
    }
  };

  /**
   * @internal
   */
  private validateOptions = (compilation: Compilation, reporter: Reporter) => {
    if (
      this.isEnabled(compilation) &&
      !compilation.compiler.options.output.crossOriginLoading
    ) {
      reporter.warnOnce(
        'SRI requires a cross-origin policy, defaulting to "anonymous". ' +
          "Set webpack option output.crossOriginLoading to a value other than false " +
          "to make this warning go away. " +
          "See https://w3c.github.io/webappsec-subresource-integrity/#cross-origin-data-leakage"
      );
    }
    return (
      this.validateHashFuncNames(reporter) && this.validateHashLoading(reporter)
    );
  };

  /**
   * @internal
   */
  private validateHashFuncNames = (reporter: Reporter): boolean => {
    if (!Array.isArray(this.options.hashFuncNames)) {
      reporter.error(
        "options.hashFuncNames must be an array of hash function names, " +
          "instead got '" +
          this.options.hashFuncNames +
          "'."
      );
      return false;
    } else if (this.options.hashFuncNames.length === 0) {
      reporter.error("Must specify at least one hash function name.");
      return false;
    } else if (
      !this.options.hashFuncNames.every(
        this.validateHashFuncName.bind(this, reporter)
      )
    ) {
      return false;
    } else {
      this.warnStandardHashFunc(reporter);
      return true;
    }
  };

  /**
   * @internal
   */
  private validateHashLoading = (reporter: Reporter): boolean => {
    const supportedHashLoadingOptions = Object.freeze(["eager", "lazy"]);
    if (supportedHashLoadingOptions.includes(this.options.hashLoading)) {
      return true;
    }

    const optionsStr = supportedHashLoadingOptions
      .map((opt) => `'${opt}'`)
      .join(", ");

    reporter.error(
      `options.hashLoading must be one of ${optionsStr}, instead got '${this.options.hashLoading}'`
    );
    return false;
  };

  /**
   * @internal
   */
  private warnStandardHashFunc = (reporter: Reporter) => {
    let foundStandardHashFunc = false;
    for (let i = 0; i < this.options.hashFuncNames.length; i += 1) {
      if (standardHashFuncNames.indexOf(this.options.hashFuncNames[i]) >= 0) {
        foundStandardHashFunc = true;
      }
    }
    if (!foundStandardHashFunc) {
      reporter.warnOnce(
        "It is recommended that at least one hash function is part of the set " +
          "for which support is mandated by the specification. " +
          "These are: " +
          standardHashFuncNames.join(", ") +
          ". " +
          "See http://www.w3.org/TR/SRI/#cryptographic-hash-functions for more information."
      );
    }
  };

  /**
   * @internal
   */
  private validateHashFuncName = (reporter: Reporter, hashFuncName: string) => {
    if (
      typeof hashFuncName !== "string" &&
      !((hashFuncName as unknown) instanceof String)
    ) {
      reporter.error(
        "options.hashFuncNames must be an array of hash function names, " +
          "but contained " +
          hashFuncName +
          "."
      );
      return false;
    }
    try {
      createHash(hashFuncName);
    } catch (error) {
      reporter.error(
        "Cannot use hash function '" + hashFuncName + "': " + error.message
      );
      return false;
    }
    return true;
  };

  apply(compiler: Compiler): void {
    compiler.hooks.beforeCompile.tapPromise(thisPluginName, async () => {
      try {
        getHtmlWebpackPluginHooks = (await import("html-webpack-plugin"))
          .default.getHooks;
      } catch (e) {
        if (e.code !== "MODULE_NOT_FOUND") {
          throw e;
        }
      }
    });

    compiler.hooks.afterPlugins.tap(thisPluginName, (compiler) => {
      compiler.hooks.thisCompilation.tap(
        {
          name: thisPluginName,
          stage: -10000,
        },
        (compilation) => {
          this.setup(compilation);
        }
      );

      compiler.hooks.compilation.tap(
        thisPluginName,
        (compilation: Compilation) => {
          compilation.hooks.statsFactory.tap(thisPluginName, (statsFactory) => {
            statsFactory.hooks.extract
              .for("asset")
              .tap(thisPluginName, (object, asset) => {
                const contenthash = asset.info?.contenthash;
                if (contenthash) {
                  const shaHashes = (
                    Array.isArray(contenthash) ? contenthash : [contenthash]
                  ).filter((hash: unknown) =>
                    String(hash).match(/^sha[0-9]+-/)
                  );
                  if (shaHashes.length > 0) {
                    (object as unknown as StatsObjectWithIntegrity).integrity =
                      shaHashes.join(" ");
                  }
                }
              });
          });
        }
      );
    });
  }
}
