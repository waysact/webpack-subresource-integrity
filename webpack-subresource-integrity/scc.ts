import type { Graph, StronglyConnectedComponent } from "./types";
import { assert } from "./util";

interface TarjanVertexMetadata {
  index: number;
  lowlink: number;
  onstack?: boolean;
}

class SccVerticesBuilder<T> {
  private vertices: Set<T>;
  private edges: Map<T, Set<T>>;

  private vertexMetadata = new Map<T, TarjanVertexMetadata>();
  private stack: T[] = [];
  private index = 0;
  private stronglyConnectedComponents = new Set<
    StronglyConnectedComponent<T>
  >();

  constructor({ vertices, edges }: Graph<T>) {
    this.vertices = vertices;
    this.edges = edges;

    for (const vertex of this.vertices) {
      if (!this.vertexMetadata.has(vertex)) {
        this.strongConnect(vertex);
      }
    }
  }

  public build(): Set<StronglyConnectedComponent<T>> {
    return this.stronglyConnectedComponents;
  }

  private strongConnectChildren(vertex: T, vertexData: TarjanVertexMetadata) {
    for (const child of this.edges.get(vertex) ?? []) {
      this.strongConnectChild(child, vertexData);
    }
  }

  private strongConnectChild(child: T, vertexData: TarjanVertexMetadata) {
    const childData = this.vertexMetadata.get(child);
    if (childData?.onstack === false) {
      return;
    }
    vertexData.lowlink = Math.min(
      vertexData.lowlink,
      childData
        ? // Child is in stack and hence in the current SCC
          // If child is not on stack, then (vertex, child) is an edge pointing to an SCC already found and must be ignored
          // Note: The next line may look odd - but is correct.
          // It says childData.index not childData.lowlink; that is deliberate and from the original paper
          childData.index
        : // Child has not yet been visited; recurse on it
          this.strongConnect(child).lowlink
    );
  }

  private strongConnect(vertex: T) {
    // Set the depth index for v to the smallest unused index
    const vertexData: TarjanVertexMetadata = {
      index: this.index,
      lowlink: this.index,
      onstack: true,
    };
    this.vertexMetadata.set(vertex, vertexData);
    this.index++;
    this.stack.push(vertex);

    this.strongConnectChildren(vertex, vertexData);

    // If vertex is a root node, pop the stack and generate an SCC
    if (vertexData.index === vertexData.lowlink) {
      const newStronglyConnectedComponent = { nodes: new Set<T>() };
      let currentNode: T | undefined;
      do {
        currentNode = this.stack.pop();
        assert(currentNode, "Working stack was empty");
        const metadata = this.vertexMetadata.get(currentNode);
        assert(metadata, "All nodes on stack should have metadata");
        metadata.onstack = false;
        newStronglyConnectedComponent.nodes.add(currentNode);
      } while (currentNode !== vertex);

      this.stronglyConnectedComponents.add(newStronglyConnectedComponent);
    }

    return vertexData;
  }
}

class SccEdgesBuilder<T> {
  private vertices: Set<StronglyConnectedComponent<T>>;
  private edges: Map<T, Set<T>>;
  private vertexToSCCMap = new Map<T, StronglyConnectedComponent<T>>();

  constructor(
    vertices: Set<StronglyConnectedComponent<T>>,
    edges: Map<T, Set<T>>
  ) {
    this.vertices = vertices;
    this.edges = edges;

    for (const scc of this.vertices) {
      for (const vertex of scc.nodes) {
        this.vertexToSCCMap.set(vertex, scc);
      }
    }
  }

  public build() {
    // Now that all SCCs have been identified, rebuild the graph
    const sccEdges = new Map<
      StronglyConnectedComponent<T>,
      Set<StronglyConnectedComponent<T>>
    >();

    for (const scc of this.vertices) {
      sccEdges.set(scc, this.getChildSCCNodes(scc));
    }

    return sccEdges;
  }

  private getChildSCCNodes(scc: StronglyConnectedComponent<T>) {
    const childSCCNodes = new Set<StronglyConnectedComponent<T>>();
    scc.nodes.forEach((vertex) => {
      const edge = this.edges.get(vertex);
      if (!edge) {
        return;
      }
      edge.forEach((childVertex) => {
        const childScc = this.vertexToSCCMap.get(childVertex);
        if (childScc && childScc !== scc) {
          childSCCNodes.add(childScc);
        }
      });
    });
    return childSCCNodes;
  }
}

/**
 * Tarjan's strongly connected components algorithm
 * https://en.wikipedia.org/wiki/Tarjan%27s_strongly_connected_components_algorithm
 */
export function createDAGfromGraph<T>(
  graph: Graph<T>
): Graph<StronglyConnectedComponent<T>> {
  const vertices = new SccVerticesBuilder(graph).build();
  const edges = new SccEdgesBuilder(vertices, graph.edges).build();
  return { vertices, edges };
}
