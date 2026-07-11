import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { Toast } from 'primeng/toast';
import { EquipmentCatalogApiService } from '../../core/equipment-catalog/equipment-catalog-api.service';
import type {
  EquipmentCatalogEntryDto,
  EquipmentCatalogEntryShape,
  EquipmentKind,
  EquipmentTagDto,
  EquipmentTagType,
} from '../../core/equipment-catalog/equipment-catalog.types';

interface DraftRow {
  slug: string;
  name: string;
  kind: EquipmentKind;
  tags: EquipmentTagDto[];
  defaultQuantity: number;
  isStarter: boolean;
  description: string;
}

const emptyDraft = (): DraftRow => ({
  slug: '',
  name: '',
  kind: 'weapon',
  tags: [],
  defaultQuantity: 1,
  isStarter: false,
  description: '',
});

/** Consumables carry no tags and a quantity; weapons and armor are the reverse. */
export const isTagged = (kind: EquipmentKind): boolean => kind !== 'consumable';

@Component({
  selector: 'app-equipment-catalog-page',
  standalone: true,
  imports: [FormsModule, TableModule, ButtonModule, ConfirmDialog, Toast, InputTextModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-toast />
    <p-confirmdialog />

    <div class="bo-page">
      <div class="bo-page-head">
        <h1>Catalogo equipaggiamento</h1>
      </div>

      <div class="bo-card">
        <p-table
          [value]="entries() ?? []"
          [loading]="entries() === undefined"
          [tableStyle]="{ 'min-width': '900px' }"
          styleClass="bo-table"
        >
          <ng-template pTemplate="header">
            <tr>
              <th>Slug</th>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Tag / Quantità</th>
              <th>Iniziale</th>
              <th>Azioni</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-entry>
            @if (editingSlug() === entry.slug) {
              <tr>
                <td><input pInputText [(ngModel)]="draft.slug" style="width: 100%;" /></td>
                <td><input pInputText [(ngModel)]="draft.name" style="width: 100%;" /></td>
                <td>
                  <select class="bo-select" [(ngModel)]="draft.kind" style="width: 100%;">
                    <option value="weapon">weapon</option>
                    <option value="armor">armor</option>
                    <option value="consumable">consumable</option>
                  </select>
                </td>
                <td>
                  @if (draftIsTagged()) {
                    <div data-testid="tag-editor">
                      @for (tag of draft.tags; track $index) {
                        <div style="display: flex; gap: 4px; margin-bottom: 4px;">
                          <input pInputText [(ngModel)]="tag.name" style="flex: 1;" />
                          <span class="bo-pill" [class.active]="tag.type === 'core'">{{
                            tag.type
                          }}</span>
                          <button
                            type="button"
                            class="bo-btn ghost icon danger"
                            title="Rimuovi tag"
                            (click)="removeTag($index)"
                          >
                            ✕
                          </button>
                        </div>
                      }
                      <div style="display: flex; gap: 4px;">
                        <button
                          type="button"
                          class="bo-btn ghost"
                          style="font-size: 12px;"
                          (click)="addTag('core')"
                        >
                          + core
                        </button>
                        <button
                          type="button"
                          class="bo-btn ghost"
                          style="font-size: 12px;"
                          (click)="addTag('extra')"
                        >
                          + extra
                        </button>
                      </div>
                    </div>
                  } @else {
                    <input
                      data-testid="default-quantity"
                      pInputText
                      type="number"
                      min="0"
                      [(ngModel)]="draft.defaultQuantity"
                      style="width: 100%;"
                    />
                  }
                </td>
                <td>
                  <input type="checkbox" [(ngModel)]="draft.isStarter" aria-label="Iniziale" />
                </td>
                <td>
                  <div
                    style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;"
                  >
                    @if (rowError()) {
                      <small style="color: var(--p-red-500, #ef4444);">{{ rowError() }}</small>
                    }
                    <div style="display: flex; gap: 4px;">
                      <button
                        type="button"
                        class="bo-btn primary"
                        style="font-size: 12px; padding: 4px 10px; height: auto;"
                        (click)="submitEdit(entry)"
                      >
                        Salva
                      </button>
                      <button
                        type="button"
                        class="bo-btn ghost"
                        style="font-size: 12px; padding: 4px 10px; height: auto;"
                        (click)="cancelEdit()"
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            } @else {
              <tr>
                <td style="font-family: monospace;">{{ entry.slug }}</td>
                <td>{{ entry.name }}</td>
                <td>
                  <span class="bo-pill">{{ entry.kind }}</span>
                </td>
                <td>
                  @if (entry.kind === 'consumable') {
                    ×{{ entry.defaultQuantity ?? 0 }}
                  } @else {
                    @for (tag of entry.tags ?? []; track tag.name) {
                      <span class="bo-pill" [class.active]="tag.type === 'core'">{{
                        tag.name
                      }}</span>
                    }
                  }
                </td>
                <td>
                  <input
                    type="checkbox"
                    [attr.data-testid]="'starter-' + entry.slug"
                    [checked]="entry.isStarter"
                    aria-label="Iniziale"
                    (change)="toggleStarter(entry)"
                  />
                </td>
                <td>
                  <div class="row-actions">
                    <button
                      type="button"
                      class="bo-btn ghost icon"
                      title="Modifica"
                      (click)="startEdit(entry)"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="bo-btn ghost icon danger"
                      title="Elimina"
                      (click)="confirmDelete(entry)"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            }
          </ng-template>

          <ng-template pTemplate="footer">
            @if (addRowVisible()) {
              <tr>
                <td>
                  <input
                    pInputText
                    [(ngModel)]="draft.slug"
                    placeholder="slug"
                    style="width: 100%;"
                  />
                </td>
                <td>
                  <input
                    pInputText
                    [(ngModel)]="draft.name"
                    placeholder="nome"
                    style="width: 100%;"
                  />
                </td>
                <td>
                  <select class="bo-select" [(ngModel)]="draft.kind" style="width: 100%;">
                    <option value="weapon">weapon</option>
                    <option value="armor">armor</option>
                    <option value="consumable">consumable</option>
                  </select>
                </td>
                <td>
                  @if (draftIsTagged()) {
                    <div data-testid="tag-editor">
                      @for (tag of draft.tags; track $index) {
                        <div style="display: flex; gap: 4px; margin-bottom: 4px;">
                          <input pInputText [(ngModel)]="tag.name" style="flex: 1;" />
                          <span class="bo-pill" [class.active]="tag.type === 'core'">{{
                            tag.type
                          }}</span>
                          <button
                            type="button"
                            class="bo-btn ghost icon danger"
                            title="Rimuovi tag"
                            (click)="removeTag($index)"
                          >
                            ✕
                          </button>
                        </div>
                      }
                      <div style="display: flex; gap: 4px;">
                        <button
                          type="button"
                          class="bo-btn ghost"
                          style="font-size: 12px;"
                          (click)="addTag('core')"
                        >
                          + core
                        </button>
                        <button
                          type="button"
                          class="bo-btn ghost"
                          style="font-size: 12px;"
                          (click)="addTag('extra')"
                        >
                          + extra
                        </button>
                      </div>
                    </div>
                  } @else {
                    <input
                      data-testid="default-quantity"
                      pInputText
                      type="number"
                      min="0"
                      [(ngModel)]="draft.defaultQuantity"
                      style="width: 100%;"
                    />
                  }
                </td>
                <td>
                  <input type="checkbox" [(ngModel)]="draft.isStarter" aria-label="Iniziale" />
                </td>
                <td>
                  <div
                    style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;"
                  >
                    @if (rowError()) {
                      <small style="color: var(--p-red-500, #ef4444);">{{ rowError() }}</small>
                    }
                    <div style="display: flex; gap: 4px;">
                      <button
                        type="button"
                        class="bo-btn primary"
                        style="font-size: 12px; padding: 4px 10px; height: auto;"
                        (click)="submitAdd()"
                      >
                        Salva
                      </button>
                      <button
                        type="button"
                        class="bo-btn ghost"
                        style="font-size: 12px; padding: 4px 10px; height: auto;"
                        (click)="cancelAdd()"
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            }
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="6" style="text-align: center; color: var(--bo-text-faint);">
                Nessun equipaggiamento nel catalogo
              </td>
            </tr>
          </ng-template>
        </p-table>

        @if (!addRowVisible()) {
          <button
            type="button"
            class="bo-btn ghost"
            style="margin-top: 8px; font-size: 13px;"
            (click)="showAddRow()"
          >
            + Aggiungi
          </button>
        }
      </div>
    </div>
  `,
})
export class EquipmentCatalogPage implements OnInit {
  private readonly api = inject(EquipmentCatalogApiService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  protected readonly entries = signal<EquipmentCatalogEntryDto[] | undefined>(undefined);
  protected readonly editingSlug = signal<string | null>(null);
  protected readonly addRowVisible = signal(false);
  protected readonly rowError = signal<string | null>(null);
  protected draft: DraftRow = emptyDraft();

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.list().subscribe((list) => this.entries.set(list));
  }

  /** Drives which editor the kind column shows: tags, or a quantity. */
  protected draftIsTagged(): boolean {
    return isTagged(this.draft.kind);
  }

  protected addTag(type: EquipmentTagType): void {
    this.draft.tags = [...this.draft.tags, { name: '', type }];
  }

  protected removeTag(index: number): void {
    this.draft.tags = this.draft.tags.filter((_, i) => i !== index);
  }

  protected showAddRow(): void {
    this.draft = emptyDraft();
    this.rowError.set(null);
    this.editingSlug.set(null);
    this.addRowVisible.set(true);
  }

  protected cancelAdd(): void {
    this.addRowVisible.set(false);
    this.rowError.set(null);
  }

  /**
   * Build the `entry` payload for the current draft, sending only the fields
   * the API accepts for that kind: tags for weapon/armor, defaultQuantity for
   * consumable. Sending both would be a 400.
   */
  private draftEntry(): EquipmentCatalogEntryShape {
    const base: EquipmentCatalogEntryShape = {
      name: this.draft.name.trim(),
      kind: this.draft.kind,
      isStarter: this.draft.isStarter,
      description: this.draft.description.trim() || undefined,
    };
    return isTagged(this.draft.kind)
      ? { ...base, tags: this.draft.tags.map((t) => ({ name: t.name.trim(), type: t.type })) }
      : { ...base, defaultQuantity: Number(this.draft.defaultQuantity) };
  }

  private validateDraft(): string | null {
    if (!this.draft.slug.trim() || !this.draft.name.trim()) return 'Slug e nome sono obbligatori';
    if (isTagged(this.draft.kind)) {
      if (this.draft.tags.some((t) => !t.name.trim())) return 'Ogni tag deve avere un nome';
    } else {
      const q = Number(this.draft.defaultQuantity);
      if (!Number.isInteger(q) || q < 0) return 'La quantità deve essere un intero non negativo';
    }
    return null;
  }

  protected submitAdd(): void {
    const invalid = this.validateDraft();
    if (invalid) {
      this.rowError.set(invalid);
      return;
    }
    this.api
      .patchSchema([{ action: 'add', slug: this.draft.slug.trim(), entry: this.draftEntry() }])
      .subscribe({
        next: () => {
          this.addRowVisible.set(false);
          this.rowError.set(null);
          this.load();
          this.messageService.add({ severity: 'success', summary: 'Equipaggiamento aggiunto' });
        },
        // The pending draft is left intact so the admin can correct and retry.
        error: (err) => this.rowError.set(this.errorMessage(err)),
      });
  }

  protected startEdit(entry: EquipmentCatalogEntryDto): void {
    this.addRowVisible.set(false);
    this.draft = {
      slug: entry.slug,
      name: entry.name,
      kind: entry.kind,
      tags: (entry.tags ?? []).map((t) => ({ ...t })),
      defaultQuantity: entry.defaultQuantity ?? 0,
      isStarter: entry.isStarter,
      description: entry.description ?? '',
    };
    this.rowError.set(null);
    this.editingSlug.set(entry.slug);
  }

  protected cancelEdit(): void {
    this.editingSlug.set(null);
    this.rowError.set(null);
  }

  protected submitEdit(entry: EquipmentCatalogEntryDto): void {
    const invalid = this.validateDraft();
    if (invalid) {
      this.rowError.set(invalid);
      return;
    }
    const newSlug = this.draft.slug.trim();

    const op =
      newSlug !== entry.slug
        ? { action: 'rename' as const, slug: entry.slug, rename: newSlug }
        : { action: 'update' as const, slug: entry.slug, entry: this.draftEntry() };

    this.api.patchSchema([op]).subscribe({
      next: () => {
        this.editingSlug.set(null);
        this.rowError.set(null);
        this.load();
        this.messageService.add({ severity: 'success', summary: 'Equipaggiamento aggiornato' });
      },
      error: (err) => this.rowError.set(this.errorMessage(err)),
    });
  }

  /**
   * `isStarter` alone decides what the wizard offers, so it toggles in place —
   * no edit mode. Only the flag is sent: the API merges it into the stored
   * entry, and `slug` belongs on the op, not inside `entry`.
   */
  protected toggleStarter(entry: EquipmentCatalogEntryDto): void {
    this.api
      .patchSchema([{ action: 'update', slug: entry.slug, entry: { isStarter: !entry.isStarter } }])
      .subscribe({
        next: () => this.load(),
        error: () =>
          this.messageService.add({
            severity: 'error',
            summary: "Errore durante l'aggiornamento",
          }),
      });
  }

  protected confirmDelete(entry: EquipmentCatalogEntryDto): void {
    // No in-use warning: characters hold independent copies, not references.
    this.confirmationService.confirm({
      message: `Eliminare "${entry.name}" dal catalogo?`,
      acceptLabel: 'Elimina',
      rejectLabel: 'Annulla',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.api.patchSchema([{ action: 'delete', slug: entry.slug }]).subscribe({
          next: () => {
            this.load();
            this.messageService.add({ severity: 'success', summary: 'Equipaggiamento eliminato' });
          },
          error: () =>
            this.messageService.add({
              severity: 'error',
              summary: "Errore durante l'eliminazione",
            }),
        });
      },
    });
  }

  private errorMessage(err: unknown): string {
    const status = (err as { status?: number })?.status;
    if (status === 409) return 'Slug già esistente';
    if (status === 400) return 'Dati non validi';
    return 'Errore imprevisto';
  }
}
