import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  CampaignCharacterOption,
  CreateQuestBody,
  CreateStageBody,
  Quest,
  UpdateQuestBody,
  UpdateStageBody,
} from './quests.types';

/** Admin access to a campaign's quests and their stages. */
@Injectable({ providedIn: 'root' })
export class QuestsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  private questsUrl(campaignId: string): string {
    return `${this.base}/campaigns/${campaignId}/quests`;
  }

  list(campaignId: string): Observable<Quest[]> {
    return this.http.get<Quest[]>(this.questsUrl(campaignId));
  }

  get(campaignId: string, questId: string): Observable<Quest> {
    return this.http.get<Quest>(`${this.questsUrl(campaignId)}/${questId}`);
  }

  create(campaignId: string, body: CreateQuestBody): Observable<Quest> {
    return this.http.post<Quest>(this.questsUrl(campaignId), body);
  }

  update(campaignId: string, questId: string, body: UpdateQuestBody): Observable<Quest> {
    return this.http.patch<Quest>(`${this.questsUrl(campaignId)}/${questId}`, body);
  }

  delete(campaignId: string, questId: string): Observable<void> {
    return this.http.delete<void>(`${this.questsUrl(campaignId)}/${questId}`);
  }

  addStage(campaignId: string, questId: string, body: CreateStageBody): Observable<Quest> {
    return this.http.post<Quest>(`${this.questsUrl(campaignId)}/${questId}/stages`, body);
  }

  updateStage(
    campaignId: string,
    questId: string,
    stageId: string,
    body: UpdateStageBody,
  ): Observable<Quest> {
    return this.http.patch<Quest>(
      `${this.questsUrl(campaignId)}/${questId}/stages/${stageId}`,
      body,
    );
  }

  deleteStage(campaignId: string, questId: string, stageId: string): Observable<Quest> {
    return this.http.delete<Quest>(`${this.questsUrl(campaignId)}/${questId}/stages/${stageId}`);
  }

  /**
   * The campaign's characters for the assignee multi-select. The endpoint is
   * actor-scoped, so an admin receives every character of the campaign.
   */
  campaignCharacters(campaignId: string): Observable<CampaignCharacterOption[]> {
    return this.http
      .get<{ id: string; name: string }[]>(`${this.base}/campaigns/${campaignId}/characters`)
      .pipe(map((rows) => rows.map(({ id, name }) => ({ id, name }))));
  }
}
