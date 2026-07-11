import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { environment } from '../../../environments/environment';
import { ConditionsCatalogApiService } from './conditions-catalog-api.service';

describe('ConditionsCatalogApiService', () => {
  let service: ConditionsCatalogApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ConditionsCatalogApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() issues a GET to /conditions-catalog', () => {
    let result: unknown;
    service.list().subscribe((r) => (result = r));
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/conditions-catalog`);
    expect(req.request.method).toBe('GET');
    const entries = [
      { slug: 'poisoned', name: 'Avvelenato', defaultSeverity: 'major', polarity: 'negative' },
    ];
    req.flush(entries);
    expect(result).toEqual(entries);
  });

  it('patchSchema() issues a PATCH with the ops body', () => {
    let result: unknown;
    const ops = [
      {
        action: 'add' as const,
        slug: 'poisoned',
        entry: {
          name: 'Avvelenato',
          defaultSeverity: 'major' as const,
          polarity: 'negative' as const,
        },
      },
    ];
    service.patchSchema(ops).subscribe((r) => (result = r));
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/conditions-catalog`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ ops });
    req.flush({ ignored: [] });
    expect(result).toEqual({ ignored: [] });
  });
});
