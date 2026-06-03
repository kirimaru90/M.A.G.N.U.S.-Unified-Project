import { ChangeDetectionStrategy, Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { switchMap } from 'rxjs/operators';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { StateApiService } from '../../core/state/state-api.service';
import type { MutationAtom, StateEntryDto } from '../../core/state/state.types';
import { TerminalsApiService } from '../../core/terminal/terminals-api.service';
import type { StateDeclaration, TerminalContent } from '../../domain/terminal-schema';
import { StateTableComponent } from '../state/state-table';

@Component({
  selector: 'app-terminal-state-panel',
  standalone: true,
  imports: [ButtonModule, StateTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bo-card section" style="margin-top: 16px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <h2 style="margin: 0;">Stato locale</h2>
        @if (entries().length > 0) {
          <button type="button" class="bo-btn ghost danger" (click)="confirmResetAll()">
            Reset tutto ({{ entries().length }})
          </button>
        }
      </div>

      <app-state-table
        [entries]="entries()"
        scope="local"
        emptyMessage="Nessuna variabile locale dichiarata"
        (mutate)="onMutate($event)"
        (resetVar)="onResetVar($event)"
        (schemaChange)="onSchemaChange($event)"
      />
    </div>
  `,
})
export class TerminalStatePanelComponent implements OnInit, OnChanges {
  @Input({ required: true }) terminalId!: string;
  @Input() refreshTrigger = 0;

  private readonly stateApi = inject(StateApiService);
  private readonly terminalsApi = inject(TerminalsApiService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  protected readonly entries = signal<StateEntryDto[]>([]);
  private readonly localSchema = signal<StateDeclaration['local']>({});

  ngOnInit(): void {
    this.loadFull();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['refreshTrigger'] && !changes['refreshTrigger'].firstChange) {
      this.loadFull();
    }
  }

  private loadFull(): void {
    this.terminalsApi.getEnvelope(this.terminalId).subscribe({
      next: (envelope) => {
        const schema = envelope.content.state.local;
        this.localSchema.set(schema);
        this.entries.set(this.buildEntries(schema, envelope.state));
      },
      error: () =>
        this.messageService.add({ severity: 'error', summary: 'Errore caricamento stato' }),
    });
  }

  private loadValues(): void {
    this.stateApi.getTerminalFlatState(this.terminalId).subscribe({
      next: (flat) => {
        this.entries.set(this.buildEntries(this.localSchema(), flat));
      },
      error: () =>
        this.messageService.add({ severity: 'error', summary: 'Errore caricamento stato' }),
    });
  }

  private buildEntries(
    schema: StateDeclaration['local'],
    flat: Record<string, unknown>,
  ): StateEntryDto[] {
    return Object.entries(schema).map(([key, variable]) => {
      const entry: StateEntryDto = {
        key,
        type: variable.type,
        default: variable.default,
        current: (flat[key] ?? variable.default) as boolean | number | string,
      };
      if (variable.type === 'enum') {
        entry.values = variable.values;
      }
      return entry;
    });
  }

  protected onMutate(atom: MutationAtom): void {
    this.stateApi.mutateTerminal(this.terminalId, [atom]).subscribe({
      next: () => this.loadValues(),
      error: () =>
        this.messageService.add({ severity: 'error', summary: 'Errore durante la modifica' }),
    });
  }

  protected onSchemaChange(event: { old: StateEntryDto; entry: StateEntryDto }): void {
    this.terminalsApi
      .get(this.terminalId)
      .pipe(
        switchMap((content: TerminalContent) => {
          const local = { ...content.state.local } as Record<string, unknown>;
          delete local[event.old.key];
          local[event.entry.key] = this.toSchemaVar(event.entry);
          const updated: TerminalContent = {
            ...content,
            state: {
              ...content.state,
              local: local as unknown as TerminalContent['state']['local'],
            },
          };
          return this.terminalsApi.update(this.terminalId, updated);
        }),
        switchMap(() =>
          this.stateApi.mutateTerminal(this.terminalId, [
            { key: `local.${event.entry.key}`, op: 'set', value: event.entry.current },
          ]),
        ),
      )
      .subscribe({
        next: () => this.loadFull(),
        error: () =>
          this.messageService.add({ severity: 'error', summary: 'Errore durante la modifica dello schema' }),
      });
  }

  private toSchemaVar(entry: StateEntryDto): unknown {
    if (entry.type === 'boolean') return { type: 'boolean', default: entry.default as boolean };
    if (entry.type === 'number') return { type: 'number', default: entry.default as number };
    if (entry.type === 'enum')
      return { type: 'enum', default: entry.default as string, values: entry.values ?? [] };
    return { type: 'string', default: entry.default as string };
  }

  protected onResetVar(entry: StateEntryDto): void {
    this.confirmationService.confirm({
      message: `Ripristinare la variabile "${entry.key}" al valore di default (${entry.default})?`,
      acceptLabel: 'Ripristina',
      rejectLabel: 'Annulla',
      accept: () => {
        this.stateApi.resetTerminalVar(this.terminalId, entry.key).subscribe({
          next: () => this.loadValues(),
          error: () =>
            this.messageService.add({ severity: 'error', summary: 'Errore durante il reset' }),
        });
      },
    });
  }

  protected confirmResetAll(): void {
    this.confirmationService.confirm({
      message: `Ripristinare tutte le ${this.entries().length} variabili locali ai valori di default?`,
      acceptLabel: 'Ripristina tutto',
      rejectLabel: 'Annulla',
      acceptButtonStyleClass: 'p-button-warning',
      accept: () => {
        this.stateApi.resetTerminalAll(this.terminalId).subscribe({
          next: () => this.loadValues(),
          error: () =>
            this.messageService.add({ severity: 'error', summary: 'Errore durante il reset' }),
        });
      },
    });
  }
}
