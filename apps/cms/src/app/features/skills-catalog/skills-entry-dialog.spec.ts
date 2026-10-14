import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SkillsEntryDialogComponent } from './skills-entry-dialog';
import { SkillsCatalogApiService } from '../../core/skills-catalog/skills-catalog-api.service';
import type { SkillCatalogEntryDto } from '../../core/skills-catalog/skills-catalog.types';

describe('SkillsEntryDialogComponent', () => {
  let fixture: ComponentFixture<SkillsEntryDialogComponent>;
  let component: SkillsEntryDialogComponent;
  let patchSpy: ReturnType<typeof vi.fn>;
  let saved: string[];

  beforeEach(async () => {
    patchSpy = vi.fn().mockReturnValue(of({ ignored: [] }));
    await TestBed.configureTestingModule({
      imports: [SkillsEntryDialogComponent],
      providers: [{ provide: SkillsCatalogApiService, useValue: { patchSchema: patchSpy } }],
    }).compileComponents();
    fixture = TestBed.createComponent(SkillsEntryDialogComponent);
    component = fixture.componentInstance;
    saved = [];
    component.saved.subscribe((k) => saved.push(k));
  });

  function open(entry: SkillCatalogEntryDto | null) {
    fixture.componentRef.setInput('entry', entry);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  }

  const form = () => component['form'];

  it('creates with an add op, omitting an empty description', () => {
    open(null);
    form().setValue({ slug: 'lockpick', name: 'Scasso', description: '' });
    component['submit']();

    expect(patchSpy).toHaveBeenCalledWith([
      { action: 'add', slug: 'lockpick', entry: { name: 'Scasso', description: undefined } },
    ]);
    expect(saved).toEqual(['created']);
  });

  it('updates name and description when the slug is unchanged', () => {
    open({ slug: 'lockpick', name: 'Scasso' });
    form().patchValue({ description: 'Aprire serrature' });
    component['submit']();

    expect(patchSpy).toHaveBeenCalledWith([
      { action: 'update', slug: 'lockpick', entry: { name: 'Scasso', description: 'Aprire serrature' } },
    ]);
    expect(saved).toEqual(['updated']);
  });

  it('renames then updates when slug and name both change', () => {
    open({ slug: 'lockpick', name: 'Scasso', description: 'x' });
    form().patchValue({ slug: 'lockpicking', name: 'Scassinare' });
    component['submit']();

    expect(patchSpy).toHaveBeenCalledWith([
      { action: 'rename', slug: 'lockpick', rename: 'lockpicking' },
      { action: 'update', slug: 'lockpicking', entry: { name: 'Scassinare', description: 'x' } },
    ]);
  });

  it('rejects a missing slug or name without a request', () => {
    open(null);
    form().patchValue({ name: 'Scasso' });
    component['submit']();

    expect(patchSpy).not.toHaveBeenCalled();
    expect(component['error']()).toBe('Slug e nome sono obbligatori');
  });

  it('keeps the values and names the slug on a 409', () => {
    patchSpy.mockReturnValueOnce(throwError(() => ({ status: 409 })));
    open(null);
    form().setValue({ slug: 'lockpick', name: 'Scasso', description: 'd' });
    component['submit']();

    expect(component['error']()).toBe('Slug "lockpick" già esistente');
    expect(form().getRawValue()).toEqual({ slug: 'lockpick', name: 'Scasso', description: 'd' });
    expect(saved).toEqual([]);
  });
});
