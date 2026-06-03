import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormArray, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { makeMutationGroup } from './terminal-form';

@Component({
  selector: 'app-mutation-editor',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mutation-editor">
      <datalist id="mut-keys">
        @for (k of availableKeys; track k) {
          <option [value]="k"></option>
        }
      </datalist>
      @for (row of rows.controls; track row; let i = $index) {
        <div [formGroup]="asGroup(row)" class="mutation-row">
          <input formControlName="key" list="mut-keys" placeholder="es. local.variabile" class="bo-input sm" />
          <select formControlName="op" class="bo-select sm">
            <option value="set">set</option>
            <option value="increment">increment</option>
            <option value="toggle">toggle</option>
          </select>
          @if (asGroup(row).get('op')?.value === 'set') {
            <input formControlName="value" placeholder="valore" class="bo-input sm" />
          }
          @if (asGroup(row).get('op')?.value === 'increment') {
            <input formControlName="by" type="number" placeholder="quantità" class="bo-input sm" />
          }
          <button type="button" class="bo-btn ghost sm danger" (click)="remove(i)">✕</button>
        </div>
      }
      <button type="button" class="bo-btn ghost sm" (click)="add()">+ Aggiungi mutazione</button>
    </div>
  `,
  styles: [`
    .mutation-editor { display: flex; flex-direction: column; gap: 6px; }
    .mutation-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .bo-input.sm, .bo-select.sm { padding: 4px 8px; font-size: 13px; }
    .bo-btn.sm { padding: 4px 10px; font-size: 13px; }
    .danger { color: var(--bo-danger, #c0392b); }
  `],
})
export class MutationEditorComponent {
  @Input({ required: true }) rows!: FormArray<FormGroup>;
  @Input() availableKeys: string[] = [];

  add(): void {
    this.rows.push(makeMutationGroup());
  }

  remove(i: number): void {
    this.rows.removeAt(i);
  }

  asGroup(c: unknown): FormGroup {
    return c as FormGroup;
  }
}
