import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SpeciesCatalogPage } from './species-catalog-page';
import { SpeciesCatalogApiService } from '../../core/species-catalog/species-catalog-api.service';

const GHOUL = {
  slug: 'ghoul',
  name: 'Ghoul',
  permesso: 'Immune alle radiazioni.',
  svantaggio: 'Inviso agli umani.',
  tagSkillBudget: 3,
  margin: 4,
};

describe('SpeciesCatalogPage', () => {
  let fixture: ComponentFixture<SpeciesCatalogPage>;
  let component: SpeciesCatalogPage;
  let listSpy: ReturnType<typeof vi.fn>;
  let patchSpy: ReturnType<typeof vi.fn>;

  function setup(entries: unknown[] = []) {
    listSpy = vi.fn().mockReturnValue(of(entries));
    patchSpy = vi.fn().mockReturnValue(of({ ignored: [] }));

    return TestBed.configureTestingModule({
      imports: [SpeciesCatalogPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SpeciesCatalogApiService, useValue: { list: listSpy, patchSchema: patchSpy } },
        ConfirmationService,
        MessageService,
      ],
    }).compileComponents();
  }

  beforeEach(async () => {
    await setup([GHOUL]);
    fixture = TestBed.createComponent(SpeciesCatalogPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the catalog from a single GET on init', () => {
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(component['entries']()).toEqual([GHOUL]);
  });

  it('renders the margin column header', () => {
    expect(fixture.nativeElement.textContent).toContain('Margine salute');
  });

  it('renders read-only rows with no inline inputs', () => {
    expect(fixture.nativeElement.querySelector('p-table tbody input')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Inviso agli umani.');
  });

  it('opens the dialog empty for create', () => {
    component['openCreate']();
    expect(component['dialogVisible']()).toBe(true);
    expect(component['dialogEntry']()).toBeNull();
  });

  it('opens the dialog with the row entry for edit', () => {
    const entry = GHOUL;
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

  it('deletes a species via a delete op after confirmation', () => {
    const confirmationService = TestBed.inject(ConfirmationService);
    vi.spyOn(confirmationService, 'confirm').mockImplementation((opts) => {
      opts.accept?.();
      return confirmationService;
    });

    component['confirmDelete'](GHOUL);
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([{ action: 'delete', slug: 'ghoul' }]);
  });

  // 3.T.3 — a 409 renders inline and the draft survives for a retry.
  it('surfaces an in-use 409 on delete as an inline error and keeps the entry listed', () => {
    const confirmationService = TestBed.inject(ConfirmationService);
    vi.spyOn(confirmationService, 'confirm').mockImplementation((opts) => {
      opts.accept?.();
      return confirmationService;
    });
    patchSpy.mockReturnValueOnce({
      subscribe: ({ error }: { error: (e: unknown) => void }) => error({ status: 409 }),
    });

    component['confirmDelete'](GHOUL);
    fixture.detectChanges();

    expect(component['deleteError']()).toBe('ghoul');
    expect(component['deleteErrorText']()).toBe('Specie in uso da un personaggio');
    expect(component['entries']()).toEqual([GHOUL]);
  });

  it('renders the empty message when the catalog has no entries', async () => {
    TestBed.resetTestingModule();
    await setup([]);
    const emptyFixture = TestBed.createComponent(SpeciesCatalogPage);
    emptyFixture.detectChanges();
    expect(emptyFixture.nativeElement.textContent).toContain('Nessuna specie nel catalogo');
  });
});
