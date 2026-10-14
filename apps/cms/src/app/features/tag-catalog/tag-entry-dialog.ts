import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { CatalogEntryDialogBase, CatalogFormRead } from '../../core/catalog/catalog-entry-dialog.base';
import type { CatalogOp } from '../../core/catalog/catalog-ops';
import { TagCatalogApiService } from '../../core/tag-catalog/tag-catalog-api.service';
import type { TagCatalogEntryDto, TagCatalogEntryShape } from '../../core/tag-catalog/tag-catalog.types';
import { DialogActionsComponent } from '../../shared/dialog-actions/dialog-actions';

@Component({
  selector: 'app-tag-entry-dialog',
  standalone: true,
  imports: [Dialog, ReactiveFormsModule, InputText, DialogActionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="closed.emit()"
      [header]="isEdit ? 'Modifica tag' : 'Nuovo tag'"
      [modal]="true"
      [style]="{ width: '420px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="bo-field">
          <label class="bo-label" for="te-slug">Slug</label>
          <input pInputText id="te-slug" formControlName="slug" placeholder="slug" class="bo-input w-full" />
        </div>

        <div class="bo-field">
          <label class="bo-label" for="te-name">Nome</label>
          <input pInputText id="te-name" formControlName="name" placeholder="nome" class="bo-input w-full" />
        </div>

        <app-dialog-actions [error]="error()" [saving]="saving()" (cancelled)="closed.emit()" />
      </form>
    </p-dialog>
  `,
})
export class TagEntryDialogComponent extends CatalogEntryDialogBase<TagCatalogEntryDto, TagCatalogEntryShape> {
  private readonly api = inject(TagCatalogApiService);

  protected readonly form = inject(FormBuilder).nonNullable.group({ slug: '', name: '' });

  protected resetForm(entry: TagCatalogEntryDto | null): void {
    this.form.reset({ slug: entry?.slug ?? '', name: entry?.name ?? '' });
  }

  protected readForm(): CatalogFormRead<TagCatalogEntryShape> {
    const slug = this.form.controls.slug.value.trim();
    const name = this.form.controls.name.value.trim();
    if (!slug || !name) return { error: 'Slug e nome sono obbligatori' };
    return { slug, entry: { name } };
  }

  protected patch(ops: CatalogOp<TagCatalogEntryShape>[]) {
    return this.api.patchSchema(ops);
  }
}
