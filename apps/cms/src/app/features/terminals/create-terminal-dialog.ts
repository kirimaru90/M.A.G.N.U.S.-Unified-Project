import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { buildTerminalStub } from '../../core/terminal/terminal-stub';
import { TerminalsApiService } from '../../core/terminal/terminals-api.service';
import type { TerminalDto } from '../../core/terminal/terminal.types';
import { TerminalContentSchema } from '../../domain/terminal-schema';

@Component({
  selector: 'app-create-terminal-dialog',
  standalone: true,
  imports: [Dialog, ReactiveFormsModule, Checkbox, InputText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="closed.emit()"
      header="Nuovo terminale"
      [modal]="true"
      [style]="{ width: '420px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <div class="bo-field">
          <label class="bo-label" for="ct-title">Titolo</label>
          <input
            pInputText
            id="ct-title"
            formControlName="title"
            placeholder="Nome del terminale"
            class="bo-input w-full"
          />
          @if (titleError()) {
            <span class="bo-field-error">{{ titleError() }}</span>
          }
        </div>

        <div class="bo-field-row">
          <p-checkbox formControlName="public" [binary]="true" inputId="ct-public" />
          <label for="ct-public" class="bo-label" style="margin-left: 8px;">Pubblico</label>
        </div>

        @if (apiError()) {
          <div class="bo-field-error" style="margin-top: 8px;">{{ apiError() }}</div>
        }

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;">
          <button type="button" class="bo-btn ghost" (click)="closed.emit()">Annulla</button>
          <button type="submit" class="bo-btn primary" [disabled]="saving()">
            {{ saving() ? 'Creazione…' : 'Crea' }}
          </button>
        </div>
      </form>
    </p-dialog>
  `,
})
export class CreateTerminalDialogComponent {
  @Input() visible = false;
  @Input() campaignId = '';
  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<TerminalDto>();

  private readonly api = inject(TerminalsApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly saving = signal(false);
  protected readonly titleError = signal<string | null>(null);
  protected readonly apiError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    title: ['', Validators.required],
    public: [false],
  });

  onSubmit(): void {
    this.titleError.set(null);
    this.apiError.set(null);

    const raw = this.form.getRawValue();

    if (!raw.title || raw.title.trim().length === 0) {
      this.titleError.set('Il titolo è obbligatorio');
      return;
    }

    const stub = buildTerminalStub({ title: raw.title.trim(), public: raw.public ?? false });

    // Defence-in-depth: verify stub satisfies schema before sending
    const check = TerminalContentSchema.safeParse(stub);
    if (!check.success) {
      this.apiError.set('Errore interno: il terminale generato non è valido.');
      return;
    }

    this.saving.set(true);
    this.api.create(this.campaignId, stub).subscribe({
      next: (dto) => {
        this.saving.set(false);
        this.form.reset({ title: '', public: false });
        this.created.emit(dto);
      },
      error: () => {
        this.saving.set(false);
        this.apiError.set('Errore durante la creazione del terminale.');
      },
    });
  }
}
