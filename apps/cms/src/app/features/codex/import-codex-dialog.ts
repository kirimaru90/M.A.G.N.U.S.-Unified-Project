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
import { Dialog } from 'primeng/dialog';
import { CodexApiService } from '../../core/codex/codex-api.service';
import type { CodexImportResult, CodexImportSkipReason } from '../../core/codex/codex.types';

export const SKIP_REASON_LABEL: Record<CodexImportSkipReason, string> = {
  invalid: 'non valida',
  collision: 'già presente',
  duplicate_in_file: 'duplicata nel file',
};

/** The file's entries, or the Italian error to show when it is not a JSON array. */
export function parseCodexFile(text: string): { entries: unknown[] } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: 'Il file non è un JSON valido.' };
  }
  if (!Array.isArray(parsed)) return { error: 'Il file deve contenere un array di voci.' };
  return { entries: parsed };
}

/**
 * Picks a codex export file, checks locally that it is a JSON array, and sends
 * it to the append-only import. Per-item rules (collisions, invalid items) are
 * the API's; this dialog only reports its summary.
 */
@Component({
  selector: 'app-import-codex-dialog',
  standalone: true,
  imports: [Dialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="closed.emit()"
      header="Importa codex"
      [modal]="true"
      [style]="{ width: '520px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <input
        type="file"
        accept=".json,application/json"
        data-testid="codex-import-file"
        (change)="onFileSelect($event)"
      />
      @if (fileName()) {
        <div style="margin-top: 8px; font-size: 13px;" data-testid="codex-import-ready">
          {{ fileName() }}: {{ entries()?.length ?? 0 }} voci
        </div>
      }

      @if (error()) {
        <div class="bo-field-error" style="margin-top: 12px;" data-testid="codex-import-error">
          {{ error() }}
        </div>
      }

      @if (summary(); as s) {
        <div style="margin-top: 12px; font-size: 14px;" data-testid="codex-import-summary">
          <div>{{ s.added }} voci aggiunte, {{ s.skipped.length }} saltate.</div>
          @if (s.skipped.length > 0) {
            <ul
              style="max-height: 30vh; overflow-y: auto; margin: 4px 0 0; padding-left: 20px; font-size: 12px;"
            >
              @for (skip of s.skipped; track skip.index) {
                <li>{{ skip.name || '(senza nome)' }} ({{ reasonLabel[skip.reason] }})</li>
              }
            </ul>
          }
        </div>
      }

      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;">
        <button type="button" class="bo-btn ghost" (click)="closed.emit()">Chiudi</button>
        <button
          type="button"
          class="bo-btn primary"
          data-testid="codex-import-submit"
          [disabled]="!entries() || importing()"
          (click)="onImport()"
        >
          Importa
        </button>
      </div>
    </p-dialog>
  `,
})
export class ImportCodexDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() campaignId = '';
  /** Emitted on close; the list refreshes then, whether or not anything was added. */
  @Output() closed = new EventEmitter<void>();

  private readonly api = inject(CodexApiService);

  protected readonly reasonLabel = SKIP_REASON_LABEL;

  protected readonly fileName = signal<string | null>(null);
  protected readonly entries = signal<unknown[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly summary = signal<CodexImportResult | null>(null);
  protected readonly importing = signal(false);

  ngOnChanges(): void {
    if (!this.visible) return;
    this.fileName.set(null);
    this.entries.set(null);
    this.error.set(null);
    this.summary.set(null);
  }

  protected onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => this.loadText(file.name, reader.result as string);
    reader.readAsText(file);
  }

  /** Validate the file locally; a malformed one never reaches the API. */
  loadText(name: string, text: string): void {
    this.summary.set(null);
    const result = parseCodexFile(text);
    if ('error' in result) {
      this.fileName.set(null);
      this.entries.set(null);
      this.error.set(result.error);
      return;
    }
    this.error.set(null);
    this.fileName.set(name);
    this.entries.set(result.entries);
  }

  onImport(): void {
    const entries = this.entries();
    if (!entries || this.importing()) return;
    this.importing.set(true);
    this.api.import(this.campaignId, entries).subscribe({
      next: (result) => {
        this.importing.set(false);
        this.entries.set(null);
        this.summary.set(result);
      },
      error: () => {
        this.importing.set(false);
        this.error.set("Errore durante l'importazione del codex.");
      },
    });
  }
}
