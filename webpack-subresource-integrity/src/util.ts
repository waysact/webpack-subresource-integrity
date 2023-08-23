/**
 * Copyright (c) 2015-present, Waysact Pty Ltd
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "crypto";
import type { AssetInfo, Chunk, Compilation, Compiler, sources } from "webpack";
import { sep } from "path";
import type { HtmlTagObject } from "./types";

export type ChunkGroup = ReturnType<Compilation["addChunkInGroup"]>;

export const sriHashVariableReference = "__webpack_require__.sriHashes";

export function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message);
  }
}

export function getTagSrc(tag: HtmlTagObject): string | undefined {
  if (!["script", "link"].includes(tag.tagName) || !tag.attributes) {
    return undefined;
  }
  if (typeof tag.attributes["href"] === "string") {
    return tag.attributes["href"];
  }
  if (typeof tag.attributes["src"] === "string") {
    return tag.attributes["src"];
  }
  return undefined;
}

export const normalizePath = (p: string): string =>
  p.replace(/\?.*$/, "").split(sep).join("/");

export const placeholderPrefix = "*-*-*-CHUNK-SRI-HASH-";

export const placeholderRegex = new RegExp(
  `${placeholderPrefix.replace(
    /[-*/\\]/g,
    "\\$&"
  )}[a-zA-Z0-9=/+]+(\\ssha\\d{3}-[a-zA-Z0-9=/+]+)*`,
  "g"
);

export const computeIntegrity = (
  hashFuncNames: string[],
  source: string | Buffer
): string => {
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

const placeholderCache: Record<string, string> = {};
export const makePlaceholder = (
  hashFuncNames: string[],
  id: string | number
): string => {
  const cacheKey = hashFuncNames.join() + id;
  const cachedPlaceholder = placeholderCache[cacheKey];
  if (cachedPlaceholder) return cachedPlaceholder;
  const placeholderSource = `${placeholderPrefix}${id}`;
  const filler = computeIntegrity(hashFuncNames, placeholderSource);
  const placeholder =
    placeholderPrefix + filler.substring(placeholderPrefix.length);
  placeholderCache[cacheKey] = placeholder;
  return placeholder;
};

export function addIfNotExist<T>(set: Set<T>, item: T): boolean {
  if (set.has(item)) return true;
  set.add(item);
  return false;
}
export function wmfSharedChunk(chunk: Chunk): boolean {
  return chunk.chunkReason === "split chunk (cache group: default)";
}

export function findChunks(chunk: Chunk): Set<Chunk> {
  const allChunks = new Set<Chunk>();
  const groupsVisited = new Set<string>();

  (function recurseChunk(childChunk: Chunk) {
    function recurseGroup(group: ChunkGroup) {
      if (addIfNotExist(groupsVisited, group.id)) return;
      group.chunks.forEach(recurseChunk);
      group.childrenIterable.forEach(recurseGroup);
    }

    if (wmfSharedChunk(childChunk) || addIfNotExist(allChunks, childChunk)) {
      return;
    }
    Array.from(childChunk.groupsIterable).forEach(recurseGroup);
  })(chunk);

  return allChunks;
}

export function notNil<TValue>(
  value: TValue | null | undefined
): value is TValue {
  return value !== null && value !== undefined;
}

export function generateSriHashPlaceholders(
  chunks: Iterable<Chunk>,
  hashFuncNames: [string, ...string[]]
): Record<string, string> {
  return Array.from(chunks).reduce((sriHashes, depChunk: Chunk) => {
    if (depChunk.id) {
      sriHashes[depChunk.id] = makePlaceholder(hashFuncNames, depChunk.id);
    }
    return sriHashes;
  }, {} as { [key: string]: string });
}

function allSetsHave<T>(sets: Iterable<Set<T>>, item: T) {
  for (const set of sets) {
    if (!set.has(item)) {
      return false;
    }
  }
  return true;
}

export function* intersect<T>(sets: Iterable<Set<T>>): Generator<T> {
  const { value: initialSet } = sets[Symbol.iterator]().next();
  if (!initialSet) {
    return;
  }

  initialSetLoop: for (const item of initialSet) {
    if (!allSetsHave(sets, item)) {
      continue initialSetLoop;
    }
    yield item;
  }
}

export function intersectSets<T>(setsToIntersect: Iterable<Set<T>>): Set<T> {
  return new Set<T>(intersect(setsToIntersect));
}

export function unionSet<T>(...sets: Iterable<T>[]): Set<T> {
  const result = new Set<T>();
  for (const set of sets) {
    for (const item of set) {
      result.add(item);
    }
  }
  return result;
}

export function* map<T, TResult>(
  items: Iterable<T>,
  fn: (item: T) => TResult
): Generator<TResult> {
  for (const item of items) {
    yield fn(item);
  }
}

export function* flatMap<T, TResult>(
  collections: Iterable<T>,
  fn: (item: T) => Iterable<TResult>
): Generator<TResult> {
  for (const item of collections) {
    for (const result of fn(item)) {
      yield result;
    }
  }
}

export function* allChunksInGroupIterable(
  chunkGroup: ChunkGroup
): Generator<Chunk> {
  for (const childGroup of chunkGroup.childrenIterable) {
    for (const childChunk of childGroup.chunks) {
      yield childChunk;
    }
  }
}

export function* allChunksInChunkIterable(chunk: Chunk): Generator<Chunk> {
  for (const group of chunk.groupsIterable) {
    for (const childChunk of allChunksInGroupIterable(group)) {
      yield childChunk;
    }
  }
}

export function* allChunksInPrimaryChunkIterable(
  chunk: Chunk
): Generator<Chunk> {
  for (const chunkGroup of chunk.groupsIterable) {
    if (chunkGroup.chunks[chunkGroup.chunks.length - 1] !== chunk) {
      // Only add sri hashes for one chunk per chunk group,
      // where the last chunk in the group is the primary chunk
      continue;
    }
    for (const childChunk of allChunksInGroupIterable(chunkGroup)) {
      yield childChunk;
    }
  }
}

export function updateAsset(
  compilation: Compilation,
  assetPath: string,
  source: sources.Source,
  integrity: string,
  onUpdate: (assetInfo: AssetInfo) => void
): void {
  compilation.updateAsset(assetPath, source, (assetInfo) => {
    if (!assetInfo) {
      return undefined;
    }

    onUpdate(assetInfo);

    return {
      ...assetInfo,
      contenthash: Array.isArray(assetInfo.contenthash)
        ? [...new Set([...assetInfo.contenthash, integrity])]
        : assetInfo.contenthash
        ? [assetInfo.contenthash, integrity]
        : integrity,
    };
  });
}

export function tryGetSource(
  source: sources.Source
): string | Buffer | undefined {
  try {
    return source.source();
  } catch (_) {
    return undefined;
  }
}

export function replaceInSource(
  compiler: Compiler,
  source: sources.Source,
  path: string,
  replacements: Map<string, string>
): sources.Source {
  const oldSource = source.source();
  if (typeof oldSource !== "string") {
    return source;
  }
  const newAsset = new compiler.webpack.sources.ReplaceSource(source, path);

  for (const match of oldSource.matchAll(placeholderRegex)) {
    const placeholder = match[0];
    const position = match.index;
    if (placeholder && position !== undefined) {
      newAsset.replace(
        position,
        position + placeholder.length - 1,
        replacements.get(placeholder) || placeholder
      );
    }
  }

  return newAsset;
}

export function usesAnyHash(assetInfo: AssetInfo): boolean {
  return !!(
    assetInfo.fullhash ||
    assetInfo.chunkhash ||
    assetInfo.modulehash ||
    assetInfo.contenthash
  );
}

export function hasOwnProperty<X extends object, Y extends PropertyKey>(
  obj: X,
  prop: Y
): obj is X & Record<Y, unknown> {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}
