import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateQuestDialogComponent } from './create-quest-dialog';
import { QuestsApiService } from '../../core/quests/quests-api.service';
import { makeQuest } from './quest-fixtures';

describe('CreateQuestDialogComponent', () => {
  let fixture: ComponentFixture<CreateQuestDialogComponent>;
  let createSpy: ReturnType<typeof vi.fn>;

  const q = <T extends Element = HTMLElement>(sel: string) =>
    document.body.querySelector(sel) as T | null;
  const submit = () => q<HTMLButtonElement>('[data-testid="dialog-submit"]')!;

  function setValue(sel: string, value: string) {
    const el = q<HTMLInputElement | HTMLSelectElement>(sel)!;
    el.value = value;
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    createSpy = vi.fn().mockReturnValue(of(makeQuest({ id: 'new' })));
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [CreateQuestDialogComponent],
      providers: [
        {
          provide: QuestsApiService,
          useValue: {
            create: createSpy,
            campaignCharacters: vi.fn().mockReturnValue(of([{ id: 'a', name: 'Alice' }])),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CreateQuestDialogComponent);
    fixture.componentRef.setInput('campaignId', 'c1');
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('disables submit while the title is empty', () => {
    expect(submit().disabled).toBe(true);
    setValue('[data-testid="stage-title"]', 'Un segnale strano');
    expect(submit().disabled).toBe(false);
  });

  it('switching to Personale hides Pubblica, shows Personaggi, and requires a character', () => {
    expect(q('[data-testid="quest-public-field"]')).toBeTruthy();
    setValue('[data-testid="stage-title"]', 'X');
    setValue('[data-testid="quest-kind"]', 'personal');
    expect(q('[data-testid="quest-public-field"]')).toBeNull();
    expect(q('[data-testid="quest-characters-field"]')).toBeTruthy();
    expect(submit().disabled).toBe(true);
  });

  it('creates a story quest with its first stage and emits it', () => {
    const created = vi.fn();
    fixture.componentInstance.created.subscribe(created);
    setValue('[data-testid="stage-title"]', '  Un segnale strano ');
    submit().click();
    fixture.detectChanges();
    expect(createSpy).toHaveBeenCalledWith('c1', {
      kind: 'story',
      isPublic: false,
      stage: {
        title: 'Un segnale strano',
        description: undefined,
        reward: undefined,
        status: 'in_corso',
        isMilestone: false,
        isPublic: false,
      },
    });
    expect(created).toHaveBeenCalledWith(expect.objectContaining({ id: 'new' }));
  });
});
