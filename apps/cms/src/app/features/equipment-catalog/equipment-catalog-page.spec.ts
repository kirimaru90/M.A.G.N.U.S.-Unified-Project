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
  defaultQuantity: 2,
  isStarter: true,
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
      defaultQuantity: 1,
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

  // 3.T.2 — a consumable sends defaultQuantity and no tags; the API 400s on tags.
  it('sends defaultQuantity and no tags for a consumable', () => {
    component['showAddRow']();
    component['draft'] = {
      slug: 'radaway',
      name: 'RadAway',
      kind: 'consumable',
      tags: [],
      defaultQuantity: 3,
      isStarter: false,
      description: '',
    };
    component['submitAdd']();
    fixture.detectChanges();

    const [[ops]] = patchSpy.mock.calls as [[{ entry: Record<string, unknown> }[]]];
    expect(ops[0].entry).toEqual({
      name: 'RadAway',
      kind: 'consumable',
      isStarter: false,
      description: undefined,
      defaultQuantity: 3,
    });
    expect(ops[0].entry).not.toHaveProperty('tags');
  });

  it('presents the tag editor for weapon/armor and defaultQuantity for consumable', () => {
    component['showAddRow']();

    component['draft'].kind = 'weapon';
    expect(component['draftIsTagged']()).toBe(true);

    component['draft'].kind = 'armor';
    expect(component['draftIsTagged']()).toBe(true);

    component['draft'].kind = 'consumable';
    expect(component['draftIsTagged']()).toBe(false);
  });

  it('renders the tag editor for a weapon draft and the quantity field for a consumable', async () => {
    // The `@if` lives inside PrimeNG's footer template, whose view is checked by
    // the table, not by this component — so drive the real <select> rather than
    // mutating `draft` and marking only this component dirty.
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
    expect(fixture.nativeElement.querySelector('[data-testid="default-quantity"]')).toBeNull();

    await selectKind('consumable');
    expect(component['draft'].kind).toBe('consumable');
    expect(fixture.nativeElement.querySelector('[data-testid="tag-editor"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="default-quantity"]')).toBeTruthy();
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
      defaultQuantity: 0,
      isStarter: false,
      description: '',
    };
    component['submitAdd']();
    fixture.detectChanges();

    expect(patchSpy).not.toHaveBeenCalled();
    expect(component['rowError']()).toBe('Ogni tag deve avere un nome');
  });

  it('rejects a negative defaultQuantity', () => {
    component['showAddRow']();
    component['draft'] = {
      slug: 'x',
      name: 'X',
      kind: 'consumable',
      tags: [],
      defaultQuantity: -1,
      isStarter: false,
      description: '',
    };
    component['submitAdd']();
    fixture.detectChanges();

    expect(patchSpy).not.toHaveBeenCalled();
    expect(component['rowError']()).toBe('La quantità deve essere un intero non negativo');
  });

  // 3.T.2 — the isStarter toggle round-trips through an update op.
  it('toggles isStarter in place via an update op carrying only the flag', () => {
    const coltello: EquipmentCatalogEntryDto = {
      slug: 'coltello',
      name: 'Coltello',
      kind: 'weapon',
      tags: [],
      isStarter: false,
    };
    component['toggleStarter'](coltello);
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([
      { action: 'update', slug: 'coltello', entry: { isStarter: true } },
    ]);
    // and the list is refetched so the row reflects the new flag
    expect(listSpy).toHaveBeenCalledTimes(2);
  });

  it('toggles isStarter back off', () => {
    component['toggleStarter'](PISTOL);
    expect(patchSpy).toHaveBeenCalledWith([
      { action: 'update', slug: 'pistola-10mm', entry: { isStarter: false } },
    ]);
  });

  it('edits a consumable via an update op with defaultQuantity', () => {
    component['startEdit'](STIMPACK);
    fixture.detectChanges();
    component['draft'].defaultQuantity = 5;
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
          description: undefined,
          defaultQuantity: 5,
        },
      },
    ]);
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
      defaultQuantity: 0,
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
});
