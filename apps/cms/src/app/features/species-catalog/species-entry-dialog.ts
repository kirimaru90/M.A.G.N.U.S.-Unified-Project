import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { CatalogEntryDialogBase, CatalogFormRead } from '../../core/catalog/catalog-entry-dialog.base';
import type { CatalogOp } from '../../core/catalog/catalog-ops';
import { SpeciesCatalogApiService } from '../../core/species-catalog/species-catalog-api.service';
import type { SpeciesCatalogEntryDto, SpeciesCatalogEntryShape } from '../../core/species-catalog/species-catalog.types';
import { DialogActionsComponent } from '../../shared/dialog-actions/dialog-actions';

const isPositiveInteger = (value: number): boolean => Number.isInteger(Number(value)) && Number(value) >= 1;

/**
 * Species slugs are fixed once created: characters reference them, so the
 * slug is read-only when editing and an edit is always a plain `update`.
 */
@Component({
  selector: 'app-species-entry-dialog',
  standalone: true,
  imports: [Dialog, ReactiveFormsModule, InputText, Textarea, DialogActionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="closed.emit()"
      [header]="isEdit ? 'Modifica specie' : 'Nuova specie'"
      [modal]="true"
      [style]="{ width: '520px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="bo-field">
          <label class="bo-label" for="spe-slug">Slug</label>
          <input pInputText id="spe-slug" formControlName="slug" placeholder="slug" class="bo-input w-full" />
          @if (isEdit) {
            <small style="color: var(--bo-text-faint);">Lo slug non è modificabile dopo la creazione.</small>
          }
        </div>

        <div class="bo-field">
          <label class="bo-label" for="spe-name">Nome</label>
          <input pInputText id="spe-name" formControlName="name" placeholder="nome" class="bo-input w-full" />
        </div>

        <div class="bo-field">
          <label class="bo-label" for="spe-permesso">Permesso</label>
          <textarea pTextarea id="spe-permesso" formControlName="permesso" rows="2" class="bo-input w-full"></textarea>
        </div>

        <div class="bo-field">
          <label class="bo-label" for="spe-svantaggio">Svantaggio</label>
          <textarea pTextarea id="spe-svantaggio" formControlName="svantaggio" rows="2" class="bo-input w-full"></textarea>
        </div>

        <div style="display: flex; gap: 12px;">
          <div class="bo-field" style="flex: 1;">
            <label class="bo-label" for="spe-budget">Budget maestria</label>
            <input pInputText type="number" min="1" step="1" id="spe-budget" formControlName="tagSkillBudget" class="bo-input w-full" />
          </div>

          <div class="bo-field" style="flex: 1;">
            <label class="bo-label" for="spe-margin">Margine salute</label>
            <input pInputText type="number" min="1" step="1" id="spe-margin" formControlName="margin" class="bo-input w-full" />
          </div>
        </div>

        <div class="bo-field">
          <label class="bo-label" for="spe-description">Descrizione</label>
          <textarea pTextarea id="spe-description" formControlName="description" rows="2" class="bo-input w-full"></textarea>
        </div>

        <app-dialog-actions [error]="error()" [saving]="saving()" (cancelled)="closed.emit()" />
      </form>
    </p-dialog>
  `,
})
export class SpeciesEntryDialogComponent extends CatalogEntryDialogBase<SpeciesCatalogEntryDto, SpeciesCatalogEntryShape> {
  private readonly api = inject(SpeciesCatalogApiService);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    slug: '',
    name: '',
    permesso: '',
    svantaggio: '',
    tagSkillBudget: 3,
    margin: 4,
    description: '',
  });

  protected resetForm(entry: SpeciesCatalogEntryDto | null): void {
    this.form.reset({
      slug: entry?.slug ?? '',
      name: entry?.name ?? '',
      permesso: entry?.permesso ?? '',
      svantaggio: entry?.svantaggio ?? '',
      tagSkillBudget: entry?.tagSkillBudget ?? 3,
      margin: entry?.margin ?? 4,
      description: entry?.description ?? '',
    });
    if (entry) this.form.controls.slug.disable();
    else this.form.controls.slug.enable();
  }

  protected readForm(): CatalogFormRead<SpeciesCatalogEntryShape> {
    const v = this.form.getRawValue();
    const slug = v.slug.trim();
    const name = v.name.trim();
    const permesso = v.permesso.trim();
    const svantaggio = v.svantaggio.trim();
    if (!slug || !name || !permesso || !svantaggio) {
      return { error: 'Slug, nome, permesso e svantaggio sono obbligatori' };
    }
    if (!isPositiveInteger(v.tagSkillBudget)) return { error: 'Il budget maestria deve essere un intero positivo' };
    if (!isPositiveInteger(v.margin)) return { error: 'Il margine salute deve essere un intero positivo' };
    return {
      slug,
      entry: {
        name,
        permesso,
        svantaggio,
        tagSkillBudget: Number(v.tagSkillBudget),
        margin: Number(v.margin),
        description: v.description.trim() || undefined,
      },
    };
  }

  protected patch(ops: CatalogOp<SpeciesCatalogEntryShape>[]) {
    return this.api.patchSchema(ops);
  }
}
