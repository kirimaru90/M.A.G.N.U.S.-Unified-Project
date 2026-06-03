import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { CreateUserSchema } from '../../core/user/user.schemas';
import { UsersApiService } from '../../core/user/users-api.service';
import type { UserDto } from '../../core/user/user.types';

const ROLE_OPTIONS = [
  { label: 'Admin', value: 'admin' },
  { label: 'Player', value: 'player' },
];

@Component({
  selector: 'app-create-user-dialog',
  standalone: true,
  imports: [Dialog, ReactiveFormsModule, InputText, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="closed.emit()"
      header="Nuovo utente"
      [modal]="true"
      [style]="{ width: '420px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <div class="bo-field">
          <label class="bo-label" for="cu-username">Nome utente</label>
          <input
            pInputText
            id="cu-username"
            formControlName="username"
            placeholder="Nome utente"
            class="bo-input w-full"
          />
          @if (usernameError()) {
            <span class="bo-field-error">{{ usernameError() }}</span>
          }
        </div>

        <div class="bo-field">
          <label class="bo-label" for="cu-role">Ruolo</label>
          <p-select
            inputId="cu-role"
            formControlName="role"
            [options]="roleOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Seleziona ruolo"
            styleClass="w-full"
          />
          @if (roleError()) {
            <span class="bo-field-error">{{ roleError() }}</span>
          }
        </div>

        <div class="bo-field">
          <label class="bo-label" for="cu-password">Password</label>
          <input
            pInputText
            type="password"
            id="cu-password"
            formControlName="password"
            placeholder="Password"
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
            {{ saving() ? 'Salvataggio…' : 'Crea' }}
          </button>
        </div>
      </form>
    </p-dialog>
  `,
})
export class CreateUserDialogComponent {
  @Input() visible = false;
  @Output() closed = new EventEmitter<void>();
  @Output() userCreated = new EventEmitter<UserDto>();

  protected readonly roleOptions = ROLE_OPTIONS;

  private readonly api = inject(UsersApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly saving = signal(false);
  protected readonly usernameError = signal<string | null>(null);
  protected readonly roleError = signal<string | null>(null);
  protected readonly passwordError = signal<string | null>(null);
  protected readonly apiError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    username: [''],
    role: [null as string | null],
    password: [''],
  });

  onSubmit(): void {
    this.usernameError.set(null);
    this.roleError.set(null);
    this.passwordError.set(null);
    this.apiError.set(null);

    const raw = this.form.getRawValue();
    const result = CreateUserSchema.safeParse({
      username: raw.username,
      role: raw.role,
      password: raw.password,
    });

    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        if (field === 'username') this.usernameError.set(issue.message);
        else if (field === 'role') this.roleError.set(issue.message);
        else if (field === 'password') this.passwordError.set(issue.message);
      }
      return;
    }

    this.saving.set(true);
    this.api.create(result.data).subscribe({
      next: (user) => {
        this.saving.set(false);
        this.form.reset({ username: '', role: null, password: '' });
        this.userCreated.emit(user);
      },
      error: () => {
        this.saving.set(false);
        this.apiError.set('Errore durante la creazione dell\'utente.');
      },
    });
  }
}
