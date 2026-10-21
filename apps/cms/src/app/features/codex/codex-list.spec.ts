import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmationService, MessageService } from 'primeng/api';
import { CodexListPage, foldText, toCodexRow } from './codex-list';
import { CodexApiService } from '../../core/codex/codex-api.service';
import { CurrentCampaignService } from '../../core/campaign/current-campaign.service';
import type { CampaignDto } from '../../core/campaign/campaign.types';
import type { CodexEntry } from '../../core/codex/codex.types';
import { makeEntry } from './codex-fixtures';

const CAMPAIGN = { id: 'c1', name: 'Campagna Uno' } as CampaignDto;

const PIPER = { id: 'p', name: 'Piper', deleted: false };
const NICK = { id: 'n', name: 'Nick', deleted: false };

describe('CodexListPage', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let confirm: ConfirmationService;

  function setup(current: CampaignDto | null, entries: CodexEntry[] = []) {
    api = {
      list: vi.fn().mockReturnValue(of(entries)),
      campaignPlaces: vi
        .fn()
        .mockReturnValue(of([{ slug: 'dc', name: 'Diamond City', type: 'settlement' }])),
      campaignCharacters: vi.fn().mockReturnValue(of([])),
      remove: vi.fn().mockReturnValue(of(undefined)),
      restore: vi.fn().mockReturnValue(of(makeEntry())),
      export: vi.fn().mockReturnValue(of([])),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CodexListPage],
      providers: [
        { provide: CodexApiService, useValue: api },
        {
          provide: CurrentCampaignService,
          useValue: { currentCampaign: signal(current), campaigns: signal([CAMPAIGN]) },
        },
        ConfirmationService,
        MessageService,
      ],
    });
    const fixture: ComponentFixture<CodexListPage> = TestBed.createComponent(CodexListPage);
    confirm = fixture.debugElement.injector.get(ConfirmationService);
    fixture.detectChanges();
    return fixture;
  }

  const rowsOf = (fixture: ComponentFixture<CodexListPage>) =>
    Array.from(
      fixture.nativeElement.querySelectorAll(
        '[data-testid="codex-row"]',
      ) as NodeListOf<HTMLElement>,
    );

  function setControl(
    fixture: ComponentFixture<CodexListPage>,
    testid: string,
    value: string | boolean,
  ) {
    const el = fixture.nativeElement.querySelector(`[data-testid="${testid}"]`) as HTMLInputElement;
    if (typeof value === 'boolean') {
      el.checked = value;
      el.dispatchEvent(new Event('change'));
    } else {
      el.value = value;
      el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input'));
    }
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('shows the select-a-campaign empty state and no table without a campaign', () => {
    const fixture = setup(null);
    expect(fixture.nativeElement.textContent).toContain('Seleziona una campagna');
    expect(fixture.nativeElement.querySelector('p-table')).toBeNull();
    expect(api['list']).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="new-entry"]').disabled).toBe(true);
  });

  it('renders the eight columns and the empty message', () => {
    const fixture = setup(CAMPAIGN, []);
    expect(api['list']).toHaveBeenCalledWith('c1');
    const headers = Array.from(
      fixture.nativeElement.querySelectorAll('th') as NodeListOf<HTMLElement>,
    ).map((th) => th.textContent!.trim());
    expect(headers).toEqual([
      'Nome',
      'Tipo',
      'Visibilità',
      'Modificabile',
      'Autore',
      'Mappa',
      'Aggiornata il',
      'Azioni',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Nessuna voce nel codex');
  });

  it('hides deleted entries by default and shows them dimmed when asked', () => {
    const fixture = setup(CAMPAIGN, [
      makeEntry({ id: 'a', name: 'Alfa' }),
      makeEntry({ id: 'b', name: 'Beta' }),
      makeEntry({
        id: 'c',
        name: 'Gamma',
        isDeleted: true,
        deletedAt: '2026-10-21T10:00:00Z',
        deletedByCharacterId: 'p',
        characters: [PIPER],
      }),
    ]);
    const box = fixture.nativeElement.querySelector(
      '[data-testid="codex-show-deleted"]',
    ) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(rowsOf(fixture)).toHaveLength(2);

    setControl(fixture, 'codex-show-deleted', true);
    const rows = rowsOf(fixture);
    expect(rows).toHaveLength(3);
    const deleted = rows.find((r) => r.textContent!.includes('Gamma'))!;
    expect(deleted.style.opacity).toBe('0.55');
    expect(deleted.textContent).toContain('Eliminata');
    expect(deleted.querySelector('[data-testid="deleted-by"]')!.textContent).toContain(
      'Eliminata da Piper · 21/10/2026',
    );
    expect(deleted.querySelector('[data-testid="edit-entry"]')).toBeNull();
    expect(deleted.querySelector('[data-testid="restore-entry"]')).toBeTruthy();
  });

  it('filters by type and by accent-insensitive text', () => {
    const fixture = setup(CAMPAIGN, [
      makeEntry({ id: 'a', name: 'Città Diamante', type: 'luogo' }),
      makeEntry({ id: 'b', name: 'Mirelurk', type: 'creatura' }),
    ]);
    setControl(fixture, 'codex-type-filter', 'creatura');
    expect(rowsOf(fixture).map((r) => r.textContent)).toEqual([
      expect.stringContaining('Mirelurk'),
    ]);
    setControl(fixture, 'codex-type-filter', '');
    setControl(fixture, 'codex-filter', 'citta');
    expect(rowsOf(fixture).map((r) => r.textContent)).toEqual([
      expect.stringContaining('Città Diamante'),
    ]);
  });

  it('names listed characters in the Visibilità cell', () => {
    const fixture = setup(CAMPAIGN, [
      makeEntry({ visibleToCharacterIds: ['p', 'n'], characters: [PIPER, NICK] }),
    ]);
    const cell = fixture.nativeElement.querySelector('[data-testid="visibility-cell"]');
    expect(cell.textContent.replace(/\s+/g, ' ').trim()).toBe('Piper, Nick');
  });

  it('asks before a permanent delete and only then calls the API', () => {
    const fixture = setup(CAMPAIGN, [makeEntry()]);
    const spy = vi.spyOn(confirm, 'confirm');
    (fixture.nativeElement.querySelector('[data-testid="delete-entry"]') as HTMLElement).click();
    expect(api['remove']).not.toHaveBeenCalled();
    const opts = spy.mock.calls[0][0];
    expect(opts.message).toContain('Diamond City');
    expect(opts.message).toContain('non è reversibile');
    opts.accept!();
    expect(api['remove']).toHaveBeenCalledWith('c1', 'e1');
  });

  it('restores a deleted entry without confirmation, and purges with one', () => {
    const fixture = setup(CAMPAIGN, [
      makeEntry({ isDeleted: true, deletedAt: '2026-10-21T00:00:00Z' }),
    ]);
    setControl(fixture, 'codex-show-deleted', true);
    const spy = vi.spyOn(confirm, 'confirm');
    (fixture.nativeElement.querySelector('[data-testid="restore-entry"]') as HTMLElement).click();
    expect(api['restore']).toHaveBeenCalledWith('c1', 'e1');
    expect(spy).not.toHaveBeenCalled();
    expect(api['list']).toHaveBeenCalledTimes(2);

    (fixture.nativeElement.querySelector('[data-testid="purge-entry"]') as HTMLElement).click();
    spy.mock.calls[0][0].accept!();
    expect(api['remove']).toHaveBeenCalledWith('c1', 'e1');
  });

  it('exports as codex-<campaign>.json', () => {
    const fixture = setup(CAMPAIGN, []);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const anchors: HTMLAnchorElement[] = [];
    const create = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = create(tag);
      if (tag === 'a') anchors.push(el as HTMLAnchorElement);
      return el;
    });
    URL.createObjectURL = vi.fn().mockReturnValue('blob:x');
    URL.revokeObjectURL = vi.fn();
    (fixture.nativeElement.querySelector('[data-testid="export-codex"]') as HTMLElement).click();
    expect(api['export']).toHaveBeenCalledWith('c1');
    expect(anchors[0].download).toBe('codex-campagna-uno.json');
    expect(click).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe('toCodexRow', () => {
  const places = new Map([
    ['dc', { slug: 'dc', name: 'Diamond City', type: 'settlement' as const }],
  ]);

  it('derives author, map and visibility labels', () => {
    expect(toCodexRow(makeEntry({ isPublic: true }), places).visibilityLabel).toBe('Pubblica');
    expect(toCodexRow(makeEntry(), places).visibilityLabel).toBe('Nessuno');
    expect(toCodexRow(makeEntry(), places).authorLabel).toBe('Master');
    expect(toCodexRow(makeEntry(), places).mapLabel).toBe('—');

    const linked = toCodexRow(makeEntry({ mapPlaceSlug: 'dc' }), places);
    expect(linked).toMatchObject({ mapLabel: 'Diamond City', mapMissing: false });
    const dangling = toCodexRow(makeEntry({ mapPlaceSlug: 'ghost' }), places);
    expect(dangling).toMatchObject({ mapLabel: 'ghost', mapMissing: true });

    const byPlayer = toCodexRow(
      makeEntry({
        createdByCharacterId: 'p',
        visibleToCharacterIds: ['p', 'x'],
        characters: [PIPER, { id: 'x', name: 'Old', deleted: true }],
      }),
      places,
    );
    expect(byPlayer.authorLabel).toBe('Piper');
    expect(byPlayer.visibleTo[1].deleted).toBe(true);
  });

  it('folds case and accents for the filter', () => {
    expect(foldText('  Città ')).toBe('citta');
  });
});
