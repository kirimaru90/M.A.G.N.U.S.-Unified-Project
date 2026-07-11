import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SkillsCatalogPage } from './skills-catalog-page';
import { SkillsCatalogApiService } from '../../core/skills-catalog/skills-catalog-api.service';

describe('SkillsCatalogPage', () => {
  let fixture: ComponentFixture<SkillsCatalogPage>;
  let component: SkillsCatalogPage;
  let listSpy: ReturnType<typeof vi.fn>;
  let patchSpy: ReturnType<typeof vi.fn>;

  function setup(entries: unknown[] = []) {
    listSpy = vi.fn().mockReturnValue(of(entries));
    patchSpy = vi.fn().mockReturnValue(of({ ignored: [] }));

    return TestBed.configureTestingModule({
      imports: [SkillsCatalogPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SkillsCatalogApiService, useValue: { list: listSpy, patchSchema: patchSpy } },
        ConfirmationService,
        MessageService,
      ],
    }).compileComponents();
  }

  beforeEach(async () => {
    await setup([{ slug: 'hacking', name: 'Hacking', description: 'Bypassare terminali' }]);
    fixture = TestBed.createComponent(SkillsCatalogPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the catalog from a single GET on init', () => {
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(component['entries']()).toEqual([
      { slug: 'hacking', name: 'Hacking', description: 'Bypassare terminali' },
    ]);
  });

  it('adds a skill via patchSchema with an add op', () => {
    component['showAddRow']();
    fixture.detectChanges();
    component['draft'] = { slug: 'lockpick', name: 'Lockpick', description: '' };
    component['submitAdd']();
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([
      { action: 'add', slug: 'lockpick', entry: { name: 'Lockpick', description: undefined } },
    ]);
    expect(component['addRowVisible']()).toBe(false);
  });

  it('rejects an add with a missing slug or name', () => {
    component['showAddRow']();
    fixture.detectChanges();
    component['draft'] = { slug: '', name: '', description: '' };
    component['submitAdd']();
    fixture.detectChanges();

    expect(patchSpy).not.toHaveBeenCalled();
    expect(component['rowError']()).toBeTruthy();
  });

  it('cancels the add row without calling patchSchema', () => {
    component['showAddRow']();
    fixture.detectChanges();
    component['cancelAdd']();
    fixture.detectChanges();

    expect(patchSpy).not.toHaveBeenCalled();
    expect(component['addRowVisible']()).toBe(false);
  });

  it('renames a skill via a single rename op when only the slug changes', () => {
    const entry = { slug: 'hacking', name: 'Hacking', description: 'Bypassare terminali' };
    component['startEdit'](entry);
    fixture.detectChanges();
    component['draft'].slug = 'hacking-2';
    component['submitEdit'](entry);
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([
      { action: 'rename', slug: 'hacking', rename: 'hacking-2' },
    ]);
  });

  it('updates a skill via an update op when the slug is unchanged', () => {
    const entry = { slug: 'hacking', name: 'Hacking', description: 'old' };
    component['startEdit'](entry);
    fixture.detectChanges();
    component['draft'].description = 'new';
    component['submitEdit'](entry);
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([
      { action: 'update', slug: 'hacking', entry: { name: 'Hacking', description: 'new' } },
    ]);
  });

  it('cancels an in-progress edit without calling patchSchema', () => {
    const entry = { slug: 'hacking', name: 'Hacking', description: 'old' };
    component['startEdit'](entry);
    fixture.detectChanges();
    component['cancelEdit']();
    fixture.detectChanges();

    expect(patchSpy).not.toHaveBeenCalled();
    expect(component['editingSlug']()).toBeNull();
  });

  it('surfaces a 409 error message when patchSchema rejects with a conflict', () => {
    patchSpy.mockReturnValueOnce({
      subscribe: ({ error }: { error: (e: unknown) => void }) => error({ status: 409 }),
    });
    component['showAddRow']();
    component['draft'] = { slug: 'hacking', name: 'Hacking', description: '' };
    component['submitAdd']();
    fixture.detectChanges();

    expect(component['rowError']()).toBe('Slug già esistente');
  });

  it('deletes a skill via patchSchema with a delete op after confirmation', () => {
    const confirmationService = TestBed.inject(ConfirmationService);
    vi.spyOn(confirmationService, 'confirm').mockImplementation((opts) => {
      opts.accept?.();
      return confirmationService;
    });

    component['confirmDelete']({ slug: 'hacking', name: 'Hacking' });
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([{ action: 'delete', slug: 'hacking' }]);
  });

  it('renders the empty message when the catalog has no entries', async () => {
    TestBed.resetTestingModule();
    await setup([]);
    const emptyFixture = TestBed.createComponent(SkillsCatalogPage);
    emptyFixture.detectChanges();
    expect(emptyFixture.nativeElement.textContent).toContain('Nessuna abilità nel catalogo');
  });
});
