import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConditionsEntryDialogComponent } from './conditions-entry-dialog';
import { ConditionsCatalogApiService } from '../../core/conditions-catalog/conditions-catalog-api.service';
import type { ConditionCatalogEntryDto } from '../../core/conditions-catalog/conditions-catalog.types';

const POISONED: ConditionCatalogEntryDto = {
  slug: 'poisoned',
  name: 'Avvelenato',
  defaultSeverity: 'major',
  polarity: 'negative',
};

describe('ConditionsEntryDialogComponent', () => {
  let fixture: ComponentFixture<ConditionsEntryDialogComponent>;
  let component: ConditionsEntryDialogComponent;
  let patchSpy: ReturnType<typeof vi.fn>;
  let saved: string[];

  beforeEach(async () => {
    patchSpy = vi.fn().mockReturnValue(of({ ignored: [] }));
    await TestBed.configureTestingModule({
      imports: [ConditionsEntryDialogComponent],
      providers: [{ provide: ConditionsCatalogApiService, useValue: { patchSchema: patchSpy } }],
    }).compileComponents();
    fixture = TestBed.createComponent(ConditionsEntryDialogComponent);
    component = fixture.componentInstance;
    saved = [];
    component.saved.subscribe((k) => saved.push(k));
  });

  function open(entry: ConditionCatalogEntryDto | null) {
    fixture.componentRef.setInput('entry', entry);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  }

  const form = () => component['form'];

  it('starts a new condition as minor and negative', () => {
    open(null);
    expect(form().getRawValue()).toEqual({
      slug: '',
      name: '',
      defaultSeverity: 'minor',
      polarity: 'negative',
      description: '',
    });
  });

  it('creates with an add op carrying severity and polarity', () => {
    open(null);
    form().patchValue({ slug: 'fatigued', name: 'Affaticato' });
    component['submit']();

    expect(patchSpy).toHaveBeenCalledWith([
      {
        action: 'add',
        slug: 'fatigued',
        entry: { name: 'Affaticato', defaultSeverity: 'minor', polarity: 'negative', description: undefined },
      },
    ]);
    expect(saved).toEqual(['created']);
  });

  it("changes a condition preset's severity via an update op", () => {
    open(POISONED);
    form().controls.defaultSeverity.setValue('minor');
    component['submit']();

    expect(patchSpy).toHaveBeenCalledWith([
      {
        action: 'update',
        slug: 'poisoned',
        entry: { name: 'Avvelenato', defaultSeverity: 'minor', polarity: 'negative', description: undefined },
      },
    ]);
  });

  it("changes a condition preset's polarity via an update op", () => {
    open(POISONED);
    form().controls.polarity.setValue('positive');
    component['submit']();

    expect(patchSpy).toHaveBeenCalledWith([
      {
        action: 'update',
        slug: 'poisoned',
        entry: { name: 'Avvelenato', defaultSeverity: 'major', polarity: 'positive', description: undefined },
      },
    ]);
  });

  it('renames then updates when the slug changes', () => {
    open(POISONED);
    form().patchValue({ slug: 'poisoned-2', defaultSeverity: 'minor' });
    component['submit']();

    expect(patchSpy).toHaveBeenCalledWith([
      { action: 'rename', slug: 'poisoned', rename: 'poisoned-2' },
      {
        action: 'update',
        slug: 'poisoned-2',
        entry: { name: 'Avvelenato', defaultSeverity: 'minor', polarity: 'negative', description: undefined },
      },
    ]);
  });

  it('rejects a missing slug or name without a request', () => {
    open(null);
    component['submit']();

    expect(patchSpy).not.toHaveBeenCalled();
    expect(component['error']()).toBe('Slug e nome sono obbligatori');
  });

  it('keeps the values and names the slug on a 409', () => {
    patchSpy.mockReturnValueOnce(throwError(() => ({ status: 409 })));
    open(null);
    form().patchValue({ slug: 'poisoned', name: 'Avvelenato', defaultSeverity: 'major' });
    component['submit']();

    expect(component['error']()).toBe('Slug "poisoned" già esistente');
    expect(form().getRawValue().defaultSeverity).toBe('major');
    expect(saved).toEqual([]);
  });
});
