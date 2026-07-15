import { describe, it, expect } from 'vitest';
import {
  fitToWidthZoom,
  NODE_HEIGHT,
  NODE_WIDTH,
  scaleLayout,
  ZOOM_MAX,
  type FlowLayout,
  type Point,
  type PositionedNode,
} from './flow-graph.layout';

function node(id: string, x: number, y: number): PositionedNode {
  return { id, x, y, width: NODE_WIDTH, height: NODE_HEIGHT, ghost: false };
}

/** True when `p` lies on the perimeter of node `n` (within tolerance). */
function onBorder(p: Point, n: PositionedNode, tol = 0.01): boolean {
  const left = n.x;
  const right = n.x + n.width;
  const top = n.y;
  const bottom = n.y + n.height;
  const onVertical =
    (Math.abs(p.x - left) < tol || Math.abs(p.x - right) < tol) && p.y >= top - tol && p.y <= bottom + tol;
  const onHorizontal =
    (Math.abs(p.y - top) < tol || Math.abs(p.y - bottom) < tol) && p.x >= left - tol && p.x <= right + tol;
  return onVertical || onHorizontal;
}

describe('scaleLayout', () => {
  it('scales positions, points, labels, and canvas by z while keeping box size constant', () => {
    const layout: FlowLayout = {
      nodes: [node('a', 0, 0), node('b', 300, 0)],
      edges: [
        {
          from: 'a',
          to: 'b',
          kind: 'direct',
          label: 'Vai',
          points: [
            { x: 150, y: 26 },
            { x: 300, y: 26 },
          ],
          labelX: 225,
          labelY: 26,
        },
      ],
      width: 450,
      height: 52,
    };

    const scaled = scaleLayout(layout, 2);

    // Node positions scale...
    expect(scaled.nodes[1].x).toBe(600);
    // ...but box size stays constant.
    expect(scaled.nodes[0].width).toBe(NODE_WIDTH);
    expect(scaled.nodes[0].height).toBe(NODE_HEIGHT);

    // Canvas and label positions scale.
    expect(scaled.width).toBe(900);
    expect(scaled.height).toBe(104);
    expect(scaled.edges[0].labelX).toBe(450);
    expect(scaled.edges[0].labelY).toBe(52);
  });

  it('trims a straight edge back onto the source/target box borders', () => {
    const layout: FlowLayout = {
      nodes: [node('a', 0, 0), node('b', 300, 0)],
      edges: [
        {
          from: 'a',
          to: 'b',
          kind: 'direct',
          label: '',
          points: [
            { x: 150, y: 26 },
            { x: 300, y: 26 },
          ],
          labelX: 225,
          labelY: 26,
        },
      ],
      width: 450,
      height: 52,
    };

    const scaled = scaleLayout(layout, 2);
    const pts = scaled.edges[0].points;
    expect(onBorder(pts[0], scaled.nodes[0])).toBe(true);
    expect(onBorder(pts[pts.length - 1], scaled.nodes[1])).toBe(true);
  });

  it('trims an L-shaped (multi-bend) edge back onto the box borders', () => {
    const layout: FlowLayout = {
      nodes: [node('a', 0, 0), node('b', 300, 100)],
      edges: [
        {
          from: 'a',
          to: 'b',
          kind: 'cond',
          label: '',
          points: [
            { x: 150, y: 26 },
            { x: 225, y: 26 },
            { x: 225, y: 126 },
            { x: 300, y: 126 },
          ],
          labelX: 225,
          labelY: 76,
        },
      ],
      width: 450,
      height: 152,
    };

    const scaled = scaleLayout(layout, 1.5);
    const pts = scaled.edges[0].points;
    expect(onBorder(pts[0], scaled.nodes[0])).toBe(true);
    expect(onBorder(pts[pts.length - 1], scaled.nodes[1])).toBe(true);
  });
});

describe('fitToWidthZoom', () => {
  it('spreads a narrow graph above 1×', () => {
    expect(fitToWidthZoom(400, 800, ZOOM_MAX)).toBeCloseTo(2);
  });

  it('clamps a graph already wider than the container to exactly 1×', () => {
    expect(fitToWidthZoom(1000, 500, ZOOM_MAX)).toBe(1);
  });

  it('never exceeds max', () => {
    expect(fitToWidthZoom(100, 900, ZOOM_MAX)).toBe(ZOOM_MAX);
  });
});
