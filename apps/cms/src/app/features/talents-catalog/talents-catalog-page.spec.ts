import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TalentsCatalogPage } from './talents-catalog-page';
import { TalentsCatalogApiService } from '../../core/talents-catalog/talents-catalog-api.service';

describe('TalentsCatalogPage', () => {
  let fixture: ComponentFixture<TalentsCatalogPage>;
  let component: TalentsCatalogPage;
  let listSpy: ReturnType<typeof vi.fn>;
  let patchSpy: ReturnType<typeof vi.fn>;

  function setup(entries: unknown[] = []) {
    listSpy = vi.fn().mockReturnValue(of(entries));
    patchSpy = vi.fn().mockReturnValue(of({ ignored: [] }));

    return TestBed.configureTestingModule({
      imports: [TalentsCatalogPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TalentsCatalogApiService, useValue: { list: listSpy, patchSchema: patchSpy } },
        ConfirmationService,
        MessageService,
      ],
    }).compileComponents();
  }

  beforeEach(async () => {
    await setup([{ slug: 'gunslinger', name: 'Gunslinger', description: 'Precisione col revolver' }]);
    fixture = TestBed.createComponent(TalentsCatalogPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the catalog from a single GET on init', () => {
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(component['entries']()).toEqual([
      { slug: 'gunslinger', name: 'Gunslinger', description: 'Precisione col revolver' },
    ]);
  });

  it('adds a talent via patchSchema with an add op', () => {
    component['showAddRow']();
    fixture.detectChanges();
    component['draft'] = { slug: 'lone-wanderer', name: 'Lone Wanderer', description: '' };
    component['submitAdd']();
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([
      { action: 'add', slug: 'lone-wanderer', entry: { name: 'Lone Wanderer', description: undefined } },
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

  it('renames a talent via a single rename op when only the slug changes', () => {
    const entry = { slug: 'gunslinger', name: 'Gunslinger', description: 'Precisione col revolver' };
    component['startEdit'](entry);
    fixture.detectChanges();
    component['draft'].slug = 'gunslinger-2';
    component['submitEdit'](entry);
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([
      { action: 'rename', slug: 'gunslinger', rename: 'gunslinger-2' },
    ]);
  });

  it('updates a talent via an update op when the slug is unchanged', () => {
    const entry = { slug: 'gunslinger', name: 'Gunslinger', description: 'old' };
    component['startEdit'](entry);
    fixture.detectChanges();
    component['draft'].description = 'new';
    component['submitEdit'](entry);
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([
      { action: 'update', slug: 'gunslinger', entry: { name: 'Gunslinger', description: 'new' } },
    ]);
  });

  it('cancels an in-progress edit without calling patchSchema', () => {
    const entry = { slug: 'gunslinger', name: 'Gunslinger', description: 'old' };
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
    component['draft'] = { slug: 'gunslinger', name: 'Gunslinger', description: '' };
    component['submitAdd']();
    fixture.detectChanges();

    expect(component['rowError']()).toBe('Slug già esistente');
  });

  it('deletes a talent via patchSchema with a delete op after confirmation', () => {
    const confirmationService = TestBed.inject(ConfirmationService);
    vi.spyOn(confirmationService, 'confirm').mockImplementation((opts) => {
      opts.accept?.();
      return confirmationService;
    });

    component['confirmDelete']({ slug: 'gunslinger', name: 'Gunslinger' });
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([{ action: 'delete', slug: 'gunslinger' }]);
  });

  it('renders the empty message when the catalog has no entries', async () => {
    TestBed.resetTestingModule();
    await setup([]);
    const emptyFixture = TestBed.createComponent(TalentsCatalogPage);
    emptyFixture.detectChanges();
    expect(emptyFixture.nativeElement.textContent).toContain('Nessun talento nel catalogo');
  });
});
