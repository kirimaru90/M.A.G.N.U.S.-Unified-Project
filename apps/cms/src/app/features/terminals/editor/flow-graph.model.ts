import type { NodeComponent, TerminalContent, TerminalNode } from '../../../domain/terminal-schema';

// ── Types ─────────────────────────────────────────────────────────────────────

export type EdgeKind = 'direct' | 'cond' | 'back' | 'broken';

export interface FlowNode {
  id: string;
  hasLogin: boolean;
  hasVariants: boolean;
  hasInput: boolean;
  hasOnEnter: boolean;
  snippet: string;
}

export interface FlowEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  label: string;
}

export interface BrokenTarget {
  from: string;
  to: string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** `'start'` when a boot node exists, otherwise `null` (panel warns). */
  entryId: string | null;
  /** Node ids no path from `entryId` reaches. */
  unreachable: string[];
  /** Edges whose `to` matches no node id. */
  broken: BrokenTarget[];
}

const ENTRY_ID = 'start';
const SNIPPET_MAX = 60;

// ── Derivation ────────────────────────────────────────────────────────────────

/**
 * Pure projection of a terminal's content into a flow graph. Nodes are the
 * terminal's node ids; edges are every `target` reachable from a node's choices,
 * its variants' choices, and its input-component branches (node-level and
 * per-variant). Kept DOM-free so it is unit-testable in isolation.
 */
export function deriveFlowGraph(content: TerminalContent): FlowGraph {
  const entries = Object.entries(content.nodes);
  const nodeIds = new Set(entries.map(([id]) => id));

  const nodes: FlowNode[] = entries.map(([id, node]) => ({
    id,
    hasLogin: !!node.login?.users?.length,
    hasVariants: !!node.variants?.length,
    hasInput: nodeHasInput(node),
    hasOnEnter: !!node.on_enter?.length,
    snippet: makeSnippet(node.text),
  }));

  const edges: FlowEdge[] = [];
  for (const [id, node] of entries) {
    collectNodeEdges(id, node, edges);
  }

  // Broken-target pass: an edge whose `to` is not a node id.
  const broken: BrokenTarget[] = [];
  for (const edge of edges) {
    if (!nodeIds.has(edge.to)) {
      edge.kind = 'broken';
      broken.push({ from: edge.from, to: edge.to });
    }
  }

  // Back-edge pass: tag edges that close a cycle (target on the DFS stack).
  tagBackEdges(nodeIds, edges);

  // Reachability: BFS from `entryId` over non-broken edges.
  const entryId = nodeIds.has(ENTRY_ID) ? ENTRY_ID : null;
  const reachable = computeReachable(entryId, edges);
  const unreachable = entries.map(([id]) => id).filter((id) => !reachable.has(id));

  return { nodes, edges, entryId, unreachable, broken };
}

// ── Edge extraction ───────────────────────────────────────────────────────────

function collectNodeEdges(from: string, node: TerminalNode, out: FlowEdge[]): void {
  // node.choices[] — direct unless the choice carries a `when`.
  for (const choice of node.choices ?? []) {
    out.push({ from, to: choice.target, kind: choice.when ? 'cond' : 'direct', label: choice.label });
  }
  // node.components[](input).branches[] — always conditional (branch-guarded).
  collectComponentEdges(from, node.components, out);
  // node.variants[] — choices and components are variant-guarded, always conditional.
  for (const variant of node.variants ?? []) {
    for (const choice of variant.choices ?? []) {
      out.push({ from, to: choice.target, kind: 'cond', label: choice.label });
    }
    collectComponentEdges(from, variant.components, out);
  }
}

function collectComponentEdges(from: string, components: NodeComponent[] | undefined, out: FlowEdge[]): void {
  for (const component of components ?? []) {
    for (const branch of component.branches ?? []) {
      out.push({ from, to: branch.target, kind: 'cond', label: '' });
    }
  }
}

function nodeHasInput(node: TerminalNode): boolean {
  if (node.components?.some((c) => c.type === 'input')) return true;
  return !!node.variants?.some((v) => v.components?.some((c) => c.type === 'input'));
}

function makeSnippet(text: string | undefined): string {
  const trimmed = (text ?? '').replace(/\s+/g, ' ').trim();
  return trimmed.length > SNIPPET_MAX ? `${trimmed.slice(0, SNIPPET_MAX - 1)}…` : trimmed;
}

// ── Back-edge tagging ─────────────────────────────────────────────────────────

/**
 * DFS over the (non-broken) graph; an edge whose target is currently on the
 * recursion stack closes a cycle and is tagged `back`.
 */
function tagBackEdges(nodeIds: Set<string>, edges: FlowEdge[]): void {
  const adjacency = new Map<string, FlowEdge[]>();
  for (const id of nodeIds) adjacency.set(id, []);
  for (const edge of edges) {
    if (edge.kind !== 'broken') adjacency.get(edge.from)?.push(edge);
  }

  const visited = new Set<string>();
  const onStack = new Set<string>();

  const visit = (id: string): void => {
    visited.add(id);
    onStack.add(id);
    for (const edge of adjacency.get(id) ?? []) {
      if (onStack.has(edge.to)) {
        edge.kind = 'back';
      } else if (!visited.has(edge.to)) {
        visit(edge.to);
      }
    }
    onStack.delete(id);
  };

  // Start from `start` if present so the traversal order matches the emulator's,
  // then cover any remaining components.
  if (nodeIds.has(ENTRY_ID)) visit(ENTRY_ID);
  for (const id of nodeIds) {
    if (!visited.has(id)) visit(id);
  }
}

// ── Reachability ──────────────────────────────────────────────────────────────

function computeReachable(entryId: string | null, edges: FlowEdge[]): Set<string> {
  const reachable = new Set<string>();
  if (!entryId) return reachable;

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.kind === 'broken') continue;
    const list = adjacency.get(edge.from);
    if (list) list.push(edge.to);
    else adjacency.set(edge.from, [edge.to]);
  }

  const queue: string[] = [entryId];
  reachable.add(entryId);
  while (queue.length) {
    const id = queue.shift() as string;
    for (const to of adjacency.get(id) ?? []) {
      if (!reachable.has(to)) {
        reachable.add(to);
        queue.push(to);
      }
    }
  }
  return reachable;
}
