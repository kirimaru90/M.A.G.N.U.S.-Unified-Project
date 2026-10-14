import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { TableModule } from 'primeng/table';
import { Toast } from 'primeng/toast';
import type { CatalogSaveKind } from '../../core/catalog/catalog-entry-dialog.base';
import { EquipmentCatalogApiService } from '../../core/equipment-catalog/equipment-catalog-api.service';
import type { EquipmentCatalogEntryDto, EquipmentKind } from '../../core/equipment-catalog/equipment-catalog.types';
import { EquipmentEntryDialogComponent } from './equipment-entry-dialog';
import { KIND_OPTIONS } from './equipment-kinds';

@Component({
  selector: 'app-equipment-catalog-page',
  standalone: true,
  imports: [FormsModule, TableModule, ButtonModule, ConfirmDialog, Toast, InputTextModule, MultiSelect, EquipmentEntryDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-toast />
    <p-confirmdialog />

    <div class="bo-page">
      <div class="bo-page-head">
        <h1>Catalogo equipaggiamento</h1>
        <div class="bo-page-head-actions">
          <button type="button" class="bo-btn primary" (click)="openCreate()">
            + Aggiungi
          </button>
        </div>
      </div>

      <div class="bo-card">
        <div class="bo-filter-bar">
          <input
            pInputText
            data-testid="filter-name"
            [ngModel]="nameFilter()"
            (ngModelChange)="nameFilter.set($event)"
            placeholder="Filtra per nome"
          />
          <p-multiselect
            data-testid="filter-kind"
            [options]="kindOptions"
            optionLabel="label"
            optionValue="value"
            [ngModel]="kindFilter()"
            (ngModelChange)="kindFilter.set($event)"
            placeholder="Tutti i tipi"
            [showToggleAll]="false"
            [style]="{ 'min-width': '200px' }"
          />
          <p-multiselect
            data-testid="filter-tag"
            [options]="availableTags()"
            [ngModel]="tagFilter()"
            (ngModelChange)="tagFilter.set($event)"
            [filter]="true"
            filterPlaceholder="Cerca tag…"
            placeholder="Tutti i tag"
            [showToggleAll]="false"
            [style]="{ 'min-width': '200px' }"
          />
          <label style="display: inline-flex; gap: 4px; align-items: center;">
            <input
              type="checkbox"
              data-testid="filter-starter"
              [ngModel]="starterFilter()"
              (ngModelChange)="starterFilter.set($event)"
            />
            Solo iniziali
          </label>
        </div>

        <p-table
          [value]="filteredEntries() ?? []"
          [loading]="entries() === undefined"
          [tableStyle]="{ 'min-width': '900px' }"
          styleClass="bo-table"
          sortField="name"
          [sortOrder]="1"
        >
          <ng-template pTemplate="header">
            <tr>
              <th pSortableColumn="slug">Slug <p-sortIcon field="slug" /></th>
              <th pSortableColumn="name">Nome <p-sortIcon field="name" /></th>
              <th pSortableColumn="kind">Tipo <p-sortIcon field="kind" /></th>
              <th>Tag / Descrizione</th>
              <th pSortableColumn="isStarter">Iniziale <p-sortIcon field="isStarter" /></th>
              <th>Azioni</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-entry>
            <tr>
              <td style="font-family: monospace;">{{ entry.slug }}</td>
              <td>{{ entry.name }}</td>
              <td>
                <span class="bo-pill">{{ entry.kind }}</span>
              </td>
              <td>
                @if (entry.kind === 'consumable' || entry.kind === 'misc') {
                  {{ entry.description }}
                } @else {
                  @for (tag of entry.tags ?? []; track tag.name) {
                    <span class="bo-pill" [class.active]="tag.type === 'core'">{{
                      tag.name
                    }}</span>
                  }
                }
              </td>
              <td>
                @if (entry.kind !== 'misc') {
                  <span
                    class="bo-pill"
                    [class.active]="entry.isStarter"
                    [attr.data-testid]="'starter-' + entry.slug"
                  >
                    {{ entry.isStarter ? 'Sì' : 'No' }}
                  </span>
                }
              </td>
              <td>
                <div class="row-actions">
                  <button
                    type="button"
                    class="bo-btn ghost icon"
                    title="Modifica"
                    (click)="openEdit(entry)"
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
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="6" style="text-align: center; color: var(--bo-text-faint);">
                Nessun equipaggiamento nel catalogo
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>

    <app-equipment-entry-dialog
      [visible]="dialogVisible()"
      [entry]="dialogEntry()"
      (closed)="dialogVisible.set(false)"
      (saved)="onSaved($event)"
    />
  `,
})
export class EquipmentCatalogPage implements OnInit {
  private readonly api = inject(EquipmentCatalogApiService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  protected readonly entries = signal<EquipmentCatalogEntryDto[] | undefined>(undefined);
  protected readonly dialogVisible = signal(false);
  protected readonly dialogEntry = signal<EquipmentCatalogEntryDto | null>(null);

  // A mutable copy: PrimeNG's p-multiselect [options] input is typed as a
  // mutable array, so the readonly KIND_OPTIONS cannot be bound directly.
  protected readonly kindOptions = [...KIND_OPTIONS];

  // --- Client-side filter bar — all filters AND together. ---
  protected readonly nameFilter = signal('');
  protected readonly starterFilter = signal(false);
  protected readonly kindFilter = signal<EquipmentKind[]>([]);
  protected readonly tagFilter = signal<string[]>([]);

  /**
   * Distinct tag names present across the loaded catalog (weapon/armor entries
   * carry tags; others don't), sorted for stable display. Drives the tag filter
   * options — derived from the entries, not the tag catalog, so the choices are
   * exactly the tags actually in use.
   */
  protected readonly availableTags = computed(() => {
    const all = this.entries();
    if (!all) return [];
    const names = new Set<string>();
    for (const e of all) {
      for (const t of e.tags ?? []) {
        if (t.name) names.add(t.name);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  });

  /**
   * The loaded catalog narrowed by the active filters. Returns `undefined` while
   * the catalog is still loading (so the table keeps showing its loading state)
   * and re-derives whenever `entries()` reloads after an add/update/delete.
   */
  protected readonly filteredEntries = computed(() => {
    const all = this.entries();
    if (!all) return all;
    const name = this.nameFilter().trim().toLowerCase();
    const starterOnly = this.starterFilter();
    const kinds = this.kindFilter();
    const tags = this.tagFilter();
    return all.filter((e) => {
      if (name && !e.name.toLowerCase().includes(name)) return false;
      if (starterOnly && !e.isStarter) return false;
      if (kinds.length > 0 && !kinds.includes(e.kind)) return false;
      // OR within the tag filter: the entry matches if it carries any selected tag.
      if (tags.length > 0 && !(e.tags ?? []).some((t) => tags.includes(t.name))) return false;
      return true;
    });
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.list().subscribe((list) => this.entries.set(list));
  }

  protected openCreate(): void {
    this.dialogEntry.set(null);
    this.dialogVisible.set(true);
  }

  protected openEdit(entry: EquipmentCatalogEntryDto): void {
    this.dialogEntry.set(entry);
    this.dialogVisible.set(true);
  }

  protected onSaved(kind: CatalogSaveKind): void {
    this.dialogVisible.set(false);
    this.load();
    this.messageService.add({
      severity: 'success',
      summary: kind === 'created' ? 'Equipaggiamento aggiunto' : 'Equipaggiamento aggiornato',
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
}
