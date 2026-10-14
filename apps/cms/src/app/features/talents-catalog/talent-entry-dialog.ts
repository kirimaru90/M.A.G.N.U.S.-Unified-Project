import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { CatalogEntryDialogBase, CatalogFormRead } from '../../core/catalog/catalog-entry-dialog.base';
import type { CatalogOp } from '../../core/catalog/catalog-ops';
import { TalentsCatalogApiService } from '../../core/talents-catalog/talents-catalog-api.service';
import type { TalentCatalogEntryDto, TalentCatalogEntryShape } from '../../core/talents-catalog/talents-catalog.types';
import { DialogActionsComponent } from '../../shared/dialog-actions/dialog-actions';
import { APPROACHES } from './special-approaches';

@Component({
  selector: 'app-talent-entry-dialog',
  standalone: true,
  imports: [Dialog, ReactiveFormsModule, InputText, Textarea, InputNumberModule, DialogActionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="closed.emit()"
      [header]="isEdit ? 'Modifica talento' : 'Nuovo talento'"
      [modal]="true"
      [style]="{ width: '520px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="bo-field">
          <label class="bo-label" for="tae-slug">Slug</label>
          <input pInputText id="tae-slug" formControlName="slug" placeholder="slug" class="bo-input w-full" />
        </div>

        <div class="bo-field">
          <label class="bo-label" for="tae-name">Nome</label>
          <input pInputText id="tae-name" formControlName="name" placeholder="nome" class="bo-input w-full" />
        </div>

        <div class="bo-field">
          <label class="bo-label" for="tae-description">Descrizione</label>
          <textarea pTextarea id="tae-description" formControlName="description" rows="3" class="bo-input w-full"></textarea>
        </div>

        <div class="bo-field">
          <span class="bo-label">Requisiti S·P·E·C·I·A·L</span>
          <div
            formArrayName="special"
            data-testid="special-steppers"
            style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px 16px;"
          >
            @for (approach of approaches; track approach.key; let i = $index) {
              <div style="display: flex; align-items: center; gap: 8px;">
                <label class="bo-label" [for]="'tae-' + approach.key" style="min-width: 16px; font-weight: 700; margin: 0;">
                  {{ approach.letter }}
                </label>
                <p-inputnumber
                  [inputId]="'tae-' + approach.key"
                  [formControlName]="i"
                  [min]="0"
                  [max]="5"
                  [showButtons]="true"
                  [useGrouping]="false"
                  [inputStyle]="{ width: '3rem' }"
                />
              </div>
            }
          </div>
        </div>

        <app-dialog-actions [error]="error()" [saving]="saving()" (cancelled)="closed.emit()" />
      </form>
    </p-dialog>
  `,
})
export class TalentEntryDialogComponent extends CatalogEntryDialogBase<TalentCatalogEntryDto, TalentCatalogEntryShape> {
  private readonly api = inject(TalentsCatalogApiService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly approaches = APPROACHES;

  protected readonly form = this.fb.group({
    slug: '',
    name: '',
    description: '',
    special: this.fb.array(APPROACHES.map(() => this.fb.control(0))),
  });

  protected resetForm(entry: TalentCatalogEntryDto | null): void {
    this.form.reset({
      slug: entry?.slug ?? '',
      name: entry?.name ?? '',
      description: entry?.description ?? '',
      special: APPROACHES.map((_, i) => entry?.specialRequirement?.[i] ?? 0),
    });
  }

  protected readForm(): CatalogFormRead<TalentCatalogEntryShape> {
    const { slug, name, description, special } = this.form.getRawValue();
    if (!slug.trim() || !name.trim()) return { error: 'Slug e nome sono obbligatori' };
    return {
      slug: slug.trim(),
      entry: {
        name: name.trim(),
        description: description.trim() || undefined,
        // a cleared stepper reads as null; it means no requirement on that stat
        specialRequirement: special.map((v) => v ?? 0),
      },
    };
  }

  protected patch(ops: CatalogOp<TalentCatalogEntryShape>[]) {
    return this.api.patchSchema(ops);
  }
}
