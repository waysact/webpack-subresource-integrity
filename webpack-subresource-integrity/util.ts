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

export function generateSriHashPlaceholders(
  chunks: Iterable<Chunk>,
  hashFuncNames: [string, ...string[]]
) {
  return Array.from(chunks).reduce((sriHashes, depChunk: Chunk) => {
    if (depChunk.id) {
      sriHashes[depChunk.id] = makePlaceholder(hashFuncNames, depChunk.id);
    }
    return sriHashes;
  }, {} as { [key: string]: string });
}

export interface Graph<T> {
  vertices: Set<T>;
  edges: Map<T, Set<T>>;
}

export function buildTopologicallySortedChunkGraph(
  chunks: Iterable<Chunk>
): [
  sortedVertices: StronglyConnectedComponent<Chunk>[],
  sccGraph: Graph<StronglyConnectedComponent<Chunk>>,
  chunkToSccMap: Map<Chunk, StronglyConnectedComponent<Chunk>>
] {
  const queue = [...chunks];
  const vertices = new Set<Chunk>();
  const edges = new Map<Chunk, Set<Chunk>>();

  while (queue.length) {
    const vertex = queue.pop()!;
    if (vertices.has(vertex)) {
      continue;
    }
    vertices.add(vertex);
    edges.set(vertex, new Set<Chunk>());
    for (const vertexGroup of vertex.groupsIterable) {
      for (const childGroup of vertexGroup.childrenIterable) {
        for (const childChunk of childGroup.chunks) {
          edges.get(vertex)?.add(childChunk);
          if (!vertices.has(childChunk)) {
            queue.push(childChunk);
          }
        }
      }
    }
  }

  const dag = createDAGfromGraph({ vertices, edges });
  const sortedVertices = topologicalSort(dag);
  const chunkToSccMap = new Map<Chunk, StronglyConnectedComponent<Chunk>>(
    [...dag.vertices].flatMap((scc) =>
      [...scc.nodes].map((chunk) => [chunk, scc])
    )
  );

  return [sortedVertices, dag, chunkToSccMap];
}

export interface StronglyConnectedComponent<T> {
  nodes: Set<T>;
}

interface TarjanVertexMetadata {
  index?: number;
  lowlink?: number;
  onstack?: boolean;
}

/**
 * Tarjan's strongly connected components algorithm
 * https://en.wikipedia.org/wiki/Tarjan%27s_strongly_connected_components_algorithm
 */
function createDAGfromGraph<T>({
  vertices,
  edges,
}: Graph<T>): Graph<StronglyConnectedComponent<T>> {
  let index = 0;
  const stack: T[] = [];
  const vertexMetadata = new Map<T, TarjanVertexMetadata>(
    [...vertices].map((vertex) => [vertex, {}])
  );

  const stronglyConnectedComponents = new Set<StronglyConnectedComponent<T>>();

  for (const vertex of vertices) {
    if (vertexMetadata.get(vertex)!.index === undefined) {
      strongConnect(vertex);
    }
  }

  function strongConnect(vertex: T) {
    // Set the depth index for v to the smallest unused index
    const vertexData = vertexMetadata.get(vertex)!;
    vertexData.index = index;
    vertexData.lowlink = index;
    index++;
    stack.push(vertex);
    vertexData.onstack = true;

    for (const child of edges.get(vertex) ?? []) {
      const childData = vertexMetadata.get(child)!;
      if (childData.index === undefined) {
        // Child has not yet been visited; recurse on it
        strongConnect(child);
        vertexData.lowlink = Math.min(vertexData.lowlink, childData.lowlink!);
      } else if (childData.onstack) {
        // Child is in stack and hence in the current SCC
        // If child is not on stack, then (vertex, child) is an edge pointing to an SCC already found and must be ignored
        // Note: The next line may look odd - but is correct.
        // It says childData.index not childData.lowlink; that is deliberate and from the original paper
        vertexData.lowlink = Math.min(vertexData.lowlink, childData.index);
      }
    }

    // If vertex is a root node, pop the stack and generate an SCC
    if (vertexData.index === vertexData.lowlink) {
      const newStronglyConnectedComponent = { nodes: new Set<T>() };
      let currentNode: T;
      do {
        currentNode = stack.pop()!;
        vertexMetadata.get(currentNode)!.onstack = false;
        newStronglyConnectedComponent.nodes.add(currentNode);
      } while (currentNode !== vertex);

      stronglyConnectedComponents.add(newStronglyConnectedComponent);
    }
  }

  // Now that all SCCs have been identified, rebuild the graph
  const vertexToSCCMap = new Map<T, StronglyConnectedComponent<T>>();
  const sccEdges = new Map<
    StronglyConnectedComponent<T>,
    Set<StronglyConnectedComponent<T>>
  >();

  for (const scc of stronglyConnectedComponents) {
    for (const vertex of scc.nodes) {
      vertexToSCCMap.set(vertex, scc);
    }
  }

  for (const scc of stronglyConnectedComponents) {
    const childSCCNodes = new Set<StronglyConnectedComponent<T>>();
    for (const vertex of scc.nodes) {
      for (const childVertex of edges.get(vertex) ?? []) {
        const childScc = vertexToSCCMap.get(childVertex);
        if (childScc && childScc !== scc) {
          childSCCNodes.add(childScc);
        }
      }
    }
    sccEdges.set(scc, childSCCNodes);
  }

  return { vertices: stronglyConnectedComponents, edges: sccEdges };
}

// This implementation assumes a directed acyclic graph (such as one produce by createDAGfromGraph),
// and does not attempt to detect cycles
function topologicalSort<T>({ vertices, edges }: Graph<T>): T[] {
  const sortedItems: T[] = [];

  const seenNodes = new Set<T>();

  function visit(node: T) {
    if (seenNodes.has(node)) {
      return;
    }

    seenNodes.add(node);

    for (const child of edges.get(node) ?? []) {
      visit(child);
    }

    sortedItems.push(node);
  }

  for (const vertex of vertices) {
    visit(vertex);
  }

  return sortedItems;
}
