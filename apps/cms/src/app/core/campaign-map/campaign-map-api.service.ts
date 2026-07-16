import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { CampaignMapDto } from './campaign-map.types';

@Injectable({ providedIn: 'root' })
export class CampaignMapApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/campaigns`;

  get(campaignId: string): Observable<CampaignMapDto> {
    return this.http.get<CampaignMapDto>(`${this.base}/${campaignId}/map`);
  }

  replace(campaignId: string, map: CampaignMapDto): Observable<CampaignMapDto> {
    return this.http.put<CampaignMapDto>(`${this.base}/${campaignId}/map`, map);
  }
}
