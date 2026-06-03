import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { EditCampaignSchema } from '../../core/campaign/campaign.schemas';
import { CampaignsApiService } from '../../core/campaign/campaigns-api.service';
import type { CampaignDto } from '../../core/campaign/campaign.types';

@Component({
  selector: 'app-edit-campaign-dialog',
  standalone: true,
  imports: [Dialog, ReactiveFormsModule, Checkbox, InputText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="closed.emit()"
      header="Modifica campagna"
      [modal]="true"
      [style]="{ width: '420px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <div class="bo-field">
          <label class="bo-label" for="ec-name">Nome</label>
          <input
            pInputText
            id="ec-name"
            formControlName="name"
            placeholder="Nome campagna"
            class="bo-input w-full"
          />
          @if (nameError()) {
            <span class="bo-field-error">{{ nameError() }}</span>
          }
        </div>

        <div class="bo-field-row">
          <p-checkbox formControlName="isPublic" [binary]="true" inputId="ec-public" />
          <label for="ec-public" class="bo-label" style="margin-left: 8px;">Pubblica</label>
        </div>

        @if (apiError()) {
          <div class="bo-field-error" style="margin-top: 8px;">{{ apiError() }}</div>
        }

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;">
          <button type="button" class="bo-btn ghost" (click)="closed.emit()">Annulla</button>
          <button type="submit" class="bo-btn primary" [disabled]="saving()">
            {{ saving() ? 'Salvataggio…' : 'Salva' }}
          </button>
        </div>
      </form>
    </p-dialog>
  `,
})
export class EditCampaignDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() campaign: CampaignDto | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<CampaignDto>();

  private readonly api = inject(CampaignsApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly saving = signal(false);
  protected readonly nameError = signal<string | null>(null);
  protected readonly apiError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    isPublic: [false],
  });

  ngOnChanges(): void {
    if (this.campaign && this.visible) {
      this.nameError.set(null);
      this.apiError.set(null);
      this.form.patchValue({ name: this.campaign.name, isPublic: this.campaign.isPublic });
    }
  }

  onSubmit(): void {
    this.nameError.set(null);
    this.apiError.set(null);

    const raw = this.form.getRawValue();
    const result = EditCampaignSchema.safeParse({
      name: raw.name,
      isPublic: raw.isPublic ?? false,
    });

    if (!result.success) {
      const nameIssue = result.error.issues.find((i) => i.path[0] === 'name');
      if (nameIssue) this.nameError.set(nameIssue.message);
      return;
    }

    if (!this.campaign) return;

    this.saving.set(true);
    this.api.update(this.campaign.id, result.data).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.saved.emit(updated);
      },
      error: () => {
        this.saving.set(false);
        this.apiError.set('Errore durante la modifica della campagna.');
      },
    });
  }
}
