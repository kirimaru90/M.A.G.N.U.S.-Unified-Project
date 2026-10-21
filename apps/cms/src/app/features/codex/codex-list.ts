import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, catchError, combineLatest, forkJoin, map, of, switchMap } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { Toast } from 'primeng/toast';
import { CurrentCampaignService } from '../../core/campaign/current-campaign.service';
import { CodexApiService } from '../../core/codex/codex-api.service';
import {
  CODEX_TYPES,
  CODEX_TYPE_LABELS,
  type CodexCharacterRef,
  type CodexEntry,
  type CodexPlaceOption,
  type CodexType,
} from '../../core/codex/codex.types';
import { CampaignWorkspaceSwitcherComponent } from '../../layout/campaign-workspace-switcher';
import { slugify } from '../campaign-map/place-import';
import { CodexEntryDialogComponent } from './codex-entry-dialog';
import { ImportCodexDialogComponent } from './import-codex-dialog';

/** Case- and accent-insensitive key for the text filter. */
export function foldText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** One table row: the entry flattened to sortable, display-ready fields. */
export interface CodexRow {
  entry: CodexEntry;
  name: string;
  typeLabel: string;
  /** Characters the entry is revealed to; empty when public. */
  visibleTo: CodexCharacterRef[];
  /** `Pubblica`, the listed names, or `Nessuno`. Also the sort key. */
  visibilityLabel: string;
  isEditable: boolean;
  authorLabel: string;
  /** The linked place's name, `—` when unlinked, or the raw slug when dangling. */
  mapLabel: string;
  mapMissing: boolean;
  updatedAt: string;
  isDeleted: boolean;
  /** `Piper` or `Master`, for `Eliminata da …`. */
  deletedByLabel: string;
}

export function toCodexRow(
  entry: CodexEntry,
  placesBySlug: ReadonlyMap<string, CodexPlaceOption>,
): CodexRow {
  const refs = new Map(entry.characters.map((c) => [c.id, c]));
  const ref = (id: string): CodexCharacterRef => refs.get(id) ?? { id, name: '', deleted: true };
  const visibleTo = entry.isPublic ? [] : entry.visibleToCharacterIds.map(ref);
  const place = entry.mapPlaceSlug ? placesBySlug.get(entry.mapPlaceSlug) : undefined;
  const nameOf = (id: string | null) => (id ? ref(id).name || '?' : 'Master');
  return {
    entry,
    name: entry.name,
    typeLabel: CODEX_TYPE_LABELS[entry.type],
    visibleTo,
    visibilityLabel: entry.isPublic
      ? 'Pubblica'
      : visibleTo.length > 0
        ? visibleTo.map((c) => c.name || '?').join(', ')
        : 'Nessuno',
    isEditable: entry.isEditable,
    authorLabel: nameOf(entry.createdByCharacterId),
    mapLabel: !entry.mapPlaceSlug ? '—' : (place?.name ?? entry.mapPlaceSlug),
    mapMissing: !!entry.mapPlaceSlug && !place,
    updatedAt: entry.updatedAt,
    isDeleted: entry.isDeleted,
    deletedByLabel: nameOf(entry.deletedByCharacterId),
  };
}

@Component({
  selector: 'app-codex-list',
  standalone: true,
  imports: [
    TableModule,
    ConfirmDialog,
    Toast,
    DatePipe,
    FormsModule,
    CampaignWorkspaceSwitcherComponent,
    CodexEntryDialogComponent,
    ImportCodexDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-toast />
    <p-confirmdialog />

    <div class="bo-page">
      <div class="bo-page-head">
        <h1>Codex</h1>
        <div class="bo-page-head-actions">
          <app-campaign-workspace-switcher />
          <button
            type="button"
            class="bo-btn ghost"
            data-testid="export-codex"
            [disabled]="!campaign()"
            (click)="doExport()"
          >
            Esporta
          </button>
          <button
            type="button"
            class="bo-btn ghost"
            data-testid="import-codex"
            [disabled]="!campaign()"
            (click)="showImport.set(true)"
          >
            Importa
          </button>
          <button
            type="button"
            class="bo-btn primary"
            data-testid="new-entry"
            [disabled]="!campaign()"
            (click)="openCreate()"
          >
            Nuova voce
          </button>
        </div>
      </div>

      @if (!campaign()) {
        <div
          class="bo-card"
          style="text-align: center; color: var(--bo-text-faint); padding: 32px;"
        >
          <p>Seleziona una campagna per continuare.</p>
        </div>
      } @else {
        <div class="bo-card">
          <div class="bo-filter-bar">
            <input
              class="bo-input"
              data-testid="codex-filter"
              placeholder="Filtra per nome"
              [ngModel]="textFilter()"
              (ngModelChange)="textFilter.set($event)"
            />
            <select
              class="bo-select"
              data-testid="codex-type-filter"
              [ngModel]="typeFilter()"
              (ngModelChange)="typeFilter.set($event)"
            >
              <option value="">Tutti i tipi</option>
              @for (t of types; track t) {
                <option [value]="t">{{ typeLabels[t] }}</option>
              }
            </select>
            <label style="display: inline-flex; align-items: center; gap: 6px;">
              <input
                type="checkbox"
                data-testid="codex-show-deleted"
                [ngModel]="showDeleted()"
                (ngModelChange)="showDeleted.set($event)"
              />
              Mostra eliminate
            </label>
          </div>

          <p-table
            [value]="rows() ?? []"
            [loading]="rows() === undefined"
            [tableStyle]="{ 'min-width': '960px' }"
            sortField="name"
            [sortOrder]="1"
            styleClass="bo-table"
          >
            <ng-template pTemplate="header">
              <tr>
                <th pSortableColumn="name">Nome <p-sortIcon field="name" /></th>
                <th pSortableColumn="typeLabel">Tipo <p-sortIcon field="typeLabel" /></th>
                <th pSortableColumn="visibilityLabel">
                  Visibilità <p-sortIcon field="visibilityLabel" />
                </th>
                <th pSortableColumn="isEditable">Modificabile <p-sortIcon field="isEditable" /></th>
                <th pSortableColumn="authorLabel">Autore <p-sortIcon field="authorLabel" /></th>
                <th pSortableColumn="mapLabel">Mappa <p-sortIcon field="mapLabel" /></th>
                <th pSortableColumn="updatedAt">Aggiornata il <p-sortIcon field="updatedAt" /></th>
                <th>Azioni</th>
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-row>
              <tr data-testid="codex-row" [style.opacity]="row.isDeleted ? 0.55 : null">
                <td>
                  @if (row.isDeleted) {
                    {{ row.name }}
                    <span class="bo-pill danger">Eliminata</span>
                    <div
                      style="font-size: 12px; color: var(--bo-text-faint);"
                      data-testid="deleted-by"
                    >
                      Eliminata da {{ row.deletedByLabel }} ·
                      {{ row.entry.deletedAt | date: 'dd/MM/yyyy' }}
                    </div>
                  } @else {
                    <a href="" (click)="$event.preventDefault(); openEdit(row.entry)">{{
                      row.name
                    }}</a>
                  }
                </td>
                <td>{{ row.typeLabel }}</td>
                <td data-testid="visibility-cell">
                  @if (row.entry.isPublic) {
                    <span class="bo-pill active">Pubblica</span>
                  } @else {
                    @for (c of row.visibleTo; track c.id; let last = $last) {
                      <span
                        [style.text-decoration]="c.deleted ? 'line-through' : null"
                        [title]="c.deleted ? 'Personaggio eliminato' : ''"
                        >{{ c.name || '?' }}</span
                      >
                      @if (!last) {
                        ,
                      }
                    } @empty {
                      Nessuno
                    }
                  }
                </td>
                <td>{{ row.isEditable ? '✓' : '' }}</td>
                <td>{{ row.authorLabel }}</td>
                <td>
                  {{ row.mapLabel }}
                  @if (row.mapMissing) {
                    <span class="bo-pill danger">non trovato</span>
                  }
                </td>
                <td>{{ row.updatedAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td>
                  <div class="row-actions">
                    @if (row.isDeleted) {
                      <button
                        type="button"
                        class="bo-btn ghost"
                        data-testid="restore-entry"
                        (click)="restore(row)"
                      >
                        Ripristina
                      </button>
                      <button
                        type="button"
                        class="bo-btn ghost danger"
                        data-testid="purge-entry"
                        (click)="confirmDelete(row)"
                      >
                        Elimina definitivamente
                      </button>
                    } @else {
                      <button
                        type="button"
                        class="bo-btn ghost icon"
                        title="Modifica"
                        data-testid="edit-entry"
                        (click)="openEdit(row.entry)"
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
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        class="bo-btn ghost icon danger"
                        title="Elimina"
                        data-testid="delete-entry"
                        (click)="confirmDelete(row)"
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
                    }
                  </div>
                </td>
              </tr>
            </ng-template>

            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="8" style="text-align: center; color: var(--bo-text-faint);">
                  Nessuna voce nel codex
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>
      }
    </div>

    <app-codex-entry-dialog
      [visible]="dialogOpen()"
      [campaignId]="campaign()?.id ?? ''"
      [entry]="editing()"
      (closed)="dialogOpen.set(false)"
      (saved)="onSaved()"
    />

    <app-import-codex-dialog
      [visible]="showImport()"
      [campaignId]="campaign()?.id ?? ''"
      (closed)="onImportClosed()"
    />
  `,
})
export class CodexListPage {
  private readonly api = inject(CodexApiService);
  private readonly currentCampaign = inject(CurrentCampaignService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  protected readonly types = CODEX_TYPES;
  protected readonly typeLabels = CODEX_TYPE_LABELS;

  /** The active workspace campaign; the codex is scoped to it. */
  protected readonly campaign = this.currentCampaign.currentCampaign;

  protected readonly textFilter = signal('');
  protected readonly typeFilter = signal<CodexType | ''>('');
  protected readonly showDeleted = signal(false);

  protected readonly dialogOpen = signal(false);
  protected readonly editing = signal<CodexEntry | null>(null);
  protected readonly showImport = signal(false);

  private readonly reload$ = new BehaviorSubject<void>(undefined);

  private readonly data = toSignal(
    combineLatest([toObservable(this.campaign), this.reload$]).pipe(
      switchMap(([campaign]) =>
        campaign
          ? forkJoin({
              entries: this.api.list(campaign.id),
              // The Mappa column only names places; a failed map read leaves slugs shown raw.
              places: this.api
                .campaignPlaces(campaign.id)
                .pipe(catchError(() => of<CodexPlaceOption[]>([]))),
            })
          : of({ entries: [] as CodexEntry[], places: [] as CodexPlaceOption[] }),
      ),
      map(({ entries, places }) => {
        const bySlug = new Map(places.map((p) => [p.slug, p]));
        return entries.map((e) => toCodexRow(e, bySlug));
      }),
    ),
  );

  protected readonly rows = computed(() => {
    const all = this.data();
    if (all === undefined) return undefined;
    const text = foldText(this.textFilter());
    const type = this.typeFilter();
    const deleted = this.showDeleted();
    return all.filter(
      (r) =>
        (deleted || !r.isDeleted) &&
        (!type || r.entry.type === type) &&
        (!text || foldText(r.name).includes(text)),
    );
  });

  protected openCreate(): void {
    this.editing.set(null);
    this.dialogOpen.set(true);
  }

  protected openEdit(entry: CodexEntry): void {
    this.editing.set(entry);
    this.dialogOpen.set(true);
  }

  protected onSaved(): void {
    this.dialogOpen.set(false);
    this.reload$.next();
  }

  protected onImportClosed(): void {
    this.showImport.set(false);
    this.reload$.next();
  }

  protected confirmDelete(row: CodexRow): void {
    this.confirmationService.confirm({
      message: `Eliminare definitivamente la voce «${row.name}»? L'operazione non è reversibile.`,
      acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: 'Elimina',
      rejectLabel: 'Annulla',
      accept: () => this.onDeleteConfirmed(row),
    });
  }

  private onDeleteConfirmed(row: CodexRow): void {
    const campaign = this.campaign();
    if (!campaign) return;
    this.api.remove(campaign.id, row.entry.id).subscribe({
      next: () => {
        this.reload$.next();
        this.messageService.add({ severity: 'success', summary: 'Voce eliminata' });
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: "Errore durante l'eliminazione" });
      },
    });
  }

  protected restore(row: CodexRow): void {
    const campaign = this.campaign();
    if (!campaign) return;
    this.api.restore(campaign.id, row.entry.id).subscribe({
      next: () => {
        this.reload$.next();
        this.messageService.add({ severity: 'success', summary: 'Voce ripristinata' });
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Errore durante il ripristino' });
      },
    });
  }

  protected doExport(): void {
    const campaign = this.campaign();
    if (!campaign) return;
    this.api.export(campaign.id).subscribe({
      next: (entries) => {
        const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `codex-${slugify(campaign.name)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: "Errore durante l'esportazione" });
      },
    });
  }
}
