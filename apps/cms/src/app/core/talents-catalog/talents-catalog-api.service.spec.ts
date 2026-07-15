import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { environment } from '../../../environments/environment';
import { TalentsCatalogApiService } from './talents-catalog-api.service';

describe('TalentsCatalogApiService', () => {
  let service: TalentsCatalogApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TalentsCatalogApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() issues a GET to /talents-catalog', () => {
    let result: unknown;
    service.list().subscribe((r) => (result = r));
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/talents-catalog`);
    expect(req.request.method).toBe('GET');
    const entries = [{ slug: 'gunslinger', name: 'Gunslinger' }];
    req.flush(entries);
    expect(result).toEqual(entries);
  });

  it('patchSchema() issues a PATCH with the ops body', () => {
    let result: unknown;
    const ops = [{ action: 'add' as const, slug: 'gunslinger', entry: { name: 'Gunslinger' } }];
    service.patchSchema(ops).subscribe((r) => (result = r));
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/talents-catalog`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ ops });
    req.flush({ ignored: [] });
    expect(result).toEqual({ ignored: [] });
  });
});
