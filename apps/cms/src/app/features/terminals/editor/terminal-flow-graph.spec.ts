import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { TerminalFlowGraphComponent } from './terminal-flow-graph';
import type { FlowGraph } from './flow-graph.model';

function graph(overrides: Partial<FlowGraph> = {}): FlowGraph {
  return {
    nodes: [
      { id: 'start', hasLogin: false, hasVariants: false, hasInput: false, hasOnEnter: false, snippet: '' },
      { id: 'menu', hasLogin: false, hasVariants: false, hasInput: false, hasOnEnter: false, snippet: '' },
    ],
    edges: [{ from: 'start', to: 'menu', kind: 'direct', label: 'Vai' }],
    entryId: 'start',
    unreachable: [],
    broken: [],
    ...overrides,
  };
}

describe('TerminalFlowGraphComponent', () => {
  let fixture: ComponentFixture<TerminalFlowGraphComponent>;
  let host: HTMLElement;

  function setup(g: FlowGraph): void {
    fixture = TestBed.createComponent(TerminalFlowGraphComponent);
    fixture.componentRef.setInput('graph', g);
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TerminalFlowGraphComponent] });
  });

  it('renders one box per node', () => {
    setup(graph());
    const boxes = host.querySelectorAll('.fg-node:not(.ghost)');
    expect(boxes.length).toBe(2);
  });

  it('renders a ghost box per broken target', () => {
    setup(graph({
      edges: [{ from: 'start', to: 'vault_doorX', kind: 'broken', label: 'Vault' }],
      broken: [{ from: 'start', to: 'vault_doorX' }],
    }));
    const ghosts = host.querySelectorAll('.fg-node.ghost');
    expect(ghosts.length).toBe(1);
    expect(ghosts[0].textContent).toContain('vault_doorX');
  });

  it('emits the node id when a node box is clicked', () => {
    setup(graph());
    let emitted: string | null = null;
    fixture.componentInstance.nodeSelected.subscribe((id) => (emitted = id));

    const menuNode = Array.from(host.querySelectorAll('.fg-node')).find((el) =>
      el.textContent?.includes('menu'),
    ) as SVGGElement;
    menuNode.dispatchEvent(new MouseEvent('click'));

    expect(emitted).toBe('menu');
  });

  it('does not emit when a ghost box is clicked', () => {
    setup(graph({
      edges: [{ from: 'start', to: 'vault_doorX', kind: 'broken', label: '' }],
      broken: [{ from: 'start', to: 'vault_doorX' }],
    }));
    let emitted = false;
    fixture.componentInstance.nodeSelected.subscribe(() => (emitted = true));

    const ghost = host.querySelector('.fg-node.ghost') as SVGGElement;
    ghost.dispatchEvent(new MouseEvent('click'));

    expect(emitted).toBe(false);
  });

  it('sets hover isolation so non-incident edges are dimmed', () => {
    setup(graph({
      nodes: [
        { id: 'start', hasLogin: false, hasVariants: false, hasInput: false, hasOnEnter: false, snippet: '' },
        { id: 'menu', hasLogin: false, hasVariants: false, hasInput: false, hasOnEnter: false, snippet: '' },
        { id: 'far', hasLogin: false, hasVariants: false, hasInput: false, hasOnEnter: false, snippet: '' },
      ],
      edges: [
        { from: 'start', to: 'menu', kind: 'direct', label: '' },
        { from: 'menu', to: 'far', kind: 'direct', label: '' },
      ],
    }));

    const startNode = Array.from(host.querySelectorAll('.fg-node')).find((el) =>
      el.textContent?.includes('start'),
    ) as SVGGElement;
    startNode.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    // start→menu stays lit; menu→far (not incident to start) is dimmed.
    const dimmedEdges = host.querySelectorAll('.fg-edge.dim');
    expect(dimmedEdges.length).toBe(1);
  });

  it('warns when there is no entry node', () => {
    setup(graph({ entryId: null }));
    expect(host.querySelector('.flow-warning')?.textContent).toContain('start');
  });

  it('marks the active node', () => {
    setup(graph());
    fixture.componentRef.setInput('activeNodeId', 'menu');
    fixture.detectChanges();
    const active = host.querySelector('.fg-node.active');
    expect(active?.textContent).toContain('menu');
  });
});
