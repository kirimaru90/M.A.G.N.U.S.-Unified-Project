import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConditionsCatalogPage } from './conditions-catalog-page';
import { ConditionsCatalogApiService } from '../../core/conditions-catalog/conditions-catalog-api.service';

describe('ConditionsCatalogPage', () => {
  let fixture: ComponentFixture<ConditionsCatalogPage>;
  let component: ConditionsCatalogPage;
  let listSpy: ReturnType<typeof vi.fn>;
  let patchSpy: ReturnType<typeof vi.fn>;

  function setup(entries: unknown[] = []) {
    listSpy = vi.fn().mockReturnValue(of(entries));
    patchSpy = vi.fn().mockReturnValue(of({ ignored: [] }));

    return TestBed.configureTestingModule({
      imports: [ConditionsCatalogPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConditionsCatalogApiService, useValue: { list: listSpy, patchSchema: patchSpy } },
        ConfirmationService,
        MessageService,
      ],
    }).compileComponents();
  }

  beforeEach(async () => {
    await setup([
      { slug: 'poisoned', name: 'Avvelenato', defaultSeverity: 'major', polarity: 'negative' },
    ]);
    fixture = TestBed.createComponent(ConditionsCatalogPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the catalog from a single GET on init', () => {
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(component['entries']()).toEqual([
      { slug: 'poisoned', name: 'Avvelenato', defaultSeverity: 'major', polarity: 'negative' },
    ]);
  });

  it('renders read-only rows with no inline inputs', () => {
    expect(fixture.nativeElement.querySelector('p-table tbody input')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Avvelenato');
  });

  it('opens the dialog empty for create', () => {
    component['openCreate']();
    expect(component['dialogVisible']()).toBe(true);
    expect(component['dialogEntry']()).toBeNull();
  });

  it('opens the dialog with the row entry for edit', () => {
    const entry = { slug: 'poisoned', name: 'Avvelenato', defaultSeverity: 'major' as const, polarity: 'negative' as const };
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

  it('deletes a condition preset via patchSchema with a delete op after confirmation', () => {
    const confirmationService = TestBed.inject(ConfirmationService);
    vi.spyOn(confirmationService, 'confirm').mockImplementation((opts) => {
      opts.accept?.();
      return confirmationService;
    });

    component['confirmDelete']({
      slug: 'poisoned',
      name: 'Avvelenato',
      defaultSeverity: 'major',
      polarity: 'negative',
    });
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([{ action: 'delete', slug: 'poisoned' }]);
  });

  it('renders the empty message when the catalog has no entries', async () => {
    TestBed.resetTestingModule();
    await setup([]);
    const emptyFixture = TestBed.createComponent(ConditionsCatalogPage);
    emptyFixture.detectChanges();
    expect(emptyFixture.nativeElement.textContent).toContain('Nessuna condizione nel catalogo');
  });

  // --- 7.3 polarity + severity filters (default all, AND-combined) ---

  describe('polarity + severity filters', () => {
    const POISONED = { slug: 'poisoned', name: 'Avvelenato', defaultSeverity: 'major', polarity: 'negative' };
    const FATIGUED = { slug: 'fatigued', name: 'Affaticato', defaultSeverity: 'minor', polarity: 'negative' };
    const WELL_FED = { slug: 'well-fed', name: 'Ben Nutrito', defaultSeverity: 'minor', polarity: 'positive' };
    const RESTED = { slug: 'rested', name: 'Riposato', defaultSeverity: 'major', polarity: 'positive' };

    async function withEntries(entries: unknown[]) {
      TestBed.resetTestingModule();
      await setup(entries);
      const f = TestBed.createComponent(ConditionsCatalogPage);
      f.detectChanges();
      return f.componentInstance as ConditionsCatalogPage;
    }

    const slugs = (c: ConditionsCatalogPage) =>
      (c['filteredEntries']() ?? []).map((e) => e.slug).sort();

    it('defaults to all entries', async () => {
      const c = await withEntries([POISONED, FATIGUED, WELL_FED, RESTED]);
      expect(slugs(c)).toEqual(['fatigued', 'poisoned', 'rested', 'well-fed']);
    });

    it('filters by polarity, restoring all when the selection is cleared', async () => {
      const c = await withEntries([POISONED, FATIGUED, WELL_FED, RESTED]);
      c['polarityFilter'].set(['negative']);
      expect(slugs(c)).toEqual(['fatigued', 'poisoned']);
      c['polarityFilter'].set([]);
      expect(slugs(c)).toEqual(['fatigued', 'poisoned', 'rested', 'well-fed']);
    });

    it('filters by severity', async () => {
      const c = await withEntries([POISONED, FATIGUED, WELL_FED, RESTED]);
      c['severityFilter'].set(['major']);
      expect(slugs(c)).toEqual(['poisoned', 'rested']);
    });

    it('ORs multiple values within one filter', async () => {
      const c = await withEntries([POISONED, FATIGUED, WELL_FED, RESTED]);
      c['severityFilter'].set(['minor', 'major']);
      expect(slugs(c)).toEqual(['fatigued', 'poisoned', 'rested', 'well-fed']);
    });

    it('ANDs polarity and severity together', async () => {
      const c = await withEntries([POISONED, FATIGUED, WELL_FED, RESTED]);
      c['polarityFilter'].set(['negative']);
      c['severityFilter'].set(['minor']);
      expect(slugs(c)).toEqual(['fatigued']);
    });
  });

  // --- 7.2 sortable table defaults to name ascending on load ---

  it('renders rows ascending by name on load', async () => {
    TestBed.resetTestingModule();
    await setup([
      { slug: 'poisoned', name: 'Avvelenato', defaultSeverity: 'major', polarity: 'negative' },
      { slug: 'rested', name: 'Riposato', defaultSeverity: 'minor', polarity: 'positive' },
      { slug: 'fatigued', name: 'Affaticato', defaultSeverity: 'minor', polarity: 'negative' },
    ]);
    const f = TestBed.createComponent(ConditionsCatalogPage);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();

    const names = Array.from(
      f.nativeElement.querySelectorAll('tbody tr td:nth-child(2)') as NodeListOf<HTMLElement>,
    ).map((td) => td.textContent?.trim());
    expect(names).toEqual(['Affaticato', 'Avvelenato', 'Riposato']);
  });
});
