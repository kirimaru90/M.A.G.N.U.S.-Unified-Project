import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { environment } from '../../../environments/environment';
import { TagCatalogApiService } from './tag-catalog-api.service';

describe('TagCatalogApiService', () => {
  let service: TagCatalogApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TagCatalogApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() issues a GET to /tag-catalog', () => {
    let result: unknown;
    service.list().subscribe((r) => (result = r));
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/tag-catalog`);
    expect(req.request.method).toBe('GET');
    const entries = [{ slug: 'automatica', name: 'Automatica' }];
    req.flush(entries);
    expect(result).toEqual(entries);
  });

  it('patchSchema() issues a PATCH with the ops body', () => {
    let result: unknown;
    const ops = [
      { action: 'add' as const, slug: 'automatica', entry: { name: 'Automatica' } },
    ];
    service.patchSchema(ops).subscribe((r) => (result = r));
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/tag-catalog`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ ops });
    req.flush({ ignored: [] });
    expect(result).toEqual({ ignored: [] });
  });
});
