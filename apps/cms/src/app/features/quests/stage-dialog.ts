import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { Dialog } from 'primeng/dialog';
import { DialogActionsComponent } from '../../shared/dialog-actions/dialog-actions';
import { QuestsApiService } from '../../core/quests/quests-api.service';
import type { Quest, QuestStage, UpdateStageBody } from '../../core/quests/quests.types';
import {
  StageFieldsComponent,
  emptyStageDraft,
  stageDraftFrom,
  type StageDraft,
} from './stage-fields';

export const UNPUBLISH_CURRENT_MESSAGE =
  'I giocatori torneranno a vedere lo stadio precedente. Continuare?';

/**
 * Creates or edits one stage. A new stage opens pre-filled from the quest's
 * last stage but as a draft; an edit sends only the fields that changed.
 */
@Component({
  selector: 'app-stage-dialog',
  standalone: true,
  imports: [Dialog, FormsModule, DialogActionsComponent, StageFieldsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="closed.emit()"
      [header]="stage ? 'Modifica stadio' : 'Nuovo stadio'"
      [modal]="true"
      [style]="{ width: '520px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <form (ngSubmit)="onSubmit()">
        <app-stage-fields idPrefix="sd" [(draft)]="draft" />
        <app-dialog-actions
          [error]="apiError()"
          [saving]="saving()"
          [disabled]="!canSubmit()"
          (cancelled)="closed.emit()"
        />
      </form>
    </p-dialog>
  `,
})
export class StageDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input({ required: true }) campaignId!: string;
  @Input({ required: true }) quest!: Quest;
  /** The stage being edited; `null` creates a new one. */
  @Input() stage: QuestStage | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Quest>();

  private readonly api = inject(QuestsApiService);
  private readonly confirmation = inject(ConfirmationService);

  protected readonly draft = signal<StageDraft>(emptyStageDraft());
  private original: StageDraft | null = null;

  protected readonly saving = signal(false);
  protected readonly apiError = signal<string | null>(null);
  protected readonly canSubmit = computed(() => this.draft().title.trim().length > 0);

  ngOnChanges(): void {
    if (!this.visible) return;
    this.apiError.set(null);
    if (this.stage) {
      this.original = stageDraftFrom(this.stage);
      this.draft.set({ ...this.original });
    } else {
      this.original = null;
      const last = this.quest.stages[this.quest.stages.length - 1];
      this.draft.set({ ...(last ? stageDraftFrom(last) : emptyStageDraft()), isPublic: false });
    }
  }

  onSubmit(): void {
    if (!this.canSubmit() || this.saving()) return;
    const stage = this.stage;
    if (!stage) {
      this.create();
      return;
    }
    const changes = this.changedFields();
    if (Object.keys(changes).length === 0) {
      this.closed.emit();
      return;
    }
    if (changes.isPublic === false && this.isLastPublic(stage)) {
      this.confirmation.confirm({
        message: UNPUBLISH_CURRENT_MESSAGE,
        acceptLabel: 'Continua',
        rejectLabel: 'Annulla',
        accept: () => this.update(stage.id, changes),
      });
      return;
    }
    this.update(stage.id, changes);
  }

  private isLastPublic(stage: QuestStage): boolean {
    const publicStages = this.quest.stages.filter((s) => s.isPublic);
    return publicStages[publicStages.length - 1]?.id === stage.id;
  }

  private changedFields(): UpdateStageBody {
    const d = this.draft();
    const o = this.original!;
    const out: UpdateStageBody = {};
    if (d.title.trim() !== o.title) out.title = d.title.trim();
    if (d.description !== o.description) out.description = d.description;
    if (d.reward !== o.reward) out.reward = d.reward;
    if (d.status !== o.status) out.status = d.status;
    if (d.isMilestone !== o.isMilestone) out.isMilestone = d.isMilestone;
    if (d.isPublic !== o.isPublic) out.isPublic = d.isPublic;
    return out;
  }

  private create(): void {
    const d = this.draft();
    this.run(
      this.api.addStage(this.campaignId, this.quest.id, {
        title: d.title.trim(),
        description: d.description.trim() || undefined,
        reward: d.reward.trim() || undefined,
        status: d.status,
        isMilestone: d.isMilestone,
        isPublic: d.isPublic,
      }),
    );
  }

  private update(stageId: string, changes: UpdateStageBody): void {
    this.run(this.api.updateStage(this.campaignId, this.quest.id, stageId, changes));
  }

  private run(request: ReturnType<QuestsApiService['addStage']>): void {
    this.saving.set(true);
    this.apiError.set(null);
    request.subscribe({
      next: (quest) => {
        this.saving.set(false);
        this.saved.emit(quest);
      },
      error: () => {
        this.saving.set(false);
        this.apiError.set('Errore durante il salvataggio dello stadio.');
      },
    });
  }
}
