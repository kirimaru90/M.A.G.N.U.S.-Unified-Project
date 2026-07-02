import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TerminalsApiService } from './terminals-api.service';
import { environment } from '../../../environments/environment';
import type { TerminalDetailEnvelope } from './terminal.types';
import type { TerminalContent } from '../../domain/terminal-schema';

function baseContent(): TerminalContent {
  return {
    meta: { title: 'guida', public: true },
    state: { local: {}, global: {} },
    login: { users: [{ username: 'tecnico' }] },
    nodes: { start: { text: 'hi' } },
  } as TerminalContent;
}

function baseEnvelope(): TerminalDetailEnvelope {
  return {
    id: 't1',
    campaignId: 'c1',
    title: 'guida',
    content: baseContent(),
    state: {},
    fictionalUsers: [{ username: 'tecnico', password: 'robco123' }],
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('TerminalsApiService', () => {
  let service: TerminalsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TerminalsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getEnvelope surfaces fictionalUsers', () => {
    const envelope = baseEnvelope();
    let result: TerminalDetailEnvelope | undefined;
    service.getEnvelope('t1').subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/terminals/t1`);
    expect(req.request.method).toBe('GET');
    req.flush(envelope);

    expect(result?.fictionalUsers).toEqual([{ username: 'tecnico', password: 'robco123' }]);
  });

  it('update emits the envelope (content + fictionalUsers) rather than bare content', () => {
    const envelope = baseEnvelope();
    let result: TerminalDetailEnvelope | undefined;
    service.update('t1', baseContent()).subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/terminals/t1`);
    expect(req.request.method).toBe('PUT');
    req.flush(envelope);

    expect(result).toBeDefined();
    expect(result?.content).toEqual(envelope.content);
    expect(result?.fictionalUsers).toEqual(envelope.fictionalUsers);
  });
});
