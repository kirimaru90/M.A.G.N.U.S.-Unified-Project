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

  it('adds a starter weapon template carrying kind, isStarter and both tags', () => {
    component['showAddRow']();
    fixture.detectChanges();
    component['draft'] = {
      slug: 'fucile-da-caccia',
      name: 'Fucile da Caccia',
      kind: 'weapon',
      tags: [
        { name: 'PROIETTILI', type: 'core' },
        { name: 'LUNGA GITTATA', type: 'extra' },
      ],
      isStarter: true,
      description: '',
    };
    component['submitAdd']();
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([
      {
        action: 'add',
        slug: 'fucile-da-caccia',
        entry: {
          name: 'Fucile da Caccia',
          kind: 'weapon',
          isStarter: true,
          description: undefined,
          tags: [
            { name: 'PROIETTILI', type: 'core' },
            { name: 'LUNGA GITTATA', type: 'extra' },
          ],
        },
      },
    ]);
  });

  // 7.1 — a consumable sends a description and no quantity/tags.
  it('sends a description and no defaultQuantity or tags for a consumable', () => {
    component['showAddRow']();
    component['draft'] = {
      slug: 'radaway',
      name: 'RadAway',
      kind: 'consumable',
      tags: [],
      isStarter: false,
      description: 'Rimuove radiazioni',
    };
    component['submitAdd']();
    fixture.detectChanges();

    const [[ops]] = patchSpy.mock.calls as [[{ entry: Record<string, unknown> }[]]];
    expect(ops[0].entry).toEqual({
      name: 'RadAway',
      kind: 'consumable',
      isStarter: false,
      description: 'Rimuove radiazioni',
    });
    expect(ops[0].entry).not.toHaveProperty('tags');
    expect(ops[0].entry).not.toHaveProperty('defaultQuantity');
  });

  it('presents the tag editor for weapon/armor and the description editor for consumable/misc', () => {
    component['showAddRow']();

    component['draft'].kind = 'weapon';
    expect(component['draftIsTagged']()).toBe(true);

    component['draft'].kind = 'armor';
    expect(component['draftIsTagged']()).toBe(true);

    component['draft'].kind = 'consumable';
    expect(component['draftIsTagged']()).toBe(false);

    component['draft'].kind = 'misc';
    expect(component['draftIsTagged']()).toBe(false);
  });

  // 7.1 — the consumable/misc form shows a description field, not a quantity field.
  it('renders the tag editor for a weapon draft and the description field for a consumable', async () => {
    const selectKind = async (kind: string) => {
      const select: HTMLSelectElement = fixture.nativeElement.querySelector('select.bo-select');
      select.value = kind;
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    component['showAddRow']();
    fixture.detectChanges();
    await fixture.whenStable();

    await selectKind('weapon');
    expect(component['draft'].kind).toBe('weapon');
    expect(fixture.nativeElement.querySelector('[data-testid="tag-editor"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="description"]')).toBeNull();

    await selectKind('consumable');
    expect(component['draft'].kind).toBe('consumable');
    expect(fixture.nativeElement.querySelector('[data-testid="tag-editor"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="description"]')).toBeTruthy();
    // No quantity field remains.
    expect(fixture.nativeElement.querySelector('[data-testid="default-quantity"]')).toBeNull();
  });

  it('adds and removes draft tags', () => {
    component['showAddRow']();
    component['addTag']('core');
    component['addTag']('extra');
    expect(component['draft'].tags).toEqual([
      { name: '', type: 'core' },
      { name: '', type: 'extra' },
    ]);

    component['removeTag'](0);
    expect(component['draft'].tags).toEqual([{ name: '', type: 'extra' }]);
  });

  it('rejects a tag with a blank name', () => {
    component['showAddRow']();
    component['draft'] = {
      slug: 'x',
      name: 'X',
      kind: 'weapon',
      tags: [{ name: '', type: 'core' }],
      isStarter: false,
      description: '',
    };
    component['submitAdd']();
    fixture.detectChanges();

    expect(patchSpy).not.toHaveBeenCalled();
    expect(component['rowError']()).toBe('Ogni tag deve avere un nome');
  });

  // Starter is edited only within row-edit; promoting an entry rides the update op.
  it('promotes an entry to a starter within row edit via an update op carrying isStarter', () => {
    const coltello: EquipmentCatalogEntryDto = {
      slug: 'coltello',
      name: 'Coltello',
      kind: 'weapon',
      tags: [],
      isStarter: false,
    };
    component['startEdit'](coltello);
    fixture.detectChanges();
    component['draft'].isStarter = true;
    component['submitEdit'](coltello);
    fixture.detectChanges();

    const [[ops]] = patchSpy.mock.calls as [[{ action: string; entry: Record<string, unknown> }[]]];
    expect(ops[0].action).toBe('update');
    expect(ops[0].entry).toMatchObject({ isStarter: true });
    // and the list is refetched so the row reflects the new flag
    expect(listSpy).toHaveBeenCalledTimes(2);
  });

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
  it('edits a consumable via an update op carrying its description', () => {
    component['startEdit'](STIMPACK);
    fixture.detectChanges();
    component['draft'].description = 'Cura ferite';
    component['submitEdit'](STIMPACK);
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([
      {
        action: 'update',
        slug: 'stimpack',
        entry: {
          name: 'Stimpack',
          kind: 'consumable',
          isStarter: true,
          description: 'Cura ferite',
        },
      },
    ]);
    const [[ops]] = patchSpy.mock.calls as [[{ entry: Record<string, unknown> }[]]];
    expect(ops[0].entry).not.toHaveProperty('defaultQuantity');
  });

  it('renames a template via a single rename op when only the slug changes', () => {
    component['startEdit'](PISTOL);
    fixture.detectChanges();
    component['draft'].slug = 'pistola-10';
    component['submitEdit'](PISTOL);
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([
      { action: 'rename', slug: 'pistola-10mm', rename: 'pistola-10' },
    ]);
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
  it('surfaces a 409 duplicate-slug error inline without discarding pending edits', () => {
    patchSpy.mockReturnValueOnce({
      subscribe: ({ error }: { error: (e: unknown) => void }) => error({ status: 409 }),
    });
    component['showAddRow']();
    component['draft'] = {
      slug: 'pistola-10mm',
      name: 'Pistola 10mm',
      kind: 'weapon',
      tags: [],
      isStarter: true,
      description: '',
    };
    component['submitAdd']();
    fixture.detectChanges();

    expect(component['rowError']()).toBe('Slug già esistente');
    expect(component['addRowVisible']()).toBe(true);
    expect(component['draft'].slug).toBe('pistola-10mm');
  });

  it('renders the empty message when the catalog has no entries', async () => {
    TestBed.resetTestingModule();
    await setup([]);
    const emptyFixture = TestBed.createComponent(EquipmentCatalogPage);
    emptyFixture.detectChanges();
    expect(emptyFixture.nativeElement.textContent).toContain('Nessun equipaggiamento nel catalogo');
  });

  // --- misc-items-catalog: misc (Vari) kind ---

  it('treats a misc draft as untagged so the description editor shows, not tags', () => {
    component['showAddRow']();
    component['draft'].kind = 'misc';
    expect(component['draftIsTagged']()).toBe(false);
  });

  it('offers a Vari option in the kind selector', () => {
    component['showAddRow']();
    fixture.detectChanges();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select.bo-select');
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('misc');
    const variOption = Array.from(select.options).find((o) => o.value === 'misc');
    expect(variOption?.textContent?.trim()).toBe('Vari');
  });

  it('adds a misc (Vari) template with a description and no defaultQuantity or tags', () => {
    component['showAddRow']();
    component['draft'] = {
      slug: 'chiave-inglese',
      name: 'Chiave inglese',
      kind: 'misc',
      tags: [],
      isStarter: false,
      description: 'Attrezzo',
    };
    component['submitAdd']();
    fixture.detectChanges();

    const [[ops]] = patchSpy.mock.calls as [[{ entry: Record<string, unknown> }[]]];
    expect(ops[0]).toMatchObject({ action: 'add', slug: 'chiave-inglese' });
    expect(ops[0].entry).toEqual({
      name: 'Chiave inglese',
      kind: 'misc',
      isStarter: false,
      description: 'Attrezzo',
    });
    expect(ops[0].entry).not.toHaveProperty('tags');
    expect(ops[0].entry).not.toHaveProperty('defaultQuantity');
  });

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
