import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TagEntryDialogComponent } from './tag-entry-dialog';
import { TagCatalogApiService } from '../../core/tag-catalog/tag-catalog-api.service';
import type { TagCatalogEntryDto } from '../../core/tag-catalog/tag-catalog.types';

describe('TagEntryDialogComponent', () => {
  let fixture: ComponentFixture<TagEntryDialogComponent>;
  let component: TagEntryDialogComponent;
  let patchSpy: ReturnType<typeof vi.fn>;
  let saved: string[];

  beforeEach(async () => {
    patchSpy = vi.fn().mockReturnValue(of({ ignored: [] }));
    await TestBed.configureTestingModule({
      imports: [TagEntryDialogComponent],
      providers: [{ provide: TagCatalogApiService, useValue: { patchSchema: patchSpy } }],
    }).compileComponents();
    fixture = TestBed.createComponent(TagEntryDialogComponent);
    component = fixture.componentInstance;
    saved = [];
    component.saved.subscribe((k) => saved.push(k));
  });

  function open(entry: TagCatalogEntryDto | null) {
    fixture.componentRef.setInput('entry', entry);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  }

  const form = () => component['form'];

  it('creates with an add op', () => {
    open(null);
    form().setValue({ slug: 'pesante', name: 'Pesante' });
    component['submit']();

    expect(patchSpy).toHaveBeenCalledWith([{ action: 'add', slug: 'pesante', entry: { name: 'Pesante' } }]);
    expect(saved).toEqual(['created']);
  });

  it('pre-fills the form when editing', () => {
    open({ slug: 'automatica', name: 'Automatica' });
    expect(form().getRawValue()).toEqual({ slug: 'automatica', name: 'Automatica' });
  });

  it('updates when the slug is unchanged', () => {
    open({ slug: 'automatica', name: 'Automatica' });
    form().controls.name.setValue('AUTOMATICA');
    component['submit']();

    expect(patchSpy).toHaveBeenCalledWith([
      { action: 'update', slug: 'automatica', entry: { name: 'AUTOMATICA' } },
    ]);
    expect(saved).toEqual(['updated']);
  });

  it('renames then updates when slug and name both change, keeping the new name', () => {
    open({ slug: 'automatica', name: 'Automatica' });
    form().setValue({ slug: 'auto', name: 'Auto' });
    component['submit']();

    expect(patchSpy).toHaveBeenCalledWith([
      { action: 'rename', slug: 'automatica', rename: 'auto' },
      { action: 'update', slug: 'auto', entry: { name: 'Auto' } },
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
    form().setValue({ slug: 'automatica', name: 'Automatica' });
    component['submit']();

    expect(component['error']()).toBe('Slug "automatica" già esistente');
    expect(form().getRawValue()).toEqual({ slug: 'automatica', name: 'Automatica' });
    expect(saved).toEqual([]);
  });

  it('clears the previous values and error when reopened for create', () => {
    patchSpy.mockReturnValueOnce(throwError(() => ({ status: 400 })));
    open(null);
    form().setValue({ slug: 'x', name: 'X' });
    component['submit']();
    expect(component['error']()).toBe('Dati non validi');

    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    open(null);

    expect(form().getRawValue()).toEqual({ slug: '', name: '' });
    expect(component['error']()).toBeNull();
  });

  it('cancel emits closed and issues no request', () => {
    open(null);
    let closed = 0;
    component.closed.subscribe(() => closed++);
    (document.querySelector('[data-testid="dialog-cancel"]') as HTMLButtonElement).click();

    expect(closed).toBe(1);
    expect(patchSpy).not.toHaveBeenCalled();
  });
});
