import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { Toast } from 'primeng/toast';
import { CampaignsApiService } from '../../core/campaign/campaigns-api.service';
import type { CampaignDto } from '../../core/campaign/campaign.types';
import { CurrentCampaignService } from '../../core/campaign/current-campaign.service';
import { CreateCampaignDialogComponent } from './create-campaign-dialog';
import { EditCampaignDialogComponent } from './edit-campaign-dialog';

@Component({
  selector: 'app-campaigns',
  standalone: true,
  imports: [
    TableModule,
    ButtonModule,
    ConfirmDialog,
    Toast,
    RouterLink,
    CreateCampaignDialogComponent,
    EditCampaignDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-toast />
    <p-confirmdialog />

    <div class="bo-page">
      <div class="bo-page-head">
        <h1>Campagne</h1>
        <button type="button" class="bo-btn primary" (click)="showCreate.set(true)">
          Nuova campagna
        </button>
      </div>

      <div class="bo-card">
        <p-table
          [value]="campaigns() ?? []"
          [loading]="campaigns() === undefined"
          [tableStyle]="{ 'min-width': '600px' }"
          styleClass="bo-table"
        >
          <ng-template pTemplate="header">
            <tr>
              <th>Nome</th>
              <th>Attiva</th>
              <th>Pubblica</th>
              <th>Azioni</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-campaign>
            <tr>
              <td>
                <a [routerLink]="['/campaigns', campaign.id]">{{ campaign.name }}</a>
              </td>
              <td>
                <span class="bo-pill" [class.active]="campaign.isActive">
                  {{ campaign.isActive ? 'Attiva' : 'Inattiva' }}
                </span>
              </td>
              <td>
                <span class="bo-pill" [class.active]="campaign.isPublic">
                  {{ campaign.isPublic ? 'Pubblica' : 'Privata' }}
                </span>
              </td>
              <td>
                <div class="row-actions">
                  <button
                    type="button"
                    class="bo-btn ghost icon"
                    title="Modifica"
                    (click)="openEdit(campaign)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="bo-btn ghost icon"
                    [title]="campaign.isActive ? 'Disattiva' : 'Attiva'"
                    (click)="toggleActive(campaign)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="bo-btn ghost icon danger"
                    title="Elimina"
                    (click)="confirmDelete(campaign)"
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
              <td colspan="4" style="text-align: center; color: var(--bo-text-faint);">
                Nessuna campagna trovata
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>

    <app-create-campaign-dialog
      [visible]="showCreate()"
      (closed)="showCreate.set(false)"
      (created)="onCreated()"
    />

    <app-edit-campaign-dialog
      [visible]="showEdit()"
      [campaign]="campaignToEdit()"
      (closed)="closeEdit()"
      (saved)="onSaved($event)"
    />
  `,
})
export class CampaignsPage {
  private readonly api = inject(CampaignsApiService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly currentCampaign = inject(CurrentCampaignService);

  protected readonly campaigns = this.currentCampaign.campaigns;

  protected readonly showCreate = signal(false);
  protected readonly showEdit = signal(false);
  protected readonly campaignToEdit = signal<CampaignDto | null>(null);

  protected openEdit(campaign: CampaignDto): void {
    this.campaignToEdit.set(campaign);
    this.showEdit.set(true);
  }

  protected closeEdit(): void {
    this.showEdit.set(false);
    this.campaignToEdit.set(null);
  }

  protected onCreated(): void {
    this.showCreate.set(false);
    this.currentCampaign.refresh();
    this.messageService.add({ severity: 'success', summary: 'Campagna creata' });
  }

  protected onSaved(_updated: CampaignDto): void {
    this.closeEdit();
    this.currentCampaign.refresh();
    this.messageService.add({ severity: 'success', summary: 'Campagna aggiornata' });
  }

  protected toggleActive(campaign: CampaignDto): void {
    this.api.activate(campaign.id).subscribe({
      next: () => this.currentCampaign.refresh(),
      error: () =>
        this.messageService.add({ severity: 'error', summary: 'Errore durante l\'aggiornamento' }),
    });
  }

  protected confirmDelete(campaign: CampaignDto): void {
    this.confirmationService.confirm({
      message:
        'Questa azione eliminerà la campagna e tutti i suoi terminali e dati di stato. L\'operazione non è reversibile.',
      acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: 'Elimina',
      rejectLabel: 'Annulla',
      accept: () => this.onDeleteConfirmed(campaign),
    });
  }

  private onDeleteConfirmed(campaign: CampaignDto): void {
    this.api.delete(campaign.id).subscribe({
      next: () => {
        if (this.currentCampaign.currentCampaign()?.id === campaign.id) {
          this.currentCampaign.clear();
        }
        this.currentCampaign.refresh();
        this.messageService.add({ severity: 'success', summary: 'Campagna eliminata' });
      },
      error: () =>
        this.messageService.add({ severity: 'error', summary: 'Errore durante l\'eliminazione' }),
    });
  }
}
