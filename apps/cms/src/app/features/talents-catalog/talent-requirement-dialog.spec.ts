import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { TalentRequirementDialogComponent } from './talent-requirement-dialog';

describe('TalentRequirementDialogComponent', () => {
  let fixture: ComponentFixture<TalentRequirementDialogComponent>;
  let component: TalentRequirementDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TalentRequirementDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TalentRequirementDialogComponent);
    component = fixture.componentInstance;
  });

  it('pre-fills steppers from the entry current specialRequirement', () => {
    component.entry = {
      slug: 'gun-fu',
      name: 'Gun Fu',
      specialRequirement: [0, 0, 3, 0, 0, 1, 0],
    };
    component.visible = true;
    component.ngOnChanges();

    expect(component['values']).toEqual([0, 0, 3, 0, 0, 1, 0]);
  });

  it('defaults every stat to 0 when the entry has no specialRequirement', () => {
    component.entry = { slug: 'gun-fu', name: 'Gun Fu' };
    component.visible = true;
    component.ngOnChanges();

    expect(component['values']).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('emits an all-zero array on save when never set', () => {
    component.entry = { slug: 'gun-fu', name: 'Gun Fu' };
    component.visible = true;
    component.ngOnChanges();

    let emitted: number[] | undefined;
    component.saved.subscribe((v) => (emitted = v));
    component['onSave']();

    expect(emitted).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('bounds stepper values to 0..5 via setValue', () => {
    component.entry = { slug: 'gun-fu', name: 'Gun Fu' };
    component.visible = true;
    component.ngOnChanges();

    component['setValue'](2, 5);
    expect(component['values']).toEqual([0, 0, 5, 0, 0, 0, 0]);

    let emitted: number[] | undefined;
    component.saved.subscribe((v) => (emitted = v));
    component['onSave']();
    expect(emitted).toEqual([0, 0, 5, 0, 0, 0, 0]);
  });
});
