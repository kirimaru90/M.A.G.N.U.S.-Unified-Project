import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmationService } from 'primeng/api';
import { StageDialogComponent, UNPUBLISH_CURRENT_MESSAGE } from './stage-dialog';
import { QuestsApiService } from '../../core/quests/quests-api.service';
import type { Quest, QuestStage } from '../../core/quests/quests.types';
import type { StageDraft } from './stage-fields';
import { makeQuest, makeStage } from './quest-fixtures';

describe('StageDialogComponent', () => {
  let fixture: ComponentFixture<StageDialogComponent>;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let confirmation: ConfirmationService;

  const quest = makeQuest({
    stages: [
      makeStage({ id: 's1', title: 'Uno' }),
      makeStage({
        id: 's2',
        title: 'La porta si apre',
        description: 'desc',
        reward: 'caps',
        status: 'in_corso',
        isMilestone: true,
        isPublic: true,
      }),
    ],
  });

  beforeEach(async () => {
    api = {
      addStage: vi.fn().mockReturnValue(of(quest)),
      updateStage: vi.fn().mockReturnValue(of(quest)),
    };
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [StageDialogComponent],
      providers: [{ provide: QuestsApiService, useValue: api }, ConfirmationService],
    }).compileComponents();
    confirmation = TestBed.inject(ConfirmationService);
    fixture = TestBed.createComponent(StageDialogComponent);
  });

  function open(stage: QuestStage | null, q: Quest = quest) {
    fixture.componentRef.setInput('campaignId', 'c1');
    fixture.componentRef.setInput('quest', q);
    fixture.componentRef.setInput('stage', stage);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  }

  const draft = () =>
    (fixture.componentInstance as unknown as { draft: { (): StageDraft; set(d: StageDraft): void } })
      .draft;

  it('pre-fills a new stage from the last one, as a draft', () => {
    open(null);
    expect(draft()()).toEqual({
      title: 'La porta si apre',
      description: 'desc',
      reward: 'caps',
      status: 'in_corso',
      isMilestone: true,
      isPublic: false,
    });
  });

  it('creates a new stage with POST', () => {
    open(null);
    fixture.componentInstance.onSubmit();
    expect(api['addStage']).toHaveBeenCalledWith('c1', 'q1', {
      title: 'La porta si apre',
      description: 'desc',
      reward: 'caps',
      status: 'in_corso',
      isMilestone: true,
      isPublic: false,
    });
  });

  it('the Salva button submits the form', () => {
    open(null);
    (document.querySelector('[data-testid="dialog-submit"]') as HTMLButtonElement).click();
    expect(api['addStage']).toHaveBeenCalled();
  });

  it('edits send only the changed fields', () => {
    open(quest.stages[0]);
    draft().set({ ...draft()(), description: 'corretto' });
    fixture.componentInstance.onSubmit();
    expect(api['updateStage']).toHaveBeenCalledWith('c1', 'q1', 's1', { description: 'corretto' });
  });

  it('publishing a draft sends isPublic: true without confirmation', () => {
    const q = makeQuest({ stages: [makeStage(), makeStage({ id: 's2', isPublic: false })] });
    const confirm = vi.spyOn(confirmation, 'confirm');
    open(q.stages[1], q);
    draft().set({ ...draft()(), isPublic: true });
    fixture.componentInstance.onSubmit();
    expect(confirm).not.toHaveBeenCalled();
    expect(api['updateStage']).toHaveBeenCalledWith('c1', 'q1', 's2', { isPublic: true });
  });

  it('unpublishing the last public stage asks first and PATCHes only on confirm', () => {
    const confirm = vi.spyOn(confirmation, 'confirm');
    open(quest.stages[1]);
    draft().set({ ...draft()(), isPublic: false });
    fixture.componentInstance.onSubmit();
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: UNPUBLISH_CURRENT_MESSAGE }),
    );
    expect(api['updateStage']).not.toHaveBeenCalled();
    confirm.mock.calls[0][0].accept!();
    expect(api['updateStage']).toHaveBeenCalledWith('c1', 'q1', 's2', { isPublic: false });
  });

  it('unpublishing an earlier public stage needs no confirmation', () => {
    const confirm = vi.spyOn(confirmation, 'confirm');
    open(quest.stages[0]);
    draft().set({ ...draft()(), isPublic: false });
    fixture.componentInstance.onSubmit();
    expect(confirm).not.toHaveBeenCalled();
    expect(api['updateStage']).toHaveBeenCalled();
  });
});
