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

  function nodeByText(text: string): SVGGElement {
    return Array.from(host.querySelectorAll('.fg-node')).find((el) =>
      el.querySelector('.fg-node-id')?.textContent?.trim() === text,
    ) as SVGGElement;
  }

  function svgWidth(): number {
    return Number((host.querySelector('.flow-canvas') as Element).getAttribute('width'));
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

    nodeByText('menu').dispatchEvent(new MouseEvent('click'));

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

  it('renders the start label on the entry node with no highlight class at rest', () => {
    setup(graph());
    const start = nodeByText('start');

    // The `start` label is retained...
    expect(start.querySelector('.fg-entry-tag')?.textContent?.trim()).toBe('start');
    // ...but the entry node carries no active/hover highlight at rest.
    expect(start.classList.contains('hovered')).toBe(false);
    expect(start.classList.contains('active')).toBe(false);
    expect(host.querySelector('.fg-node.hovered')).toBeNull();
    expect(host.querySelector('.fg-node.active')).toBeNull();
  });

  it('zooms in via the header + control within bounds', () => {
    setup(graph());
    const base = svgWidth(); // rest = fit-to-width default (1× in a zero-width jsdom container)

    (host.querySelector('[aria-label="Aumenta zoom"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const zoomed = svgWidth();
    expect(zoomed).toBeGreaterThan(base);
    expect(zoomed).toBeLessThanOrEqual(base * 3);
  });

  it('zooms in via the mouse wheel within bounds', () => {
    setup(graph());
    const base = svgWidth();

    const wrap = host.querySelector('.flow-canvas-wrap') as HTMLElement;
    wrap.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true }));
    fixture.detectChanges();

    const zoomed = svgWidth();
    expect(zoomed).toBeGreaterThan(base);
    expect(zoomed).toBeLessThanOrEqual(base * 3);
  });

  it('highlights a hovered non-active node and its edges without dimming the rest', () => {
    setup(graph({
      nodes: [
        { id: 'start', hasLogin: false, hasVariants: false, hasInput: false, hasOnEnter: false, snippet: '' },
        { id: 'menu', hasLogin: false, hasVariants: false, hasInput: false, hasOnEnter: false, snippet: '' },
        { id: 'far', hasLogin: false, hasVariants: false, hasInput: false, hasOnEnter: false, snippet: '' },
        { id: 'iso_a', hasLogin: false, hasVariants: false, hasInput: false, hasOnEnter: false, snippet: '' },
        { id: 'iso_b', hasLogin: false, hasVariants: false, hasInput: false, hasOnEnter: false, snippet: '' },
      ],
      edges: [
        { from: 'start', to: 'menu', kind: 'direct', label: '' },
        { from: 'menu', to: 'far', kind: 'direct', label: '' },
        { from: 'iso_a', to: 'iso_b', kind: 'direct', label: '' },
      ],
    }));

    nodeByText('menu').dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    // Hovered node gets the hover class; it is not the active node.
    const menu = nodeByText('menu');
    expect(menu.classList.contains('hovered')).toBe(true);
    expect(menu.classList.contains('active')).toBe(false);

    // Only the two edges incident to `menu` are highlighted.
    expect(host.querySelectorAll('.fg-edge.hl').length).toBe(2);
    expect(host.querySelectorAll('.fg-edge:not(.hl)').length).toBe(1);

    // Nothing is dimmed (the old isolation behaviour is gone).
    expect(host.querySelectorAll('.fg-node.dim').length).toBe(0);
    expect(host.querySelectorAll('.fg-edge.dim').length).toBe(0);

    // Other nodes keep their resting appearance.
    expect(nodeByText('far').classList.contains('hovered')).toBe(false);
    expect(nodeByText('iso_a').classList.contains('hovered')).toBe(false);
  });

  it('keeps the active styling when hovering the active node', () => {
    setup(graph());
    fixture.componentRef.setInput('activeNodeId', 'menu');
    fixture.detectChanges();

    nodeByText('menu').dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    // The active node retains its active class (CSS :not(.active) keeps the
    // selected look on top of the hover border); its edges are still highlighted.
    const menu = nodeByText('menu');
    expect(menu.classList.contains('active')).toBe(true);
    expect(host.querySelectorAll('.fg-edge.hl').length).toBe(1);
  });
});
