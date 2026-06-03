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
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { ResetPasswordSchema } from '../../core/user/user.schemas';
import { UsersApiService } from '../../core/user/users-api.service';
import type { UserDto } from '../../core/user/user.types';

@Component({
  selector: 'app-reset-password-dialog',
  standalone: true,
  imports: [Dialog, ReactiveFormsModule, InputText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="closed.emit()"
      header="Reimposta password"
      [modal]="true"
      [style]="{ width: '420px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <div class="bo-field">
          <label class="bo-label" for="rp-password">Nuova password</label>
          <input
            pInputText
            type="password"
            id="rp-password"
            formControlName="password"
            placeholder="Nuova password"
            class="bo-input w-full"
          />
          @if (passwordError()) {
            <span class="bo-field-error">{{ passwordError() }}</span>
          }
        </div>

        @if (apiError()) {
          <div class="bo-field-error" style="margin-top: 8px;">{{ apiError() }}</div>
        }

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;">
          <button type="button" class="bo-btn ghost" (click)="closed.emit()">Annulla</button>
          <button type="submit" class="bo-btn primary" [disabled]="saving()">
            {{ saving() ? 'Salvataggio…' : 'Reimposta' }}
          </button>
        </div>
      </form>
    </p-dialog>
  `,
})
export class ResetPasswordDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() user: UserDto | null = null;
  @Output() closed = new EventEmitter<void>();

  private readonly api = inject(UsersApiService);
  private readonly fb = inject(FormBuilder);
  private readonly messageService = inject(MessageService);

  protected readonly saving = signal(false);
  protected readonly passwordError = signal<string | null>(null);
  protected readonly apiError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    password: [''],
  });

  ngOnChanges(): void {
    if (this.visible) {
      this.passwordError.set(null);
      this.apiError.set(null);
      this.form.reset({ password: '' });
    }
  }

  onSubmit(): void {
    this.passwordError.set(null);
    this.apiError.set(null);

    const raw = this.form.getRawValue();
    const result = ResetPasswordSchema.safeParse({ password: raw.password });

    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'password');
      if (issue) this.passwordError.set(issue.message);
      return;
    }

    if (!this.user) return;

    this.saving.set(true);
    this.api.update(this.user.id, { password: result.data.password }).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.reset({ password: '' });
        this.messageService.add({ severity: 'success', summary: 'Password aggiornata' });
        this.closed.emit();
      },
      error: () => {
        this.saving.set(false);
        this.apiError.set('Errore durante il reset della password.');
      },
    });
  }
}
