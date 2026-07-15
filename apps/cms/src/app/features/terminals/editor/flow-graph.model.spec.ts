import { describe, it, expect } from 'vitest';
import { deriveFlowGraph } from './flow-graph.model';
import type { TerminalContent } from '../../../domain/terminal-schema';

function content(nodes: TerminalContent['nodes']): TerminalContent {
  return {
    meta: { title: 'T', public: false },
    state: { local: {}, global: {} },
    login: { users: [] },
    nodes,
  } as TerminalContent;
}

describe('deriveFlowGraph', () => {
  it('extracts a direct edge from an unconditional node-level choice', () => {
    const g = deriveFlowGraph(content({
      start: { choices: [{ label: 'Apri porta', target: 'door_check' }] },
      door_check: {},
    }));

    const edge = g.edges.find((e) => e.from === 'start' && e.to === 'door_check');
    expect(edge).toMatchObject({ kind: 'direct', label: 'Apri porta' });
  });

  it('marks a choice with a `when` as conditional', () => {
    const g = deriveFlowGraph(content({
      start: { choices: [{ label: 'Se acceso', target: 'lit', when: { var: 'power', op: 'eq', value: true } }] },
      lit: {},
    }));

    expect(g.edges.find((e) => e.to === 'lit')?.kind).toBe('cond');
  });

  it('extracts conditional edges from input-component branches', () => {
    const g = deriveFlowGraph(content({
      start: {},
      door_check: {
        components: [{
          type: 'input',
          placeholder: 'PIN',
          set: 'attempt',
          branches: [
            { when: { var: 'attempt', op: 'eq', value: '1234' }, target: 'vault_open' },
            { default: true, target: 'menu' },
          ],
        }],
      },
      vault_open: {},
      menu: {},
    }));

    expect(g.edges.find((e) => e.to === 'vault_open')).toMatchObject({ from: 'door_check', kind: 'cond' });
    expect(g.edges.find((e) => e.to === 'menu')).toMatchObject({ from: 'door_check', kind: 'cond' });
  });

  it('extracts edges from variant choices and per-variant component branches', () => {
    const g = deriveFlowGraph(content({
      start: {
        variants: [{
          default: true,
          choices: [{ label: 'Vai', target: 'a' }],
          components: [{
            type: 'input', placeholder: 'x', set: 'y',
            branches: [{ default: true, target: 'b' }],
          }],
        }],
      },
      a: {},
      b: {},
    }));

    expect(g.edges.find((e) => e.to === 'a')).toMatchObject({ from: 'start', kind: 'cond', label: 'Vai' });
    expect(g.edges.find((e) => e.to === 'b')).toMatchObject({ from: 'start', kind: 'cond' });
  });

  it('resolves the entry node to `start` when present', () => {
    const g = deriveFlowGraph(content({ start: {}, other: {} }));
    expect(g.entryId).toBe('start');
  });

  it('reports a null entry and warns via all-unreachable when there is no start node', () => {
    const g = deriveFlowGraph(content({ menu: {}, other: {} }));
    expect(g.entryId).toBeNull();
    expect(g.unreachable).toEqual(expect.arrayContaining(['menu', 'other']));
  });

  it('reports unreachable nodes', () => {
    const g = deriveFlowGraph(content({
      start: { choices: [{ label: 'Go', target: 'menu' }] },
      menu: {},
      orphan: {},
    }));

    expect(g.unreachable).toContain('orphan');
    expect(g.unreachable).not.toContain('menu');
    expect(g.unreachable).not.toContain('start');
  });

  it('reports a broken target and tags the edge', () => {
    const g = deriveFlowGraph(content({
      start: { choices: [{ label: 'Vault', target: 'vault_doorX' }] },
    }));

    expect(g.broken).toContainEqual({ from: 'start', to: 'vault_doorX' });
    expect(g.edges.find((e) => e.to === 'vault_doorX')?.kind).toBe('broken');
  });

  it('tags a cycle-closing edge as a back edge', () => {
    const g = deriveFlowGraph(content({
      start: { choices: [{ label: 'A', target: 'a' }] },
      a: { choices: [{ label: 'Back to start', target: 'start' }] },
    }));

    const backEdge = g.edges.find((e) => e.from === 'a' && e.to === 'start');
    expect(backEdge?.kind).toBe('back');
  });

  it('derives node badges from node contents', () => {
    const g = deriveFlowGraph(content({
      start: {
        login: { users: ['tecnico'] },
        on_enter: [{ key: 'seen', op: 'toggle' }],
        variants: [{ default: true }],
        components: [{ type: 'input', placeholder: 'x', set: 'y', branches: [] }],
      },
    }));

    const node = g.nodes.find((n) => n.id === 'start');
    expect(node).toMatchObject({ hasLogin: true, hasOnEnter: true, hasVariants: true, hasInput: true });
  });
});
