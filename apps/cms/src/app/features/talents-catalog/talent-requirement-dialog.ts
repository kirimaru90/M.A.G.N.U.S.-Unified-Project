import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import type { TalentCatalogEntryDto } from '../../core/talents-catalog/talents-catalog.types';

// S·P·E·C·I·A·L order, positional to TalentCatalogEntryDto.specialRequirement.
const APPROACHES = [
  { key: 'strength', letter: 'S' },
  { key: 'perception', letter: 'P' },
  { key: 'endurance', letter: 'E' },
  { key: 'charisma', letter: 'C' },
  { key: 'intelligence', letter: 'I' },
  { key: 'agility', letter: 'A' },
  { key: 'luck', letter: 'L' },
] as const;

@Component({
  selector: 'app-talent-requirement-dialog',
  standalone: true,
  imports: [Dialog, FormsModule, InputNumberModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="closed.emit()"
      [header]="'Requisiti — ' + (entry?.name ?? '')"
      [modal]="true"
      [style]="{ width: '380px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <div style="display: flex; flex-direction: column; gap: 12px;">
        @for (approach of approaches; track approach.key; let i = $index) {
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
            <label class="bo-label" style="min-width: 24px; font-weight: 700;">{{ approach.letter }}</label>
            <p-inputnumber
              [ngModel]="values[i]"
              (ngModelChange)="setValue(i, $event)"
              [min]="0"
              [max]="5"
              [showButtons]="true"
              [useGrouping]="false"
              styleClass="w-full"
            />
          </div>
        }
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;">
        <button type="button" class="bo-btn ghost" (click)="closed.emit()">Annulla</button>
        <button type="button" class="bo-btn primary" (click)="onSave()">Salva</button>
      </div>
    </p-dialog>
  `,
})
export class TalentRequirementDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() entry: TalentCatalogEntryDto | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<number[]>();

  protected readonly approaches = APPROACHES;
  protected values: number[] = APPROACHES.map(() => 0);

  ngOnChanges(): void {
    if (this.entry && this.visible) {
      const existing = this.entry.specialRequirement;
      this.values = APPROACHES.map((_, i) => existing?.[i] ?? 0);
    }
  }

  protected setValue(index: number, value: number): void {
    this.values = this.values.map((v, i) => (i === index ? (value ?? 0) : v));
  }

  protected onSave(): void {
    this.saved.emit([...this.values]);
  }
}
