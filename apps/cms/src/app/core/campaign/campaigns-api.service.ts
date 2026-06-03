import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { CreateCampaignDto, EditCampaignDto } from './campaign.schemas';
import type { CampaignDto } from './campaign.types';
import type { UserDto } from '../user/user.types';

@Injectable({ providedIn: 'root' })
export class CampaignsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/campaigns`;

  list(): Observable<CampaignDto[]> {
    return this.http.get<CampaignDto[]>(this.base);
  }

  create(dto: CreateCampaignDto): Observable<CampaignDto> {
    return this.http.post<CampaignDto>(this.base, dto);
  }

  update(id: string, dto: EditCampaignDto): Observable<CampaignDto> {
    return this.http.put<CampaignDto>(`${this.base}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  activate(id: string): Observable<CampaignDto> {
    return this.http.post<CampaignDto>(`${this.base}/${id}/activate`, null);
  }

  get(id: string): Observable<CampaignDto> {
    return this.http.get<CampaignDto>(`${this.base}/${id}`);
  }

  listPlayers(campaignId: string): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(`${this.base}/${campaignId}/players`);
  }

  addPlayer(campaignId: string, playerId: string): Observable<UserDto> {
    return this.http.post<UserDto>(`${this.base}/${campaignId}/players`, { playerId });
  }

  removePlayer(campaignId: string, playerId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${campaignId}/players/${playerId}`);
  }
}
