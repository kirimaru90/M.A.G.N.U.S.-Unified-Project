import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { MessageService } from 'primeng/api';
import { Dialog } from 'primeng/dialog';
import { FileUpload, FileSelectEvent } from 'primeng/fileupload';
import { Textarea } from 'primeng/textarea';
import { TerminalsApiService } from '../../core/terminal/terminals-api.service';
import type { TerminalDto } from '../../core/terminal/terminal.types';
import { TerminalContentSchema } from '../../domain/terminal-schema';
import type { TerminalContent } from '../../domain/terminal-schema';

interface ZodError {
  path: string;
  message: string;
}

@Component({
  selector: 'app-import-terminal-dialog',
  standalone: true,
  imports: [Dialog, FileUpload, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="closed.emit()"
      header="Importa terminale"
      [modal]="true"
      [style]="{ width: '580px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <p-fileupload
        mode="basic"
        accept=".json,application/json"
        [maxFileSize]="1048576"
        chooseLabel="Scegli file JSON"
        [auto]="false"
        [customUpload]="true"
        (onSelect)="onFileSelect($event)"
      />

      <textarea
        pInputTextarea
        class="bo-input w-full"
        style="margin-top: 12px; height: 200px; font-family: monospace; font-size: 12px; resize: vertical;"
        placeholder="Incolla o carica il JSON del terminale..."
        [value]="jsonText()"
        (input)="jsonText.set($any($event.target).value)"
      ></textarea>

      @if (parseError()) {
        <div class="bo-field-error" style="margin-top: 12px;">{{ parseError() }}</div>
      }

      @if (zodErrors().length > 0) {
        <div style="margin-top: 12px;">
          <div class="bo-field-error" style="margin-bottom: 4px;">Il file non è un terminale valido:</div>
          <ul style="max-height: 40vh; overflow-y: auto; margin: 0; padding-left: 20px; font-size: 12px;">
            @for (err of zodErrors(); track $index) {
              <li>{{ err.path }}: {{ err.message }}</li>
            }
          </ul>
        </div>
      }

      @if (apiError()) {
        <div class="bo-field-error" style="margin-top: 12px;">{{ apiError() }}</div>
      }

      @if (validConfirmation()) {
        <div style="margin-top: 12px; color: green; font-size: 14px;">JSON valido.</div>
      }

      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;">
        <button type="button" class="bo-btn ghost" (click)="closed.emit()">Chiudi</button>
        <button type="button" class="bo-btn secondary" (click)="onCheckJson()">Controlla JSON</button>
        <button
          type="button"
          class="bo-btn primary"
          (click)="onImport()"
          [disabled]="!jsonText().trim() || importing()"
        >Importa</button>
      </div>
    </p-dialog>
  `,
})
export class ImportTerminalDialogComponent {
  @Input() visible = false;
  @Input() campaignId = '';
  @Output() closed = new EventEmitter<void>();
  @Output() imported = new EventEmitter<TerminalDto>();

  private readonly api = inject(TerminalsApiService);
  private readonly messageService = inject(MessageService);

  protected readonly jsonText = signal<string>('');
  protected readonly importing = signal<boolean>(false);
  protected readonly parseError = signal<string | null>(null);
  protected readonly zodErrors = signal<ZodError[]>([]);
  protected readonly apiError = signal<string | null>(null);
  protected readonly validConfirmation = signal<boolean>(false);

  protected onFileSelect(event: FileSelectEvent): void {
    this.parseError.set(null);
    this.zodErrors.set([]);
    this.apiError.set(null);
    this.validConfirmation.set(false);

    const file = event.currentFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const raw = reader.result as string;
      try {
        const parsed = JSON.parse(raw);
        this.jsonText.set(JSON.stringify(parsed, null, 2));
      } catch {
        this.jsonText.set(raw);
      }
    };
    reader.readAsText(file);
  }

  private validate(): TerminalContent | null {
    this.parseError.set(null);
    this.zodErrors.set([]);
    this.apiError.set(null);
    this.validConfirmation.set(false);

    let parsed: unknown;
    try {
      parsed = JSON.parse(this.jsonText());
    } catch {
      this.parseError.set('Il file non è un JSON valido.');
      return null;
    }

    const result = TerminalContentSchema.safeParse(parsed);
    if (!result.success) {
      this.zodErrors.set(
        result.error.issues.map((issue) => ({
          path: issue.path.join('.') || '(root)',
          message: issue.message,
        })),
      );
      return null;
    }

    return result.data;
  }

  protected onCheckJson(): void {
    const data = this.validate();
    if (data !== null) {
      this.jsonText.set(JSON.stringify(data, null, 2));
      this.validConfirmation.set(true);
    }
  }

  protected onImport(): void {
    const data = this.validate();
    if (data === null) return;

    this.importing.set(true);
    this.api.import(this.campaignId, data).subscribe({
      next: (dto) => {
        this.importing.set(false);
        this.messageService.add({ severity: 'success', summary: 'Terminale importato' });
        this.imported.emit(dto);
        this.closed.emit();
      },
      error: (err) => {
        this.importing.set(false);
        const body = err?.error;
        const msg =
          typeof body?.message === 'string'
            ? body.message
            : 'Errore durante l\'importazione del terminale.';
        this.apiError.set(msg);
      },
    });
  }
}
