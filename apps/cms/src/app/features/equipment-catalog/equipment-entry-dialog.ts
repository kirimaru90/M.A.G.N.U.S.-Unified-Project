import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { CatalogEntryDialogBase, CatalogFormRead } from '../../core/catalog/catalog-entry-dialog.base';
import type { CatalogOp } from '../../core/catalog/catalog-ops';
import { EquipmentCatalogApiService } from '../../core/equipment-catalog/equipment-catalog-api.service';
import type {
  EquipmentCatalogEntryDto,
  EquipmentCatalogEntryShape,
  EquipmentKind,
  EquipmentTagDto,
  EquipmentTagType,
} from '../../core/equipment-catalog/equipment-catalog.types';
import { DialogActionsComponent } from '../../shared/dialog-actions/dialog-actions';
import { KIND_OPTIONS, isTagged } from './equipment-kinds';

type TagGroup = FormGroup<{ name: FormControl<string>; type: FormControl<EquipmentTagType> }>;

@Component({
  selector: 'app-equipment-entry-dialog',
  standalone: true,
  imports: [Dialog, ReactiveFormsModule, InputText, Textarea, Checkbox, DialogActionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="closed.emit()"
      [header]="isEdit ? 'Modifica equipaggiamento' : 'Nuovo equipaggiamento'"
      [modal]="true"
      [style]="{ width: '540px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="bo-field">
          <label class="bo-label" for="ee-slug">Slug</label>
          <input pInputText id="ee-slug" formControlName="slug" placeholder="slug" class="bo-input w-full" />
        </div>

        <div class="bo-field">
          <label class="bo-label" for="ee-name">Nome</label>
          <input pInputText id="ee-name" formControlName="name" placeholder="nome" class="bo-input w-full" />
        </div>

        <div class="bo-field">
          <label class="bo-label" for="ee-kind">Tipo</label>
          <select id="ee-kind" class="bo-select w-full" formControlName="kind" data-testid="kind">
            @for (opt of kindOptions; track opt.value) {
              <option [value]="opt.value">{{ opt.label }}</option>
            }
          </select>
        </div>

        @if (tagged()) {
          <div class="bo-field" data-testid="tag-editor">
            <span class="bo-label">Tag</span>
            <div formArrayName="tags">
              @for (tag of form.controls.tags.controls; track tag; let i = $index) {
                <div [formGroupName]="i" style="display: flex; gap: 4px; align-items: center; margin-bottom: 4px;">
                  <input pInputText formControlName="name" placeholder="nome tag" style="flex: 1;" />
                  <span class="bo-pill" [class.active]="tag.controls.type.value === 'core'">{{ tag.controls.type.value }}</span>
                  <button type="button" class="bo-btn ghost icon danger" title="Rimuovi tag" (click)="removeTag(i)">✕</button>
                </div>
              }
            </div>
            <div style="display: flex; gap: 4px;">
              <button type="button" class="bo-btn ghost" style="font-size: 12px;" (click)="addTag('core')">+ core</button>
              <button type="button" class="bo-btn ghost" style="font-size: 12px;" (click)="addTag('extra')">+ extra</button>
            </div>
          </div>
        } @else {
          <div class="bo-field">
            <label class="bo-label" for="ee-description">Descrizione</label>
            <textarea
              pTextarea
              id="ee-description"
              data-testid="description"
              formControlName="description"
              rows="3"
              class="bo-input w-full"
            ></textarea>
          </div>
        }

        @if (kind() !== 'misc') {
          <div class="bo-field-row" data-testid="starter-editor">
            <p-checkbox formControlName="isStarter" [binary]="true" inputId="ee-starter" />
            <label for="ee-starter" class="bo-label" style="margin-left: 8px;">Iniziale</label>
          </div>
        }

        <app-dialog-actions [error]="error()" [saving]="saving()" (cancelled)="closed.emit()" />
      </form>
    </p-dialog>
  `,
})
export class EquipmentEntryDialogComponent extends CatalogEntryDialogBase<
  EquipmentCatalogEntryDto,
  EquipmentCatalogEntryShape
> {
  private readonly api = inject(EquipmentCatalogApiService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly kindOptions = KIND_OPTIONS;

  protected readonly form = this.fb.group({
    slug: '',
    name: '',
    kind: 'weapon' as EquipmentKind,
    tags: this.fb.array<TagGroup>([]),
    isStarter: false,
    description: '',
  });

  protected readonly kind = toSignal(this.form.controls.kind.valueChanges, {
    initialValue: this.form.controls.kind.value,
  });

  protected tagged(): boolean {
    return isTagged(this.kind());
  }

  private tagGroup(tag: EquipmentTagDto): TagGroup {
    return this.fb.group({ name: tag.name, type: tag.type });
  }

  protected addTag(type: EquipmentTagType): void {
    this.form.controls.tags.push(this.tagGroup({ name: '', type }));
  }

  protected removeTag(index: number): void {
    this.form.controls.tags.removeAt(index);
  }

  protected resetForm(entry: EquipmentCatalogEntryDto | null): void {
    this.form.controls.tags.clear();
    for (const t of entry?.tags ?? []) this.form.controls.tags.push(this.tagGroup(t));
    this.form.reset({
      slug: entry?.slug ?? '',
      name: entry?.name ?? '',
      kind: entry?.kind ?? 'weapon',
      isStarter: entry?.isStarter ?? false,
      description: entry?.description ?? '',
    });
  }

  /**
   * Sends only the fields the API accepts for the kind: tags for weapon/armor,
   * a description for consumable/misc (quantity is a per-character inventory
   * concern, never a template field). Sending tags on a consumable would be a
   * 400. `misc` templates are never starters.
   */
  protected readForm(): CatalogFormRead<EquipmentCatalogEntryShape> {
    const v = this.form.getRawValue();
    if (!v.slug.trim() || !v.name.trim()) return { error: 'Slug e nome sono obbligatori' };
    const tagged = isTagged(v.kind);
    if (tagged && v.tags.some((t) => !t.name.trim())) return { error: 'Ogni tag deve avere un nome' };

    const base: EquipmentCatalogEntryShape = {
      name: v.name.trim(),
      kind: v.kind,
      isStarter: v.kind === 'misc' ? false : v.isStarter,
      description: v.description.trim() || undefined,
    };
    return {
      slug: v.slug.trim(),
      entry: tagged ? { ...base, tags: v.tags.map((t) => ({ name: t.name.trim(), type: t.type })) } : base,
    };
  }

  protected patch(ops: CatalogOp<EquipmentCatalogEntryShape>[]) {
    return this.api.patchSchema(ops);
  }
}
