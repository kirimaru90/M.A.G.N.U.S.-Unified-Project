import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QuestsApiService } from './quests-api.service';
import { environment } from '../../../environments/environment';
import type { Quest } from './quests.types';

const base = environment.apiBaseUrl;

const QUEST: Quest = {
  id: 'q1',
  kind: 'story',
  characterIds: [],
  characters: [],
  isPublic: true,
  createdByCharacterId: null,
  stages: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('QuestsApiService', () => {
  let service: QuestsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(QuestsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list GETs the campaign-scoped endpoint and returns the typed array', () => {
    let out: Quest[] | undefined;
    service.list('c1').subscribe((q) => (out = q));
    const req = http.expectOne(`${base}/campaigns/c1/quests`);
    expect(req.request.method).toBe('GET');
    req.flush([QUEST]);
    expect(out).toEqual([QUEST]);
  });

  it('create POSTs header and first stage', () => {
    const body = {
      kind: 'story' as const,
      isPublic: true,
      stage: { title: 'T', status: 'in_corso' as const, isMilestone: false, isPublic: false },
    };
    service.create('c1', body).subscribe();
    const req = http.expectOne(`${base}/campaigns/c1/quests`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush(QUEST);
  });

  it('update PATCHes the quest header', () => {
    service.update('c1', 'q1', { characterIds: ['a'] }).subscribe();
    const req = http.expectOne(`${base}/campaigns/c1/quests/q1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ characterIds: ['a'] });
    req.flush(QUEST);
  });

  it('delete DELETEs the quest', () => {
    service.delete('c1', 'q1').subscribe();
    const req = http.expectOne(`${base}/campaigns/c1/quests/q1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('stage endpoints address the quest stages', () => {
    service
      .addStage('c1', 'q1', { title: 'T', status: 'in_corso', isMilestone: false, isPublic: false })
      .subscribe();
    const add = http.expectOne(`${base}/campaigns/c1/quests/q1/stages`);
    expect(add.request.method).toBe('POST');
    add.flush(QUEST);

    service.updateStage('c1', 'q1', 's1', { isPublic: true }).subscribe();
    const patch = http.expectOne(`${base}/campaigns/c1/quests/q1/stages/s1`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ isPublic: true });
    patch.flush(QUEST);

    service.deleteStage('c1', 'q1', 's1').subscribe();
    const del = http.expectOne(`${base}/campaigns/c1/quests/q1/stages/s1`);
    expect(del.request.method).toBe('DELETE');
    del.flush(QUEST);
  });

  it('campaignCharacters maps characters to { id, name }', () => {
    let out: unknown;
    service.campaignCharacters('c1').subscribe((c) => (out = c));
    http
      .expectOne(`${base}/campaigns/c1/characters`)
      .flush([{ id: 'a', name: 'Alice', special: {}, userId: 'u1' }]);
    expect(out).toEqual([{ id: 'a', name: 'Alice' }]);
  });
});
