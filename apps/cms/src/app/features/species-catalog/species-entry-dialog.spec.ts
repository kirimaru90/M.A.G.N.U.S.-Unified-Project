import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpeciesEntryDialogComponent } from './species-entry-dialog';
import { SpeciesCatalogApiService } from '../../core/species-catalog/species-catalog-api.service';
import type { SpeciesCatalogEntryDto } from '../../core/species-catalog/species-catalog.types';

const GHOUL: SpeciesCatalogEntryDto = {
  slug: 'ghoul',
  name: 'Ghoul',
  permesso: 'Immune alle radiazioni.',
  svantaggio: 'Inviso agli umani.',
  tagSkillBudget: 3,
  margin: 4,
};

/** GHOUL's update `entry` payload (no slug), with overrides. */
const ghoulEntry = (overrides: Partial<SpeciesCatalogEntryDto> = {}) => ({
  name: GHOUL.name,
  permesso: GHOUL.permesso,
  svantaggio: GHOUL.svantaggio,
  tagSkillBudget: GHOUL.tagSkillBudget,
  margin: GHOUL.margin,
  description: undefined,
  ...overrides,
});

describe('SpeciesEntryDialogComponent', () => {
  let fixture: ComponentFixture<SpeciesEntryDialogComponent>;
  let component: SpeciesEntryDialogComponent;
  let patchSpy: ReturnType<typeof vi.fn>;
  let saved: string[];

  beforeEach(async () => {
    patchSpy = vi.fn().mockReturnValue(of({ ignored: [] }));
    await TestBed.configureTestingModule({
      imports: [SpeciesEntryDialogComponent],
      providers: [{ provide: SpeciesCatalogApiService, useValue: { patchSchema: patchSpy } }],
    }).compileComponents();
    fixture = TestBed.createComponent(SpeciesEntryDialogComponent);
    component = fixture.componentInstance;
    saved = [];
    component.saved.subscribe((k) => saved.push(k));
  });

  function open(entry: SpeciesCatalogEntryDto | null) {
    fixture.componentRef.setInput('entry', entry);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  }

  const form = () => component['form'];

  it('starts a new species with budget 3 and margin 4, slug editable', () => {
    open(null);
    expect(form().getRawValue()).toMatchObject({ tagSkillBudget: 3, margin: 4 });
    expect(form().controls.slug.enabled).toBe(true);
  });

  it('creates with an add op', () => {
    open(null);
    form().patchValue({ slug: 'synth', name: 'Sintetico', permesso: 'a', svantaggio: 'b' });
    component['submit']();

    expect(patchSpy).toHaveBeenCalledWith([
      {
        action: 'add',
        slug: 'synth',
        entry: { name: 'Sintetico', permesso: 'a', svantaggio: 'b', tagSkillBudget: 3, margin: 4, description: undefined },
      },
    ]);
    expect(saved).toEqual(['created']);
  });

  it('shows the slug read-only when editing', () => {
    open(GHOUL);
    expect(form().controls.slug.disabled).toBe(true);
    expect((document.querySelector('#spe-slug') as HTMLInputElement).disabled).toBe(true);
  });

  it('re-enables the slug when reopened for create', () => {
    open(GHOUL);
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    open(null);
    expect(form().controls.slug.enabled).toBe(true);
  });

  it("changes a species' drawback copy via an update op", () => {
    open(GHOUL);
    form().controls.svantaggio.setValue('Rischio di selvatichire.');
    component['submit']();

    expect(patchSpy).toHaveBeenCalledWith([
      { action: 'update', slug: 'ghoul', entry: ghoulEntry({ svantaggio: 'Rischio di selvatichire.' }) },
    ]);
    expect(saved).toEqual(['updated']);
  });

  it("changes a species' tag-skill budget via an update op", () => {
    open(GHOUL);
    form().controls.tagSkillBudget.setValue(5);
    component['submit']();

    expect(patchSpy).toHaveBeenCalledWith([{ action: 'update', slug: 'ghoul', entry: ghoulEntry({ tagSkillBudget: 5 }) }]);
  });

  it("changes a species' health margin via an update op", () => {
    open(GHOUL);
    form().controls.margin.setValue(6);
    component['submit']();

    expect(patchSpy).toHaveBeenCalledWith([{ action: 'update', slug: 'ghoul', entry: ghoulEntry({ margin: 6 }) }]);
  });

  it('renaming the display name sends an update only, never a rename', () => {
    open(GHOUL);
    form().controls.name.setValue('Ghoul ferale');
    component['submit']();

    const ops = patchSpy.mock.calls[0][0] as { action: string; slug: string }[];
    expect(ops).toEqual([{ action: 'update', slug: 'ghoul', entry: ghoulEntry({ name: 'Ghoul ferale' }) }]);
    expect(ops.some((op) => op.action === 'rename')).toBe(false);
  });

  it('rejects an add missing required copy', () => {
    open(null);
    form().patchValue({ slug: 'synth', name: 'Sintetico' });
    component['submit']();

    expect(patchSpy).not.toHaveBeenCalled();
    expect(component['error']()).toBe('Slug, nome, permesso e svantaggio sono obbligatori');
  });

  it.each([0, -1, 1.5])('rejects a tagSkillBudget of %s client-side', (budget) => {
    open(null);
    form().patchValue({ slug: 'synth', name: 'Sintetico', permesso: 'a', svantaggio: 'b', tagSkillBudget: budget });
    component['submit']();

    expect(patchSpy).not.toHaveBeenCalled();
    expect(component['error']()).toBe('Il budget maestria deve essere un intero positivo');
  });

  it.each([0, -1])('rejects a margin of %s client-side', (margin) => {
    open(null);
    form().patchValue({ slug: 'synth', name: 'Sintetico', permesso: 'a', svantaggio: 'b', margin });
    component['submit']();

    expect(patchSpy).not.toHaveBeenCalled();
    expect(component['error']()).toBe('Il margine salute deve essere un intero positivo');
  });

  it('keeps the values and names the slug on a duplicate-slug 409', () => {
    patchSpy.mockReturnValueOnce(throwError(() => ({ status: 409 })));
    open(null);
    form().patchValue({ slug: 'ghoul', name: 'Ghoul 2', permesso: 'a', svantaggio: 'b' });
    component['submit']();

    expect(component['error']()).toBe('Slug "ghoul" già esistente');
    expect(form().getRawValue()).toMatchObject({ slug: 'ghoul', name: 'Ghoul 2' });
    expect(saved).toEqual([]);
  });
});
