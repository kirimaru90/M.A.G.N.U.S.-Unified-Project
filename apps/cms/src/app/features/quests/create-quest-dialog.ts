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
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { MultiSelect } from 'primeng/multiselect';
import { DialogActionsComponent } from '../../shared/dialog-actions/dialog-actions';
import { QuestsApiService } from '../../core/quests/quests-api.service';
import {
  QUEST_KIND_LABELS,
  type CampaignCharacterOption,
  type Quest,
  type QuestKind,
} from '../../core/quests/quests.types';
import { StageFieldsComponent, emptyStageDraft, type StageDraft } from './stage-fields';

/** Collects a quest header and its first stage, then creates it. */
@Component({
  selector: 'app-create-quest-dialog',
  standalone: true,
  imports: [Dialog, FormsModule, Checkbox, MultiSelect, DialogActionsComponent, StageFieldsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="closed.emit()"
      header="Nuova quest"
      [modal]="true"
      [style]="{ width: '520px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <form (ngSubmit)="onSubmit()">
        <div class="bo-field">
          <label class="bo-label" for="cq-kind">Tipo</label>
          <select
            id="cq-kind"
            name="kind"
            class="bo-select w-full"
            data-testid="quest-kind"
            [ngModel]="kind()"
            (ngModelChange)="kind.set($event)"
          >
            <option value="story">{{ kindLabels.story }}</option>
            <option value="personal">{{ kindLabels.personal }}</option>
          </select>
        </div>

        @if (kind() === 'story') {
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;" data-testid="quest-public-field">
            <p-checkbox
              [binary]="true"
              inputId="cq-public"
              name="isPublic"
              [ngModel]="isPublic()"
              (ngModelChange)="isPublic.set($event)"
            />
            <label class="bo-label" for="cq-public">Pubblica</label>
          </div>
        } @else {
          <div class="bo-field" data-testid="quest-characters-field">
            <label class="bo-label" for="cq-characters">Personaggi</label>
            <p-multiselect
              inputId="cq-characters"
              name="characterIds"
              [options]="characters()"
              optionLabel="name"
              optionValue="id"
              placeholder="Seleziona personaggi"
              [showToggleAll]="false"
              styleClass="w-full"
              appendTo="body"
              [ngModel]="characterIds()"
              (ngModelChange)="characterIds.set($event ?? [])"
            />
          </div>
        }

        <div class="bo-card-section-title" style="margin-top: 12px;">Primo stadio</div>
        <app-stage-fields idPrefix="cq-stage" [(draft)]="stage" />

        <app-dialog-actions
          [error]="apiError()"
          [saving]="saving()"
          [disabled]="!canSubmit()"
          submitLabel="Crea"
          savingLabel="Creazione…"
          (cancelled)="closed.emit()"
        />
      </form>
    </p-dialog>
  `,
})
export class CreateQuestDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() campaignId = '';
  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<Quest>();

  private readonly api = inject(QuestsApiService);

  protected readonly kindLabels = QUEST_KIND_LABELS;

  protected readonly kind = signal<QuestKind>('story');
  protected readonly isPublic = signal(false);
  protected readonly characterIds = signal<string[]>([]);
  protected readonly stage = signal<StageDraft>(emptyStageDraft());
  protected readonly characters = signal<CampaignCharacterOption[]>([]);

  protected readonly saving = signal(false);
  protected readonly apiError = signal<string | null>(null);

  protected readonly canSubmit = computed(
    () =>
      this.stage().title.trim().length > 0 &&
      (this.kind() === 'story' || this.characterIds().length > 0),
  );

  ngOnChanges(): void {
    if (!this.visible) return;
    this.reset();
    if (this.campaignId) {
      this.api.campaignCharacters(this.campaignId).subscribe({
        next: (list) => this.characters.set(list),
      });
    }
  }

  onSubmit(): void {
    if (!this.canSubmit() || this.saving()) return;
    this.apiError.set(null);
    const s = this.stage();
    const story = this.kind() === 'story';

    this.saving.set(true);
    this.api
      .create(this.campaignId, {
        kind: this.kind(),
        isPublic: story ? this.isPublic() : false,
        ...(story ? {} : { characterIds: this.characterIds() }),
        stage: {
          title: s.title.trim(),
          description: s.description.trim() || undefined,
          reward: s.reward.trim() || undefined,
          status: s.status,
          isMilestone: s.isMilestone,
          isPublic: s.isPublic,
        },
      })
      .subscribe({
        next: (quest) => {
          this.saving.set(false);
          this.created.emit(quest);
        },
        error: () => {
          this.saving.set(false);
          this.apiError.set('Errore durante la creazione della quest.');
        },
      });
  }

  private reset(): void {
    this.kind.set('story');
    this.isPublic.set(false);
    this.characterIds.set([]);
    this.stage.set(emptyStageDraft());
    this.apiError.set(null);
  }
}
