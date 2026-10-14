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
import { DialogActionsComponent } from '../../shared/dialog-actions/dialog-actions';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { EditUserSchema } from '../../core/user/user.schemas';
import { UsersApiService } from '../../core/user/users-api.service';
import type { UserDto } from '../../core/user/user.types';

const ROLE_OPTIONS = [
  { label: 'Admin', value: 'admin' },
  { label: 'Player', value: 'player' },
];

@Component({
  selector: 'app-edit-user-dialog',
  standalone: true,
  imports: [Dialog, DialogActionsComponent, ReactiveFormsModule, InputText, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="closed.emit()"
      header="Modifica utente"
      [modal]="true"
      [style]="{ width: '420px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <div class="bo-field">
          <label class="bo-label" for="eu-username">Nome utente</label>
          <input
            pInputText
            id="eu-username"
            formControlName="username"
            placeholder="Nome utente"
            class="bo-input w-full"
          />
          @if (usernameError()) {
            <span class="bo-field-error">{{ usernameError() }}</span>
          }
        </div>

        <div class="bo-field">
          <label class="bo-label" for="eu-role">Ruolo</label>
          <p-select
            inputId="eu-role"
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

        <app-dialog-actions
          [error]="apiError()"
          [saving]="saving()"
          (cancelled)="closed.emit()"
        />
      </form>
    </p-dialog>
  `,
})
export class EditUserDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() user: UserDto | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() userUpdated = new EventEmitter<UserDto>();

  protected readonly roleOptions = ROLE_OPTIONS;

  private readonly api = inject(UsersApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly saving = signal(false);
  protected readonly usernameError = signal<string | null>(null);
  protected readonly roleError = signal<string | null>(null);
  protected readonly apiError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    username: [''],
    role: [null as string | null],
  });

  ngOnChanges(): void {
    if (this.user && this.visible) {
      this.usernameError.set(null);
      this.roleError.set(null);
      this.apiError.set(null);
      this.form.patchValue({ username: this.user.username, role: this.user.role });
    }
  }

  onSubmit(): void {
    this.usernameError.set(null);
    this.roleError.set(null);
    this.apiError.set(null);

    const raw = this.form.getRawValue();
    const result = EditUserSchema.safeParse({
      username: raw.username,
      role: raw.role,
    });

    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        if (field === 'username') this.usernameError.set(issue.message);
        else if (field === 'role') this.roleError.set(issue.message);
      }
      return;
    }

    if (!this.user) return;

    this.saving.set(true);
    this.api.update(this.user.id, result.data).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.userUpdated.emit(updated);
      },
      error: () => {
        this.saving.set(false);
        this.apiError.set('Errore durante la modifica dell\'utente.');
      },
    });
  }
}
