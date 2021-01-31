/**
 * Copyright (c) 2015-present, Waysact Pty Ltd
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "crypto";
import webpack, {
  Chunk,
  Compiler,
  Compilation,
  Template,
  sources,
  optimize,
} from "webpack";
import { relative, sep, join } from "path";
import { readFileSync } from "fs";
import * as assert from "typed-assert";

import type HtmlWebpackPlugin from "html-webpack-plugin";

type HtmlTagObject = HtmlWebpackPlugin.HtmlTagObject;

type getHtmlWebpackPluginHooksType = (
  compilation: Compilation
) => HtmlWebpackPlugin.Hooks;

type ChunkGroup = ReturnType<Compilation["addChunkInGroup"]>;

interface TemplateFiles {
  js: string[];
  css: string[];
}

const thisPluginName = "webpack-subresource-integrity";

// https://www.w3.org/TR/2016/REC-SRI-20160623/#cryptographic-hash-functions
const standardHashFuncNames = ["sha256", "sha384", "sha512"];

let getHtmlWebpackPluginHooks: getHtmlWebpackPluginHooksType | null = null;

function getTagSrc(tag: HtmlTagObject): string | undefined {
  if (!["script", "link"].includes(tag.tagName) || !tag.attributes) {
    return undefined;
  }
  if (typeof tag.attributes.href === "string") {
    return tag.attributes.href;
  }
  if (typeof tag.attributes.src === "string") {
    return tag.attributes.src;
  }
  return undefined;
}

const normalizePath = (p: string) =>
  p.replace(/\?.*$/, "").split(sep).join("/");

const placeholderPrefix = "*-*-*-CHUNK-SRI-HASH-";

const computeIntegrity = (hashFuncNames: string[], source: string | Buffer) => {
  const result = hashFuncNames
    .map(
      (hashFuncName) =>
        hashFuncName +
        "-" +
        createHash(hashFuncName)
          .update(
            typeof source === "string" ? Buffer.from(source, "utf-8") : source
          )
          .digest("base64")
    )
    .join(" ");

  return result;
};

const makePlaceholder = (hashFuncNames: string[], id: string | number) => {
  const placeholder = `${placeholderPrefix}${id}`;
  const filler = computeIntegrity(hashFuncNames, placeholder);
  return placeholderPrefix + filler.substring(placeholderPrefix.length);
};

function findChunks(chunk: Chunk) {
  const allChunks = new Set<Chunk>();
  const groupsVisited = new Set<string>();

  function addIfNotExist<T>(set: Set<T>, item: T) {
    if (set.has(item)) return true;
    set.add(item);
    return false;
  }

  (function recurseChunk(childChunk: Chunk) {
    function recurseGroup(group: ChunkGroup) {
      if (addIfNotExist(groupsVisited, group.id)) return;
      group.chunks.forEach(recurseChunk);
      group.childrenIterable.forEach(recurseGroup);
    }

    if (addIfNotExist(allChunks, childChunk)) return;
    Array.from(childChunk.groupsIterable).forEach(recurseGroup);
  })(chunk);

  return allChunks;
}

/**
 * @internal
 */
interface SubresourceIntegrityPluginResolvedOptions {
  readonly hashFuncNames: [string, ...string[]];
  readonly enabled: "auto" | true | false;
}

/**
 * @public
 */
export interface SubresourceIntegrityPluginOptions {
  readonly hashFuncNames?: [string, ...string[]];
  readonly enabled?: "auto" | true | false;
}

/**
 * The webpack-subresource-integrity plugin.
 *
 * @public
 */
export class SubresourceIntegrityPlugin {
  /**
   * @internal
   */
  private readonly options: SubresourceIntegrityPluginResolvedOptions;

  /**
   * @internal
   */
  private emittedMessages: Set<string> = new Set();

  /**
   * @internal
   */
  private assetIntegrity: Map<string, string> = new Map();

  /**
   * @internal
   */
  private inverseAssetIntegrity: Map<string, string> = new Map();

  /**
   * @internal
   */
  private hwpPublicPath: string | null = null;

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
      ...options,
    };
  }

  /**
   * @internal
   */
  private emitMessage(messages: Error[], message: string): void {
    messages.push(new Error(`${thisPluginName}: ${message}`));
  }

  /**
   * @internal
   */
  private emitMessageOnce(messages: Error[], message: string): void {
    if (!this.emittedMessages.has(message)) {
      this.emittedMessages.add(message);
      this.emitMessage(messages, message);
    }
  }

  /**
   * @internal
   */
  private warnOnce(compilation: Compilation, message: string): void {
    this.emitMessageOnce(compilation.warnings, message);
  }

  /**
   * @internal
   */
  private errorOnce(compilation: Compilation, message: string): void {
    this.emitMessageOnce(compilation.errors, message);
  }

  /**
   * @internal
   */
  private error(compilation: Compilation, message: string): void {
    this.emitMessage(compilation.errors, message);
  }

  /**
   * @internal
   */
  private warnIfHotUpdate(
    compilation: Compilation,
    source: string | Buffer
  ): void {
    if (source.indexOf("webpackHotUpdate") >= 0) {
      this.warnOnce(
        compilation,
        "webpack-subresource-integrity may interfere with hot reloading. " +
          "Consider disabling this plugin in development mode."
      );
    }
  }

  /**
   * @internal
   */
  private updateAssetIntegrity(assetKey: string, integrity: string) {
    if (!this.assetIntegrity.has(assetKey)) {
      this.assetIntegrity.set(assetKey, integrity);
      this.inverseAssetIntegrity.set(integrity, assetKey);
    }
  }

  /**
   * @internal
   */
  private addMissingIntegrityHashes = (
    assets: Record<string, sources.Source>
  ): void => {
    Object.keys(assets).forEach((assetKey) => {
      const asset = assets[assetKey];
      let source;
      try {
        source = asset.source();
      } catch (_) {
        return;
      }
      this.updateAssetIntegrity(
        assetKey,
        computeIntegrity(this.options.hashFuncNames, source)
      );
    });
  };

  /**
   * @internal
   */
  private replaceAsset = (
    assets: Record<string, sources.Source>,
    hashByChunkId: Map<string | number, string>,
    chunkFile: string
  ): sources.Source => {
    const oldSource = assets[chunkFile].source();
    const hashFuncNames = this.options.hashFuncNames;
    const newAsset = new webpack.sources.ReplaceSource(
      assets[chunkFile],
      chunkFile
    );

    Array.from(hashByChunkId.entries()).forEach((idAndHash) => {
      const magicMarker = makePlaceholder(hashFuncNames, idAndHash[0]);
      const magicMarkerPos = oldSource.indexOf(magicMarker);
      if (magicMarkerPos >= 0) {
        newAsset.replace(
          magicMarkerPos,
          magicMarkerPos + magicMarker.length - 1,
          idAndHash[1],
          chunkFile
        );
      }
    });

    assets[chunkFile] = newAsset;

    return newAsset;
  };

  /**
   * @internal
   */
  private processChunk = (
    chunk: Chunk,
    compilation: Compilation,
    assets: Record<string, sources.Source>
  ): void => {
    const hashByChunkId = new Map<string | number, string>();

    Array.from(findChunks(chunk))
      .reverse()
      .forEach((childChunk: Chunk) => {
        const files = Array.from(childChunk.files);

        let sourcePath = files[files.length - 1];
        if (!sourcePath) {
          return;
        }

        if (assets[sourcePath]) {
          this.warnIfHotUpdate(compilation, assets[sourcePath].source());
          const newAsset = this.replaceAsset(assets, hashByChunkId, sourcePath);
          const integrity = computeIntegrity(
            this.options.hashFuncNames,
            newAsset.source()
          );

          if (childChunk.id !== null) {
            hashByChunkId.set(childChunk.id, integrity);
          }
          this.updateAssetIntegrity(sourcePath, integrity);
          compilation.updateAsset(
            sourcePath,
            (x) => x,
            (assetInfo) =>
              assetInfo && {
                ...assetInfo,
                contenthash: Array.isArray(assetInfo.contenthash)
                  ? [...new Set([...assetInfo.contenthash, integrity])]
                  : assetInfo.contenthash
                  ? [assetInfo.contenthash, integrity]
                  : integrity,
              }
          );
        } else {
          this.warnOnce(
            compilation,
            `No asset found for source path '${sourcePath}', options are ${Object.keys(
              assets
            ).join(", ")}`
          );
        }
      });
  };

  /**
   * @internal
   */
  private addAttribute = (
    compilation: Compilation,
    elName: string,
    source: string
  ): string => {
    if (!compilation.outputOptions.crossOriginLoading) {
      this.errorOnce(
        compilation,
        "webpack option output.crossOriginLoading not set, code splitting will not work!"
      );
    }

    return Template.asString([
      source,
      elName + ".integrity = __webpack_require__.sriHashes[chunkId];",
      elName +
        ".crossOrigin = " +
        JSON.stringify(compilation.outputOptions.crossOriginLoading) +
        ";",
    ]);
  };

  /**
   * @internal
   */
  private processAssets = (
    compilation: Compilation,
    assets: Record<string, sources.Source>
  ): void => {
    Array.from(compilation.chunks)
      .filter((chunk) => chunk.hasRuntime())
      .forEach((chunk) => {
        this.processChunk(chunk, compilation, assets);
      });

    this.addMissingIntegrityHashes(assets);
  };

  /**
   * @internal
   */
  private hwpAssetPath = (src: string): string => {
    assert.isNotNull(this.hwpPublicPath);
    return relative(this.hwpPublicPath, src);
  };

  /**
   * @internal
   */
  private getIntegrityChecksumForAsset = (
    assets: Record<string, sources.Source>,
    src: string
  ): string | undefined => {
    if (this.assetIntegrity.has(src)) {
      return this.assetIntegrity.get(src);
    }

    const normalizedSrc = normalizePath(src);
    const normalizedKey = Object.keys(assets).find(
      (assetKey) => normalizePath(assetKey) === normalizedSrc
    );
    if (normalizedKey) {
      return this.assetIntegrity.get(normalizedKey);
    }
    return undefined;
  };

  /**
   * @internal
   */
  private processTag = (compilation: Compilation, tag: HtmlTagObject): void => {
    if (tag.attributes && Object.prototype.hasOwnProperty.call(tag.attributes, "integrity")) {
      return;
    }

    const tagSrc = getTagSrc(tag);

    if (!tagSrc) {
      return;
    }

    const src = this.hwpAssetPath(tagSrc);

    let integrity = this.getIntegrityChecksumForAsset(compilation.assets, src);

    if (!integrity) {
      const candidate = join(compilation.compiler.outputPath, src);
      try {
        integrity = computeIntegrity(
          this.options.hashFuncNames,
          readFileSync(candidate)
        );
      } catch (e) {
        if (e.code !== "ENOENT") {
          throw e;
        }
      }
    }

    if (!integrity) {
      this.errorOnce(
        compilation,
        "Could not determine integrity for asset at path " + src
      );
      return;
    }

    tag.attributes.integrity = integrity;
    tag.attributes.crossorigin =
      compilation.compiler.options.output.crossOriginLoading || "anonymous";
  };

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
    if (!this.validateOptions(compilation) || !this.isEnabled(compilation)) {
      return;
    }

    if (
      typeof compilation.outputOptions.chunkLoading === "string" &&
      ["require", "async-node"].includes(compilation.outputOptions.chunkLoading)
    ) {
      this.warnOnce(
        compilation,
        "This plugin is not useful for non-web targets."
      );
      return;
    }

    compilation.hooks.processAssets.tap(
      {
        name: thisPluginName,
        stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
      },
      (records: Record<string, sources.Source>) => {
        return this.processAssets(compilation, records);
      }
    );

    compilation.hooks.afterProcessAssets.tap(
      thisPluginName,
      (records: Record<string, sources.Source>) => {
        Object.keys(records).forEach((assetName) => {
          if (
            records[assetName].source().includes(placeholderPrefix) &&
            !assetName.endsWith(".map") // FIXME
          ) {
            this.errorOnce(
              compilation,
              `Asset ${assetName} contains unresolved integrity placeholders`
            );
          }
        });
      }
    );

    optimize.RealContentHashPlugin.getCompilationHooks(
      compilation
    ).updateHash.tap(thisPluginName, (input, oldHash) => {
      const assetKey = this.inverseAssetIntegrity.get(oldHash);
      if (assetKey && input.length === 1) {
        const newIntegrity = computeIntegrity(
          this.options.hashFuncNames,
          input[0]
        );
        this.inverseAssetIntegrity.delete(oldHash);
        this.assetIntegrity.delete(assetKey);
        this.updateAssetIntegrity(assetKey, newIntegrity);

        return newIntegrity;
      }
      return oldHash;
    });

    if (getHtmlWebpackPluginHooks) {
      getHtmlWebpackPluginHooks(
        compilation
      ).beforeAssetTagGeneration.tapPromise(
        thisPluginName,
        async (pluginArgs) => {
          this.hwpPublicPath = pluginArgs.assets.publicPath;

          (["js", "css"] as (keyof TemplateFiles)[]).forEach((fileType) => {
            (pluginArgs.assets as any)[
              fileType + "Integrity"
            ] = (pluginArgs.assets as TemplateFiles)[
              fileType
            ].map((filePath: string) =>
              this.getIntegrityChecksumForAsset(
                compilation.assets,
                this.hwpAssetPath(filePath)
              )
            );
          });

          return pluginArgs;
        }
      );

      getHtmlWebpackPluginHooks(compilation).alterAssetTagGroups.tapPromise(
        {
          name: thisPluginName,
          stage: 10000,
        },
        async (data) => {
          this.addMissingIntegrityHashes(compilation.assets);

          data.headTags
            .concat(data.bodyTags)
            .forEach((tag: HtmlTagObject) => this.processTag(compilation, tag));

          return data;
        }
      );
    }

    const { mainTemplate } = compilation;

    mainTemplate.hooks.jsonpScript.tap(thisPluginName, (source: string) =>
      this.addAttribute(compilation, "script", source)
    );
    mainTemplate.hooks.linkPreload.tap(thisPluginName, (source: string) =>
      this.addAttribute(compilation, "link", source)
    );
    mainTemplate.hooks.localVars.tap(thisPluginName, (source, chunk) => {
      const allChunks = findChunks(chunk);
      const includedChunks = chunk.getChunkMaps(false).hash;

      if (Object.keys(includedChunks).length > 0) {
        return Template.asString([
          source,
          "__webpack_require__.sriHashes = " +
            JSON.stringify(
              Array.from(allChunks).reduce((sriHashes, depChunk: Chunk) => {
                if (
                  depChunk.id !== null &&
                  includedChunks[depChunk.id.toString()]
                ) {
                  sriHashes[depChunk.id] = makePlaceholder(
                    this.options.hashFuncNames,
                    depChunk.id
                  );
                }
                return sriHashes;
              }, {} as { [key: string]: string })
            ) +
            ";",
        ]);
      }

      return source;
    });
  };

  /**
   * @internal
   */
  private validateOptions = (compilation: Compilation) => {
    if (
      this.isEnabled(compilation) &&
      !compilation.compiler.options.output.crossOriginLoading
    ) {
      this.warnOnce(
        compilation,
        'SRI requires a cross-origin policy, defaulting to "anonymous". ' +
          "Set webpack option output.crossOriginLoading to a value other than false " +
          "to make this warning go away. " +
          "See https://w3c.github.io/webappsec-subresource-integrity/#cross-origin-data-leakage"
      );
    }
    return this.validateHashFuncNames(compilation);
  };

  /**
   * @internal
   */
  private validateHashFuncNames = (compilation: Compilation): boolean => {
    if (!Array.isArray(this.options.hashFuncNames)) {
      this.error(
        compilation,
        "options.hashFuncNames must be an array of hash function names, " +
          "instead got '" +
          this.options.hashFuncNames +
          "'."
      );
      return false;
    } else if (this.options.hashFuncNames.length === 0) {
      this.error(compilation, "Must specify at least one hash function name.");
      return false;
    } else if (
      !this.options.hashFuncNames.every(
        this.validateHashFuncName.bind(this, compilation)
      )
    ) {
      return false;
    } else {
      this.warnStandardHashFunc(compilation);
      return true;
    }
  };

  /**
   * @internal
   */
  private warnStandardHashFunc = (compilation: Compilation) => {
    let foundStandardHashFunc = false;
    for (let i = 0; i < this.options.hashFuncNames.length; i += 1) {
      if (standardHashFuncNames.indexOf(this.options.hashFuncNames[i]) >= 0) {
        foundStandardHashFunc = true;
      }
    }
    if (!foundStandardHashFunc) {
      this.warnOnce(
        compilation,
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
  private validateHashFuncName = (
    compilation: Compilation,
    hashFuncName: string
  ) => {
    if (
      typeof hashFuncName !== "string" &&
      !((hashFuncName as unknown) instanceof String)
    ) {
      this.error(
        compilation,
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
      this.error(
        compilation,
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
        "DefaultStatsFactoryPlugin",
        (compilation: Compilation) => {
          compilation.hooks.statsFactory.tap(thisPluginName, (statsFactory) => {
            statsFactory.hooks.extract
              .for("asset")
              .tap(thisPluginName, (object, asset) => {
                if (this.assetIntegrity.has(asset.name)) {
                  (object as any).integrity = String(
                    this.assetIntegrity.get(asset.name)
                  );
                }
              });
          });
        }
      );
    });
  }
}
