import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { TerminalContent } from '../../domain/terminal-schema';
import {
  toTerminalDto,
  type TerminalDetailEnvelope,
  type TerminalDto,
  type TerminalListItem,
} from './terminal.types';

@Injectable({ providedIn: 'root' })
export class TerminalsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /**
   * Remove the server-owned `meta.id` from content before any write. The API injects
   * `meta.id` on read and rejects a non-empty `meta.id` on input (HTTP 400), so every
   * create/import/update path must strip it first.
   */
  private stripServerOwned(content: TerminalContent): TerminalContent {
    const { id: _drop, ...meta } = content.meta;
    return { ...content, meta };
  }

  listByCampaign(campaignId: string): Observable<TerminalDto[]> {
    return this.http
      .get<TerminalListItem[]>(`${this.base}/campaigns/${campaignId}/terminals`)
      .pipe(map((rows) => rows.map(toTerminalDto)));
  }

  create(campaignId: string, content: TerminalContent): Observable<TerminalDto> {
    return this.http.post<TerminalDto>(
      `${this.base}/campaigns/${campaignId}/terminals`,
      this.stripServerOwned(content),
    );
  }

  import(campaignId: string, content: TerminalContent): Observable<TerminalDto> {
    return this.http.post<TerminalDto>(
      `${this.base}/campaigns/${campaignId}/terminals/import`,
      this.stripServerOwned(content),
    );
  }

  get(id: string): Observable<TerminalContent> {
    return this.http
      .get<TerminalDetailEnvelope>(`${this.base}/terminals/${id}`)
      .pipe(map((r) => r.content));
  }

  getEnvelope(id: string): Observable<TerminalDetailEnvelope> {
    return this.http.get<TerminalDetailEnvelope>(`${this.base}/terminals/${id}`);
  }

  /**
   * Resolve a terminal by its user-authored `hiddenId` within a campaign. This is the
   * only API call keyed on `hiddenId`; every other terminal call uses the server-owned `id`.
   */
  getByHiddenId(campaignId: string, hiddenId: string): Observable<TerminalDto> {
    return this.http.get<TerminalDto>(
      `${this.base}/campaigns/${campaignId}/terminals/by-hidden-id/${hiddenId}`,
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/terminals/${id}`);
  }

  update(id: string, content: TerminalContent): Observable<TerminalDetailEnvelope> {
    return this.http.put<TerminalDetailEnvelope>(
      `${this.base}/terminals/${id}`,
      this.stripServerOwned(content),
    );
  }

  export(id: string): Observable<TerminalContent> {
    return this.http.post<TerminalContent>(`${this.base}/terminals/${id}/export`, null);
  }
}
