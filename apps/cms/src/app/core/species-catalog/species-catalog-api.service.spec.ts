import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { environment } from '../../../environments/environment';
import { SpeciesCatalogApiService } from './species-catalog-api.service';

describe('SpeciesCatalogApiService', () => {
  let service: SpeciesCatalogApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SpeciesCatalogApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() issues a GET to /species-catalog', () => {
    let result: unknown;
    service.list().subscribe((r) => (result = r));
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/species-catalog`);
    expect(req.request.method).toBe('GET');
    const entries = [
      {
        slug: 'ghoul',
        name: 'Ghoul',
        permesso: 'Immune alle radiazioni.',
        svantaggio: 'Inviso agli umani.',
        tagSkillBudget: 3,
      },
    ];
    req.flush(entries);
    expect(result).toEqual(entries);
  });

  it('patchSchema() issues a PATCH with the ops body', () => {
    let result: unknown;
    const ops = [
      {
        action: 'update' as const,
        slug: 'human',
        entry: {
          name: 'Umano',
          permesso: 'Versatilità completa.',
          svantaggio: 'Nessun talento sovrannaturale.',
          tagSkillBudget: 5,
        },
      },
    ];
    service.patchSchema(ops).subscribe((r) => (result = r));
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/species-catalog`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ ops });
    req.flush({ ignored: [] });
    expect(result).toEqual({ ignored: [] });
  });
});
