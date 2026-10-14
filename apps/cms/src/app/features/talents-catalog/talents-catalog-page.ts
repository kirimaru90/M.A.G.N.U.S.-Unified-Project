import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { Toast } from 'primeng/toast';
import type { CatalogSaveKind } from '../../core/catalog/catalog-entry-dialog.base';
import { TalentsCatalogApiService } from '../../core/talents-catalog/talents-catalog-api.service';
import type { TalentCatalogEntryDto } from '../../core/talents-catalog/talents-catalog.types';
import { ImportTalentsDialogComponent } from './import-talents-dialog';
import { specialRequirementPreview } from './special-approaches';
import { TalentEntryDialogComponent } from './talent-entry-dialog';

@Component({
  selector: 'app-talents-catalog-page',
  standalone: true,
  imports: [
    TableModule,
    ButtonModule,
    ConfirmDialog,
    Toast,
    TalentEntryDialogComponent,
    ImportTalentsDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-toast />
    <p-confirmdialog />

    <div class="bo-page">
      <div class="bo-page-head">
        <h1>Catalogo talenti</h1>
        <div class="bo-page-head-actions">
          <button type="button" class="bo-btn ghost" (click)="exportCatalog()">
            Esporta
          </button>
          <button type="button" class="bo-btn ghost" (click)="openImportDialog()">
            Importa
          </button>
          <button type="button" class="bo-btn primary" (click)="openCreate()">
            + Aggiungi
          </button>
        </div>
      </div>

      <div class="bo-card">
        <p-table
          [value]="entries() ?? []"
          [loading]="entries() === undefined"
          [tableStyle]="{ 'min-width': '600px' }"
          styleClass="bo-table"
          sortField="name"
          [sortOrder]="1"
        >
          <ng-template pTemplate="header">
            <tr>
              <th pSortableColumn="slug">Slug <p-sortIcon field="slug" /></th>
              <th pSortableColumn="name">Nome <p-sortIcon field="name" /></th>
              <th pSortableColumn="description">Descrizione <p-sortIcon field="description" /></th>
              <th>Requisiti</th>
              <th>Azioni</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-entry>
            <tr>
              <td style="font-family: monospace;">{{ entry.slug }}</td>
              <td>{{ entry.name }}</td>
              <td>{{ entry.description }}</td>
              <td style="font-family: monospace; white-space: nowrap;" data-testid="requirement-preview">
                {{ requirementPreview(entry.specialRequirement) }}
              </td>
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
              <td colspan="5" style="text-align: center; color: var(--bo-text-faint);">
                Nessun talento nel catalogo
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>

    <app-import-talents-dialog
      [visible]="importDialogVisible()"
      [currentEntries]="entries() ?? []"
      (closed)="closeImportDialog()"
      (imported)="onImported()"
    />

    <app-talent-entry-dialog
      [visible]="dialogVisible()"
      [entry]="dialogEntry()"
      (closed)="dialogVisible.set(false)"
      (saved)="onSaved($event)"
    />
  `,
})
export class TalentsCatalogPage implements OnInit {
  private readonly api = inject(TalentsCatalogApiService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  protected readonly entries = signal<TalentCatalogEntryDto[] | undefined>(undefined);
  protected readonly dialogVisible = signal(false);
  protected readonly dialogEntry = signal<TalentCatalogEntryDto | null>(null);

  protected readonly importDialogVisible = signal(false);

  protected readonly requirementPreview = specialRequirementPreview;

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

  protected openEdit(entry: TalentCatalogEntryDto): void {
    this.dialogEntry.set(entry);
    this.dialogVisible.set(true);
  }

  protected onSaved(kind: CatalogSaveKind): void {
    this.dialogVisible.set(false);
    this.load();
    this.messageService.add({
      severity: 'success',
      summary: kind === 'created' ? 'Talento aggiunto' : 'Talento aggiornato',
    });
  }

  protected confirmDelete(entry: TalentCatalogEntryDto): void {
    this.confirmationService.confirm({
      message: `Eliminare il talento "${entry.name}"?`,
      acceptLabel: 'Elimina',
      rejectLabel: 'Annulla',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.api.patchSchema([{ action: 'delete', slug: entry.slug }]).subscribe({
          next: () => {
            this.load();
            this.messageService.add({ severity: 'success', summary: 'Talento eliminato' });
          },
          error: () =>
            this.messageService.add({ severity: 'error', summary: "Errore durante l'eliminazione" }),
        });
      },
    });
  }

  protected exportCatalog(): void {
    const entries = this.entries() ?? [];
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'talenti-catalogo.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  protected openImportDialog(): void {
    this.importDialogVisible.set(true);
  }

  protected closeImportDialog(): void {
    this.importDialogVisible.set(false);
  }

  protected onImported(): void {
    this.load();
  }
}
