import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { CreateCampaignSchema } from '../../core/campaign/campaign.schemas';
import { CampaignsApiService } from '../../core/campaign/campaigns-api.service';
import type { CampaignDto } from '../../core/campaign/campaign.types';

@Component({
  selector: 'app-create-campaign-dialog',
  standalone: true,
  imports: [Dialog, ReactiveFormsModule, Checkbox, InputText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="closed.emit()"
      header="Nuova campagna"
      [modal]="true"
      [style]="{ width: '420px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <div class="bo-field">
          <label class="bo-label" for="cc-name">Nome</label>
          <input
            pInputText
            id="cc-name"
            formControlName="name"
            placeholder="Nome campagna"
            class="bo-input w-full"
          />
          @if (nameError()) {
            <span class="bo-field-error">{{ nameError() }}</span>
          }
        </div>

        <div class="bo-field-row">
          <p-checkbox formControlName="isActive" [binary]="true" inputId="cc-active" />
          <label for="cc-active" class="bo-label" style="margin-left: 8px;">Attiva</label>
        </div>

        <div class="bo-field-row">
          <p-checkbox formControlName="isPublic" [binary]="true" inputId="cc-public" />
          <label for="cc-public" class="bo-label" style="margin-left: 8px;">Pubblica</label>
        </div>

        @if (apiError()) {
          <div class="bo-field-error" style="margin-top: 8px;">{{ apiError() }}</div>
        }

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;">
          <button type="button" class="bo-btn ghost" (click)="closed.emit()">Annulla</button>
          <button type="submit" class="bo-btn primary" [disabled]="saving()">
            {{ saving() ? 'Salvataggio…' : 'Crea' }}
          </button>
        </div>
      </form>
    </p-dialog>
  `,
})
export class CreateCampaignDialogComponent {
  @Input() visible = false;
  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<CampaignDto>();

  private readonly api = inject(CampaignsApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly saving = signal(false);
  protected readonly nameError = signal<string | null>(null);
  protected readonly apiError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    isActive: [false],
    isPublic: [false],
  });

  onSubmit(): void {
    this.nameError.set(null);
    this.apiError.set(null);

    const raw = this.form.getRawValue();
    const result = CreateCampaignSchema.safeParse({
      name: raw.name,
      isActive: raw.isActive ?? false,
      isPublic: raw.isPublic ?? false,
    });

    if (!result.success) {
      const nameIssue = result.error.issues.find((i) => i.path[0] === 'name');
      if (nameIssue) this.nameError.set(nameIssue.message);
      return;
    }

    this.saving.set(true);
    this.api.create(result.data).subscribe({
      next: (campaign) => {
        this.saving.set(false);
        this.form.reset({ name: '', isActive: false, isPublic: false });
        this.created.emit(campaign);
      },
      error: () => {
        this.saving.set(false);
        this.apiError.set('Errore durante la creazione della campagna.');
      },
    });
  }
}
