import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  TalentCatalogEntryDto,
  TalentsCatalogOp,
  TalentsCatalogPatchResponse,
} from './talents-catalog.types';

@Injectable({ providedIn: 'root' })
export class TalentsCatalogApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/talents-catalog`;

  list(): Observable<TalentCatalogEntryDto[]> {
    return this.http.get<TalentCatalogEntryDto[]>(this.base);
  }

  patchSchema(ops: TalentsCatalogOp[]): Observable<TalentsCatalogPatchResponse> {
    return this.http.patch<TalentsCatalogPatchResponse>(this.base, { ops });
  }
}
