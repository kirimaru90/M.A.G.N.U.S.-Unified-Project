import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { Toast } from 'primeng/toast';
import type { CatalogSaveKind } from '../../core/catalog/catalog-entry-dialog.base';
import { catalogErrorMessage } from '../../core/catalog/catalog-ops';
import { SpeciesCatalogApiService } from '../../core/species-catalog/species-catalog-api.service';
import type { SpeciesCatalogEntryDto } from '../../core/species-catalog/species-catalog.types';
import { SpeciesEntryDialogComponent } from './species-entry-dialog';

@Component({
  selector: 'app-species-catalog-page',
  standalone: true,
  imports: [TableModule, ButtonModule, ConfirmDialog, Toast, SpeciesEntryDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-toast />
    <p-confirmdialog />

    <div class="bo-page">
      <div class="bo-page-head">
        <h1>Catalogo specie</h1>
        <div class="bo-page-head-actions">
          <button type="button" class="bo-btn primary" (click)="openCreate()">
            + Aggiungi
          </button>
        </div>
      </div>

      <div class="bo-card">
        <p-table
          [value]="entries() ?? []"
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
              <th pSortableColumn="permesso">Permesso <p-sortIcon field="permesso" /></th>
              <th pSortableColumn="svantaggio">Svantaggio <p-sortIcon field="svantaggio" /></th>
              <th pSortableColumn="tagSkillBudget">Budget maestria <p-sortIcon field="tagSkillBudget" /></th>
              <th pSortableColumn="margin">Margine salute <p-sortIcon field="margin" /></th>
              <th>Azioni</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-entry>
            <tr>
              <td style="font-family: monospace;">{{ entry.slug }}</td>
              <td>{{ entry.name }}</td>
              <td>{{ entry.permesso }}</td>
              <td>{{ entry.svantaggio }}</td>
              <td>{{ entry.tagSkillBudget }}</td>
              <td>{{ entry.margin }}</td>
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
                @if (deleteError() === entry.slug) {
                  <small style="color: var(--p-red-500, #ef4444);">{{ deleteErrorText() }}</small>
                }
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="7" style="text-align: center; color: var(--bo-text-faint);">
                Nessuna specie nel catalogo
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>

    <app-species-entry-dialog
      [visible]="dialogVisible()"
      [entry]="dialogEntry()"
      (closed)="dialogVisible.set(false)"
      (saved)="onSaved($event)"
    />
  `,
})
export class SpeciesCatalogPage implements OnInit {
  private readonly api = inject(SpeciesCatalogApiService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  protected readonly entries = signal<SpeciesCatalogEntryDto[] | undefined>(undefined);
  protected readonly dialogVisible = signal(false);
  protected readonly dialogEntry = signal<SpeciesCatalogEntryDto | null>(null);
  /** Slug whose delete failed, so the error renders on that row rather than globally. */
  protected readonly deleteError = signal<string | null>(null);
  protected readonly deleteErrorText = signal<string | null>(null);

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

  protected openEdit(entry: SpeciesCatalogEntryDto): void {
    this.dialogEntry.set(entry);
    this.dialogVisible.set(true);
  }

  protected onSaved(kind: CatalogSaveKind): void {
    this.dialogVisible.set(false);
    this.load();
    this.messageService.add({
      severity: 'success',
      summary: kind === 'created' ? 'Specie aggiunta' : 'Specie aggiornata',
    });
  }

  protected confirmDelete(entry: SpeciesCatalogEntryDto): void {
    this.confirmationService.confirm({
      message: `Eliminare la specie "${entry.name}"?`,
      acceptLabel: 'Elimina',
      rejectLabel: 'Annulla',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.api.patchSchema([{ action: 'delete', slug: entry.slug }]).subscribe({
          next: () => {
            this.deleteError.set(null);
            this.load();
            this.messageService.add({ severity: 'success', summary: 'Specie eliminata' });
          },
          error: (err) => {
            // A 409 here means a character still points at this species.
            this.deleteError.set(entry.slug);
            this.deleteErrorText.set(
              catalogErrorMessage(err, {
                slug: entry.slug,
                action: 'delete',
                inUseMessage: 'Specie in uso da un personaggio',
              }),
            );
          },
        });
      },
    });
  }
}
