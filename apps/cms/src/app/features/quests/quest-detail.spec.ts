import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmationService } from 'primeng/api';
import { QuestDetailPage } from './quest-detail';
import { QuestsApiService } from '../../core/quests/quests-api.service';
import { CurrentCampaignService } from '../../core/campaign/current-campaign.service';
import type { CampaignDto } from '../../core/campaign/campaign.types';
import type { Quest } from '../../core/quests/quests.types';
import { makeQuest, makeStage } from './quest-fixtures';

const CAMPAIGN = { id: 'c1', name: 'Campagna Uno' } as CampaignDto;

@Component({ template: '' })
class StubPage {}

describe('QuestDetailPage', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  function setup(quest: Quest) {
    api = {
      get: vi.fn().mockReturnValue(of(quest)),
      update: vi.fn().mockImplementation((_c, _q, body) => of({ ...quest, ...body })),
      delete: vi.fn().mockReturnValue(of(undefined)),
      deleteStage: vi.fn().mockReturnValue(of(quest)),
      campaignCharacters: vi.fn().mockReturnValue(
        of([
          { id: 'a', name: 'Alice' },
          { id: 'b', name: 'Nick' },
        ]),
      ),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [QuestDetailPage],
      providers: [
        provideRouter([{ path: 'quests', component: StubPage }]),
        { provide: ActivatedRoute, useValue: { snapshot: { params: { questId: quest.id } } } },
        { provide: QuestsApiService, useValue: api },
        { provide: CurrentCampaignService, useValue: { currentCampaign: signal(CAMPAIGN) } },
      ],
    });
    const fixture: ComponentFixture<QuestDetailPage> = TestBed.createComponent(QuestDetailPage);
    fixture.detectChanges();
    fixture.detectChanges();
    return fixture;
  }

  const threeStages = () =>
    makeQuest({
      stages: [
        makeStage({ id: 's1', title: 'Uno' }),
        makeStage({ id: 's2', title: 'Due' }),
        makeStage({ id: 's3', title: 'Tre', isPublic: false, revealedAt: null }),
      ],
    });

  beforeEach(() => TestBed.resetTestingModule());

  it('loads the quest of the current campaign and titles it with the last stage', () => {
    const fixture = setup(threeStages());
    expect(api['get']).toHaveBeenCalledWith('c1', 'q1');
    expect(fixture.nativeElement.querySelector('[data-testid="quest-title"]').textContent).toContain(
      'Tre',
    );
  });

  it('names the character that created the quest from the Pip-Boy', () => {
    const creator = (q: Quest) =>
      setup(q).nativeElement.querySelector('[data-testid="quest-creator"]') as HTMLElement | null;
    expect(creator(makeQuest())).toBeNull();
    expect(
      creator(
        makeQuest({
          kind: 'personal',
          isPublic: false,
          characterIds: ['a'],
          characters: [{ id: 'a', name: 'Alice', deleted: false }],
          createdByCharacterId: 'a',
        }),
      )!.textContent,
    ).toContain('Creata dal giocatore di Alice');
  });

  it('lists stages newest first with a Bozza badge on drafts', () => {
    const fixture = setup(threeStages());
    const rows = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="stage-row"]'),
    ) as HTMLElement[];
    expect(rows.map((r) => r.querySelector('strong')!.textContent)).toEqual(['Tre', 'Due', 'Uno']);
    expect(rows[0].querySelector('[data-testid="draft-badge"]')).toBeTruthy();
    expect(rows[1].querySelector('[data-testid="draft-badge"]')).toBeNull();
  });

  it('offers Elimina only on the last stage', () => {
    const fixture = setup(threeStages());
    const rows = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="stage-row"]'),
    ) as HTMLElement[];
    expect(rows.map((r) => !!r.querySelector('[data-testid="delete-stage"]'))).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('offers no stage delete on a single-stage quest', () => {
    const fixture = setup(makeQuest());
    expect(fixture.nativeElement.querySelector('[data-testid="delete-stage"]')).toBeNull();
  });

  it('saves header changes with PATCH', () => {
    const quest = makeQuest({
      kind: 'personal',
      isPublic: false,
      characterIds: ['a'],
      characters: [{ id: 'a', name: 'Alice', deleted: false }],
    });
    const fixture = setup(quest);
    const page = fixture.componentInstance as unknown as {
      characterIds: { set(v: string[]): void };
      saveHeader(): void;
    };
    page.characterIds.set(['a', 'b']);
    fixture.detectChanges();
    const save = fixture.nativeElement.querySelector('[data-testid="save-header"]') as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    save.click();
    expect(api['update']).toHaveBeenCalledWith('c1', 'q1', {
      kind: 'personal',
      characterIds: ['a', 'b'],
    });
  });

  it('marks deleted assignees', () => {
    const fixture = setup(
      makeQuest({
        kind: 'personal',
        isPublic: false,
        characterIds: ['a', 'z'],
        characters: [
          { id: 'a', name: 'Alice', deleted: false },
          { id: 'z', name: 'Ghoul', deleted: true },
        ],
      }),
    );
    expect(fixture.nativeElement.querySelector('[data-testid="deleted-assignees"]').textContent).toContain(
      'Ghoul',
    );
  });

  it('asks for confirmation before deleting the quest or the last stage', () => {
    const fixture = setup(threeStages());
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    const confirm = vi.spyOn(confirmation, 'confirm');

    (fixture.nativeElement.querySelector('[data-testid="delete-quest"]') as HTMLElement).click();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(api['delete']).not.toHaveBeenCalled();
    confirm.mock.calls[0][0].accept!();
    expect(api['delete']).toHaveBeenCalledWith('c1', 'q1');

    (fixture.nativeElement.querySelector('[data-testid="delete-stage"]') as HTMLElement).click();
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(api['deleteStage']).not.toHaveBeenCalled();
    confirm.mock.calls[1][0].accept!();
    expect(api['deleteStage']).toHaveBeenCalledWith('c1', 'q1', 's3');
  });
});
