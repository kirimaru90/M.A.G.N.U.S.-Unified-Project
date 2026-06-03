import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MultiSelect } from 'primeng/multiselect';
import { CampaignsApiService } from '../../core/campaign/campaigns-api.service';
import type { CampaignDto } from '../../core/campaign/campaign.types';
import type { UserDto } from '../../core/user/user.types';

@Component({
  selector: 'app-user-campaigns-panel',
  standalone: true,
  imports: [ButtonModule, MultiSelect, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bo-card section">
      <h2 style="margin: 0 0 16px;">Campagne assegnate</h2>

      @if (assignedCampaigns().length === 0) {
        <p style="color: var(--bo-text-faint); margin-bottom: 16px;">
          Nessuna campagna assegnata
        </p>
      } @else {
        <ul style="list-style: none; padding: 0; margin: 0 0 16px;">
          @for (campaign of assignedCampaigns(); track campaign.id) {
            <li style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--bo-border, #e5e7eb);">
              <span>{{ campaign.name }}</span>
              <button
                type="button"
                class="bo-btn ghost icon danger"
                title="Rimuovi"
                (click)="confirmRemove(campaign)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </li>
          }
        </ul>
      }

      <div style="display: flex; gap: 8px; align-items: flex-end;">
        <div style="flex: 1;">
          <p-multiselect
            [options]="availableCampaigns()"
            [(ngModel)]="selectedToAdd"
            optionLabel="name"
            placeholder="Seleziona campagne da aggiungere"
            styleClass="w-full"
          />
        </div>
        <button
          type="button"
          class="bo-btn primary"
          [disabled]="selectedToAdd.length === 0 || adding()"
          (click)="addSelected()"
        >
          Aggiungi
        </button>
      </div>
    </div>
  `,
})
export class UserCampaignsPanelComponent implements OnInit {
  @Input({ required: true }) user!: UserDto;

  private readonly campaignsApi = inject(CampaignsApiService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  protected readonly assignedCampaigns = signal<CampaignDto[]>([]);
  protected readonly availableCampaigns = signal<CampaignDto[]>([]);
  protected readonly adding = signal(false);
  protected selectedToAdd: CampaignDto[] = [];

  ngOnInit(): void {
    this.loadAssignments();
  }

  private loadAssignments(): void {
    this.campaignsApi.list().pipe(
      switchMap((allCampaigns) => {
        if (allCampaigns.length === 0) return of({ allCampaigns, playersByCampaign: [] as { campaignId: string; playerIds: string[] }[] });
        return forkJoin(
          allCampaigns.map((c) =>
            this.campaignsApi.listPlayers(c.id).pipe(
              catchError(() => of([])),
            ),
          ),
        ).pipe(
          switchMap((playerLists) => {
            const playersByCampaign = allCampaigns.map((c, i) => ({
              campaignId: c.id,
              playerIds: (playerLists[i] as UserDto[]).map((p) => p.id),
            }));
            return of({ allCampaigns, playersByCampaign });
          }),
        );
      }),
    ).subscribe(({ allCampaigns, playersByCampaign }) => {
      const assignedIds = new Set(
        playersByCampaign.filter((x) => x.playerIds.includes(this.user.id)).map((x) => x.campaignId),
      );
      this.assignedCampaigns.set(allCampaigns.filter((c) => assignedIds.has(c.id)));
      this.availableCampaigns.set(allCampaigns.filter((c) => !assignedIds.has(c.id)));
      this.selectedToAdd = [];
    });
  }

  protected addSelected(): void {
    if (this.selectedToAdd.length === 0) return;
    this.adding.set(true);
    const requests = this.selectedToAdd.map((c) =>
      this.campaignsApi.addPlayer(c.id, this.user.id).pipe(
        catchError(() => {
          this.messageService.add({
            severity: 'error',
            summary: `Impossibile assegnare a ${c.name}`,
          });
          return of(null);
        }),
      ),
    );
    forkJoin(requests).subscribe(() => {
      this.adding.set(false);
      this.loadAssignments();
    });
  }

  protected confirmRemove(campaign: CampaignDto): void {
    this.confirmationService.confirm({
      message: 'Rimuovere il giocatore dalla campagna?',
      acceptLabel: 'Rimuovi',
      rejectLabel: 'Annulla',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.campaignsApi.removePlayer(campaign.id, this.user.id).subscribe({
          next: () => this.loadAssignments(),
          error: () =>
            this.messageService.add({ severity: 'error', summary: 'Errore durante la rimozione' }),
        });
      },
    });
  }
}
