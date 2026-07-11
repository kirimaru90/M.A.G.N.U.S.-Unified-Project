import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  SkillCatalogEntryDto,
  SkillsCatalogOp,
  SkillsCatalogPatchResponse,
} from './skills-catalog.types';

@Injectable({ providedIn: 'root' })
export class SkillsCatalogApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/skills-catalog`;

  list(): Observable<SkillCatalogEntryDto[]> {
    return this.http.get<SkillCatalogEntryDto[]>(this.base);
  }

  patchSchema(ops: SkillsCatalogOp[]): Observable<SkillsCatalogPatchResponse> {
    return this.http.patch<SkillsCatalogPatchResponse>(this.base, { ops });
  }
}
