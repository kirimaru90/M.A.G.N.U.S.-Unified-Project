import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  TagCatalogEntryDto,
  TagCatalogOp,
  TagCatalogPatchResponse,
} from './tag-catalog.types';

@Injectable({ providedIn: 'root' })
export class TagCatalogApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/tag-catalog`;

  list(): Observable<TagCatalogEntryDto[]> {
    return this.http.get<TagCatalogEntryDto[]>(this.base);
  }

  patchSchema(ops: TagCatalogOp[]): Observable<TagCatalogPatchResponse> {
    return this.http.patch<TagCatalogPatchResponse>(this.base, { ops });
  }
}
