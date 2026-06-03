import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
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
        <div [formGroup]="asGroup(node)" class="node-card">
          <div class="node-header">
            <div class="id-field">
              <div class="field-label">ID nodo *</div>
              <input formControlName="id" class="bo-input sm" placeholder="es. start" />
              @if (asGroup(node).get('id')?.invalid && asGroup(node).get('id')?.touched) {
                <span class="field-error">L'ID è obbligatorio</span>
              }
            </div>
            <button
              type="button"
              class="bo-btn ghost sm danger"
              [disabled]="nodes.length === 1"
              (click)="removeNode(i)"
            >
              ✕ Rimuovi nodo
            </button>
          </div>
          <app-node-editor [nodeGroup]="asGroup(node)" [availableUsernames]="availableUsernames" [availableKeys]="availableKeys" />
        </div>
      }

      <button type="button" class="bo-btn ghost" (click)="addNode()">+ Aggiungi nodo</button>
    </div>
  `,
  styles: [`
    .section { margin-bottom: 16px; }
    .node-card { border: 1px solid var(--bo-border, #ddd); border-radius: 8px; margin-bottom: 16px; overflow: hidden; }
    .node-header { display: flex; justify-content: space-between; align-items: flex-end; padding: 12px; background: var(--bo-accent); color: var(--bo-text-inverse); border-bottom: 1px solid var(--bo-accent); }
    .id-field { display: flex; flex-direction: column; gap: 4px; }
    .field-label { font-size: 13px; font-weight: 500; }
    .node-header .field-label { color: var(--bo-text-inverse); }
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

  addNode(): void {
    const id = `nodo_${this.nodes.length + 1}`;
    this.nodes.push(makeNodeGroup(id));
  }

  removeNode(i: number): void {
    if (this.nodes.length > 1) {
      this.nodes.removeAt(i);
    }
  }

  asGroup(c: unknown): FormGroup {
    return c as FormGroup;
  }
}
