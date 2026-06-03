import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { FlatState, StateSchemaOp } from './state.types';

@Injectable({ providedIn: 'root' })
export class CampaignGlobalSchemaApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  patchSchema(campaignId: string, ops: StateSchemaOp[]): Observable<{ state: FlatState }> {
    return this.http.patch<{ state: FlatState }>(
      `${this.base}/campaigns/${campaignId}/state/schema`,
      { ops },
    );
  }
}
