import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EquipmentEntryDialogComponent } from './equipment-entry-dialog';
import { EquipmentCatalogApiService } from '../../core/equipment-catalog/equipment-catalog-api.service';
import type { EquipmentCatalogEntryDto } from '../../core/equipment-catalog/equipment-catalog.types';

const PISTOL: EquipmentCatalogEntryDto = {
  slug: 'pistola-10mm',
  name: 'Pistola 10mm',
  kind: 'weapon',
  tags: [{ name: 'AFFIDABILE', type: 'core' }],
  isStarter: false,
};

const STIMPACK: EquipmentCatalogEntryDto = {
  slug: 'stimpack',
  name: 'Stimpack',
  kind: 'consumable',
  tags: [],
  description: 'Cura',
  isStarter: true,
};

describe('EquipmentEntryDialogComponent', () => {
  let fixture: ComponentFixture<EquipmentEntryDialogComponent>;
  let component: EquipmentEntryDialogComponent;
  let patchSpy: ReturnType<typeof vi.fn>;
  let saved: string[];

  beforeEach(async () => {
    patchSpy = vi.fn().mockReturnValue(of({ ignored: [] }));
    await TestBed.configureTestingModule({
      imports: [EquipmentEntryDialogComponent],
      providers: [{ provide: EquipmentCatalogApiService, useValue: { patchSchema: patchSpy } }],
    }).compileComponents();
    fixture = TestBed.createComponent(EquipmentEntryDialogComponent);
    component = fixture.componentInstance;
    saved = [];
    component.saved.subscribe((k) => saved.push(k));
  });

  function open(entry: EquipmentCatalogEntryDto | null) {
    fixture.componentRef.setInput('entry', entry);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  }

  const form = () => component['form'];
  const q = (sel: string) => document.querySelector(sel);
  const setKind = (kind: EquipmentCatalogEntryDto['kind']) => {
    form().controls.kind.setValue(kind);
    fixture.detectChanges();
  };

  it('adds a starter weapon template carrying kind, isStarter and both tags', () => {
    open(null);
    form().patchValue({ slug: 'fucile', name: 'Fucile', isStarter: true });
    component['addTag']('core');
    component['addTag']('extra');
    form().controls.tags.at(0).controls.name.setValue('AFFIDABILE');
    form().controls.tags.at(1).controls.name.setValue('PROIETTILI');
    component['submit']();

    expect(patchSpy).toHaveBeenCalledWith([
      {
        action: 'add',
        slug: 'fucile',
        entry: {
          name: 'Fucile',
          kind: 'weapon',
          isStarter: true,
          description: undefined,
          tags: [
            { name: 'AFFIDABILE', type: 'core' },
            { name: 'PROIETTILI', type: 'extra' },
          ],
        },
      },
    ]);
    expect(saved).toEqual(['created']);
  });

  it('presents the tag editor for weapon/armor and the description field for consumable/misc', () => {
    open(null);
    expect(q('[data-testid="tag-editor"]')).toBeTruthy();
    expect(q('[data-testid="description"]')).toBeNull();

    setKind('armor');
    expect(q('[data-testid="tag-editor"]')).toBeTruthy();

    setKind('consumable');
    expect(q('[data-testid="tag-editor"]')).toBeNull();
    expect(q('[data-testid="description"]')).toBeTruthy();

    setKind('misc');
    expect(q('[data-testid="tag-editor"]')).toBeNull();
    expect(q('[data-testid="description"]')).toBeTruthy();
  });

  it('never presents a quantity field', () => {
    open(null);
    setKind('consumable');
    expect(document.body.textContent?.toLowerCase()).not.toContain('quantit');
  });

  it('sends a description and no tags for a consumable', () => {
    open(null);
    form().patchValue({ slug: 'radaway', name: 'RadAway', kind: 'consumable', description: 'Rimuove rad' });
    component['addTag']('core');
    form().controls.tags.at(0).controls.name.setValue('IGNORATO');
    component['submit']();

    const entry = patchSpy.mock.calls[0][0][0].entry;
    expect(entry).toEqual({ name: 'RadAway', kind: 'consumable', isStarter: false, description: 'Rimuove rad' });
    expect('tags' in entry).toBe(false);
    expect('defaultQuantity' in entry).toBe(false);
  });

  it('offers a Vari option in the kind selector', () => {
    open(null);
    const select = q('[data-testid="kind"]') as HTMLSelectElement;
    const vari = Array.from(select.options).find((o) => o.value === 'misc');
    expect(vari?.textContent?.trim()).toBe('Vari');
  });

  it('adds a misc (Vari) template with a description and no starter editor', () => {
    open(null);
    setKind('misc');
    expect(q('[data-testid="starter-editor"]')).toBeNull();

    form().patchValue({ slug: 'chiave', name: 'Chiave inglese', description: 'Attrezzo' });
    component['submit']();

    expect(patchSpy).toHaveBeenCalledWith([
      {
        action: 'add',
        slug: 'chiave',
        entry: { name: 'Chiave inglese', kind: 'misc', isStarter: false, description: 'Attrezzo' },
      },
    ]);
  });

  it('never sends isStarter for a misc template, even if it was set before switching kind', () => {
    open({ ...PISTOL, isStarter: true });
    setKind('misc');
    component['submit']();

    expect(patchSpy.mock.calls[0][0][0].entry.isStarter).toBe(false);
  });

  it('shows the starter editor for non-misc kinds', () => {
    open(null);
    expect(q('[data-testid="starter-editor"]')).toBeTruthy();
  });

  it('adds and removes tags', () => {
    open(null);
    component['addTag']('core');
    component['addTag']('extra');
    expect(form().controls.tags.getRawValue()).toEqual([
      { name: '', type: 'core' },
      { name: '', type: 'extra' },
    ]);
    component['removeTag'](0);
    expect(form().controls.tags.getRawValue()).toEqual([{ name: '', type: 'extra' }]);
  });

  it('rejects a tag with a blank name', () => {
    open(null);
    form().patchValue({ slug: 'fucile', name: 'Fucile' });
    component['addTag']('core');
    component['submit']();

    expect(patchSpy).not.toHaveBeenCalled();
    expect(component['error']()).toBe('Ogni tag deve avere un nome');
  });

  it('pre-fills tags when editing and does not share them with the entry', () => {
    open(PISTOL);
    expect(form().controls.tags.getRawValue()).toEqual([{ name: 'AFFIDABILE', type: 'core' }]);
    form().controls.tags.at(0).controls.name.setValue('CAMBIATO');
    expect(PISTOL.tags![0].name).toBe('AFFIDABILE');
  });

  it('drops the previous entry tags when reopened for create', () => {
    open(PISTOL);
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    open(null);
    expect(form().controls.tags.length).toBe(0);
  });

  it('promotes an entry to a starter via an update op carrying isStarter', () => {
    open(PISTOL);
    form().controls.isStarter.setValue(true);
    component['submit']();

    expect(patchSpy).toHaveBeenCalledWith([
      {
        action: 'update',
        slug: 'pistola-10mm',
        entry: {
          name: 'Pistola 10mm',
          kind: 'weapon',
          isStarter: true,
          description: undefined,
          tags: [{ name: 'AFFIDABILE', type: 'core' }],
        },
      },
    ]);
    expect(saved).toEqual(['updated']);
  });

  it('edits a consumable via an update op carrying its description', () => {
    open(STIMPACK);
    form().controls.description.setValue('Cura 2');
    component['submit']();

    expect(patchSpy).toHaveBeenCalledWith([
      {
        action: 'update',
        slug: 'stimpack',
        entry: { name: 'Stimpack', kind: 'consumable', isStarter: true, description: 'Cura 2' },
      },
    ]);
  });

  it('renames then updates when slug and name change', () => {
    open(PISTOL);
    form().patchValue({ slug: 'pistola-10', name: 'Pistola 10' });
    component['submit']();

    const ops = patchSpy.mock.calls[0][0];
    expect(ops[0]).toEqual({ action: 'rename', slug: 'pistola-10mm', rename: 'pistola-10' });
    expect(ops[1]).toMatchObject({ action: 'update', slug: 'pistola-10', entry: { name: 'Pistola 10' } });
  });

  it('keeps the values and names the slug on a 409', () => {
    patchSpy.mockReturnValueOnce(throwError(() => ({ status: 409 })));
    open(null);
    form().patchValue({ slug: 'pistola-10mm', name: 'Pistola' });
    component['addTag']('core');
    form().controls.tags.at(0).controls.name.setValue('AFFIDABILE');
    component['submit']();

    expect(component['error']()).toBe('Slug "pistola-10mm" già esistente');
    expect(form().controls.tags.getRawValue()).toEqual([{ name: 'AFFIDABILE', type: 'core' }]);
    expect(saved).toEqual([]);
  });
});
