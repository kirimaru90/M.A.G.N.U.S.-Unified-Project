import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { StateApiService } from '../../core/state/state-api.service';
import { CampaignGlobalSchemaApiService } from '../../core/state/campaign-global-schema-api.service';
import { StateSchemaConflictResponseSchema, coerceForType } from '../../core/state/state.schemas';
import type { MutationAtom, StateEntryDto, StateEntryShape, StateSchemaConflictResponse } from '../../core/state/state.types';
import { TerminalsApiService } from '../../core/terminal/terminals-api.service';
import type { CampaignDto } from '../../core/campaign/campaign.types';
import { CampaignsApiService } from '../../core/campaign/campaigns-api.service';
import { StateTableComponent } from '../state/state-table';
import { ResetConfirmComponent } from '../state/reset-confirm';
import { SchemaConflictDialogComponent } from '../state/schema-conflict-dialog';

@Component({
  selector: 'app-campaign-state-panel',
  standalone: true,
  imports: [ButtonModule, StateTableComponent, ResetConfirmComponent, SchemaConflictDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-reset-confirm
      [campaignName]="campaign.name"
      [visible]="showResetConfirm()"
      (confirmed)="executeEntireCampaignReset()"
      (cancelled)="showResetConfirm.set(false)"
    />

    <app-schema-conflict-dialog
      [visible]="showConflictDialog()"
      [conflict]="conflictData()"
      (dismissed)="showConflictDialog.set(false)"
    />

    <div class="bo-card section" style="margin-top: 16px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <h2 style="margin: 0;">Stato globale</h2>
        <div style="display: flex; gap: 8px;">
          @if (entries().length > 0) {
            <button type="button" class="bo-btn ghost danger" (click)="confirmResetGlobal()">
              Reset globale ({{ entries().length }})
            </button>
          }
          <button
            type="button"
            class="bo-btn ghost danger"
            style="border-color: var(--p-red-600, #dc2626); color: var(--p-red-600, #dc2626);"
            (click)="showResetConfirm.set(true)"
          >
            Reset intera campagna
          </button>
        </div>
      </div>

      <app-state-table
        [entries]="entries()"
        scope="global"
        emptyMessage="Nessuna variabile globale dichiarata"
        [allowSchemaAdd]="true"
        [allowSchemaDelete]="true"
        (mutate)="onMutate($event)"
        (resetVar)="onResetVar($event)"
        (schemaChange)="onSchemaChange($event)"
        (addVar)="onAddVar($event)"
        (deleteVar)="onDeleteVar($event)"
      />
    </div>
  `,
})
export class CampaignStatePanelComponent implements OnInit {
  @Input({ required: true }) campaign!: CampaignDto;

  private readonly stateApi = inject(StateApiService);
  private readonly schemaApi = inject(CampaignGlobalSchemaApiService);
  private readonly campaignsApi = inject(CampaignsApiService);
  private readonly terminalsApi = inject(TerminalsApiService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  protected readonly entries = signal<StateEntryDto[]>([]);
  protected readonly showResetConfirm = signal(false);
  protected readonly showConflictDialog = signal(false);
  protected readonly conflictData = signal<StateSchemaConflictResponse | null>(null);

  ngOnInit(): void {
    this.loadState();
  }

  private loadState(): void {
    this.campaignsApi.get(this.campaign.id).subscribe({
      next: (c) => {
        const entries: StateEntryDto[] = Object.entries(c.state ?? {}).map(([key, entry]) => ({
          key,
          type: entry.type,
          default: entry.default as boolean | number | string,
          current: entry.value as boolean | number | string,
          ...(entry.values ? { values: entry.values } : {}),
        }));
        this.entries.set(entries);
      },
      error: () =>
        this.messageService.add({ severity: 'error', summary: 'Errore caricamento stato' }),
    });
  }

  protected onMutate(atom: MutationAtom): void {
    this.stateApi.mutateCampaign(this.campaign.id, [atom]).subscribe({
      next: () => this.loadState(),
      error: () =>
        this.messageService.add({ severity: 'error', summary: 'Errore durante la modifica' }),
    });
  }

  protected onSchemaChange(event: { old: StateEntryDto; entry: StateEntryDto }): void {
    const { old, entry } = event;
    const isRename = old.key !== entry.key;
    const isTypeChange = !isRename && old.type !== entry.type;

    const entryShape: StateEntryShape = {
      type: entry.type,
      default: entry.default,
      ...(entry.values ? { values: entry.values } : {}),
    };

    const op = isRename
      ? { action: 'update' as const, name: old.key, rename: entry.key, entry: entryShape, value: coerceForType(entry, entry.current) }
      : isTypeChange
        ? { action: 'update' as const, name: old.key, entry: entryShape }
        : { action: 'update' as const, name: old.key, entry: entryShape, value: coerceForType(entry, entry.current) };

    this.schemaApi.patchSchema(this.campaign.id, [op]).subscribe({
      next: () => {
        this.loadState();
        this.messageService.add({ severity: 'success', summary: 'Variabile aggiornata' });
      },
      error: (err) => this.handleSchemaError(err),
    });
  }

  protected onAddVar(entry: StateEntryDto): void {
    const entryShape: StateEntryShape = {
      type: entry.type,
      default: entry.default,
      ...(entry.values ? { values: entry.values } : {}),
    };
    this.schemaApi.patchSchema(this.campaign.id, [{ action: 'add', name: entry.key, entry: entryShape }]).subscribe({
      next: () => {
        this.loadState();
        this.messageService.add({ severity: 'success', summary: 'Variabile aggiunta' });
      },
      error: (err) => this.handleSchemaError(err),
    });
  }

  protected onDeleteVar(entry: StateEntryDto): void {
    this.confirmationService.confirm({
      message: `Eliminare la variabile globale "${entry.key}"? Sarà rimossa dalla campagna.`,
      acceptLabel: 'Elimina',
      rejectLabel: 'Annulla',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.schemaApi.patchSchema(this.campaign.id, [{ action: 'delete', name: entry.key }]).subscribe({
          next: () => {
            this.loadState();
            this.messageService.add({ severity: 'success', summary: 'Variabile eliminata' });
          },
          error: (err) => this.handleSchemaError(err),
        });
      },
    });
  }

  private handleSchemaError(err: { status?: number; error?: unknown }): void {
    if (err?.status === 409) {
      const parsed = StateSchemaConflictResponseSchema.safeParse(err.error);
      if (parsed.success) {
        this.conflictData.set(parsed.data);
        this.showConflictDialog.set(true);
        return;
      }
    }
    this.messageService.add({ severity: 'error', summary: 'Errore durante l\'operazione' });
  }

  protected onResetVar(entry: StateEntryDto): void {
    this.confirmationService.confirm({
      message: `Ripristinare la variabile "${entry.key}" al valore di default (${entry.default})?`,
      acceptLabel: 'Ripristina',
      rejectLabel: 'Annulla',
      accept: () => {
        this.stateApi.resetCampaignVar(this.campaign.id, entry.key).subscribe({
          next: () => this.loadState(),
          error: () =>
            this.messageService.add({ severity: 'error', summary: 'Errore durante il reset' }),
        });
      },
    });
  }

  protected confirmResetGlobal(): void {
    this.confirmationService.confirm({
      message: `Ripristinare tutte le ${this.entries().length} variabili globali ai valori di default?`,
      acceptLabel: 'Ripristina tutto',
      rejectLabel: 'Annulla',
      acceptButtonStyleClass: 'p-button-warning',
      accept: () => {
        this.stateApi.resetCampaignAll(this.campaign.id).subscribe({
          next: () => this.loadState(),
          error: () =>
            this.messageService.add({ severity: 'error', summary: 'Errore durante il reset globale' }),
        });
      },
    });
  }

  protected executeEntireCampaignReset(): void {
    this.showResetConfirm.set(false);
    this.stateApi
      .resetCampaignAll(this.campaign.id)
      .pipe(
        switchMap(() =>
          this.terminalsApi.listByCampaign(this.campaign.id).pipe(
            switchMap((terminals) => {
              if (terminals.length === 0) return of({ successes: 0, failures: [] as string[] });
              const resets = terminals.map((t) =>
                this.stateApi.resetTerminalAll(t.id).pipe(
                  catchError(() => of({ failed: t.id })),
                ),
              );
              return forkJoin(resets).pipe(
                switchMap((results) => {
                  const failures = results
                    .filter((r): r is { failed: string } => r !== null && typeof r === 'object' && 'failed' in r)
                    .map((r) => r.failed);
                  return of({ successes: terminals.length - failures.length, failures });
                }),
              );
            }),
          ),
        ),
        catchError((err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Reset globale fallito',
            detail: 'Nessun terminale locale è stato resettato.',
          });
          throw err;
        }),
      )
      .subscribe(({ successes, failures }) => {
        this.loadState();
        if (failures.length === 0) {
          this.messageService.add({
            severity: 'success',
            summary: 'Reset completato',
            detail: `Stato globale + ${successes} terminal${successes !== 1 ? 'i' : 'e'} locale${successes !== 1 ? 'i' : ''} resettati.`,
          });
        } else {
          this.messageService.add({
            severity: 'warn',
            summary: 'Reset parziale',
            detail: `${successes} terminali resettati. Errori: ${failures.join(', ')}`,
          });
        }
      });
  }
}
