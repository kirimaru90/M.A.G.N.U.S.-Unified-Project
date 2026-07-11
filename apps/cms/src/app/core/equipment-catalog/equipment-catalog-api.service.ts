import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  EquipmentCatalogEntryDto,
  EquipmentCatalogOp,
  EquipmentCatalogPatchResponse,
} from './equipment-catalog.types';

@Injectable({ providedIn: 'root' })
export class EquipmentCatalogApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/equipment-catalog`;

  /** `starterOnly` maps to `?starter=true`, the wizard's starter-template filter. */
  list(starterOnly = false): Observable<EquipmentCatalogEntryDto[]> {
    const url = starterOnly ? `${this.base}?starter=true` : this.base;
    return this.http.get<EquipmentCatalogEntryDto[]>(url);
  }

  patchSchema(ops: EquipmentCatalogOp[]): Observable<EquipmentCatalogPatchResponse> {
    return this.http.patch<EquipmentCatalogPatchResponse>(this.base, { ops });
  }
}
