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

  it('renders read-only rows with no inline inputs', () => {
    expect(fixture.nativeElement.querySelector('p-table input')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Automatica');
  });

  it('opens the dialog empty for create', () => {
    component['openCreate']();
    expect(component['dialogVisible']()).toBe(true);
    expect(component['dialogEntry']()).toBeNull();
  });

  it('opens the dialog with the row entry for edit', () => {
    const entry = { slug: 'automatica', name: 'Automatica' };
    component['openEdit'](entry);
    expect(component['dialogVisible']()).toBe(true);
    expect(component['dialogEntry']()).toBe(entry);
  });

  it('closes the dialog and reloads after a save', () => {
    component['openCreate']();
    component['onSaved']('created');

    expect(component['dialogVisible']()).toBe(false);
    expect(listSpy).toHaveBeenCalledTimes(2);
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
