import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CodexEntryDialogComponent, draftOf, patchBody } from './codex-entry-dialog';
import { CodexApiService } from '../../core/codex/codex-api.service';
import type { CodexEntry } from '../../core/codex/codex.types';
import { makeEntry } from './codex-fixtures';

type Internals = {
  patch(change: Record<string, unknown>): void;
  placeOptions(): { value: string; label: string }[];
  characterOptions(): { id: string; label: string }[];
};

describe('CodexEntryDialogComponent', () => {
  let fixture: ComponentFixture<CodexEntryDialogComponent>;
  let api: Record<string, ReturnType<typeof vi.fn>>;

  const q = <T extends Element = HTMLElement>(sel: string) =>
    document.body.querySelector(sel) as T | null;
  const submit = () => q<HTMLButtonElement>('[data-testid="dialog-submit"]')!;
  const internals = () => fixture.componentInstance as unknown as Internals;

  function setValue(sel: string, value: string) {
    const el = q<HTMLInputElement | HTMLSelectElement>(sel)!;
    el.value = value;
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input'));
    fixture.detectChanges();
  }

  async function open(entry: CodexEntry | null) {
    api = {
      create: vi.fn().mockReturnValue(of(makeEntry({ id: 'new' }))),
      update: vi.fn().mockReturnValue(of(makeEntry())),
      campaignCharacters: vi.fn().mockReturnValue(
        of([
          { id: 'p', name: 'Piper' },
          { id: 'n', name: 'Nick' },
        ]),
      ),
      campaignPlaces: vi
        .fn()
        .mockReturnValue(of([{ slug: 'dc', name: 'Diamond City', type: 'settlement' }])),
    };
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [CodexEntryDialogComponent],
      providers: [{ provide: CodexApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(CodexEntryDialogComponent);
    fixture.componentRef.setInput('campaignId', 'c1');
    fixture.componentRef.setInput('entry', entry);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('disables submit until both name and type are set', async () => {
    await open(null);
    expect(submit().disabled).toBe(true);
    setValue('[data-testid="codex-name"]', 'Mirelurk');
    expect(submit().disabled).toBe(true);
    setValue('[data-testid="codex-type"]', 'creatura');
    expect(submit().disabled).toBe(false);
    setValue('[data-testid="codex-name"]', '   ');
    expect(submit().disabled).toBe(true);
  });

  it('creates with blanks omitted and the master defaults', async () => {
    await open(null);
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    setValue('[data-testid="codex-type"]', 'luogo');
    setValue('[data-testid="codex-name"]', ' Diamond City ');
    internals().patch({ mapPlaceSlug: 'dc', visibleToCharacterIds: ['p', 'n'] });
    fixture.detectChanges();
    submit().click();
    expect(api['create']).toHaveBeenCalledWith('c1', {
      type: 'luogo',
      name: 'Diamond City',
      isPublic: false,
      visibleToCharacterIds: ['p', 'n'],
      isEditable: false,
      mapPlaceSlug: 'dc',
    });
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ id: 'new' }));
  });

  it('edits with only the changed fields', async () => {
    await open(makeEntry({ description: 'old', imageUrl: 'https://img.example.com/a.png' }));
    setValue('[data-testid="codex-description"]', 'new');
    setValue('[data-testid="codex-image"]', '');
    internals().patch({ visibleToCharacterIds: ['p', 'n'] });
    fixture.detectChanges();
    submit().click();
    expect(api['update']).toHaveBeenCalledWith('c1', 'e1', {
      description: 'new',
      imageUrl: null,
      visibleToCharacterIds: ['p', 'n'],
    });
  });

  it('lists places by name and type, and flags a dangling slug', async () => {
    await open(makeEntry({ mapPlaceSlug: 'ghost' }));
    expect(internals().placeOptions()).toEqual([
      { value: 'ghost', label: 'Luogo non trovato (ghost)' },
      { value: 'dc', label: 'Diamond City · Insediamento' },
    ]);
    internals().patch({ mapPlaceSlug: null });
    submit().click();
    expect(api['update']).toHaveBeenCalledWith('c1', 'e1', { mapPlaceSlug: null });
  });

  it('marks a deleted character that is still listed', async () => {
    await open(
      makeEntry({
        visibleToCharacterIds: ['p', 'gone'],
        characters: [
          { id: 'p', name: 'Piper', deleted: false },
          { id: 'gone', name: 'Old', deleted: true },
        ],
      }),
    );
    expect(internals().characterOptions()).toEqual([
      { id: 'p', label: 'Piper' },
      { id: 'n', label: 'Nick' },
      { id: 'gone', label: 'Old (eliminato)' },
    ]);
  });

  it('previews the image and hides the preview when it fails to load', async () => {
    await open(null);
    setValue('[data-testid="codex-image"]', 'https://img.example.com/a.png');
    const img = q<HTMLImageElement>('[data-testid="codex-image-preview"]')!;
    expect(img).toBeTruthy();
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(q('[data-testid="codex-image-preview"]')).toBeNull();
  });

  it('resizes textareas only vertically', async () => {
    await open(null);
    expect(q<HTMLTextAreaElement>('[data-testid="codex-description"]')!.style.resize).toBe(
      'vertical',
    );
    expect(q<HTMLTextAreaElement>('[data-testid="codex-secret"]')!.style.resize).toBe('vertical');
  });
});

describe('patchBody', () => {
  it('is empty when nothing changed, ignoring list order', () => {
    const before = draftOf(makeEntry({ visibleToCharacterIds: ['a', 'b'] }));
    expect(patchBody(before, { ...before, visibleToCharacterIds: ['b', 'a'] })).toEqual({});
  });
});
