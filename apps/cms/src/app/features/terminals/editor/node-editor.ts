import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MultiSelect } from 'primeng/multiselect';
import { ConditionBuilderComponent } from './condition-builder';
import { MutationEditorComponent } from './mutation-editor';
import { NodeContentEditorComponent } from './node-content-editor';
import { makeVariantGroup } from './terminal-form';

@Component({
  selector: 'app-node-editor',
  standalone: true,
  imports: [ReactiveFormsModule, MultiSelect, MutationEditorComponent, ConditionBuilderComponent, NodeContentEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [formGroup]="nodeGroup" class="node-editor">

      <!-- Login nodo (always above tab strip, per D13) -->
      <div class="sub-section">
        <h5 class="sub-label">Login nodo</h5>
        @if (availableUsernames.length > 0) {
          <p-multiselect
            [options]="availableUsernames"
            formControlName="loginUsers"
            placeholder="Seleziona utenti"
            styleClass="w-full"
          />
        } @else {
          <p class="empty-hint">Nessun utente fittizio dichiarato. Aggiungili nella sezione "Utenti fittizi" per abilitare il gate di login.</p>
        }
      </div>

      <!-- on_enter (always above tab strip, per D17) -->
      <div class="sub-section">
        <h5 class="sub-label">on_enter</h5>
        <app-mutation-editor [rows]="onEnterArray" [availableKeys]="availableKeys" />
      </div>

      <!-- Tab strip (shown only when variants exist) -->
      @if (variantsArray.length > 0) {
        <div class="tab-strip">
          <button
            type="button"
            class="tab-btn"
            [class.active]="activeVariantIdx() === -1"
            (click)="activeVariantIdx.set(-1)"
          >Nodo</button>
          @for (entry of sortedVariantEntries; track entry.idx; let ti = $index) {
            <button
              type="button"
              class="tab-btn"
              [class.active]="activeVariantIdx() === entry.idx"
              (click)="activeVariantIdx.set(entry.idx)"
            >
              @if (entry.ctrl.get('isDefault')?.value) { ★ } Var {{ ti + 1 }}
              <button type="button" class="tab-remove" (click)="removeVariant(entry.idx); $event.stopPropagation()">✕</button>
            </button>
          }
          <button type="button" class="tab-btn tab-add" (click)="addVariant()">+</button>
        </div>

        @if (variantsArray.errors?.['multipleDefaults']) {
          <span class="field-error tab-error">Al massimo una variante può essere quella predefinita</span>
        }

        <!-- Node-level content tab (tab index -1) -->
        @if (activeVariantIdx() === -1) {
          <div class="tab-content">
            <app-node-content-editor
              [textCtrl]="nodeTextCtrl"
              [choicesArray]="nodeChoicesArray"
              [componentsArray]="nodeComponentsArray"
              [availableKeys]="availableKeys"
              idPrefix="node-"
            />
          </div>
        }

        <!-- Variant tabs -->
        @for (entry of sortedVariantEntries; track entry.idx) {
          @if (activeVariantIdx() === entry.idx) {
            <div [formGroup]="entry.ctrl" class="tab-content">
              <!-- isDefault toggle + when condition selector (D17 / D6) -->
              <div class="sub-section">
                <div class="checkbox-row">
                  <input type="checkbox" [id]="'var-default-' + entry.idx" formControlName="isDefault" />
                  <label [for]="'var-default-' + entry.idx">Variante predefinita (fallback)</label>
                </div>
                @if (!entry.ctrl.get('isDefault')?.value) {
                  <div class="field" style="margin-top:8px">
                    <div class="field-label">Condizione (when)</div>
                    <app-condition-builder
                      [group]="asGroup(entry.ctrl.get('when'))"
                      [canRemove]="false"
                      [availableKeys]="availableKeys"
                      (convert)="replaceVariantWhen(entry.idx, $event)"
                    />
                  </div>
                }
              </div>

              <!-- Shared content sub-editor: text + choices + components (no on_enter, no variants) -->
              <app-node-content-editor
                [textCtrl]="asControl(entry.ctrl.get('text'))"
                [choicesArray]="asArray(entry.ctrl.get('choices'))"
                [componentsArray]="asArray(entry.ctrl.get('components'))"
                [availableKeys]="availableKeys"
                [idPrefix]="'var-' + entry.idx + '-'"
              />
            </div>
          }
        }

      } @else {
        <!-- No variants: edit node-level content directly, no tab chrome -->
        <app-node-content-editor
          [textCtrl]="nodeTextCtrl"
          [choicesArray]="nodeChoicesArray"
          [componentsArray]="nodeComponentsArray"
          [availableKeys]="availableKeys"
          idPrefix="node-"
        />
        <button type="button" class="bo-btn ghost sm" style="margin-top:4px" (click)="addVariant()">+ Aggiungi variante</button>
      }

    </div>
  `,
  styles: [`
    .node-editor { padding: 12px; }
    .sub-section { margin-bottom: 16px; }
    .sub-label { font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--bo-text-faint); margin: 0 0 8px; }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field-label { font-size: 13px; font-weight: 500; }
    .checkbox-row { display: flex; align-items: center; gap: 6px; }
    .field-error { font-size: 12px; color: var(--bo-danger, #c0392b); }
    .tab-error { display: block; margin-bottom: 8px; }
    .tab-strip { display: flex; gap: 4px; flex-wrap: wrap; border-bottom: 2px solid var(--bo-border, #ddd); margin-bottom: 12px; padding-bottom: 0; }
    .tab-btn { padding: 6px 14px; font-size: 13px; border: 1px solid var(--bo-border, #ddd); border-bottom: none; border-radius: 6px 6px 0 0; background: var(--bo-panel-2, #faf8f2); cursor: pointer; display: flex; align-items: center; gap: 4px; color: inherit; }
    .tab-btn.active { background: hsl(var(--bo-accent-h) var(--bo-accent-s) calc(var(--bo-accent-l) - 8%)); border-color: hsl(var(--bo-accent-h) var(--bo-accent-s) calc(var(--bo-accent-l) - 8%)); color: var(--bo-text-inverse); font-weight: 600; }
    .tab-add { font-size: 16px; padding: 4px 10px; }
    .tab-remove { font-size: 11px; color: var(--bo-text-faint, #999); margin-left: 4px; cursor: pointer; }
    .tab-remove:hover { color: var(--bo-danger, #c0392b); }
    .tab-btn.active .tab-remove { color: var(--bo-text-inverse); opacity: 0.85; }
    .tab-btn.active .tab-remove:hover { color: var(--bo-danger, #c0392b); opacity: 1; }
    .tab-content { padding-top: 8px; }
    .bo-btn.sm { padding: 4px 10px; font-size: 13px; }
    .empty-hint { font-size: 12px; color: var(--bo-text-faint, #999); margin: 0 0 4px; }
    .field-hint { font-size: 12px; color: var(--bo-text-faint, #999); margin: 4px 0 0; }
  `],
})
export class NodeEditorComponent {
  @Input({ required: true }) nodeGroup!: FormGroup;
  @Input() availableUsernames: string[] = [];
  @Input() availableKeys: string[] = [];

  /** -1 = node-level tab; N = variantsArray index N */
  protected activeVariantIdx = signal<number>(-1);

  get onEnterArray(): FormArray<FormGroup> {
    return this.nodeGroup.get('on_enter') as FormArray<FormGroup>;
  }

  get variantsArray(): FormArray<FormGroup> {
    return this.nodeGroup.get('variants') as FormArray<FormGroup>;
  }

  get nodeTextCtrl(): FormControl {
    return this.nodeGroup.get('text') as FormControl;
  }

  get nodeChoicesArray(): FormArray<FormGroup> {
    return this.nodeGroup.get('choices') as FormArray<FormGroup>;
  }

  get nodeComponentsArray(): FormArray<FormGroup> {
    return this.nodeGroup.get('components') as FormArray<FormGroup>;
  }

  /** Variant entries sorted so the isDefault variant tab appears first (D17). */
  protected get sortedVariantEntries(): { idx: number; ctrl: FormGroup }[] {
    const entries = this.variantsArray.controls.map((c, i) => ({ idx: i, ctrl: c as FormGroup }));
    return entries.sort((a, b) => {
      const aD = a.ctrl.get('isDefault')?.value ? 1 : 0;
      const bD = b.ctrl.get('isDefault')?.value ? 1 : 0;
      return bD - aD;
    });
  }

  addVariant(): void {
    const newIdx = this.variantsArray.length;
    this.variantsArray.push(makeVariantGroup());
    this.activeVariantIdx.set(newIdx);
  }

  removeVariant(i: number): void {
    this.variantsArray.removeAt(i);
    const cur = this.activeVariantIdx();
    if (cur === i || this.variantsArray.length === 0) {
      this.activeVariantIdx.set(-1);
    } else if (cur > i) {
      this.activeVariantIdx.set(cur - 1);
    }
  }

  replaceVariantWhen(vi: number, g: FormGroup): void {
    (this.variantsArray.at(vi) as FormGroup).setControl('when', g);
  }

  asGroup(c: unknown): FormGroup {
    return c as FormGroup;
  }

  asArray(c: unknown): FormArray<FormGroup> {
    return c as FormArray<FormGroup>;
  }

  asControl(c: unknown): FormControl {
    return c as FormControl;
  }
}
