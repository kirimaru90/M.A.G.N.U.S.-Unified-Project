import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';
import { CampaignsApiService } from './campaigns-api.service';
import type { CampaignDto } from './campaign.types';

const STORAGE_KEY = 'magnus.currentCampaignId';

@Injectable({ providedIn: 'root' })
export class CurrentCampaignService {
  private readonly api = inject(CampaignsApiService);
  readonly currentCampaign = signal<CampaignDto | null>(null);
  readonly campaigns = signal<CampaignDto[]>([]);

  constructor() {
    this.fetchList();
    const storedId = localStorage.getItem(STORAGE_KEY);
    if (!storedId) return;
    this.api
      .get(storedId)
      .pipe(take(1))
      .subscribe({
        next: (campaign) => this.currentCampaign.set(campaign),
        error: (err) => {
          if ((err as { status?: number })?.status === 404) this.clear();
        },
      });
  }

  setCurrent(campaign: CampaignDto): void {
    localStorage.setItem(STORAGE_KEY, campaign.id);
    this.currentCampaign.set(campaign);
    if (campaign.state !== undefined) return;
    this.api
      .get(campaign.id)
      .pipe(take(1))
      .subscribe({
        next: (full) => this.currentCampaign.set(full),
      });
  }

  refresh(): void {
    this.fetchList();
    const current = this.currentCampaign();
    if (!current) return;
    this.api
      .get(current.id)
      .pipe(take(1))
      .subscribe({
        next: (full) => this.currentCampaign.set(full),
        error: (err) => {
          if ((err as { status?: number })?.status === 404) this.clear();
        },
      });
  }

  clear(): void {
    this.currentCampaign.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  private fetchList(): void {
    this.api
      .list()
      .pipe(take(1))
      .subscribe({
        next: (list) => this.campaigns.set(list),
      });
  }
}
