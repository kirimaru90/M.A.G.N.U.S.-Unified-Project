import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BehaviorSubject, switchMap } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { Toast } from 'primeng/toast';
import { CurrentCampaignService } from '../../core/campaign/current-campaign.service';
import { TerminalsApiService } from '../../core/terminal/terminals-api.service';
import type { TerminalDto } from '../../core/terminal/terminal.types';
import { exportTerminal } from './export-terminal';
import { CreateTerminalDialogComponent } from './create-terminal-dialog';
import { ImportTerminalDialogComponent } from './import-terminal-dialog';

@Component({
  selector: 'app-terminals-list',
  standalone: true,
  imports: [
    TableModule,
    ButtonModule,
    ConfirmDialog,
    Toast,
    RouterLink,
    DatePipe,
    CreateTerminalDialogComponent,
    ImportTerminalDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-toast />
    <p-confirmdialog />

    <div class="bo-page">
      <div class="bo-page-head">
        <h1>Terminali</h1>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="bo-btn ghost" (click)="showImport.set(true)">
            Importa terminale
          </button>
          <button type="button" class="bo-btn primary" (click)="showCreate.set(true)">
            Nuovo terminale
          </button>
        </div>
      </div>

      @if (campaignNotFound()) {
        <div class="bo-card" style="text-align: center; color: var(--bo-text-faint); padding: 32px;">
          <p>Campagna non trovata.</p>
          <a routerLink="/campaigns" class="bo-btn ghost" style="margin-top: 12px; display: inline-block;">
            Torna alle campagne
          </a>
        </div>
      } @else {
        <div class="bo-card">
          <p-table
            [value]="terminals() ?? []"
            [loading]="terminals() === undefined"
            [tableStyle]="{ 'min-width': '600px' }"
            styleClass="bo-table"
          >
            <ng-template pTemplate="header">
              <tr>
                <th pSortableColumn="meta.title">Titolo <p-sortIcon field="meta.title" /></th>
                <th pSortableColumn="meta.public">Pubblico <p-sortIcon field="meta.public" /></th>
                <th pSortableColumn="views">Visualizzazioni <p-sortIcon field="views" /></th>
                <th pSortableColumn="createdAt">Creato il <p-sortIcon field="createdAt" /></th>
                <th pSortableColumn="updatedAt">Aggiornato il <p-sortIcon field="updatedAt" /></th>
                <th>Azioni</th>
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-terminal>
              <tr>
                <td>
                  <a [routerLink]="['/terminals', terminal.id]">{{ terminal.meta.title }}</a>
                </td>
                <td>
                  <span class="bo-pill" [class.active]="terminal.meta.public">
                    {{ terminal.meta.public ? 'Pubblico' : 'Privato' }}
                  </span>
                </td>
                <td>{{ terminal.views ?? '—' }}</td>
                <td>{{ terminal.createdAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td>{{ terminal.updatedAt ? (terminal.updatedAt | date: 'dd/MM/yyyy HH:mm') : '—' }}</td>
                <td>
                  <div class="row-actions">
                    <button
                      type="button"
                      class="bo-btn ghost icon"
                      title="Apri"
                      [routerLink]="['/terminals', terminal.id]"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="bo-btn ghost icon"
                      title="Esporta"
                      (click)="onExport(terminal)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="bo-btn ghost icon danger"
                      title="Elimina"
                      (click)="confirmDelete(terminal)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6"/>
                        <path d="M14 11v6"/>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </ng-template>

            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="6" style="text-align: center; color: var(--bo-text-faint);">
                  Nessun terminale in questa campagna
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>
      }
    </div>

    <app-create-terminal-dialog
      [visible]="showCreate()"
      [campaignId]="campaignId"
      (closed)="showCreate.set(false)"
      (created)="onCreated()"
    />

    <app-import-terminal-dialog
      [visible]="showImport()"
      [campaignId]="campaignId"
      (closed)="showImport.set(false)"
      (imported)="onImported()"
    />
  `,
})
export class TerminalsListPage {
  private readonly terminalsApi = inject(TerminalsApiService);
  private readonly currentCampaign = inject(CurrentCampaignService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly route = inject(ActivatedRoute);

  protected readonly campaignId = this.route.snapshot.params['campaignId'] as string;

  protected readonly campaignNotFound = computed(() => {
    const list = this.currentCampaign.campaigns();
    return list.length > 0 && !list.some((c) => c.id === this.campaignId);
  });

  protected readonly showCreate = signal(false);
  protected readonly showImport = signal(false);

  private readonly reload$ = new BehaviorSubject<void>(undefined);
  protected readonly terminals = toSignal(
    this.reload$.pipe(switchMap(() => this.terminalsApi.listByCampaign(this.campaignId))),
  );

  protected onCreated(): void {
    this.showCreate.set(false);
    this.reload$.next();
    this.messageService.add({ severity: 'success', summary: 'Terminale creato' });
  }

  protected onImported(): void {
    this.reload$.next();
  }

  protected onExport(terminal: TerminalDto): void {
    exportTerminal(this.terminalsApi, this.messageService, terminal.id);
  }

  protected confirmDelete(terminal: TerminalDto): void {
    this.confirmationService.confirm({
      message:
        'Questa azione eliminerà il terminale e tutto lo stato locale associato. L\'operazione non è reversibile.',
      acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: 'Elimina',
      rejectLabel: 'Annulla',
      accept: () => this.onDeleteConfirmed(terminal),
    });
  }

  private onDeleteConfirmed(terminal: TerminalDto): void {
    this.terminalsApi.delete(terminal.id).subscribe({
      next: () => {
        this.reload$.next();
        this.messageService.add({ severity: 'success', summary: 'Terminale eliminato' });
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Errore durante l\'eliminazione' });
      },
    });
  }
}
