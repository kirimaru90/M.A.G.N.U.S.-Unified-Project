import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmationService, MessageService } from 'primeng/api';
import { EquipmentCatalogPage } from './equipment-catalog-page';
import { EquipmentCatalogApiService } from '../../core/equipment-catalog/equipment-catalog-api.service';
import type { EquipmentCatalogEntryDto } from '../../core/equipment-catalog/equipment-catalog.types';

const PISTOL: EquipmentCatalogEntryDto = {
  slug: 'pistola-10mm',
  name: 'Pistola 10mm',
  kind: 'weapon',
  tags: [{ name: 'AFFIDABILE', type: 'core' }],
  isStarter: true,
};

const STIMPACK: EquipmentCatalogEntryDto = {
  slug: 'stimpack',
  name: 'Stimpack',
  kind: 'consumable',
  tags: [],
  isStarter: true,
};

const CHIAVE: EquipmentCatalogEntryDto = {
  slug: 'chiave-inglese',
  name: 'Chiave inglese',
  kind: 'misc',
  tags: [],
  description: 'Attrezzo',
  isStarter: false,
};

const GIUBBOTTO: EquipmentCatalogEntryDto = {
  slug: 'giubbotto-di-pelle',
  name: 'Giubbotto di Pelle',
  kind: 'armor',
  tags: [{ name: 'CUOIO', type: 'core' }],
  isStarter: false,
};

describe('EquipmentCatalogPage', () => {
  let fixture: ComponentFixture<EquipmentCatalogPage>;
  let component: EquipmentCatalogPage;
  let listSpy: ReturnType<typeof vi.fn>;
  let patchSpy: ReturnType<typeof vi.fn>;

  function setup(entries: unknown[] = []) {
    listSpy = vi.fn().mockReturnValue(of(entries));
    patchSpy = vi.fn().mockReturnValue(of({ ignored: [] }));

    return TestBed.configureTestingModule({
      imports: [EquipmentCatalogPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: EquipmentCatalogApiService, useValue: { list: listSpy, patchSchema: patchSpy } },
        ConfirmationService,
        MessageService,
      ],
    }).compileComponents();
  }

  beforeEach(async () => {
    await setup([PISTOL]);
    fixture = TestBed.createComponent(EquipmentCatalogPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the catalog from a single GET on init', () => {
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(component['entries']()).toEqual([PISTOL]);
  });

  // 7.1 — a consumable sends a description and no quantity/tags.
  // 7.1 — the consumable/misc form shows a description field, not a quantity field.
  // Starter is edited only within row-edit; promoting an entry rides the update op.
  it('renders the starter flag as a read-only indicator on the display row (no checkbox)', () => {
    const cell: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="starter-pistola-10mm"]',
    );
    expect(cell).toBeTruthy();
    // It is a static pill, not an interactive checkbox.
    expect(cell.tagName).not.toBe('INPUT');
    expect(cell.querySelector('input')).toBeNull();
  });

  // 7.1 — editing a consumable sends its description, never a quantity.
  it('renders read-only rows with no inline inputs', () => {
    expect(fixture.nativeElement.querySelector('p-table tbody input')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Pistola 10mm');
  });

  it('opens the dialog empty for create', () => {
    component['openCreate']();
    expect(component['dialogVisible']()).toBe(true);
    expect(component['dialogEntry']()).toBeNull();
  });

  it('opens the dialog with the row entry for edit', () => {
    const entry = PISTOL;
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

  it('deletes a template via a delete op after confirmation, with no in-use warning', () => {
    const confirmationService = TestBed.inject(ConfirmationService);
    const confirmSpy = vi.spyOn(confirmationService, 'confirm').mockImplementation((opts) => {
      opts.accept?.();
      return confirmationService;
    });

    component['confirmDelete'](PISTOL);
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([{ action: 'delete', slug: 'pistola-10mm' }]);
    // characters hold copies, so the dialog never mentions existing inventories
    expect(confirmSpy.mock.calls[0][0].message).not.toContain('personagg');
  });

  // 3.T.3
  it('renders the empty message when the catalog has no entries', async () => {
    TestBed.resetTestingModule();
    await setup([]);
    const emptyFixture = TestBed.createComponent(EquipmentCatalogPage);
    emptyFixture.detectChanges();
    expect(emptyFixture.nativeElement.textContent).toContain('Nessun equipaggiamento nel catalogo');
  });

  // --- misc-items-catalog: misc (Vari) kind ---

  it('does not render the starter toggle for a misc entry row', async () => {
    TestBed.resetTestingModule();
    await setup([CHIAVE]);
    const f = TestBed.createComponent(EquipmentCatalogPage);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid="starter-chiave-inglese"]')).toBeNull();
    // a non-misc row still shows its toggle
    TestBed.resetTestingModule();
    await setup([PISTOL]);
    const f2 = TestBed.createComponent(EquipmentCatalogPage);
    f2.detectChanges();
    expect(f2.nativeElement.querySelector('[data-testid="starter-pistola-10mm"]')).toBeTruthy();
  });

  // --- 7.2 sortable table defaults to name ascending on load ---

  it('renders rows ascending by name on load', async () => {
    TestBed.resetTestingModule();
    // Deliberately unsorted input; the table defaults to name-ascending.
    await setup([STIMPACK, CHIAVE, PISTOL]);
    const f = TestBed.createComponent(EquipmentCatalogPage);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();

    const names = Array.from(
      f.nativeElement.querySelectorAll('tbody tr td:nth-child(2)') as NodeListOf<HTMLElement>,
    ).map((td) => td.textContent?.trim());
    expect(names).toEqual(['Chiave inglese', 'Pistola 10mm', 'Stimpack']);
  });

  // --- misc-items-catalog: filter bar ---

  describe('filter bar', () => {
    async function withEntries(entries: EquipmentCatalogEntryDto[]) {
      TestBed.resetTestingModule();
      await setup(entries);
      const f = TestBed.createComponent(EquipmentCatalogPage);
      f.detectChanges();
      return f.componentInstance as EquipmentCatalogPage;
    }

    const slugs = (c: EquipmentCatalogPage) =>
      (c['filteredEntries']() ?? []).map((e) => e.slug);

    it('narrows by name substring, case-insensitively', async () => {
      const c = await withEntries([PISTOL, STIMPACK, CHIAVE]);
      c['nameFilter'].set('chiave');
      expect(slugs(c)).toEqual(['chiave-inglese']);
      c['nameFilter'].set('PISTOLA');
      expect(slugs(c)).toEqual(['pistola-10mm']);
    });

    it('narrows to starters when the checkbox is set', async () => {
      const c = await withEntries([PISTOL, STIMPACK, CHIAVE, GIUBBOTTO]);
      c['starterFilter'].set(true);
      expect(slugs(c).sort()).toEqual(['pistola-10mm', 'stimpack']);
    });

    it('narrows by the kind multi-select and restores all when cleared', async () => {
      const c = await withEntries([PISTOL, STIMPACK, CHIAVE, GIUBBOTTO]);
      c['kindFilter'].set(['weapon', 'misc']);
      expect(slugs(c).sort()).toEqual(['chiave-inglese', 'pistola-10mm']);
      c['kindFilter'].set(['misc']);
      expect(slugs(c)).toEqual(['chiave-inglese']);
      c['kindFilter'].set([]);
      expect(slugs(c).sort()).toEqual([
        'chiave-inglese',
        'giubbotto-di-pelle',
        'pistola-10mm',
        'stimpack',
      ]);
    });

    it('ANDs all active filters together', async () => {
      const c = await withEntries([PISTOL, STIMPACK, CHIAVE, GIUBBOTTO]);
      c['starterFilter'].set(true);
      c['kindFilter'].set(['weapon']);
      expect(slugs(c)).toEqual(['pistola-10mm']);
    });

    it('offers the distinct catalog tags as tag-filter options, sorted', async () => {
      const c = await withEntries([PISTOL, GIUBBOTTO, STIMPACK, CHIAVE]);
      // PISTOL → AFFIDABILE, GIUBBOTTO → CUOIO; consumable/misc carry none.
      expect(c['availableTags']()).toEqual(['AFFIDABILE', 'CUOIO']);
    });

    it('filters by tag, matching entries carrying any selected tag (OR)', async () => {
      const c = await withEntries([PISTOL, GIUBBOTTO, STIMPACK, CHIAVE]);
      c['tagFilter'].set(['AFFIDABILE']);
      expect(slugs(c)).toEqual(['pistola-10mm']);
      c['tagFilter'].set(['AFFIDABILE', 'CUOIO']);
      expect(slugs(c).sort()).toEqual(['giubbotto-di-pelle', 'pistola-10mm']);
    });

    it('ANDs the tag filter with the kind filter', async () => {
      const c = await withEntries([PISTOL, GIUBBOTTO, STIMPACK, CHIAVE]);
      c['kindFilter'].set(['weapon']);
      c['tagFilter'].set(['AFFIDABILE', 'CUOIO']);
      expect(slugs(c)).toEqual(['pistola-10mm']);
    });
  });
});
