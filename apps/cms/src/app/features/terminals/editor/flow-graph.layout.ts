import dagre from 'dagre';
import type { EdgeKind, FlowGraph } from './flow-graph.model';

export interface PositionedNode {
  id: string;
  /** Top-left corner (dagre reports centres; converted here). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** True for red ghost boxes standing in for a broken target. */
  ghost: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface PositionedEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  label: string;
  points: Point[];
  labelX: number;
  labelY: number;
}

export interface FlowLayout {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  width: number;
  height: number;
}

export const NODE_WIDTH = 150;
export const NODE_HEIGHT = 52;

/**
 * Maps a derived {@link FlowGraph} to positioned nodes and edges using dagre with
 * `rankdir: 'LR'`. Broken targets become ghost nodes so the broken edge has an
 * endpoint. Layout is pure position computation — dagre never touches the DOM.
 */
export function layoutFlowGraph(graph: FlowGraph): FlowLayout {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: 'LR', nodesep: 28, ranksep: 60, marginx: 16, marginy: 16 });
  g.setDefaultEdgeLabel(() => ({}));

  const ghostIds = new Set(graph.broken.map((b) => b.to));
  for (const node of graph.nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const ghostId of ghostIds) {
    g.setNode(ghostId, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  graph.edges.forEach((edge, i) => {
    // Multigraph name keyed by index so parallel edges (same from/to) survive.
    g.setEdge(edge.from, edge.to, {}, `e${i}`);
  });

  dagre.layout(g);

  const nodes: PositionedNode[] = g.nodes().map((id) => {
    const n = g.node(id);
    return {
      id,
      x: n.x - n.width / 2,
      y: n.y - n.height / 2,
      width: n.width,
      height: n.height,
      ghost: ghostIds.has(id),
    };
  });

  const edges: PositionedEdge[] = graph.edges.map((edge, i) => {
    const e = g.edge(edge.from, edge.to, `e${i}`);
    const points: Point[] = e?.points ?? [];
    const mid = points.length ? points[Math.floor(points.length / 2)] : { x: 0, y: 0 };
    return {
      from: edge.from,
      to: edge.to,
      kind: edge.kind,
      label: edge.label,
      points,
      labelX: mid.x,
      labelY: mid.y,
    };
  });

  const graphLabel = g.graph();
  return {
    nodes,
    edges,
    width: graphLabel.width ?? 0,
    height: graphLabel.height ?? 0,
  };
}
