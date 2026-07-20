import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { Dialog } from 'primeng/dialog';
import { FileUpload, FileSelectEvent } from 'primeng/fileupload';
import { Textarea } from 'primeng/textarea';
import { TalentsCatalogApiService } from '../../core/talents-catalog/talents-catalog-api.service';
import type { TalentCatalogEntryDto } from '../../core/talents-catalog/talents-catalog.types';
import { TalentsCatalogImportSchema } from '../../domain/talents-catalog-import-schema';
import type { TalentCatalogImportEntry } from '../../domain/talents-catalog-import-schema';
import { diffTalentsImport } from './talents-catalog-import-diff';
import type { SkippedImportEntry } from './talents-catalog-import-diff';

interface ZodError {
  path: string;
  message: string;
}

interface ImportSummary {
  added: number;
  skipped: SkippedImportEntry[];
}

const SKIP_REASON_LABEL: Record<SkippedImportEntry['reason'], string> = {
  already_in_catalog: 'già nel catalogo',
  duplicate_in_file: 'duplicato nel file',
};

@Component({
  selector: 'app-import-talents-dialog',
  standalone: true,
  imports: [Dialog, FileUpload, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="closed.emit()"
      header="Importa talenti"
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
        placeholder="Incolla o carica il JSON dei talenti..."
        [value]="jsonText()"
        (input)="jsonText.set($any($event.target).value)"
      ></textarea>

      @if (parseError()) {
        <div class="bo-field-error" style="margin-top: 12px;">{{ parseError() }}</div>
      }

      @if (zodErrors().length > 0) {
        <div style="margin-top: 12px;">
          <div class="bo-field-error" style="margin-bottom: 4px;">Il file non è un catalogo talenti valido:</div>
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

      @if (summary(); as s) {
        <div style="margin-top: 12px; font-size: 14px;">
          <div>{{ s.added }} talenti aggiunti, {{ s.skipped.length }} saltati.</div>
          @if (s.skipped.length > 0) {
            <ul style="max-height: 30vh; overflow-y: auto; margin: 4px 0 0; padding-left: 20px; font-size: 12px;">
              @for (skip of s.skipped; track skip.slug) {
                <li>{{ skip.slug }} ({{ skipReasonLabel(skip.reason) }})</li>
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
          (click)="onImport()"
          [disabled]="!jsonText().trim() || importing()"
        >Importa</button>
      </div>
    </p-dialog>
  `,
})
export class ImportTalentsDialogComponent {
  @Input() visible = false;
  @Input() currentEntries: TalentCatalogEntryDto[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() imported = new EventEmitter<void>();

  private readonly api = inject(TalentsCatalogApiService);

  protected readonly jsonText = signal<string>('');
  protected readonly importing = signal<boolean>(false);
  protected readonly parseError = signal<string | null>(null);
  protected readonly zodErrors = signal<ZodError[]>([]);
  protected readonly apiError = signal<string | null>(null);
  protected readonly summary = signal<ImportSummary | null>(null);

  protected skipReasonLabel(reason: SkippedImportEntry['reason']): string {
    return SKIP_REASON_LABEL[reason];
  }

  protected onFileSelect(event: FileSelectEvent): void {
    this.resetFeedback();

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

  private resetFeedback(): void {
    this.parseError.set(null);
    this.zodErrors.set([]);
    this.apiError.set(null);
    this.summary.set(null);
  }

  private validate(): TalentCatalogImportEntry[] | null {
    this.resetFeedback();

    let parsed: unknown;
    try {
      parsed = JSON.parse(this.jsonText());
    } catch {
      this.parseError.set('Il file non è un JSON valido.');
      return null;
    }

    const result = TalentsCatalogImportSchema.safeParse(parsed);
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

  protected onImport(): void {
    const data = this.validate();
    if (data === null) return;

    const { addOps, skipped } = diffTalentsImport(this.currentEntries, data);

    if (addOps.length === 0) {
      this.summary.set({ added: 0, skipped });
      this.imported.emit();
      return;
    }

    this.importing.set(true);
    this.api.patchSchema(addOps).subscribe({
      next: () => {
        this.importing.set(false);
        this.summary.set({ added: addOps.length, skipped });
        this.imported.emit();
      },
      error: (err) => {
        this.importing.set(false);
        const body = err?.error;
        const msg =
          typeof body?.message === 'string'
            ? body.message
            : "Errore durante l'importazione dei talenti.";
        this.apiError.set(msg);
      },
    });
  }
}
