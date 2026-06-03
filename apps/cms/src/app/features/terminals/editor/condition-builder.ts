import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  forwardRef,
} from '@angular/core';
import { FormArray, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { makeComboGroup, makeLeafGroup } from './terminal-form';

@Component({
  selector: 'app-condition-builder',
  standalone: true,
  imports: [ReactiveFormsModule, forwardRef(() => ConditionBuilderComponent)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [formGroup]="group" class="condition-node">
      @if (group.get('kind')?.value === 'leaf') {
        <div class="leaf-row">
          <datalist id="cond-keys">
            @for (k of availableKeys; track k) {
              <option [value]="k"></option>
            }
          </datalist>
          <input formControlName="var" list="cond-keys" placeholder="chiave (es. local.var)" class="bo-input sm" />
          <select formControlName="op" class="bo-select sm">
            <option value="eq">eq</option>
            <option value="neq">neq</option>
            <option value="gt">gt</option>
            <option value="lt">lt</option>
            <option value="gte">gte</option>
            <option value="lte">lte</option>
            <option value="in">in</option>
          </select>
          @if (group.get('op')?.value === 'in') {
            <input formControlName="value" placeholder="val1,val2,..." class="bo-input sm" />
          } @else {
            <input formControlName="value" placeholder="valore" class="bo-input sm" />
          }
          <button type="button" class="bo-btn ghost sm" (click)="wrapInCombo('and')">Converti in AND</button>
          <button type="button" class="bo-btn ghost sm" (click)="wrapInCombo('or')">Converti in OR</button>
          @if (canRemove) {
            <button type="button" class="bo-btn ghost sm danger" (click)="removed.emit()">✕</button>
          }
        </div>
      } @else if (group.get('kind')?.value === 'not') {
        <div class="combo-node">
          <div class="combo-header">
            <span class="combo-kind">NOT</span>
            @if (canRemove) {
              <button type="button" class="bo-btn ghost sm danger" (click)="removed.emit()">✕ Rimuovi NOT</button>
            }
          </div>
          <div class="combo-children">
            @if (children.controls[0]) {
              <app-condition-builder
                [group]="asGroup(children.controls[0])"
                [canRemove]="false"
                [availableKeys]="availableKeys"
                (removed)="removeChild(0)"
                (convert)="replaceChild(0, $event)"
              />
            }
          </div>
        </div>
      } @else {
        <div class="combo-node">
          <div class="combo-header">
            <span class="combo-kind">{{ group.get('kind')?.value }}</span>
            <button type="button" class="bo-btn ghost sm" (click)="addLeaf()">+ Foglia</button>
            <button type="button" class="bo-btn ghost sm" (click)="addCombo('and')">+ AND</button>
            <button type="button" class="bo-btn ghost sm" (click)="addCombo('or')">+ OR</button>
            @if (canRemove) {
              <button type="button" class="bo-btn ghost sm danger" (click)="removed.emit()">✕ Rimuovi gruppo</button>
            }
          </div>
          <div class="combo-children">
            @for (child of children.controls; track child; let i = $index) {
              <app-condition-builder
                [group]="asGroup(child)"
                [canRemove]="true"
                [availableKeys]="availableKeys"
                (removed)="removeChild(i)"
                (convert)="replaceChild(i, $event)"
              />
            }
            @empty {
              <span class="empty-hint">Nessuna condizione figlio.</span>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .condition-node { border-left: 2px solid var(--bo-border, #ddd); padding-left: 10px; margin-bottom: 6px; }
    .leaf-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .combo-node { }
    .combo-header { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-bottom: 6px; }
    .combo-kind { font-weight: 700; font-size: 11px; text-transform: uppercase; background: var(--bo-accent, #3498db); color: #fff; padding: 2px 6px; border-radius: 4px; }
    .combo-children { padding-left: 12px; }
    .empty-hint { font-size: 12px; color: var(--bo-text-faint, #999); }
    .bo-input.sm, .bo-select.sm { padding: 4px 8px; font-size: 13px; }
    .bo-btn.sm { padding: 4px 10px; font-size: 13px; }
    .danger { color: var(--bo-danger, #c0392b); }
  `],
})
export class ConditionBuilderComponent {
  @Input({ required: true }) group!: FormGroup;
  @Input() canRemove = false;
  @Input() availableKeys: string[] = [];
  @Output() readonly removed = new EventEmitter<void>();
  @Output() readonly convert = new EventEmitter<FormGroup>();

  get children(): FormArray<FormGroup> {
    return this.group.get('children') as FormArray<FormGroup>;
  }

  addLeaf(): void {
    this.children.push(makeLeafGroup());
  }

  addCombo(kind: 'and' | 'or'): void {
    this.children.push(makeComboGroup(kind));
  }

  removeChild(i: number): void {
    this.children.removeAt(i);
  }

  replaceChild(i: number, g: FormGroup): void {
    this.children.setControl(i, g);
  }

  wrapInCombo(kind: 'and' | 'or'): void {
    const raw = this.group.getRawValue() as { var: string; op: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in'; value: string };
    const leafClone = makeLeafGroup(raw.var, raw.op, raw.value);
    const combo = makeComboGroup(kind);
    (combo.get('children') as FormArray).push(leafClone);
    this.convert.emit(combo);
  }

  asGroup(c: unknown): FormGroup {
    return c as FormGroup;
  }
}
