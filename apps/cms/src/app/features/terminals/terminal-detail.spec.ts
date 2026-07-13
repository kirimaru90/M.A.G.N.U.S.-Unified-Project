import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideMarkdown } from 'ngx-markdown';
import { TerminalDetailPage } from './terminal-detail';
import { TerminalsApiService } from '../../core/terminal/terminals-api.service';
import { CurrentCampaignService } from '../../core/campaign/current-campaign.service';
import type { TerminalDetailEnvelope } from '../../core/terminal/terminal.types';

function baseEnvelope(): TerminalDetailEnvelope {
  return {
    id: 't1',
    campaignId: 'c1',
    title: 'guida',
    content: {
      meta: { title: 'guida', public: true },
      state: { local: {}, global: {} },
      login: { users: [{ username: 'tecnico' }] },
      nodes: { start: { text: 'hi' } },
    },
    state: {},
    fictionalUsers: [{ username: 'tecnico', password: 'robco123' }],
    createdAt: '2026-01-01T00:00:00.000Z',
  } as unknown as TerminalDetailEnvelope;
}

describe('TerminalDetailPage', () => {
  let fixture: ComponentFixture<TerminalDetailPage>;
  let getEnvelopeSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getEnvelopeSpy = vi.fn().mockReturnValue(of(baseEnvelope()));
    await TestBed.configureTestingModule({
      imports: [TerminalDetailPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMarkdown(),
        { provide: ActivatedRoute, useValue: { snapshot: { params: { id: 't1' } } } },
        {
          provide: TerminalsApiService,
          useValue: { getEnvelope: getEnvelopeSpy, get: vi.fn(), update: vi.fn() },
        },
        { provide: CurrentCampaignService, useValue: { currentCampaign: () => null } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TerminalDetailPage);
    fixture.detectChanges();
  });

  it('fetches the terminal via getEnvelope, not get', () => {
    expect(getEnvelopeSpy).toHaveBeenCalledWith('t1');
  });

  it('forwards fictionalUsers to the mounted editor so the password renders', () => {
    const el: HTMLElement = fixture.nativeElement;
    const passwordInput = el.querySelector(
      'input[placeholder="password (cleartext)"]',
    ) as HTMLInputElement | null;
    expect(passwordInput?.value).toBe('robco123');
  });

  it('exposes Esporta, Annulla modifiche and Salva in the page-head actions', () => {
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('.bo-page-head-actions button') as NodeListOf<HTMLElement>,
    ).map((b) => b.textContent?.trim());
    expect(labels).toEqual(
      expect.arrayContaining(['Esporta', 'Annulla modifiche', 'Salva']),
    );
  });

  it('does not render the old read-only summary card', () => {
    // "Visibilità" was the summary card's label; the flag now lives only in the
    // editor's metadata section (labelled "Pubblico").
    expect(fixture.nativeElement.textContent).not.toContain('Visibilità');
  });
});
