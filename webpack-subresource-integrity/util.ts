/**
 * Copyright (c) 2015-present, Waysact Pty Ltd
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "crypto";
import type { Chunk, Compilation } from "webpack";
import { sep } from "path";
import { HtmlTagObject } from "./types";

type ChunkGroup = ReturnType<Compilation["addChunkInGroup"]>;

export function getTagSrc(tag: HtmlTagObject): string | undefined {
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

export const normalizePath = (p: string): string =>
  p.replace(/\?.*$/, "").split(sep).join("/");

export const placeholderPrefix = "*-*-*-CHUNK-SRI-HASH-";

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

export const makePlaceholder = (
  hashFuncNames: string[],
  id: string | number
): string => {
  const placeholder = `${placeholderPrefix}${id}`;
  const filler = computeIntegrity(hashFuncNames, placeholder);
  return placeholderPrefix + filler.substring(placeholderPrefix.length);
};

export function findChunks(chunk: Chunk): Set<Chunk> {
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

export function notNil<TValue>(
  value: TValue | null | undefined
): value is TValue {
  return value !== null && value !== undefined;
}
