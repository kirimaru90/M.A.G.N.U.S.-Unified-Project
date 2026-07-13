import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { Toast } from 'primeng/toast';
import { TagCatalogApiService } from '../../core/tag-catalog/tag-catalog-api.service';
import type { TagCatalogEntryDto } from '../../core/tag-catalog/tag-catalog.types';

interface DraftRow {
  slug: string;
  name: string;
}

const emptyDraft = (): DraftRow => ({ slug: '', name: '' });

@Component({
  selector: 'app-tag-catalog-page',
  standalone: true,
  imports: [FormsModule, TableModule, ButtonModule, ConfirmDialog, Toast, InputTextModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-toast />
    <p-confirmdialog />

    <div class="bo-page">
      <div class="bo-page-head">
        <h1>Catalogo tag</h1>
      </div>

      <div class="bo-card">
        <p-table
          [value]="entries() ?? []"
          [loading]="entries() === undefined"
          [tableStyle]="{ 'min-width': '480px' }"
          styleClass="bo-table"
        >
          <ng-template pTemplate="header">
            <tr>
              <th>Slug</th>
              <th>Nome</th>
              <th>Azioni</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-entry>
            @if (editingSlug() === entry.slug) {
              <tr>
                <td><input pInputText [(ngModel)]="draft.slug" style="width: 100%;" /></td>
                <td><input pInputText [(ngModel)]="draft.name" style="width: 100%;" /></td>
                <td>
                  <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                    @if (rowError()) {
                      <small style="color: var(--p-red-500, #ef4444);">{{ rowError() }}</small>
                    }
                    <div style="display: flex; gap: 4px;">
                      <button type="button" class="bo-btn primary" style="font-size: 12px; padding: 4px 10px; height: auto;" (click)="submitEdit(entry)">
                        Salva
                      </button>
                      <button type="button" class="bo-btn ghost" style="font-size: 12px; padding: 4px 10px; height: auto;" (click)="cancelEdit()">
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
                  <div class="row-actions">
                    <button type="button" class="bo-btn ghost icon" title="Modifica" (click)="startEdit(entry)">
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
            }
          </ng-template>

          <ng-template pTemplate="footer">
            @if (addRowVisible()) {
              <tr>
                <td><input pInputText [(ngModel)]="draft.slug" placeholder="slug" style="width: 100%;" /></td>
                <td><input pInputText [(ngModel)]="draft.name" placeholder="nome" style="width: 100%;" /></td>
                <td>
                  <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                    @if (rowError()) {
                      <small style="color: var(--p-red-500, #ef4444);">{{ rowError() }}</small>
                    }
                    <div style="display: flex; gap: 4px;">
                      <button type="button" class="bo-btn primary" style="font-size: 12px; padding: 4px 10px; height: auto;" (click)="submitAdd()">
                        Salva
                      </button>
                      <button type="button" class="bo-btn ghost" style="font-size: 12px; padding: 4px 10px; height: auto;" (click)="cancelAdd()">
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
              <td colspan="3" style="text-align: center; color: var(--bo-text-faint);">
                Nessun tag nel catalogo
              </td>
            </tr>
          </ng-template>
        </p-table>

        @if (!addRowVisible()) {
          <button type="button" class="bo-btn ghost" style="margin-top: 8px; font-size: 13px;" (click)="showAddRow()">
            + Aggiungi
          </button>
        }
      </div>
    </div>
  `,
})
export class TagCatalogPage implements OnInit {
  private readonly api = inject(TagCatalogApiService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  protected readonly entries = signal<TagCatalogEntryDto[] | undefined>(undefined);
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

  protected submitAdd(): void {
    const slug = this.draft.slug.trim();
    const name = this.draft.name.trim();
    if (!slug || !name) {
      this.rowError.set('Slug e nome sono obbligatori');
      return;
    }
    this.api
      .patchSchema([{ action: 'add', slug, entry: { name } }])
      .subscribe({
        next: () => {
          this.addRowVisible.set(false);
          this.rowError.set(null);
          this.load();
          this.messageService.add({ severity: 'success', summary: 'Tag aggiunto' });
        },
        error: (err) => this.rowError.set(this.errorMessage(err)),
      });
  }

  protected startEdit(entry: TagCatalogEntryDto): void {
    this.addRowVisible.set(false);
    this.draft = { slug: entry.slug, name: entry.name };
    this.rowError.set(null);
    this.editingSlug.set(entry.slug);
  }

  protected cancelEdit(): void {
    this.editingSlug.set(null);
    this.rowError.set(null);
  }

  protected submitEdit(entry: TagCatalogEntryDto): void {
    const newSlug = this.draft.slug.trim();
    const name = this.draft.name.trim();
    if (!newSlug || !name) {
      this.rowError.set('Slug e nome sono obbligatori');
      return;
    }

    const op =
      newSlug !== entry.slug
        ? { action: 'rename' as const, slug: entry.slug, rename: newSlug }
        : { action: 'update' as const, slug: entry.slug, entry: { name } };

    this.api.patchSchema([op]).subscribe({
      next: () => {
        this.editingSlug.set(null);
        this.rowError.set(null);
        this.load();
        this.messageService.add({ severity: 'success', summary: 'Tag aggiornato' });
      },
      error: (err) => this.rowError.set(this.errorMessage(err)),
    });
  }

  protected confirmDelete(entry: TagCatalogEntryDto): void {
    this.confirmationService.confirm({
      message: `Eliminare il tag "${entry.name}"?`,
      acceptLabel: 'Elimina',
      rejectLabel: 'Annulla',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.api.patchSchema([{ action: 'delete', slug: entry.slug }]).subscribe({
          next: () => {
            this.load();
            this.messageService.add({ severity: 'success', summary: 'Tag eliminato' });
          },
          error: () =>
            this.messageService.add({ severity: 'error', summary: "Errore durante l'eliminazione" }),
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
