import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  ConditionCatalogEntryDto,
  ConditionsCatalogOp,
  ConditionsCatalogPatchResponse,
} from './conditions-catalog.types';

@Injectable({ providedIn: 'root' })
export class ConditionsCatalogApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/conditions-catalog`;

  list(): Observable<ConditionCatalogEntryDto[]> {
    return this.http.get<ConditionCatalogEntryDto[]>(this.base);
  }

  patchSchema(ops: ConditionsCatalogOp[]): Observable<ConditionsCatalogPatchResponse> {
    return this.http.patch<ConditionsCatalogPatchResponse>(this.base, { ops });
  }
}
