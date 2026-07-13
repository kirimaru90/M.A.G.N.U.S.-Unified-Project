import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TagCatalogPage } from './tag-catalog-page';
import { TagCatalogApiService } from '../../core/tag-catalog/tag-catalog-api.service';

describe('TagCatalogPage', () => {
  let fixture: ComponentFixture<TagCatalogPage>;
  let component: TagCatalogPage;
  let listSpy: ReturnType<typeof vi.fn>;
  let patchSpy: ReturnType<typeof vi.fn>;

  function setup(entries: unknown[] = []) {
    listSpy = vi.fn().mockReturnValue(of(entries));
    patchSpy = vi.fn().mockReturnValue(of({ ignored: [] }));

    return TestBed.configureTestingModule({
      imports: [TagCatalogPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TagCatalogApiService, useValue: { list: listSpy, patchSchema: patchSpy } },
        ConfirmationService,
        MessageService,
      ],
    }).compileComponents();
  }

  beforeEach(async () => {
    await setup([{ slug: 'automatica', name: 'Automatica' }]);
    fixture = TestBed.createComponent(TagCatalogPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the catalog from a single GET on init', () => {
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(component['entries']()).toEqual([{ slug: 'automatica', name: 'Automatica' }]);
  });

  it('adds a tag entry via patchSchema with an add op', () => {
    component['showAddRow']();
    fixture.detectChanges();
    component['draft'] = { slug: 'pesante', name: 'Pesante' };
    component['submitAdd']();
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([
      { action: 'add', slug: 'pesante', entry: { name: 'Pesante' } },
    ]);
    expect(component['addRowVisible']()).toBe(false);
  });

  it('rejects an add with a missing slug or name', () => {
    component['showAddRow']();
    fixture.detectChanges();
    component['draft'] = { slug: '', name: '' };
    component['submitAdd']();
    fixture.detectChanges();

    expect(patchSpy).not.toHaveBeenCalled();
    expect(component['rowError']()).toBeTruthy();
  });

  it('renames a tag entry via a single rename op when only the slug changes', () => {
    const entry = { slug: 'automatica', name: 'Automatica' };
    component['startEdit'](entry);
    fixture.detectChanges();
    component['draft'].slug = 'auto';
    component['submitEdit'](entry);
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([
      { action: 'rename', slug: 'automatica', rename: 'auto' },
    ]);
  });

  it('updates a tag name via an update op when the slug is unchanged', () => {
    const entry = { slug: 'automatica', name: 'Automatica' };
    component['startEdit'](entry);
    fixture.detectChanges();
    component['draft'].name = 'AUTOMATICA';
    component['submitEdit'](entry);
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([
      { action: 'update', slug: 'automatica', entry: { name: 'AUTOMATICA' } },
    ]);
  });

  it('surfaces a 409 error message and retains the pending edit when patchSchema conflicts', () => {
    patchSpy.mockReturnValueOnce({
      subscribe: ({ error }: { error: (e: unknown) => void }) => error({ status: 409 }),
    });
    component['showAddRow']();
    component['draft'] = { slug: 'automatica', name: 'Automatica' };
    component['submitAdd']();
    fixture.detectChanges();

    expect(component['rowError']()).toBe('Slug già esistente');
    expect(component['addRowVisible']()).toBe(true);
  });

  it('deletes a tag entry via patchSchema with a delete op after confirmation', () => {
    const confirmationService = TestBed.inject(ConfirmationService);
    vi.spyOn(confirmationService, 'confirm').mockImplementation((opts) => {
      opts.accept?.();
      return confirmationService;
    });

    component['confirmDelete']({ slug: 'automatica', name: 'Automatica' });
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([{ action: 'delete', slug: 'automatica' }]);
  });

  it('renders the empty message when the catalog has no entries', async () => {
    TestBed.resetTestingModule();
    await setup([]);
    const emptyFixture = TestBed.createComponent(TagCatalogPage);
    emptyFixture.detectChanges();
    expect(emptyFixture.nativeElement.textContent).toContain('Nessun tag nel catalogo');
  });
});
