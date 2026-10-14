import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { MultiSelect } from 'primeng/multiselect';
import { TableModule } from 'primeng/table';
import { Toast } from 'primeng/toast';
import type { CatalogSaveKind } from '../../core/catalog/catalog-entry-dialog.base';
import { ConditionsCatalogApiService } from '../../core/conditions-catalog/conditions-catalog-api.service';
import type {
  ConditionCatalogEntryDto,
  ConditionPolarity,
  ConditionSeverity,
} from '../../core/conditions-catalog/conditions-catalog.types';
import { ConditionsEntryDialogComponent } from './conditions-entry-dialog';

@Component({
  selector: 'app-conditions-catalog-page',
  standalone: true,
  imports: [FormsModule, TableModule, ButtonModule, ConfirmDialog, Toast, MultiSelect, ConditionsEntryDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-toast />
    <p-confirmdialog />

    <div class="bo-page">
      <div class="bo-page-head">
        <h1>Catalogo condizioni</h1>
        <div class="bo-page-head-actions">
          <button type="button" class="bo-btn primary" (click)="openCreate()">
            + Aggiungi
          </button>
        </div>
      </div>

      <div class="bo-card">
        <div class="bo-filter-bar">
          <div style="display: inline-flex; gap: 6px; align-items: center;">
            <span style="opacity: 0.7;">Polarità:</span>
            <p-multiselect
              data-testid="filter-polarity"
              [options]="polarityOptions"
              optionLabel="label"
              optionValue="value"
              [ngModel]="polarityFilter()"
              (ngModelChange)="polarityFilter.set($event)"
              placeholder="Tutte"
              [showToggleAll]="false"
              [style]="{ 'min-width': '180px' }"
            />
          </div>
          <div style="display: inline-flex; gap: 6px; align-items: center;">
            <span style="opacity: 0.7;">Gravità:</span>
            <p-multiselect
              data-testid="filter-severity"
              [options]="severityOptions"
              optionLabel="label"
              optionValue="value"
              [ngModel]="severityFilter()"
              (ngModelChange)="severityFilter.set($event)"
              placeholder="Tutte"
              [showToggleAll]="false"
              [style]="{ 'min-width': '180px' }"
            />
          </div>
        </div>

        <p-table
          [value]="filteredEntries() ?? []"
          [loading]="entries() === undefined"
          [tableStyle]="{ 'min-width': '650px' }"
          styleClass="bo-table"
          sortField="name"
          [sortOrder]="1"
        >
          <ng-template pTemplate="header">
            <tr>
              <th pSortableColumn="slug">Slug <p-sortIcon field="slug" /></th>
              <th pSortableColumn="name">Nome <p-sortIcon field="name" /></th>
              <th pSortableColumn="defaultSeverity">Gravità di default <p-sortIcon field="defaultSeverity" /></th>
              <th pSortableColumn="polarity">Polarità <p-sortIcon field="polarity" /></th>
              <th pSortableColumn="description">Descrizione <p-sortIcon field="description" /></th>
              <th>Azioni</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-entry>
            <tr>
              <td style="font-family: monospace;">{{ entry.slug }}</td>
              <td>{{ entry.name }}</td>
              <td>
                <span class="bo-pill" [class.active]="entry.defaultSeverity === 'major'">
                  {{ entry.defaultSeverity }}
                </span>
              </td>
              <td>
                <span class="bo-pill" [class.active]="entry.polarity === 'positive'">
                  {{ entry.polarity }}
                </span>
              </td>
              <td>{{ entry.description }}</td>
              <td>
                <div class="row-actions">
                  <button type="button" class="bo-btn ghost icon" title="Modifica" (click)="openEdit(entry)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button type="button" class="bo-btn ghost icon danger" title="Elimina" (click)="confirmDelete(entry)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6"/>
                      <path d="M14 11v6"/>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="6" style="text-align: center; color: var(--bo-text-faint);">
                Nessuna condizione nel catalogo
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>

    <app-conditions-entry-dialog
      [visible]="dialogVisible()"
      [entry]="dialogEntry()"
      (closed)="dialogVisible.set(false)"
      (saved)="onSaved($event)"
    />
  `,
})
export class ConditionsCatalogPage implements OnInit {
  private readonly api = inject(ConditionsCatalogApiService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  protected readonly entries = signal<ConditionCatalogEntryDto[] | undefined>(undefined);
  protected readonly dialogVisible = signal(false);
  protected readonly dialogEntry = signal<ConditionCatalogEntryDto | null>(null);

  // --- Client-side polarity + severity multiselect filters. Empty selection
  //     means "all"; within one filter values OR, across filters they AND. ---
  protected readonly polarityOptions = [
    { value: 'positive' as const, label: 'Positive' },
    { value: 'negative' as const, label: 'Negative' },
  ];
  protected readonly severityOptions = [
    { value: 'minor' as const, label: 'Minor' },
    { value: 'major' as const, label: 'Major' },
  ];
  protected readonly polarityFilter = signal<ConditionPolarity[]>([]);
  protected readonly severityFilter = signal<ConditionSeverity[]>([]);

  /**
   * The loaded catalog narrowed by the polarity and severity multiselect filters.
   * An empty selection for a filter matches every entry; a non-empty selection
   * matches any of its values (OR); the two filters combine with AND. Returns
   * `undefined` while loading so the table keeps its loading state, and
   * re-derives whenever `entries()` reloads.
   */
  protected readonly filteredEntries = computed(() => {
    const all = this.entries();
    if (!all) return all;
    const polarity = this.polarityFilter();
    const severity = this.severityFilter();
    return all.filter((e) => {
      if (polarity.length > 0 && !polarity.includes(e.polarity)) return false;
      if (severity.length > 0 && !severity.includes(e.defaultSeverity)) return false;
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

  protected openEdit(entry: ConditionCatalogEntryDto): void {
    this.dialogEntry.set(entry);
    this.dialogVisible.set(true);
  }

  protected onSaved(kind: CatalogSaveKind): void {
    this.dialogVisible.set(false);
    this.load();
    this.messageService.add({
      severity: 'success',
      summary: kind === 'created' ? 'Condizione aggiunta' : 'Condizione aggiornata',
    });
  }

  protected confirmDelete(entry: ConditionCatalogEntryDto): void {
    this.confirmationService.confirm({
      message: `Eliminare la condizione "${entry.name}"?`,
      acceptLabel: 'Elimina',
      rejectLabel: 'Annulla',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.api.patchSchema([{ action: 'delete', slug: entry.slug }]).subscribe({
          next: () => {
            this.load();
            this.messageService.add({ severity: 'success', summary: 'Condizione eliminata' });
          },
          error: () =>
            this.messageService.add({ severity: 'error', summary: "Errore durante l'eliminazione" }),
        });
      },
    });
  }
}
