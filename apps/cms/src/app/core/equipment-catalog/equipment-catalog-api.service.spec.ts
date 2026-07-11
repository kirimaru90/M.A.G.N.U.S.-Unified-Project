import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { environment } from '../../../environments/environment';
import { EquipmentCatalogApiService } from './equipment-catalog-api.service';

describe('EquipmentCatalogApiService', () => {
  let service: EquipmentCatalogApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EquipmentCatalogApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() issues a GET to /equipment-catalog', () => {
    let result: unknown;
    service.list().subscribe((r) => (result = r));
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/equipment-catalog`);
    expect(req.request.method).toBe('GET');
    const entries = [
      { slug: 'pistola-10mm', name: 'Pistola 10mm', kind: 'weapon', tags: [], isStarter: true },
    ];
    req.flush(entries);
    expect(result).toEqual(entries);
  });

  it('list(true) requests only starter templates', () => {
    service.list(true).subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/equipment-catalog?starter=true`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('patchSchema() issues a PATCH with the ops body', () => {
    let result: unknown;
    const ops = [
      {
        action: 'add' as const,
        slug: 'pistola-10mm',
        entry: {
          name: 'Pistola 10mm',
          kind: 'weapon' as const,
          isStarter: true,
          tags: [{ name: 'AFFIDABILE', type: 'core' as const }],
        },
      },
    ];
    service.patchSchema(ops).subscribe((r) => (result = r));
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/equipment-catalog`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ ops });
    req.flush({ ignored: [] });
    expect(result).toEqual({ ignored: [] });
  });
});
