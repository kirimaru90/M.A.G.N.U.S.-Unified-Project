import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { CampaignMapDto } from '../campaign-map/campaign-map.types';
import type {
  CodexCharacterOption,
  CodexEntry,
  CodexExportItem,
  CodexImportResult,
  CodexPlaceOption,
  CreateCodexEntryBody,
  UpdateCodexEntryBody,
} from './codex.types';

/** Admin access to a campaign's codex, plus the lookups its dialog needs. */
@Injectable({ providedIn: 'root' })
export class CodexApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  private codexUrl(campaignId: string): string {
    return `${this.base}/campaigns/${campaignId}/codex`;
  }

  /** Every entry, soft-deleted ones included. */
  list(campaignId: string): Observable<CodexEntry[]> {
    return this.http.get<CodexEntry[]>(this.codexUrl(campaignId));
  }

  get(campaignId: string, entryId: string): Observable<CodexEntry> {
    return this.http.get<CodexEntry>(`${this.codexUrl(campaignId)}/${entryId}`);
  }

  create(campaignId: string, body: CreateCodexEntryBody): Observable<CodexEntry> {
    return this.http.post<CodexEntry>(this.codexUrl(campaignId), body);
  }

  update(campaignId: string, entryId: string, body: UpdateCodexEntryBody): Observable<CodexEntry> {
    return this.http.patch<CodexEntry>(`${this.codexUrl(campaignId)}/${entryId}`, body);
  }

  /** Permanent delete. */
  remove(campaignId: string, entryId: string): Observable<void> {
    return this.http.delete<void>(`${this.codexUrl(campaignId)}/${entryId}`);
  }

  /** Undo a soft delete. */
  restore(campaignId: string, entryId: string): Observable<CodexEntry> {
    return this.update(campaignId, entryId, { isDeleted: false });
  }

  export(campaignId: string): Observable<CodexExportItem[]> {
    return this.http.get<CodexExportItem[]>(`${this.codexUrl(campaignId)}/export`);
  }

  import(campaignId: string, entries: unknown[]): Observable<CodexImportResult> {
    return this.http.post<CodexImportResult>(`${this.codexUrl(campaignId)}/import`, { entries });
  }

  /**
   * The campaign's live characters for the visibility multi-select. The
   * endpoint is actor-scoped, so an admin receives every character.
   */
  campaignCharacters(campaignId: string): Observable<CodexCharacterOption[]> {
    return this.http
      .get<{ id: string; name: string }[]>(`${this.base}/campaigns/${campaignId}/characters`)
      .pipe(map((rows) => rows.map(({ id, name }) => ({ id, name }))));
  }

  /** Every place of the campaign map; an admin read is not projected. */
  campaignPlaces(campaignId: string): Observable<CodexPlaceOption[]> {
    return this.http
      .get<CampaignMapDto>(`${this.base}/campaigns/${campaignId}/map`)
      .pipe(map((m) => m.places.map(({ slug, name, type }) => ({ slug, name, type }))));
  }
}
