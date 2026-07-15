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

/** Zoom bounds and step. Zoom scales layout spacing only; boxes/text stay constant size. */
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;
/** Multiplicative factor applied per wheel notch. */
export const ZOOM_WHEEL_STEP = 1.1;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

interface Rect {
  cx: number;
  cy: number;
  width: number;
  height: number;
}

/**
 * Point on the border of `rect` along the segment from the rect centre to
 * `point` (dagre-d3's intersectRect). Used to re-attach a scaled edge endpoint
 * to a constant-size box.
 */
function intersectRect(rect: Rect, point: Point): Point {
  const dx = point.x - rect.cx;
  const dy = point.y - rect.cy;
  let w = rect.width / 2;
  let h = rect.height / 2;
  let sx: number;
  let sy: number;
  if (Math.abs(dy) * w > Math.abs(dx) * h) {
    // Intersects the top or bottom edge.
    if (dy < 0) h = -h;
    sx = dy === 0 ? 0 : (h * dx) / dy;
    sy = h;
  } else {
    // Intersects the left or right edge.
    if (dx < 0) w = -w;
    sx = w;
    sy = dx === 0 ? 0 : (w * dy) / dx;
  }
  return { x: rect.cx + sx, y: rect.cy + sy };
}

/**
 * Scales layout spacing by `z`: node positions, edge points, label positions,
 * and the canvas box grow by `z`, while node `width`/`height` (and therefore the
 * on-screen box/text size) stay constant. Because the boxes keep their intrinsic
 * size, each edge's first/last point is trimmed back onto the source/target box
 * border along the incoming/outgoing segment so arrowheads stay attached.
 */
export function scaleLayout(layout: FlowLayout, z: number): FlowLayout {
  const nodes: PositionedNode[] = layout.nodes.map((n) => ({
    ...n,
    x: n.x * z,
    y: n.y * z,
    // width/height unchanged — boxes keep a constant on-screen size.
  }));

  const rectById = new Map<string, Rect>(
    nodes.map((n) => [n.id, { cx: n.x + n.width / 2, cy: n.y + n.height / 2, width: n.width, height: n.height }]),
  );

  const edges: PositionedEdge[] = layout.edges.map((e) => {
    const points: Point[] = e.points.map((p) => ({ x: p.x * z, y: p.y * z }));
    if (points.length >= 2) {
      // Capture neighbour references before mutating either endpoint.
      const nextFromStart: Point = { ...points[1] };
      const prevFromEnd: Point = { ...points[points.length - 2] };
      const src = rectById.get(e.from);
      const tgt = rectById.get(e.to);
      if (src) points[0] = intersectRect(src, nextFromStart);
      if (tgt) points[points.length - 1] = intersectRect(tgt, prevFromEnd);
    }
    return {
      ...e,
      points,
      labelX: e.labelX * z,
      labelY: e.labelY * z,
    };
  });

  return {
    nodes,
    edges,
    width: layout.width * z,
    height: layout.height * z,
  };
}

/**
 * Fit-to-width zoom: spreads a graph narrower than the container to fill it,
 * clamped to `[ZOOM_MIN, max]` so a graph already wider than the container stays
 * at 1× and scrolls.
 */
export function fitToWidthZoom(intrinsicWidth: number, containerWidth: number, max: number): number {
  if (intrinsicWidth <= 0 || containerWidth <= 0) return ZOOM_MIN;
  return clamp(containerWidth / intrinsicWidth, ZOOM_MIN, max);
}

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
