import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, filter, switchMap } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Checkbox } from 'primeng/checkbox';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { MultiSelect } from 'primeng/multiselect';
import { Toast } from 'primeng/toast';
import { CurrentCampaignService } from '../../core/campaign/current-campaign.service';
import { QuestsApiService } from '../../core/quests/quests-api.service';
import {
  QUEST_KIND_LABELS,
  QUEST_STATUS_LABELS,
  lastStage,
  type CampaignCharacterOption,
  type Quest,
  type QuestKind,
  type QuestStage,
  type UpdateQuestBody,
} from '../../core/quests/quests.types';
import { StageDialogComponent } from './stage-dialog';

interface CharacterOption {
  id: string;
  label: string;
}

@Component({
  selector: 'app-quest-detail',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    FormsModule,
    Checkbox,
    MultiSelect,
    Toast,
    ConfirmDialog,
    StageDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ConfirmationService, MessageService],
  template: `
    <p-toast />
    <p-confirmdialog />

    <div class="bo-page">
      @if (!campaign()) {
        <div class="bo-card" style="text-align: center; color: var(--bo-text-faint); padding: 32px;">
          <p>Seleziona una campagna per continuare.</p>
        </div>
      } @else if (notFound()) {
        <div class="bo-card" style="text-align: center; color: var(--bo-text-faint); padding: 32px;">
          <p>Quest non trovata.</p>
          <a routerLink="/quests" class="bo-btn ghost" style="margin-top: 12px; display: inline-block;">
            Torna alle quest
          </a>
        </div>
      } @else if (quest(); as q) {
        <div class="bo-page-head">
          <div>
            <a routerLink="/quests" style="font-size: 12px; color: var(--bo-text-faint); text-decoration: none;">
              ← Torna alle quest
            </a>
            <h1 data-testid="quest-title">{{ title() }}</h1>
            @if (creatorName(); as name) {
              <div class="hint" data-testid="quest-creator">Creata dal giocatore di {{ name }}</div>
            }
          </div>
          <div class="bo-page-head-actions">
            <button type="button" class="bo-btn danger" data-testid="delete-quest" (click)="confirmDeleteQuest()">
              Elimina quest
            </button>
          </div>
        </div>

        <div class="bo-card section" data-testid="quest-header">
          <div class="bo-card-section-title">Intestazione</div>
          <div class="bo-field">
            <label class="bo-label" for="qd-kind">Tipo</label>
            <select
              id="qd-kind"
              class="bo-select"
              data-testid="header-kind"
              [ngModel]="kind()"
              (ngModelChange)="kind.set($event)"
            >
              <option value="story">{{ kindLabels.story }}</option>
              <option value="personal">{{ kindLabels.personal }}</option>
            </select>
          </div>

          @if (kind() === 'story') {
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <p-checkbox
                [binary]="true"
                inputId="qd-public"
                [ngModel]="isPublic()"
                (ngModelChange)="isPublic.set($event)"
              />
              <label class="bo-label" for="qd-public">Pubblica</label>
            </div>
          } @else {
            <div class="bo-field" data-testid="header-characters">
              <label class="bo-label" for="qd-characters">Personaggi</label>
              <p-multiselect
                inputId="qd-characters"
                [options]="characterOptions()"
                optionLabel="label"
                optionValue="id"
                placeholder="Seleziona personaggi"
                [showToggleAll]="false"
                styleClass="w-full"
                appendTo="body"
                [ngModel]="characterIds()"
                (ngModelChange)="characterIds.set($event ?? [])"
              />
              @if (deletedAssignees().length > 0) {
                <div class="hint" data-testid="deleted-assignees">
                  Personaggi eliminati assegnati:
                  @for (c of deletedAssignees(); track c.id) {
                    <span class="bo-pill danger">{{ c.name || c.id }}</span>
                  }
                </div>
              }
            </div>
          }

          <div style="display: flex; justify-content: flex-end;">
            <button
              type="button"
              class="bo-btn primary"
              data-testid="save-header"
              [disabled]="!canSaveHeader() || savingHeader()"
              (click)="saveHeader()"
            >
              {{ savingHeader() ? 'Salvataggio…' : 'Salva intestazione' }}
            </button>
          </div>
        </div>

        <div class="bo-card section" data-testid="quest-stages">
          <div class="bo-card-head">
            <div class="bo-card-section-title">Stadi</div>
            <div class="actions">
              <button type="button" class="bo-btn primary" data-testid="new-stage" (click)="openStage(null)">
                + Nuovo stadio
              </button>
            </div>
          </div>

          @for (entry of stagesNewestFirst(); track entry.stage.id) {
            <div
              data-testid="stage-row"
              style="display: flex; gap: 12px; align-items: flex-start; padding: 10px 0; border-top: 1px solid var(--bo-border, rgba(127,127,127,.2));"
            >
              <div style="min-width: 28px; color: var(--bo-text-faint);">#{{ entry.position }}</div>
              <div style="flex: 1;">
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                  <strong>{{ entry.stage.title }}</strong>
                  @if (entry.stage.isMilestone) { <span title="Milestone">★</span> }
                  <span class="bo-tag">{{ statusLabels[entry.stage.status] }}</span>
                  @if (!entry.stage.isPublic) {
                    <span class="bo-pill warn" data-testid="draft-badge">Bozza</span>
                  }
                </div>
                <div style="font-size: 12px; color: var(--bo-text-faint); margin-top: 4px;">
                  Creato il {{ entry.stage.createdAt | date: 'dd/MM/yyyy HH:mm' }}
                  @if (entry.stage.revealedAt) {
                    · Rivelato il {{ entry.stage.revealedAt | date: 'dd/MM/yyyy HH:mm' }}
                  }
                </div>
              </div>
              <div class="row-actions" style="display: flex; gap: 4px;">
                <button type="button" class="bo-btn ghost" data-testid="edit-stage" (click)="openStage(entry.stage)">
                  Modifica
                </button>
                @if (entry.deletable) {
                  <button
                    type="button"
                    class="bo-btn ghost danger"
                    data-testid="delete-stage"
                    (click)="confirmDeleteStage(entry.stage)"
                  >
                    Elimina
                  </button>
                }
              </div>
            </div>
          }
        </div>

        <app-stage-dialog
          [visible]="stageDialogOpen()"
          [campaignId]="campaign()!.id"
          [quest]="q"
          [stage]="editingStage()"
          (closed)="stageDialogOpen.set(false)"
          (saved)="onStageSaved($event)"
        />
      } @else {
        <div class="bo-card" style="text-align: center; color: var(--bo-text-faint); padding: 32px;">
          Caricamento…
        </div>
      }
    </div>
  `,
})
export class QuestDetailPage {
  private readonly api = inject(QuestsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly campaign = inject(CurrentCampaignService).currentCampaign;
  protected readonly questId = this.route.snapshot.params['questId'] as string;

  protected readonly kindLabels = QUEST_KIND_LABELS;
  protected readonly statusLabels = QUEST_STATUS_LABELS;

  protected readonly quest = signal<Quest | null>(null);
  protected readonly notFound = signal(false);
  private readonly characters = signal<CampaignCharacterOption[]>([]);

  // Header form state, reset from the quest on every load/save.
  protected readonly kind = signal<QuestKind>('story');
  protected readonly isPublic = signal(false);
  protected readonly characterIds = signal<string[]>([]);
  protected readonly savingHeader = signal(false);

  protected readonly stageDialogOpen = signal(false);
  protected readonly editingStage = signal<QuestStage | null>(null);

  protected readonly title = computed(() => {
    const q = this.quest();
    return q ? (lastStage(q)?.title ?? '') : '';
  });

  /** Name of the character that created the quest from the Pip-Boy, if any. */
  protected readonly creatorName = computed(() => {
    const q = this.quest();
    const id = q?.createdByCharacterId;
    if (!id) return null;
    return q.characters.find((c) => c.id === id)?.name || 'un personaggio';
  });

  protected readonly stagesNewestFirst = computed(() => {
    const stages = this.quest()?.stages ?? [];
    return stages
      .map((stage, i) => ({
        stage,
        position: i + 1,
        deletable: i === stages.length - 1 && stages.length > 1,
      }))
      .reverse();
  });

  protected readonly deletedAssignees = computed(
    () => this.quest()?.characters.filter((c) => c.deleted) ?? [],
  );

  /** Campaign characters plus any deleted assignee, so it can be seen and removed. */
  protected readonly characterOptions = computed<CharacterOption[]>(() => {
    const live = this.characters().map((c) => ({ id: c.id, label: c.name }));
    const liveIds = new Set(live.map((c) => c.id));
    const deleted = this.deletedAssignees()
      .filter((c) => !liveIds.has(c.id))
      .map((c) => ({ id: c.id, label: `${c.name || c.id} (eliminato)` }));
    return [...live, ...deleted];
  });

  protected readonly canSaveHeader = computed(() => {
    const q = this.quest();
    if (!q) return false;
    if (this.kind() === 'personal' && this.characterIds().length === 0) return false;
    if (this.kind() !== q.kind) return true;
    if (this.kind() === 'story') return this.isPublic() !== q.isPublic;
    return !sameIds(this.characterIds(), q.characterIds);
  });

  constructor() {
    toObservable(this.campaign)
      .pipe(
        filter((c) => !!c),
        switchMap((c) => {
          this.api.campaignCharacters(c!.id).subscribe({
            next: (list) => this.characters.set(list),
          });
          return this.api.get(c!.id, this.questId).pipe(
            catchError((err) => {
              if (err?.status === 404) this.notFound.set(true);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((q) => this.setQuest(q));
  }

  protected saveHeader(): void {
    const campaign = this.campaign();
    if (!campaign || !this.canSaveHeader()) return;
    const body: UpdateQuestBody =
      this.kind() === 'story'
        ? { kind: 'story', isPublic: this.isPublic() }
        : { kind: 'personal', characterIds: this.characterIds() };
    this.savingHeader.set(true);
    this.api.update(campaign.id, this.questId, body).subscribe({
      next: (q) => {
        this.savingHeader.set(false);
        this.setQuest(q);
        this.messages.add({ severity: 'success', summary: 'Intestazione salvata' });
      },
      error: () => {
        this.savingHeader.set(false);
        this.messages.add({ severity: 'error', summary: 'Errore durante il salvataggio' });
      },
    });
  }

  protected openStage(stage: QuestStage | null): void {
    this.editingStage.set(stage);
    this.stageDialogOpen.set(true);
  }

  protected onStageSaved(q: Quest): void {
    this.stageDialogOpen.set(false);
    this.setQuest(q);
    this.messages.add({ severity: 'success', summary: 'Stadio salvato' });
  }

  protected confirmDeleteQuest(): void {
    this.confirmation.confirm({
      message: `Eliminare la quest «${this.title()}» e tutti i suoi stadi? L'operazione non è reversibile.`,
      acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: 'Elimina',
      rejectLabel: 'Annulla',
      accept: () => {
        const campaign = this.campaign();
        if (!campaign) return;
        this.api.delete(campaign.id, this.questId).subscribe({
          next: () => void this.router.navigate(['/quests']),
          error: () =>
            this.messages.add({ severity: 'error', summary: "Errore durante l'eliminazione" }),
        });
      },
    });
  }

  protected confirmDeleteStage(stage: QuestStage): void {
    this.confirmation.confirm({
      message: `Eliminare l'ultimo stadio «${stage.title}»? L'operazione non è reversibile.`,
      acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: 'Elimina',
      rejectLabel: 'Annulla',
      accept: () => {
        const campaign = this.campaign();
        if (!campaign) return;
        this.api.deleteStage(campaign.id, this.questId, stage.id).subscribe({
          next: (q) => {
            this.setQuest(q);
            this.messages.add({ severity: 'success', summary: 'Stadio eliminato' });
          },
          error: () =>
            this.messages.add({ severity: 'error', summary: "Errore durante l'eliminazione" }),
        });
      },
    });
  }

  private setQuest(q: Quest): void {
    this.quest.set(q);
    this.kind.set(q.kind);
    this.isPublic.set(q.isPublic);
    this.characterIds.set([...q.characterIds]);
  }
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}
