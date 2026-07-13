import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import type { CampaignDto } from '../core/campaign/campaign.types';
import { CurrentCampaignService } from '../core/campaign/current-campaign.service';

/**
 * In-page campaign selector, hosted at the top of campaign-dependent pages
 * (e.g. the terminals list). Selecting a campaign only updates the shared
 * workspace context — no navigation, because campaign-dependent routes no
 * longer carry the campaign id in the URL.
 */
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
  protected readonly currentCampaign = inject(CurrentCampaignService);

  onSelect(campaign: CampaignDto): void {
    this.currentCampaign.setCurrent(campaign);
  }
}
