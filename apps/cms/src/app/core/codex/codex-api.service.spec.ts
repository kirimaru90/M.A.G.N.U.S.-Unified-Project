import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CodexApiService } from './codex-api.service';
import { environment } from '../../../environments/environment';
import type { CodexEntry } from './codex.types';

const base = environment.apiBaseUrl;

const ENTRY: CodexEntry = {
  id: 'e1',
  type: 'luogo',
  name: 'Diamond City',
  description: null,
  secretDescription: null,
  imageUrl: null,
  isPublic: false,
  visibleToCharacterIds: [],
  isEditable: false,
  mapPlaceSlug: null,
  createdByCharacterId: null,
  isDeleted: false,
  deletedAt: null,
  deletedByCharacterId: null,
  characters: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('CodexApiService', () => {
  let service: CodexApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CodexApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list GETs the campaign-scoped endpoint and returns the typed array', () => {
    let out: CodexEntry[] | undefined;
    service.list('c1').subscribe((e) => (out = e));
    const req = http.expectOne(`${base}/campaigns/c1/codex`);
    expect(req.request.method).toBe('GET');
    req.flush([ENTRY]);
    expect(out).toEqual([ENTRY]);
  });

  it('get, create, update and remove address the entry', () => {
    service.get('c1', 'e1').subscribe();
    const get = http.expectOne(`${base}/campaigns/c1/codex/e1`);
    expect(get.request.method).toBe('GET');
    get.flush(ENTRY);

    service
      .create('c1', { type: 'luogo', name: 'X', isPublic: false, isEditable: false })
      .subscribe();
    const post = http.expectOne(`${base}/campaigns/c1/codex`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({
      type: 'luogo',
      name: 'X',
      isPublic: false,
      isEditable: false,
    });
    post.flush(ENTRY);

    service.update('c1', 'e1', { name: 'Y' }).subscribe();
    const patch = http.expectOne(`${base}/campaigns/c1/codex/e1`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ name: 'Y' });
    patch.flush(ENTRY);

    service.remove('c1', 'e1').subscribe();
    const del = http.expectOne(`${base}/campaigns/c1/codex/e1`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });

  it('restore is a PATCH { isDeleted: false }', () => {
    service.restore('c1', 'e1').subscribe();
    const req = http.expectOne(`${base}/campaigns/c1/codex/e1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ isDeleted: false });
    req.flush(ENTRY);
  });

  it('export GETs and import POSTs { entries }', () => {
    service.export('c1').subscribe();
    const exp = http.expectOne(`${base}/campaigns/c1/codex/export`);
    expect(exp.request.method).toBe('GET');
    exp.flush([]);

    service.import('c1', [{ name: 'A' }]).subscribe();
    const imp = http.expectOne(`${base}/campaigns/c1/codex/import`);
    expect(imp.request.method).toBe('POST');
    expect(imp.request.body).toEqual({ entries: [{ name: 'A' }] });
    imp.flush({ added: 1, skipped: [] });
  });

  it('maps the character and place lookups', () => {
    let chars: unknown;
    let places: unknown;
    service.campaignCharacters('c1').subscribe((c) => (chars = c));
    service.campaignPlaces('c1').subscribe((p) => (places = p));
    http
      .expectOne(`${base}/campaigns/c1/characters`)
      .flush([{ id: 'a', name: 'Alice', userId: 'u1' }]);
    http.expectOne(`${base}/campaigns/c1/map`).flush({
      config: {},
      places: [{ slug: 'dc', name: 'Diamond City', type: 'settlement', lat: 1, lng: 2 }],
    });
    expect(chars).toEqual([{ id: 'a', name: 'Alice' }]);
    expect(places).toEqual([{ slug: 'dc', name: 'Diamond City', type: 'settlement' }]);
  });
});
