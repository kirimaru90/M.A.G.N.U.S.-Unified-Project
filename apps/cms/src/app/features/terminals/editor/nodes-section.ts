import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  QueryList,
  ViewChildren,
  inject,
  signal,
} from '@angular/core';
import { FormArray, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { makeNodeGroup } from './terminal-form';
import { NodeEditorComponent } from './node-editor';

@Component({
  selector: 'app-nodes-section',
  standalone: true,
  imports: [ReactiveFormsModule, NodeEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bo-card section">
      <h3 class="bo-card-section-title">Nodi</h3>

      @if (nodes.errors?.['duplicateIds']) {
        <div class="field-error banner">Gli ID dei nodi devono essere unici</div>
      }

      @for (node of nodes.controls; track node; let i = $index) {
        <div
          #cardEl
          class="node-card"
          [class.active]="activeGroup() === asGroup(node)"
          [attr.data-node-id]="idValue(asGroup(node))"
        >
          <div class="node-header" (click)="toggle(asGroup(node))">
            <span class="chevron">{{ isExpanded(asGroup(node)) ? '▾' : '▸' }}</span>
            <span class="node-id-label">{{ idValue(asGroup(node)) || '(senza id)' }}</span>

            <span class="badges">
              @if (hasLogin(asGroup(node))) { <span class="badge" title="Gate di login">L</span> }
              @if (hasVariants(asGroup(node))) { <span class="badge" title="Varianti">V</span> }
              @if (hasInput(asGroup(node))) { <span class="badge" title="Componente input">I</span> }
              @if (hasOnEnter(asGroup(node))) { <span class="badge" title="Mutazioni on_enter">E</span> }
            </span>

            @if (isBroken(asGroup(node))) {
              <span class="broken-pill" title="Un target di questo nodo non esiste">target rotto</span>
            }

            <span class="spacer"></span>
            <button
              type="button"
              class="bo-btn ghost sm danger"
              [disabled]="nodes.length === 1"
              (click)="$event.stopPropagation(); removeNode(i)"
            >
              ✕ Rimuovi nodo
            </button>
          </div>

          @if (isExpanded(asGroup(node))) {
            <div class="node-body" [formGroup]="asGroup(node)">
              <div class="id-field">
                <div class="field-label">ID nodo *</div>
                <input formControlName="id" class="bo-input sm" placeholder="es. start" />
                @if (asGroup(node).get('id')?.invalid && asGroup(node).get('id')?.touched) {
                  <span class="field-error">L'ID è obbligatorio</span>
                }
              </div>
              <app-node-editor [nodeGroup]="asGroup(node)" [availableUsernames]="availableUsernames" [availableKeys]="availableKeys" />
            </div>
          }
        </div>
      }

      <button type="button" class="bo-btn ghost" (click)="addNode()">+ Aggiungi nodo</button>
    </div>
  `,
  styles: [`
    .section { margin-bottom: 16px; }
    .node-card { border: 1px solid var(--bo-border, #ddd); border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
    .node-card.active { border-color: var(--bo-accent); box-shadow: 0 0 0 1px var(--bo-accent); }
    .node-header { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--bo-accent); color: var(--bo-text-inverse); cursor: pointer; }
    .chevron { font-size: 12px; width: 12px; }
    .node-id-label { font-weight: 600; font-family: var(--bo-font-mono, monospace); font-size: 14px; }
    .badges { display: flex; gap: 4px; }
    .badge { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 4px; font-size: 11px; font-weight: 700; background: hsl(0 0% 100% / 0.2); color: var(--bo-text-inverse); }
    .broken-pill { padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; background: var(--bo-danger, #c0392b); color: #fff; }
    .spacer { flex: 1; }
    .node-body { padding: 12px; }
    .id-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
    .field-label { font-size: 13px; font-weight: 500; }
    .field-error { font-size: 12px; color: var(--bo-danger, #c0392b); }
    .field-error.banner { margin-bottom: 12px; }
    .bo-input.sm { padding: 4px 8px; font-size: 13px; }
    .bo-btn.sm { padding: 4px 10px; font-size: 13px; }
    .danger { color: var(--bo-danger, #c0392b); }
    .node-header .bo-btn.danger { color: var(--bo-text-inverse); border-color: hsl(0 0% 100% / 0.4); }
    .node-header .bo-btn.danger:hover:not(:disabled) { color: var(--bo-danger, #c0392b); }
  `],
})
export class NodesSectionComponent {
  @Input({ required: true }) nodes!: FormArray<FormGroup>;
  @Input() availableUsernames: string[] = [];
  @Input() availableKeys: string[] = [];
  /** Node ids that have at least one broken outgoing target (from the derived graph). */
  @Input() brokenNodeIds: string[] = [];
  /** Emits the id of the currently-active (open) card, or null when none is open. */
  @Output() readonly activeNodeChange = new EventEmitter<string | null>();

  @ViewChildren('cardEl') private cardEls!: QueryList<ElementRef<HTMLElement>>;

  private readonly cdr = inject(ChangeDetectorRef);

  /** Cards are collapsed by default; this holds the currently-expanded groups. */
  protected readonly expanded = signal(new Set<FormGroup>());
  protected readonly activeGroup = signal<FormGroup | null>(null);

  protected isExpanded(g: FormGroup): boolean {
    return this.expanded().has(g);
  }

  protected toggle(g: FormGroup): void {
    const next = new Set(this.expanded());
    if (next.has(g)) {
      next.delete(g);
      if (this.activeGroup() === g) this.setActive(null);
    } else {
      next.add(g);
      this.setActive(g);
    }
    this.expanded.set(next);
  }

  /**
   * Programmatic open used by the flow-graph preview: expands the card for the
   * node with `id`, scrolls it into view, and marks it active. No-op for an
   * unknown id.
   */
  openNode(id: string): void {
    const idx = this.nodes.controls.findIndex((c) => (c.get('id')?.value as string) === id);
    if (idx < 0) return;
    const g = this.nodes.controls[idx] as FormGroup;
    const next = new Set(this.expanded());
    next.add(g);
    this.expanded.set(next);
    this.setActive(g);
    this.cdr.markForCheck();
    // Scroll after the card body has rendered.
    setTimeout(() => {
      this.cardEls?.get(idx)?.nativeElement.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    });
  }

  private setActive(g: FormGroup | null): void {
    this.activeGroup.set(g);
    this.activeNodeChange.emit(g ? (g.get('id')?.value as string) : null);
  }

  protected idValue(g: FormGroup): string {
    return (g.get('id')?.value as string) ?? '';
  }

  protected isBroken(g: FormGroup): boolean {
    return this.brokenNodeIds.includes(this.idValue(g));
  }

  protected hasLogin(g: FormGroup): boolean {
    return !!(g.get('loginUsers')?.value as string[] | undefined)?.length;
  }

  protected hasVariants(g: FormGroup): boolean {
    return !!(g.get('variants') as FormArray | null)?.length;
  }

  protected hasInput(g: FormGroup): boolean {
    if ((g.get('components') as FormArray | null)?.length) return true;
    const variants = g.get('variants') as FormArray | null;
    return !!variants?.controls.some((v) => (v.get('components') as FormArray | null)?.length);
  }

  protected hasOnEnter(g: FormGroup): boolean {
    return !!(g.get('on_enter') as FormArray | null)?.length;
  }

  addNode(): void {
    const id = `nodo_${this.nodes.length + 1}`;
    this.nodes.push(makeNodeGroup(id));
  }

  removeNode(i: number): void {
    if (this.nodes.length > 1) {
      const g = this.nodes.at(i);
      if (this.activeGroup() === g) this.setActive(null);
      this.nodes.removeAt(i);
    }
  }

  asGroup(c: unknown): FormGroup {
    return c as FormGroup;
  }
}
