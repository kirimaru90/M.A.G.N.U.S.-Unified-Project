import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
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
      [ngModel]="model()"
      (onChange)="onSelect($event.value)"
      placeholder="Seleziona campagna"
    />
  `,
})
export class CampaignWorkspaceSwitcherComponent {
  protected readonly currentCampaign = inject(CurrentCampaignService);

  /**
   * Opt-in gate on a switch. When set, `onSelect` awaits it and only commits if
   * it resolves truthy — a page with unsaved local state (the map author) uses
   * it to confirm before discarding. When absent the switch commits immediately,
   * so the read-only terminals list is unchanged.
   */
  readonly guard = input<(next: CampaignDto) => boolean | Promise<boolean>>();

  /**
   * The select is driven from this local model rather than `currentCampaign()`
   * directly: `[ngModel]` is one-way, so a *declined* switch would otherwise
   * leave p-select showing the rejected pick (the CVA kept the user's selection
   * and the signal never moved). Reflecting the pick here, then snapping back to
   * the current campaign on decline, is a real value change p-select acts on.
   */
  protected readonly model = signal<CampaignDto | null>(null);

  constructor() {
    effect(() => this.model.set(this.currentCampaign.currentCampaign()));
  }

  async onSelect(campaign: CampaignDto): Promise<void> {
    const guard = this.guard();
    if (!guard) {
      this.currentCampaign.setCurrent(campaign);
      return;
    }

    this.model.set(campaign);
    const ok = await guard(campaign);
    if (ok) this.currentCampaign.setCurrent(campaign);
    else this.model.set(this.currentCampaign.currentCampaign());
  }
}
