/**
 * Copyright (c) 2015-present, Waysact Pty Ltd
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AssetInfo, Chunk, Compiler, Compilation, sources } from "webpack";
import { relative, join } from "path";
import { readFileSync } from "fs";
import {
  HtmlTagObject,
  SubresourceIntegrityPluginResolvedOptions,
  StronglyConnectedComponent,
  AssetType,
  TemplateFiles,
  HWPAssets,
  WSIHWPAssets,
  WSIHWPAssetsIntegrityKey,
} from "./types";
import { Reporter } from "./reporter";
import {
  assert,
  computeIntegrity,
  makePlaceholder,
  findChunks,
  normalizePath,
  getTagSrc,
  notNil,
  sriHashVariableReference,
  updateAsset,
  tryGetSource,
  replaceInSource,
  usesAnyHash,
  normalizeChunkId,
} from "./util";
import { getChunkToManifestMap } from "./manifest";
import { AssetIntegrity } from "./integrity";

const assetTypeIntegrityKeys: [AssetType, WSIHWPAssetsIntegrityKey][] = [
  ["js", "jsIntegrity"],
  ["css", "cssIntegrity"],
];

export class Plugin {
  /**
   * @internal
   */
  private readonly compilation: Compilation;

  /**
   * @internal
   */
  private readonly options: SubresourceIntegrityPluginResolvedOptions;

  /**
   * @internal
   */
  private readonly reporter: Reporter;

  /**
   * @internal
   */
  private assetIntegrity: AssetIntegrity;

  /**
   * @internal
   */
  private hwpPublicPath: string | null = null;

  /**
   * @internal
   */
  private sortedSccChunks: StronglyConnectedComponent<Chunk>[] = [];

  /**
   * @internal
   */
  private chunkManifest: Map<Chunk, Set<Chunk>> = new Map<Chunk, Set<Chunk>>();

  /**
   * @internal
   */
  private hashByPlaceholder = new Map<string, string>();

  public constructor(
    compilation: Compilation,
    options: SubresourceIntegrityPluginResolvedOptions,
    reporter: Reporter
  ) {
    this.compilation = compilation;
    this.options = options;
    this.reporter = reporter;

    this.assetIntegrity = new AssetIntegrity(this.options.hashFuncNames);
  }

  /**
   * @internal
   */
  private warnIfHotUpdate(source: string | Buffer): void {
    if (source.indexOf("webpackHotUpdate") >= 0) {
      this.reporter.warnHotReloading();
    }
  }

  /**
   * @internal
   */
  addMissingIntegrityHashes = (
    assets: Record<string, sources.Source>
  ): void => {
    Object.entries(assets).forEach(([assetKey, asset]) => {
      const source = tryGetSource(asset);
      if (source && !this.assetIntegrity.has(assetKey)) {
        this.assetIntegrity.updateFromSource(assetKey, source);
      }
    });
  };

  /**
   * @internal
   */
  private replaceAsset = (
    compiler: Compiler,
    assets: Record<string, sources.Source>,
    hashByPlaceholder: Map<string, string>,
    chunkFile: string
  ): sources.Source => {
    const asset = assets[chunkFile];
    assert(asset, `Missing asset for file ${chunkFile}`);
    return replaceInSource(compiler, asset, chunkFile, hashByPlaceholder);
  };

  private warnAboutLongTermCaching = (assetInfo: AssetInfo) => {
    if (
      usesAnyHash(assetInfo) &&
      !(
        assetInfo.contenthash &&
        this.compilation.compiler.options.optimization.realContentHash
      )
    ) {
      this.reporter.warnContentHash();
    }
  };

  /**
   * @internal
   */
  private processChunk = (
    chunk: Chunk,
    assets: Record<string, sources.Source>
  ): void => {
    Array.from(findChunks(chunk))
      .reverse()
      .forEach((chunk) => this.processChunkAssets(chunk, assets));
  };

  private processChunkAssets = (
    childChunk: Chunk,
    assets: Record<string, sources.Source>
  ) => {
    Array.from(childChunk.files).forEach((sourcePath) => {
      const asset = assets[sourcePath];
      if (asset) {
        this.warnIfHotUpdate(asset.source());
        const newAsset = this.replaceAsset(
          this.compilation.compiler,
          assets,
          this.hashByPlaceholder,
          sourcePath
        );
        const integrity = this.assetIntegrity.updateFromSource(
          sourcePath,
          newAsset.source()
        );

        if (childChunk.id !== null) {
          this.hashByPlaceholder.set(
            makePlaceholder(
              this.options.hashFuncNames,
              normalizeChunkId(sourcePath, childChunk, this.compilation)
            ),
            integrity
          );
        }

        updateAsset(
          this.compilation,
          sourcePath,
          newAsset,
          integrity,
          this.warnAboutLongTermCaching
        );
      } else {
        this.reporter.warnNoAssetsFound(sourcePath, Object.keys(assets));
      }
    });
  };

  /**
   * @internal
   */
  addAttribute = (elName: string, source: string): string => {
    if (!this.compilation.outputOptions.crossOriginLoading) {
      this.reporter.errorCrossOriginLoadingNotSet();
    }

    return this.compilation.compiler.webpack.Template.asString([
      source,
      elName + `.integrity = ${sriHashVariableReference}[chunkId];`,
      elName +
        ".crossOrigin = " +
        JSON.stringify(this.compilation.outputOptions.crossOriginLoading) +
        ";",
    ]);
  };

  /**
   * @internal
   */
  processAssets = (assets: Record<string, sources.Source>): void => {
    if (this.options.hashLoading === "lazy") {
      for (const scc of this.sortedSccChunks) {
        for (const chunk of scc.nodes) {
          this.processChunkAssets(chunk, assets);
        }
      }
    } else {
      Array.from(this.compilation.chunks)
        .filter((chunk) => chunk.hasRuntime())
        .forEach((chunk) => {
          this.processChunk(chunk, assets);
        });
    }

    this.addMissingIntegrityHashes(assets);
  };

  /**
   * @internal
   */
  private hwpAssetPath = (src: string): string => {
    assert(this.hwpPublicPath !== null, "Missing HtmlWebpackPlugin publicPath");
    return relative(this.hwpPublicPath, decodeURIComponent(src));
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

    return normalizedKey ? this.assetIntegrity.get(normalizedKey) : undefined;
  };

  /**
   * @internal
   */
  processTag = (tag: HtmlTagObject): void => {
    if (
      tag.attributes &&
      Object.prototype.hasOwnProperty.call(tag.attributes, "integrity")
    ) {
      return;
    }

    const tagSrc = getTagSrc(tag);

    if (!tagSrc) {
      return;
    }

    const src = this.hwpAssetPath(tagSrc);

    tag.attributes["integrity"] =
      this.getIntegrityChecksumForAsset(this.compilation.assets, src) ||
      computeIntegrity(
        this.options.hashFuncNames,
        readFileSync(join(this.compilation.compiler.outputPath, src))
      );
    tag.attributes["crossorigin"] =
      this.compilation.compiler.options.output.crossOriginLoading ||
      "anonymous";
  };

  /**
   * @internal
   */
  beforeRuntimeRequirements = (): void => {
    if (this.options.hashLoading === "lazy") {
      const [sortedSccChunks, chunkManifest] = getChunkToManifestMap(
        this.compilation.chunks
      );
      this.sortedSccChunks = sortedSccChunks;
      this.chunkManifest = chunkManifest;
    }
    this.hashByPlaceholder.clear();
  };

  getChildChunksToAddToChunkManifest(chunk: Chunk): Set<Chunk> {
    return this.chunkManifest.get(chunk) ?? new Set<Chunk>();
  }

  handleHwpPluginArgs = ({ assets }: { assets: HWPAssets }): void => {
    this.hwpPublicPath = assets.publicPath;

    assetTypeIntegrityKeys.forEach(
      ([a, b]: [AssetType, WSIHWPAssetsIntegrityKey]) => {
        if (b) {
          (assets as WSIHWPAssets)[b] = (assets as TemplateFiles)[a]
            .map((filePath: string) =>
              this.getIntegrityChecksumForAsset(
                this.compilation.assets,
                this.hwpAssetPath(filePath)
              )
            )
            .filter(notNil);
        }
      }
    );
  };

  handleHwpBodyTags = ({
    headTags,
    bodyTags,
  }: {
    headTags: HtmlTagObject[];
    bodyTags: HtmlTagObject[];
  }): void => {
    this.addMissingIntegrityHashes(this.compilation.assets);

    headTags.concat(bodyTags).forEach(this.processTag);
  };

  public updateHash(input: Buffer[], oldHash: string): string | undefined {
    return this.assetIntegrity.updateHash(input, oldHash);
  }
}
