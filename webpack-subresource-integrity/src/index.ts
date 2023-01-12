/**
 * Copyright (c) 2015-present, Waysact Pty Ltd
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "crypto";
import type { Compiler, Compilation } from "webpack";
import { sources } from "webpack";
import {
  SubresourceIntegrityPluginOptions,
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
import { install } from "./hooks";
import { AddLazySriRuntimeModule } from "./manifest";
import { thisPluginName, standardHashFuncNames } from "./globals";

/**
 * @public
 */
export { SubresourceIntegrityPluginOptions };

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
  private setup = (
    compilation: Compilation,
    hwpHooks: ReturnType<getHtmlWebpackPluginHooksType> | null
  ): void => {
    const reporter = new Reporter(compilation);

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
      reporter.warnNonWeb();
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
            const record = records[chunkFile];
            if (record && record.source().includes(placeholderPrefix)) {
              reporter.errorUnresolvedIntegrity(chunkFile);
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

    if (hwpHooks) {
      hwpHooks.beforeAssetTagGeneration.tapPromise(
        thisPluginName,
        async (pluginArgs) => {
          plugin.handleHwpPluginArgs(pluginArgs);
          return pluginArgs;
        }
      );

      hwpHooks.alterAssetTagGroups.tapPromise(
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
      reporter.warnCrossOriginPolicy();
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
      reporter.errorHashFuncsNonArray(this.options.hashFuncNames);
      return false;
    } else if (this.options.hashFuncNames.length === 0) {
      reporter.errorHashFuncsEmpty();
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

    reporter.errorInvalidHashLoading(
      this.options.hashLoading,
      supportedHashLoadingOptions
    );
    return false;
  };

  /**
   * @internal
   */
  private warnStandardHashFunc = (reporter: Reporter) => {
    let foundStandardHashFunc = false;

    this.options.hashFuncNames.forEach((hashFuncName) => {
      if (standardHashFuncNames.indexOf(hashFuncName) >= 0) {
        foundStandardHashFunc = true;
      }
    });
    if (!foundStandardHashFunc) {
      reporter.warnStandardHashFuncs();
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
      reporter.errorNonStringHashFunc(hashFuncName);
      return false;
    }
    try {
      createHash(hashFuncName);
    } catch (error) {
      reporter.errorUnusableHashFunc(hashFuncName, error);
      return false;
    }
    return true;
  };

  apply(compiler: Compiler): void {
    install(compiler, this.setup);
  }
}
