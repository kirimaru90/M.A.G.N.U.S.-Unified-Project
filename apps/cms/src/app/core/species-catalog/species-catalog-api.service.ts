import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  SpeciesCatalogEntryDto,
  SpeciesCatalogOp,
  SpeciesCatalogPatchResponse,
} from './species-catalog.types';

@Injectable({ providedIn: 'root' })
export class SpeciesCatalogApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/species-catalog`;

  list(): Observable<SpeciesCatalogEntryDto[]> {
    return this.http.get<SpeciesCatalogEntryDto[]>(this.base);
  }

  patchSchema(ops: SpeciesCatalogOp[]): Observable<SpeciesCatalogPatchResponse> {
    return this.http.patch<SpeciesCatalogPatchResponse>(this.base, { ops });
  }
}
