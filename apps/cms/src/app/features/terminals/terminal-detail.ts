import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, EMPTY } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Toast } from 'primeng/toast';
import { TerminalsApiService } from '../../core/terminal/terminals-api.service';
import { exportTerminal } from './export-terminal';
import { TerminalEditorComponent } from './editor/terminal-editor';
import { TerminalStatePanelComponent } from './terminal-state-panel';

@Component({
  selector: 'app-terminal-detail',
  standalone: true,
  imports: [RouterLink, Toast, ConfirmDialog, TerminalEditorComponent, TerminalStatePanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ConfirmationService, MessageService],
  template: `
    <p-toast />
    <p-confirmdialog />

    <div class="bo-page">
      @if (notFound()) {
        <div class="bo-card" style="text-align: center; color: var(--bo-text-faint); padding: 32px;">
          <p>Terminale non trovato.</p>
          <a routerLink="/campaigns" class="bo-btn ghost" style="margin-top: 12px; display: inline-block;">
            Torna alle campagne
          </a>
        </div>
      } @else if (terminal(); as t) {
        <div class="bo-page-head">
          <div>
            <a routerLink="/terminals" style="font-size: 12px; color: var(--bo-text-faint); text-decoration: none;">
              ← Torna ai terminali
            </a>
            <h1>{{ t.meta.title }}</h1>
          </div>
          <div class="bo-page-head-actions">
            @if (editor()?.dirty()) {
              <span class="bo-pill warn">Modifiche non salvate</span>
            }
            <button type="button" class="bo-btn ghost" (click)="onExport()">
              Esporta
            </button>
            <button
              type="button"
              class="bo-btn ghost"
              [disabled]="!editor()?.dirty()"
              (click)="editor()?.discard()"
            >
              Annulla modifiche
            </button>
            <button type="button" class="bo-btn primary" (click)="editor()?.save()">
              Salva
            </button>
          </div>
        </div>

        <app-terminal-editor
          [terminalId]="terminalId"
          [content]="t"
          [fictionalUsers]="fictionalUsers()"
          (saved)="saveVersion.update(v => v + 1)"
        />

        <app-terminal-state-panel [terminalId]="terminalId" [refreshTrigger]="saveVersion()" />
      } @else {
        <div class="bo-card" style="text-align: center; color: var(--bo-text-faint); padding: 32px;">
          Caricamento…
        </div>
      }
    </div>
  `,
})
export class TerminalDetailPage {
  private readonly terminalsApi = inject(TerminalsApiService);
  private readonly messageService = inject(MessageService);
  private readonly route = inject(ActivatedRoute);

  protected readonly terminalId = this.route.snapshot.params['id'] as string;

  protected readonly editor = viewChild(TerminalEditorComponent);

  protected readonly notFound = signal(false);
  protected readonly saveVersion = signal(0);

  private readonly envelope = toSignal(
    this.terminalsApi.getEnvelope(this.terminalId).pipe(
      catchError((err) => {
        if (err?.status === 404) {
          this.notFound.set(true);
        }
        return EMPTY;
      }),
    ),
  );

  protected readonly terminal = computed(() => this.envelope()?.content ?? null);
  protected readonly fictionalUsers = computed(() => this.envelope()?.fictionalUsers ?? []);

  protected onExport(): void {
    exportTerminal(this.terminalsApi, this.messageService, this.terminalId);
  }
}
