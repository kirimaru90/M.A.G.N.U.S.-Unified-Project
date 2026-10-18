import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, of, switchMap } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { Toast } from 'primeng/toast';
import { CurrentCampaignService } from '../../core/campaign/current-campaign.service';
import { QuestsApiService } from '../../core/quests/quests-api.service';
import {
  QUEST_KIND_LABELS,
  QUEST_STATUSES,
  QUEST_STATUS_LABELS,
  lastStage,
  type Quest,
  type QuestCharacterRef,
} from '../../core/quests/quests.types';
import { CampaignWorkspaceSwitcherComponent } from '../../layout/campaign-workspace-switcher';
import { CreateQuestDialogComponent } from './create-quest-dialog';

/** One table row: the quest flattened to sortable fields, derived from its last stage. */
export interface QuestRow {
  id: string;
  title: string;
  kindLabel: string;
  characters: QuestCharacterRef[];
  charactersLabel: string;
  statusLabel: string;
  statusRank: number;
  isMilestone: boolean;
  /** Story only; `-1` for personal so they sort apart. */
  publicRank: number;
  stageCount: number;
  /** e.g. `3 (1 bozza)`. */
  stagesLabel: string;
  updatedAt: string;
}

export function toQuestRow(q: Quest): QuestRow {
  const last = lastStage(q);
  const personal = q.kind === 'personal';
  return {
    id: q.id,
    title: last?.title ?? '',
    kindLabel: QUEST_KIND_LABELS[q.kind],
    characters: personal ? q.characters : [],
    charactersLabel: personal ? q.characters.map((c) => c.name).join(', ') : '',
    statusLabel: last ? QUEST_STATUS_LABELS[last.status] : '',
    statusRank: last ? QUEST_STATUSES.indexOf(last.status) : -1,
    isMilestone: !!last?.isMilestone,
    publicRank: personal ? -1 : q.isPublic ? 1 : 0,
    stageCount: q.stages.length,
    stagesLabel: stagesLabel(q),
    updatedAt: q.updatedAt,
  };
}

function stagesLabel(q: Quest): string {
  const drafts = q.stages.filter((s) => !s.isPublic).length;
  if (drafts === 0) return String(q.stages.length);
  return `${q.stages.length} (${drafts} ${drafts === 1 ? 'bozza' : 'bozze'})`;
}

@Component({
  selector: 'app-quests-list',
  standalone: true,
  imports: [
    TableModule,
    ConfirmDialog,
    Toast,
    RouterLink,
    DatePipe,
    CampaignWorkspaceSwitcherComponent,
    CreateQuestDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-toast />
    <p-confirmdialog />

    <div class="bo-page">
      <div class="bo-page-head">
        <h1>Quest</h1>
        <div class="bo-page-head-actions">
          <app-campaign-workspace-switcher />
          <button
            type="button"
            class="bo-btn primary"
            data-testid="new-quest"
            [disabled]="!campaign()"
            (click)="showCreate.set(true)"
          >
            Nuova quest
          </button>
        </div>
      </div>

      @if (!campaign()) {
        <div class="bo-card" style="text-align: center; color: var(--bo-text-faint); padding: 32px;">
          <p>Seleziona una campagna per continuare.</p>
        </div>
      } @else {
        <div class="bo-card">
          <p-table
            [value]="rows() ?? []"
            [loading]="rows() === undefined"
            [tableStyle]="{ 'min-width': '900px' }"
            sortField="updatedAt"
            [sortOrder]="-1"
            styleClass="bo-table"
          >
            <ng-template pTemplate="header">
              <tr>
                <th pSortableColumn="title">Titolo <p-sortIcon field="title" /></th>
                <th pSortableColumn="kindLabel">Tipo <p-sortIcon field="kindLabel" /></th>
                <th pSortableColumn="charactersLabel">Personaggi <p-sortIcon field="charactersLabel" /></th>
                <th pSortableColumn="statusRank">Stato <p-sortIcon field="statusRank" /></th>
                <th pSortableColumn="isMilestone">Milestone <p-sortIcon field="isMilestone" /></th>
                <th pSortableColumn="publicRank">Pubblica <p-sortIcon field="publicRank" /></th>
                <th pSortableColumn="stageCount">Stadi <p-sortIcon field="stageCount" /></th>
                <th pSortableColumn="updatedAt">Aggiornata il <p-sortIcon field="updatedAt" /></th>
                <th>Azioni</th>
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-row>
              <tr data-testid="quest-row">
                <td>
                  <a [routerLink]="['/quests', row.id]">{{ row.title }}</a>
                </td>
                <td>{{ row.kindLabel }}</td>
                <td>
                  @for (c of row.characters; track c.id; let last = $last) {
                    <span [style.text-decoration]="c.deleted ? 'line-through' : null"
                          [title]="c.deleted ? 'Personaggio eliminato' : ''">{{ c.name || '?' }}</span>
                    @if (c.deleted) { <span class="bo-pill danger">eliminato</span> }
                    @if (!last) { , }
                  } @empty {
                    —
                  }
                </td>
                <td>{{ row.statusLabel }}</td>
                <td>{{ row.isMilestone ? '★' : '' }}</td>
                <td>
                  @if (row.publicRank < 0) {
                    —
                  } @else {
                    <span class="bo-pill" [class.active]="row.publicRank === 1">
                      {{ row.publicRank === 1 ? 'Pubblica' : 'Privata' }}
                    </span>
                  }
                </td>
                <td>{{ row.stagesLabel }}</td>
                <td>{{ row.updatedAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td>
                  <div class="row-actions">
                    <button
                      type="button"
                      class="bo-btn ghost icon"
                      title="Apri"
                      [routerLink]="['/quests', row.id]"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="bo-btn ghost icon danger"
                      title="Elimina"
                      data-testid="delete-quest"
                      (click)="confirmDelete(row)"
                    >
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
                <td colspan="9" style="text-align: center; color: var(--bo-text-faint);">
                  Nessuna quest in questa campagna
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>
      }
    </div>

    <app-create-quest-dialog
      [visible]="showCreate()"
      [campaignId]="campaign()?.id ?? ''"
      (closed)="showCreate.set(false)"
      (created)="onCreated($event)"
    />
  `,
})
export class QuestsListPage {
  private readonly questsApi = inject(QuestsApiService);
  private readonly currentCampaign = inject(CurrentCampaignService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  /** The active workspace campaign; quests are scoped to it. */
  protected readonly campaign = this.currentCampaign.currentCampaign;

  protected readonly showCreate = signal(false);

  private readonly reload$ = new BehaviorSubject<void>(undefined);

  private readonly quests = toSignal(
    combineLatest([toObservable(this.campaign), this.reload$]).pipe(
      switchMap(([campaign]) =>
        campaign ? this.questsApi.list(campaign.id) : of<Quest[]>([]),
      ),
    ),
  );

  protected readonly rows = computed(() => this.quests()?.map(toQuestRow));

  protected onCreated(quest: Quest): void {
    this.showCreate.set(false);
    void this.router.navigate(['/quests', quest.id]);
  }

  protected confirmDelete(row: QuestRow): void {
    this.confirmationService.confirm({
      message: `Eliminare la quest «${row.title}» e tutti i suoi stadi? L'operazione non è reversibile.`,
      acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: 'Elimina',
      rejectLabel: 'Annulla',
      accept: () => this.onDeleteConfirmed(row),
    });
  }

  private onDeleteConfirmed(row: QuestRow): void {
    const campaign = this.campaign();
    if (!campaign) return;
    this.questsApi.delete(campaign.id, row.id).subscribe({
      next: () => {
        this.reload$.next();
        this.messageService.add({ severity: 'success', summary: 'Quest eliminata' });
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: "Errore durante l'eliminazione" });
      },
    });
  }
}
