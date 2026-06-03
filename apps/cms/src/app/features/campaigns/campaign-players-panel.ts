import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MultiSelect } from 'primeng/multiselect';
import { CampaignsApiService } from '../../core/campaign/campaigns-api.service';
import type { CampaignDto } from '../../core/campaign/campaign.types';
import { UsersApiService } from '../../core/user/users-api.service';
import type { UserDto } from '../../core/user/user.types';

@Component({
  selector: 'app-campaign-players-panel',
  standalone: true,
  imports: [ButtonModule, MultiSelect, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bo-card section">
      <h2 style="margin: 0 0 16px;">Giocatori assegnati</h2>

      @if (assignedPlayers().length === 0) {
        <p style="color: var(--bo-text-faint); margin-bottom: 16px;">
          Nessun giocatore assegnato
        </p>
      } @else {
        <ul style="list-style: none; padding: 0; margin: 0 0 16px;">
          @for (player of assignedPlayers(); track player.id) {
            <li style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--bo-border, #e5e7eb);">
              <span>{{ player.username }}</span>
              <button
                type="button"
                class="bo-btn ghost icon danger"
                title="Rimuovi"
                (click)="confirmRemove(player)"
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
            [options]="availablePlayers()"
            [(ngModel)]="selectedToAdd"
            optionLabel="username"
            placeholder="Seleziona giocatori da aggiungere"
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
export class CampaignPlayersPanelComponent implements OnInit {
  @Input({ required: true }) campaign!: CampaignDto;

  private readonly campaignsApi = inject(CampaignsApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  protected readonly assignedPlayers = signal<UserDto[]>([]);
  protected readonly availablePlayers = signal<UserDto[]>([]);
  protected readonly adding = signal(false);
  protected selectedToAdd: UserDto[] = [];

  ngOnInit(): void {
    this.loadAssignments();
  }

  private loadAssignments(): void {
    forkJoin({
      assigned: this.campaignsApi.listPlayers(this.campaign.id),
      allPlayers: this.usersApi.list(),
    }).subscribe(({ assigned, allPlayers }) => {
      const assignedIds = new Set(assigned.map((p) => p.id));
      this.assignedPlayers.set(assigned);
      this.availablePlayers.set(
        allPlayers.filter((u) => u.role === 'player' && !assignedIds.has(u.id)),
      );
      this.selectedToAdd = [];
    });
  }

  protected addSelected(): void {
    if (this.selectedToAdd.length === 0) return;
    this.adding.set(true);
    const requests = this.selectedToAdd.map((p) =>
      this.campaignsApi.addPlayer(this.campaign.id, p.id).pipe(
        catchError(() => {
          this.messageService.add({
            severity: 'error',
            summary: `Impossibile assegnare ${p.username}`,
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

  protected confirmRemove(player: UserDto): void {
    this.confirmationService.confirm({
      message: 'Rimuovere il giocatore dalla campagna?',
      acceptLabel: 'Rimuovi',
      rejectLabel: 'Annulla',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.campaignsApi.removePlayer(this.campaign.id, player.id).subscribe({
          next: () => this.loadAssignments(),
          error: () =>
            this.messageService.add({ severity: 'error', summary: 'Errore durante la rimozione' }),
        });
      },
    });
  }
}
