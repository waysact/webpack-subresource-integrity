import { Graph, StronglyConnectedComponent } from "./types";
import {
  addIfNotExist,
  ChunkGroup,
  map,
  flatMap,
  intersect,
  intersectSets,
  unionSet,
  allChunksInChunkIterable,
  allChunksInPrimaryChunkIterable,
  sriHashVariableReference,
} from "./util";
import { createDAGfromGraph } from "./scc";
import { RuntimeModule, Template, Chunk } from "webpack";

// This implementation assumes a directed acyclic graph (such as one produced by createDAGfromGraph),
// and does not attempt to detect cycles
function topologicalSort<T>({ vertices, edges }: Graph<T>): T[] {
  const sortedItems: T[] = [];
  const seenNodes = new Set<T>();

  function visit(node: T) {
    if (addIfNotExist(seenNodes, node)) {
      return;
    }
    (edges.get(node) ?? []).forEach(visit);
    sortedItems.push(node);
  }

  vertices.forEach(visit);

  return sortedItems;
}

function buildTopologicallySortedChunkGraph(
  chunks: Iterable<Chunk>
): [
  sortedVertices: StronglyConnectedComponent<Chunk>[],
  sccGraph: Graph<StronglyConnectedComponent<Chunk>>,
  chunkToSccMap: Map<Chunk, StronglyConnectedComponent<Chunk>>
] {
  const vertices = new Set<Chunk>();
  const edges = new Map<Chunk, Set<Chunk>>();

  // Chunks should have *all* chunks, not simply entry chunks
  for (const vertex of chunks) {
    if (addIfNotExist(vertices, vertex)) {
      continue;
    }

    edges.set(vertex, new Set<Chunk>());
    for (const childChunk of allChunksInChunkIterable(vertex)) {
      edges.get(vertex)?.add(childChunk);
    }
  }

  const dag = createDAGfromGraph({ vertices, edges });
  const sortedVertices = topologicalSort(dag);
  const chunkToSccMap = new Map<Chunk, StronglyConnectedComponent<Chunk>>(
    flatMap(dag.vertices, (scc) => map(scc.nodes, (chunk) => [chunk, scc]))
  );

  return [sortedVertices, dag, chunkToSccMap];
}

class ChunkToManifestMapBuilder {
  private sortedVertices: StronglyConnectedComponent<Chunk>[];
  private chunkToSccMap: Map<Chunk, StronglyConnectedComponent<Chunk>>;
  private manifest: Map<Chunk, Set<Chunk>>;

  // This map tracks which hashes a chunk group has in its manifest and the intersection
  // of all its parents (and intersection of all their parents, etc.)
  // This is meant as a guarantee that the hash for a given chunk is handled by a chunk group
  // or its parents regardless of the tree traversal used from the roots
  private hashesByChunkGroupAndParents = new Map<ChunkGroup, Set<Chunk>>();

  constructor(chunks: Iterable<Chunk>) {
    const [sortedVertices, , chunkToSccMap] =
      buildTopologicallySortedChunkGraph(chunks);
    this.sortedVertices = sortedVertices;
    this.chunkToSccMap = chunkToSccMap;
    this.manifest = this.createManifest();
  }

  public build(): [
    sortedVertices: StronglyConnectedComponent<Chunk>[],
    chunkManifest: Map<Chunk, Set<Chunk>>
  ] {
    return [this.sortedVertices, this.manifest];
  }

  private createManifest() {
    // A map of what child chunks a given chunk should contain hashes for
    // We want to walk from the root nodes down to the leaves
    return this.sortedVertices.reduceRight((manifest, vertex) => {
      for (const chunk of vertex.nodes) {
        manifest.set(chunk, this.createChunkManifest(chunk));
      }
      return manifest;
    }, new Map<Chunk, Set<Chunk>>());
  }

  private createChunkManifest(chunk: Chunk) {
    const manifest = this.getChildChunksToAddToChunkManifest(chunk);

    for (const manifestEntry of this.findIntersectionOfParentSets(chunk)) {
      manifest.delete(manifestEntry);
    }

    const combinedParentManifest = this.findIntersectionOfParentSets(chunk);
    for (const chunk of manifest) {
      if (combinedParentManifest.has(chunk)) {
        manifest.delete(chunk);
      } else {
        combinedParentManifest.add(chunk);
      }
    }

    this.addGroupCombinedManifest(chunk, manifest);

    return manifest;
  }

  private addGroupCombinedManifest(chunk: Chunk, manifest: Set<Chunk>) {
    for (const group of chunk.groupsIterable) {
      this.hashesByChunkGroupAndParents.set(
        group,
        unionSet(
          // Intersection of all parent manifests
          intersect(
            map(
              group.parentsIterable,
              (parent) =>
                this.hashesByChunkGroupAndParents.get(parent) ??
                new Set<Chunk>()
            )
          ),
          // Add this chunk's manifest
          manifest,
          // Add any existing manifests part of the group
          this.hashesByChunkGroupAndParents.get(group) ?? new Set<Chunk>()
        )
      );
    }
  }

  private findIntersectionOfParentSets(chunk: Chunk): Set<Chunk> {
    const setsToIntersect: Set<Chunk>[] = [];
    for (const group of chunk.groupsIterable) {
      for (const parent of group.parentsIterable) {
        setsToIntersect.push(
          this.hashesByChunkGroupAndParents.get(parent) ?? new Set<Chunk>()
        );
      }
    }

    return intersectSets(setsToIntersect);
  }

  private getChildChunksToAddToChunkManifest(chunk: Chunk): Set<Chunk> {
    const childChunks = new Set<Chunk>();
    const chunkSCC = this.chunkToSccMap.get(chunk);

    for (const childChunk of allChunksInPrimaryChunkIterable(chunk)) {
      const childChunkSCC = this.chunkToSccMap.get(childChunk);
      if (childChunkSCC === chunkSCC) {
        // Don't include your own SCC.
        // Your parent will have the hashes for your SCC siblings
        continue;
      }
      for (const childChunkSccNode of childChunkSCC?.nodes ?? []) {
        childChunks.add(childChunkSccNode);
      }
    }

    return childChunks;
  }
}

export function getChunkToManifestMap(
  chunks: Iterable<Chunk>
): [
  sortedVertices: StronglyConnectedComponent<Chunk>[],
  chunkManifest: Map<Chunk, Set<Chunk>>
] {
  return new ChunkToManifestMapBuilder(chunks).build();
}

export class AddLazySriRuntimeModule extends RuntimeModule {
  private sriHashes: unknown;

  constructor(sriHashes: unknown, chunkName: string | number) {
    super(
      `webpack-subresource-integrity lazy hashes for direct children of chunk ${chunkName}`
    );
    this.sriHashes = sriHashes;
  }

  override generate(): string {
    return Template.asString([
      `Object.assign(${sriHashVariableReference}, ${JSON.stringify(
        this.sriHashes
      )});`,
    ]);
  }
}
