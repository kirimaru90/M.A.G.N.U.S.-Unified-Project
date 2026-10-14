import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TalentEntryDialogComponent } from './talent-entry-dialog';
import { TalentsCatalogApiService } from '../../core/talents-catalog/talents-catalog-api.service';
import type { TalentCatalogEntryDto } from '../../core/talents-catalog/talents-catalog.types';

const AGILITY = 5;
const ENDURANCE = 2;

describe('TalentEntryDialogComponent', () => {
  let fixture: ComponentFixture<TalentEntryDialogComponent>;
  let component: TalentEntryDialogComponent;
  let patchSpy: ReturnType<typeof vi.fn>;
  let saved: string[];

  beforeEach(async () => {
    patchSpy = vi.fn().mockReturnValue(of({ ignored: [] }));
    await TestBed.configureTestingModule({
      imports: [TalentEntryDialogComponent],
      providers: [{ provide: TalentsCatalogApiService, useValue: { patchSchema: patchSpy } }],
    }).compileComponents();
    fixture = TestBed.createComponent(TalentEntryDialogComponent);
    component = fixture.componentInstance;
    saved = [];
    component.saved.subscribe((k) => saved.push(k));
  });

  function open(entry: TalentCatalogEntryDto | null) {
    fixture.componentRef.setInput('entry', entry);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  }

  const form = () => component['form'];
  const special = () => form().controls.special;

  it('renders seven S·P·E·C·I·A·L steppers in order', () => {
    open(null);
    const labels = Array.from(
      document.querySelectorAll('[data-testid="special-steppers"] label'),
    ).map((l) => l.textContent?.trim());
    expect(labels).toEqual(['S', 'P', 'E', 'C', 'I', 'A', 'L']);
  });

  it('creates with all steppers at zero', () => {
    open(null);
    form().patchValue({ slug: 'gun-fu', name: 'Gun Fu' });
    component['submit']();

    expect(patchSpy).toHaveBeenCalledWith([
      {
        action: 'add',
        slug: 'gun-fu',
        entry: { name: 'Gun Fu', description: undefined, specialRequirement: [0, 0, 0, 0, 0, 0, 0] },
      },
    ]);
    expect(saved).toEqual(['created']);
  });

  it('sets a requirement while creating a talent', () => {
    open(null);
    form().patchValue({ slug: 'gun-fu', name: 'Gun Fu' });
    special().at(AGILITY).setValue(2);
    component['submit']();

    expect(patchSpy.mock.calls[0][0][0].entry.specialRequirement).toEqual([0, 0, 0, 0, 0, 2, 0]);
  });

  it('pre-fills the steppers from the entry, defaulting missing values to zero', () => {
    open({ slug: 'a', name: 'A', specialRequirement: [1, 0, 3, 0, 0, 0, 0] });
    expect(special().getRawValue()).toEqual([1, 0, 3, 0, 0, 0, 0]);

    open({ slug: 'b', name: 'B' });
    expect(special().getRawValue()).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("sets a talent's requirement via an update op carrying name and description", () => {
    open({ slug: 'toughness', name: 'Tenacia', description: 'd' });
    special().at(ENDURANCE).setValue(3);
    component['submit']();

    expect(patchSpy).toHaveBeenCalledWith([
      {
        action: 'update',
        slug: 'toughness',
        entry: { name: 'Tenacia', description: 'd', specialRequirement: [0, 0, 3, 0, 0, 0, 0] },
      },
    ]);
    expect(saved).toEqual(['updated']);
  });

  it("clears a talent's requirement by resetting every stepper to zero", () => {
    open({ slug: 'toughness', name: 'Tenacia', specialRequirement: [0, 0, 3, 0, 0, 0, 0] });
    special().at(ENDURANCE).setValue(0);
    component['submit']();

    expect(patchSpy.mock.calls[0][0][0].entry.specialRequirement).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('treats a cleared stepper as zero', () => {
    open({ slug: 'toughness', name: 'Tenacia', specialRequirement: [0, 0, 3, 0, 0, 0, 0] });
    special().at(ENDURANCE).setValue(null as unknown as number);
    component['submit']();

    expect(patchSpy.mock.calls[0][0][0].entry.specialRequirement).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('renames then updates, keeping the requirement', () => {
    open({ slug: 'gunslinger', name: 'Gunslinger', specialRequirement: [0, 0, 0, 0, 0, 2, 0] });
    form().patchValue({ slug: 'pistolero', name: 'Pistolero' });
    component['submit']();

    expect(patchSpy).toHaveBeenCalledWith([
      { action: 'rename', slug: 'gunslinger', rename: 'pistolero' },
      {
        action: 'update',
        slug: 'pistolero',
        entry: { name: 'Pistolero', description: undefined, specialRequirement: [0, 0, 0, 0, 0, 2, 0] },
      },
    ]);
  });

  it('keeps the values and names the slug on a 409', () => {
    patchSpy.mockReturnValueOnce(throwError(() => ({ status: 409 })));
    open(null);
    form().patchValue({ slug: 'gun-fu', name: 'Gun Fu' });
    special().at(AGILITY).setValue(4);
    component['submit']();

    expect(component['error']()).toBe('Slug "gun-fu" già esistente');
    expect(special().at(AGILITY).value).toBe(4);
    expect(saved).toEqual([]);
  });
});
