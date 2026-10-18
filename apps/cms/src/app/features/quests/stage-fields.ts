import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Checkbox } from 'primeng/checkbox';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import {
  QUEST_STATUSES,
  QUEST_STATUS_LABELS,
  type QuestStage,
  type QuestStatus,
} from '../../core/quests/quests.types';

/** The editable fields of a stage, as held by the create and stage dialogs. */
export interface StageDraft {
  title: string;
  description: string;
  reward: string;
  status: QuestStatus;
  isMilestone: boolean;
  isPublic: boolean;
}

export function emptyStageDraft(): StageDraft {
  return {
    title: '',
    description: '',
    reward: '',
    status: 'in_corso',
    isMilestone: false,
    isPublic: false,
  };
}

export function stageDraftFrom(stage: QuestStage): StageDraft {
  return {
    title: stage.title,
    description: stage.description ?? '',
    reward: stage.reward ?? '',
    status: stage.status,
    isMilestone: stage.isMilestone,
    isPublic: stage.isPublic,
  };
}

/** Title, description, reward, status and flags of one stage. */
@Component({
  selector: 'app-stage-fields',
  standalone: true,
  imports: [FormsModule, InputText, Textarea, Checkbox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bo-field">
      <label class="bo-label" [for]="idPrefix() + '-title'">Titolo</label>
      <input
        pInputText
        [id]="idPrefix() + '-title'"
        data-testid="stage-title"
        class="bo-input w-full"
        [ngModel]="draft().title"
        [ngModelOptions]="standalone"
        (ngModelChange)="set('title', $event)"
      />
    </div>

    <div class="bo-field">
      <label class="bo-label" [for]="idPrefix() + '-description'">Descrizione</label>
      <textarea
        pTextarea
        rows="4"
        [id]="idPrefix() + '-description'"
        data-testid="stage-description"
        class="bo-input w-full"
        [ngModel]="draft().description"
        [ngModelOptions]="standalone"
        (ngModelChange)="set('description', $event)"
      ></textarea>
    </div>

    <div class="bo-field">
      <label class="bo-label" [for]="idPrefix() + '-reward'">Ricompensa</label>
      <textarea
        pTextarea
        rows="2"
        [id]="idPrefix() + '-reward'"
        data-testid="stage-reward"
        class="bo-input w-full"
        [ngModel]="draft().reward"
        [ngModelOptions]="standalone"
        (ngModelChange)="set('reward', $event)"
      ></textarea>
    </div>

    <div class="bo-field">
      <label class="bo-label" [for]="idPrefix() + '-status'">Stato</label>
      <select
        class="bo-select w-full"
        [id]="idPrefix() + '-status'"
        data-testid="stage-status"
        [ngModel]="draft().status"
        [ngModelOptions]="standalone"
        (ngModelChange)="set('status', $event)"
      >
        @for (s of statuses; track s) {
          <option [value]="s">{{ statusLabels[s] }}</option>
        }
      </select>
    </div>

    <div style="display: flex; gap: 24px; margin-top: 8px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <p-checkbox
          [binary]="true"
          [inputId]="idPrefix() + '-milestone'"
          [ngModel]="draft().isMilestone"
          [ngModelOptions]="standalone"
          (ngModelChange)="set('isMilestone', $event)"
        />
        <label class="bo-label" [for]="idPrefix() + '-milestone'">Milestone</label>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <p-checkbox
          [binary]="true"
          [inputId]="idPrefix() + '-public'"
          data-testid="stage-public"
          [ngModel]="draft().isPublic"
          [ngModelOptions]="standalone"
          (ngModelChange)="set('isPublic', $event)"
        />
        <label class="bo-label" [for]="idPrefix() + '-public'">Stadio pubblico</label>
      </div>
    </div>
  `,
})
export class StageFieldsComponent {
  readonly draft = model.required<StageDraft>();
  readonly idPrefix = input('stage');

  protected readonly standalone = { standalone: true };
  protected readonly statuses = QUEST_STATUSES;
  protected readonly statusLabels = QUEST_STATUS_LABELS;

  protected set<K extends keyof StageDraft>(key: K, value: StageDraft[K]): void {
    this.draft.update((d) => ({ ...d, [key]: value }));
  }
}
