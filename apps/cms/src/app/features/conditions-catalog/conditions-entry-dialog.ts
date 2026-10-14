import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { CatalogEntryDialogBase, CatalogFormRead } from '../../core/catalog/catalog-entry-dialog.base';
import type { CatalogOp } from '../../core/catalog/catalog-ops';
import { ConditionsCatalogApiService } from '../../core/conditions-catalog/conditions-catalog-api.service';
import type {
  ConditionCatalogEntryDto,
  ConditionCatalogEntryShape,
  ConditionPolarity,
  ConditionSeverity,
} from '../../core/conditions-catalog/conditions-catalog.types';
import { DialogActionsComponent } from '../../shared/dialog-actions/dialog-actions';

@Component({
  selector: 'app-conditions-entry-dialog',
  standalone: true,
  imports: [Dialog, ReactiveFormsModule, InputText, Textarea, DialogActionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="closed.emit()"
      [header]="isEdit ? 'Modifica condizione' : 'Nuova condizione'"
      [modal]="true"
      [style]="{ width: '480px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="bo-field">
          <label class="bo-label" for="ce-slug">Slug</label>
          <input pInputText id="ce-slug" formControlName="slug" placeholder="slug" class="bo-input w-full" />
        </div>

        <div class="bo-field">
          <label class="bo-label" for="ce-name">Nome</label>
          <input pInputText id="ce-name" formControlName="name" placeholder="nome" class="bo-input w-full" />
        </div>

        <div style="display: flex; gap: 12px;">
          <div class="bo-field" style="flex: 1;">
            <label class="bo-label" for="ce-severity">Gravità</label>
            <select id="ce-severity" class="bo-select w-full" formControlName="defaultSeverity">
              <option value="minor">minor</option>
              <option value="major">major</option>
            </select>
          </div>

          <div class="bo-field" style="flex: 1;">
            <label class="bo-label" for="ce-polarity">Polarità</label>
            <select id="ce-polarity" class="bo-select w-full" formControlName="polarity">
              <option value="positive">positive</option>
              <option value="negative">negative</option>
            </select>
          </div>
        </div>

        <div class="bo-field">
          <label class="bo-label" for="ce-description">Descrizione</label>
          <textarea pTextarea id="ce-description" formControlName="description" rows="3" class="bo-input w-full"></textarea>
        </div>

        <app-dialog-actions [error]="error()" [saving]="saving()" (cancelled)="closed.emit()" />
      </form>
    </p-dialog>
  `,
})
export class ConditionsEntryDialogComponent extends CatalogEntryDialogBase<
  ConditionCatalogEntryDto,
  ConditionCatalogEntryShape
> {
  private readonly api = inject(ConditionsCatalogApiService);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    slug: '',
    name: '',
    defaultSeverity: 'minor' as ConditionSeverity,
    polarity: 'negative' as ConditionPolarity,
    description: '',
  });

  protected resetForm(entry: ConditionCatalogEntryDto | null): void {
    this.form.reset({
      slug: entry?.slug ?? '',
      name: entry?.name ?? '',
      defaultSeverity: entry?.defaultSeverity ?? 'minor',
      polarity: entry?.polarity ?? 'negative',
      description: entry?.description ?? '',
    });
  }

  protected readForm(): CatalogFormRead<ConditionCatalogEntryShape> {
    const { slug, name, defaultSeverity, polarity, description } = this.form.getRawValue();
    if (!slug.trim() || !name.trim()) return { error: 'Slug e nome sono obbligatori' };
    return {
      slug: slug.trim(),
      entry: { name: name.trim(), defaultSeverity, polarity, description: description.trim() || undefined },
    };
  }

  protected patch(ops: CatalogOp<ConditionCatalogEntryShape>[]) {
    return this.api.patchSchema(ops);
  }
}
