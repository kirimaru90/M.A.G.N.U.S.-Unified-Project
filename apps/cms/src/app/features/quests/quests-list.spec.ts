import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmationService, MessageService } from 'primeng/api';
import { QuestsListPage, toQuestRow } from './quests-list';
import { QuestsApiService } from '../../core/quests/quests-api.service';
import { CurrentCampaignService } from '../../core/campaign/current-campaign.service';
import type { CampaignDto } from '../../core/campaign/campaign.types';
import type { Quest } from '../../core/quests/quests.types';
import { makeQuest, makeStage } from './quest-fixtures';

const CAMPAIGN = { id: 'c1', name: 'Campagna Uno' } as CampaignDto;

describe('QuestsListPage', () => {
  let listSpy: ReturnType<typeof vi.fn>;

  function setup(current: CampaignDto | null, quests: Quest[] = []) {
    listSpy = vi.fn().mockReturnValue(of(quests));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [QuestsListPage],
      providers: [
        provideRouter([]),
        {
          provide: QuestsApiService,
          useValue: {
            list: listSpy,
            delete: vi.fn(),
            campaignCharacters: vi.fn().mockReturnValue(of([])),
          },
        },
        {
          provide: CurrentCampaignService,
          useValue: { currentCampaign: signal(current), campaigns: signal([CAMPAIGN]) },
        },
        ConfirmationService,
        MessageService,
      ],
    });
    const fixture: ComponentFixture<QuestsListPage> = TestBed.createComponent(QuestsListPage);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('shows the select-a-campaign empty state and no table when no campaign is selected', () => {
    const fixture = setup(null);
    expect(fixture.nativeElement.textContent).toContain('Seleziona una campagna');
    expect(fixture.nativeElement.querySelector('p-table')).toBeNull();
    expect(listSpy).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="new-quest"]').disabled).toBe(true);
  });

  it('renders the nine columns and one row per quest', () => {
    const fixture = setup(CAMPAIGN, [makeQuest(), makeQuest({ id: 'q2' })]);
    expect(listSpy).toHaveBeenCalledWith('c1');
    const headers = Array.from(
      fixture.nativeElement.querySelectorAll('th') as NodeListOf<HTMLElement>,
    ).map((th) => th.textContent!.trim());
    expect(headers).toEqual([
      'Titolo',
      'Tipo',
      'Personaggi',
      'Stato',
      'Milestone',
      'Pubblica',
      'Stadi',
      'Aggiornata il',
      'Azioni',
    ]);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="quest-row"]').length).toBe(2);
  });

  it('shows the empty message for a campaign without quests', () => {
    const fixture = setup(CAMPAIGN, []);
    expect(fixture.nativeElement.textContent).toContain('Nessuna quest in questa campagna');
  });

  it('reflects the latest stage, drafts included', () => {
    const quest = makeQuest({
      stages: [makeStage(), makeStage({ id: 's2', title: 'Il tradimento', isPublic: false })],
    });
    const fixture = setup(CAMPAIGN, [quest]);
    const row = fixture.nativeElement.querySelector('[data-testid="quest-row"]') as HTMLElement;
    expect(row.textContent).toContain('Il tradimento');
    expect(row.textContent).toContain('2 (1 bozza)');
  });

  it('sorts by status when the Stato header is clicked, toggling direction', () => {
    const fixture = setup(CAMPAIGN, [
      makeQuest({ id: 'a', stages: [makeStage({ title: 'Alfa', status: 'completata' })] }),
      makeQuest({ id: 'b', stages: [makeStage({ title: 'Beta', status: 'in_corso' })] }),
      makeQuest({ id: 'c', stages: [makeStage({ title: 'Gamma', status: 'standby' })] }),
    ]);
    const titles = () =>
      Array.from(
        fixture.nativeElement.querySelectorAll('[data-testid="quest-row"] td:first-child'),
      ).map((td) => (td as HTMLElement).textContent!.trim());
    const statusHeader = Array.from(
      fixture.nativeElement.querySelectorAll('th') as NodeListOf<HTMLElement>,
    ).find((th) => th.textContent!.includes('Stato'))!;

    statusHeader.click();
    fixture.detectChanges();
    expect(titles()).toEqual(['Beta', 'Gamma', 'Alfa']);

    statusHeader.click();
    fixture.detectChanges();
    expect(titles()).toEqual(['Alfa', 'Gamma', 'Beta']);
  });
});

describe('toQuestRow', () => {
  it('derives personal quest cells and marks no public badge', () => {
    const row = toQuestRow(
      makeQuest({
        kind: 'personal',
        isPublic: false,
        characterIds: ['a', 'b'],
        characters: [
          { id: 'a', name: 'Alice', deleted: false },
          { id: 'b', name: 'Nick', deleted: true },
        ],
        stages: [makeStage({ isMilestone: true, status: 'standby' })],
      }),
    );
    expect(row.kindLabel).toBe('Personale');
    expect(row.charactersLabel).toBe('Alice, Nick');
    expect(row.characters[1].deleted).toBe(true);
    expect(row.statusLabel).toBe('Standby');
    expect(row.isMilestone).toBe(true);
    expect(row.publicRank).toBe(-1);
  });
});
