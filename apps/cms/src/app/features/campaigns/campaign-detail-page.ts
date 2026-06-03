import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { CampaignsApiService } from '../../core/campaign/campaigns-api.service';
import type { CampaignDto } from '../../core/campaign/campaign.types';
import { CampaignPlayersPanelComponent } from './campaign-players-panel';
import { CampaignStatePanelComponent } from './campaign-state-panel';

@Component({
  selector: 'app-campaign-detail-page',
  standalone: true,
  imports: [RouterLink, Toast, ConfirmDialog, CampaignPlayersPanelComponent, CampaignStatePanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ConfirmationService, MessageService],
  template: `
    <p-toast />
    <p-confirmdialog />

    <div class="bo-page">
      @if (notFound()) {
        <div style="text-align: center; padding: 48px 0;">
          <p>Campagna non trovata</p>
          <a [routerLink]="['/campaigns']" class="bo-btn ghost" style="margin-top: 12px; display: inline-block;">
            Torna alla lista
          </a>
        </div>
      } @else if (campaign()) {
        <div class="bo-page-head">
          <div style="display: flex; align-items: center; gap: 12px;">
            <h1>{{ campaign()!.name }}</h1>
            <span class="bo-pill" [class.active]="campaign()!.isActive">
              {{ campaign()!.isActive ? 'Attiva' : 'Inattiva' }}
            </span>
            <span class="bo-pill" [class.active]="campaign()!.isPublic">
              {{ campaign()!.isPublic ? 'Pubblica' : 'Privata' }}
            </span>
          </div>
        </div>

        <app-campaign-players-panel [campaign]="campaign()!" />

        <app-campaign-state-panel [campaign]="campaign()!" />
      } @else {
        <div style="padding: 48px 0; text-align: center;">
          Caricamento…
        </div>
      }
    </div>
  `,
})
export class CampaignDetailPage implements OnInit {
  private readonly api = inject(CampaignsApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly campaign = signal<CampaignDto | null>(null);
  protected readonly notFound = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.get(id).subscribe({
      next: (c) => this.campaign.set(c),
      error: () => this.notFound.set(true),
    });
  }
}
