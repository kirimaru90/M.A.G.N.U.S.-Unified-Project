import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Select } from 'primeng/select';
import type { CampaignDto } from '../core/campaign/campaign.types';
import { CurrentCampaignService } from '../core/campaign/current-campaign.service';

@Component({
  selector: 'app-campaign-workspace-switcher',
  standalone: true,
  imports: [Select, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-select
      [options]="currentCampaign.campaigns()"
      optionLabel="name"
      dataKey="id"
      [ngModel]="currentCampaign.currentCampaign()"
      (onChange)="onSelect($event.value)"
      placeholder="Seleziona campagna"
    />
  `,
})
export class CampaignWorkspaceSwitcherComponent {
  private readonly router = inject(Router);
  protected readonly currentCampaign = inject(CurrentCampaignService);

  onSelect(campaign: CampaignDto): void {
    const prev = this.currentCampaign.currentCampaign();
    this.currentCampaign.setCurrent(campaign);
    if (!prev || prev.id === campaign.id) return;

    const url = this.router.url;
    if (/^\/campaigns\/[^/]+\/terminals/.test(url)) {
      void this.router.navigate(['/campaigns', campaign.id, 'terminals']);
    } else if (/^\/campaigns\/[^/]+$/.test(url)) {
      void this.router.navigate(['/campaigns', campaign.id]);
    } else if (/^\/terminals\//.test(url)) {
      void this.router.navigate(['/campaigns', campaign.id, 'terminals']);
    }
  }
}
