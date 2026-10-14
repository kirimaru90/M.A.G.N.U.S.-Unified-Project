import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { CatalogEntryDialogBase, CatalogFormRead } from '../../core/catalog/catalog-entry-dialog.base';
import type { CatalogOp } from '../../core/catalog/catalog-ops';
import { SkillsCatalogApiService } from '../../core/skills-catalog/skills-catalog-api.service';
import type { SkillCatalogEntryDto, SkillCatalogEntryShape } from '../../core/skills-catalog/skills-catalog.types';
import { DialogActionsComponent } from '../../shared/dialog-actions/dialog-actions';

@Component({
  selector: 'app-skills-entry-dialog',
  standalone: true,
  imports: [Dialog, ReactiveFormsModule, InputText, Textarea, DialogActionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="closed.emit()"
      [header]="isEdit ? 'Modifica abilità' : 'Nuova abilità'"
      [modal]="true"
      [style]="{ width: '480px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="bo-field">
          <label class="bo-label" for="se-slug">Slug</label>
          <input pInputText id="se-slug" formControlName="slug" placeholder="slug" class="bo-input w-full" />
        </div>

        <div class="bo-field">
          <label class="bo-label" for="se-name">Nome</label>
          <input pInputText id="se-name" formControlName="name" placeholder="nome" class="bo-input w-full" />
        </div>

        <div class="bo-field">
          <label class="bo-label" for="se-description">Descrizione</label>
          <textarea pTextarea id="se-description" formControlName="description" rows="3" class="bo-input w-full"></textarea>
        </div>

        <app-dialog-actions [error]="error()" [saving]="saving()" (cancelled)="closed.emit()" />
      </form>
    </p-dialog>
  `,
})
export class SkillsEntryDialogComponent extends CatalogEntryDialogBase<SkillCatalogEntryDto, SkillCatalogEntryShape> {
  private readonly api = inject(SkillsCatalogApiService);

  protected readonly form = inject(FormBuilder).nonNullable.group({ slug: '', name: '', description: '' });

  protected resetForm(entry: SkillCatalogEntryDto | null): void {
    this.form.reset({
      slug: entry?.slug ?? '',
      name: entry?.name ?? '',
      description: entry?.description ?? '',
    });
  }

  protected readForm(): CatalogFormRead<SkillCatalogEntryShape> {
    const { slug, name, description } = this.form.getRawValue();
    if (!slug.trim() || !name.trim()) return { error: 'Slug e nome sono obbligatori' };
    return { slug: slug.trim(), entry: { name: name.trim(), description: description.trim() || undefined } };
  }

  protected patch(ops: CatalogOp<SkillCatalogEntryShape>[]) {
    return this.api.patchSchema(ops);
  }
}
