import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { FlowGraph, FlowNode } from './flow-graph.model';
import { layoutFlowGraph, NODE_HEIGHT, NODE_WIDTH, type PositionedEdge } from './flow-graph.layout';

interface Badge {
  letter: string;
  title: string;
}

@Component({
  selector: 'app-terminal-flow-graph',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bo-card section flow-panel">
      <div class="flow-header" (click)="toggleCollapsed()">
        <h3 class="bo-card-section-title">Mappa del flusso</h3>
        <button type="button" class="bo-btn ghost sm" [attr.aria-expanded]="!collapsed()">
          {{ collapsed() ? 'Espandi' : 'Comprimi' }}
        </button>
      </div>

      @if (!collapsed()) {
        @if (graph().entryId === null) {
          <div class="flow-warning">
            Nessun nodo <code>start</code>: il terminale non ha un nodo di avvio.
          </div>
        }

        <div class="flow-canvas-wrap">
          <svg
            class="flow-canvas"
            [attr.width]="layout().width"
            [attr.height]="layout().height"
            [attr.viewBox]="'0 0 ' + layout().width + ' ' + layout().height"
          >
            <defs>
              <marker id="fg-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" class="fg-arrow-head" />
              </marker>
              <marker id="fg-arrow-broken" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" class="fg-arrow-head broken" />
              </marker>
            </defs>

            <!-- Edges -->
            @for (edge of layout().edges; track $index) {
              <g class="fg-edge" [class.dim]="isEdgeDimmed(edge)" [class]="edge.kind">
                <path [attr.d]="edgePath(edge)" class="fg-edge-line"
                  [attr.marker-end]="edge.kind === 'broken' ? 'url(#fg-arrow-broken)' : 'url(#fg-arrow)'" />
                @if (edge.label) {
                  <text [attr.x]="edge.labelX" [attr.y]="edge.labelY - 4" class="fg-edge-label" text-anchor="middle">
                    {{ truncateLabel(edge.label) }}
                  </text>
                }
              </g>
            }

            <!-- Nodes -->
            @for (n of layout().nodes; track n.id) {
              <g
                class="fg-node"
                [class.ghost]="n.ghost"
                [class.entry]="!n.ghost && n.id === graph().entryId"
                [class.unreachable]="!n.ghost && isUnreachable(n.id)"
                [class.active]="!n.ghost && n.id === activeNodeId()"
                [class.dim]="isNodeDimmed(n.id)"
                [attr.transform]="'translate(' + n.x + ',' + n.y + ')'"
                (click)="onNodeClick(n.id, n.ghost)"
                (mouseenter)="hoveredId.set(n.id)"
                (mouseleave)="hoveredId.set(null)"
              >
                <rect class="fg-node-box" [attr.width]="nodeWidth" [attr.height]="nodeHeight" rx="6" />
                <text class="fg-node-id" x="10" y="20">{{ n.id }}</text>

                @if (!n.ghost && n.id === graph().entryId) {
                  <text class="fg-entry-tag" x="10" y="36">start</text>
                }
                @if (!n.ghost && isUnreachable(n.id)) {
                  <text class="fg-unreachable-tag" x="10" y="36">irraggiungibile</text>
                }
                @if (n.ghost) {
                  <text class="fg-ghost-tag" x="10" y="36">target rotto</text>
                }

                @if (!n.ghost) {
                  @for (badge of badgesFor(n.id); track badge.letter; let bi = $index) {
                    <g [attr.transform]="'translate(' + (nodeWidth - 8 - (bi + 1) * 18) + ',8)'">
                      <rect class="fg-badge-box" width="16" height="16" rx="3" />
                      <text class="fg-badge-letter" x="8" y="12" text-anchor="middle">{{ badge.letter }}</text>
                      <title>{{ badge.title }}</title>
                    </g>
                  }
                }
              </g>
            }
          </svg>
        </div>
      }
    </div>
  `,
  styles: [`
    .section { margin-bottom: 16px; }
    .flow-header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
    .flow-header .bo-card-section-title { margin: 0; }
    .bo-btn.sm { padding: 4px 10px; font-size: 13px; }
    .flow-warning {
      margin: 10px 0 4px; padding: 8px 12px; font-size: 13px;
      background: var(--bo-warn-soft); color: var(--bo-warn);
      border: 1px solid var(--bo-warn); border-radius: var(--bo-radius-sm, 6px);
    }
    .flow-warning code { font-family: var(--bo-font-mono, monospace); }
    .flow-canvas-wrap { overflow-x: auto; margin-top: 12px; }
    .flow-canvas { display: block; font-family: var(--bo-font-ui, sans-serif); }

    /* Edges */
    .fg-edge-line { fill: none; stroke: var(--bo-border-strong, #999); stroke-width: 1.5; }
    .fg-edge.cond .fg-edge-line { stroke-dasharray: 5 4; }
    .fg-edge.back .fg-edge-line { stroke-dasharray: 2 4; opacity: 0.6; }
    .fg-edge.broken .fg-edge-line { stroke: var(--bo-danger, #c0392b); stroke-dasharray: 4 3; }
    .fg-arrow-head { fill: var(--bo-border-strong, #999); }
    .fg-arrow-head.broken { fill: var(--bo-danger, #c0392b); }
    .fg-edge-label { fill: var(--bo-text-muted, #666); font-size: 10px; }
    .fg-edge.dim { opacity: 0.15; }

    /* Nodes */
    .fg-node { cursor: pointer; }
    .fg-node-box { fill: var(--bo-panel, #fff); stroke: var(--bo-border, #ddd); stroke-width: 1.5; }
    .fg-node-id { fill: var(--bo-text, #222); font-size: 13px; font-weight: 600; font-family: var(--bo-font-mono, monospace); }
    .fg-node.entry .fg-node-box { stroke: var(--bo-accent, #2d7); stroke-width: 2.5; }
    .fg-node.active .fg-node-box { fill: var(--bo-accent-soft, #eef); stroke: var(--bo-accent, #2d7); stroke-width: 2.5; }
    .fg-node.unreachable .fg-node-box { stroke-dasharray: 4 3; opacity: 0.6; }
    .fg-node.unreachable .fg-node-id { opacity: 0.6; }
    .fg-node.ghost .fg-node-box { fill: var(--bo-danger-soft, #fdecea); stroke: var(--bo-danger, #c0392b); stroke-dasharray: 4 3; }
    .fg-node.ghost .fg-node-id { fill: var(--bo-danger, #c0392b); }
    .fg-node.dim { opacity: 0.25; }
    .fg-entry-tag { fill: var(--bo-accent, #2d7); font-size: 10px; font-weight: 600; }
    .fg-unreachable-tag { fill: var(--bo-text-faint, #999); font-size: 10px; }
    .fg-ghost-tag { fill: var(--bo-danger, #c0392b); font-size: 10px; font-weight: 600; }

    /* Badges */
    .fg-badge-box { fill: var(--bo-accent-soft, #eef); stroke: var(--bo-accent, #2d7); stroke-width: 1; }
    .fg-badge-letter { fill: var(--bo-accent-text, var(--bo-accent, #2d7)); font-size: 10px; font-weight: 700; }
  `],
})
export class TerminalFlowGraphComponent {
  readonly graph = input.required<FlowGraph>();
  readonly activeNodeId = input<string | null>(null);
  readonly nodeSelected = output<string>();

  protected readonly collapsed = signal(false);
  protected readonly hoveredId = signal<string | null>(null);

  protected readonly nodeWidth = NODE_WIDTH;
  protected readonly nodeHeight = NODE_HEIGHT;

  protected readonly layout = computed(() => layoutFlowGraph(this.graph()));
  private readonly unreachableSet = computed(() => new Set(this.graph().unreachable));
  private readonly nodeById = computed(() => new Map(this.graph().nodes.map((n) => [n.id, n])));

  protected toggleCollapsed(): void {
    this.collapsed.update((v) => !v);
  }

  protected onNodeClick(id: string, ghost: boolean): void {
    if (ghost) return; // ghost boxes are not real nodes — nothing to open
    this.nodeSelected.emit(id);
  }

  protected isUnreachable(id: string): boolean {
    return this.unreachableSet().has(id);
  }

  protected isNodeDimmed(id: string): boolean {
    const hovered = this.hoveredId();
    return hovered !== null && hovered !== id;
  }

  protected isEdgeDimmed(edge: PositionedEdge): boolean {
    const hovered = this.hoveredId();
    if (hovered === null) return false;
    return edge.from !== hovered && edge.to !== hovered;
  }

  protected edgePath(edge: PositionedEdge): string {
    if (!edge.points.length) return '';
    return edge.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
  }

  protected truncateLabel(label: string): string {
    return label.length > 18 ? `${label.slice(0, 17)}…` : label;
  }

  protected badgesFor(id: string): Badge[] {
    const node: FlowNode | undefined = this.nodeById().get(id);
    if (!node) return [];
    const badges: Badge[] = [];
    if (node.hasLogin) badges.push({ letter: 'L', title: 'Gate di login' });
    if (node.hasVariants) badges.push({ letter: 'V', title: 'Varianti' });
    if (node.hasInput) badges.push({ letter: 'I', title: 'Componente input' });
    if (node.hasOnEnter) badges.push({ letter: 'E', title: 'Mutazioni on_enter' });
    return badges;
  }
}
