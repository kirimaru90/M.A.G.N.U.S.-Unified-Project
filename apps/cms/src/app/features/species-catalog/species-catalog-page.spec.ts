import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SpeciesCatalogPage } from './species-catalog-page';
import { SpeciesCatalogApiService } from '../../core/species-catalog/species-catalog-api.service';

const GHOUL = {
  slug: 'ghoul',
  name: 'Ghoul',
  permesso: 'Immune alle radiazioni.',
  svantaggio: 'Inviso agli umani.',
  tagSkillBudget: 3,
};

describe('SpeciesCatalogPage', () => {
  let fixture: ComponentFixture<SpeciesCatalogPage>;
  let component: SpeciesCatalogPage;
  let listSpy: ReturnType<typeof vi.fn>;
  let patchSpy: ReturnType<typeof vi.fn>;

  function setup(entries: unknown[] = []) {
    listSpy = vi.fn().mockReturnValue(of(entries));
    patchSpy = vi.fn().mockReturnValue(of({ ignored: [] }));

    return TestBed.configureTestingModule({
      imports: [SpeciesCatalogPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SpeciesCatalogApiService, useValue: { list: listSpy, patchSchema: patchSpy } },
        ConfirmationService,
        MessageService,
      ],
    }).compileComponents();
  }

  beforeEach(async () => {
    await setup([GHOUL]);
    fixture = TestBed.createComponent(SpeciesCatalogPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the catalog from a single GET on init', () => {
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(component['entries']()).toEqual([GHOUL]);
  });

  it('adds a species via patchSchema with an add op', () => {
    component['showAddRow']();
    fixture.detectChanges();
    component['draft'] = {
      slug: 'synth',
      name: 'Sintetico',
      permesso: 'Indistinguibile da un umano.',
      svantaggio: "Cacciato dall'Istituto.",
      tagSkillBudget: 3,
      description: '',
    };
    component['submitAdd']();
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([
      {
        action: 'add',
        slug: 'synth',
        entry: {
          name: 'Sintetico',
          permesso: 'Indistinguibile da un umano.',
          svantaggio: "Cacciato dall'Istituto.",
          tagSkillBudget: 3,
          description: undefined,
        },
      },
    ]);
    expect(component['addRowVisible']()).toBe(false);
  });

  it('rejects an add missing required copy', () => {
    component['showAddRow']();
    component['draft'] = {
      slug: 'synth',
      name: 'Sintetico',
      permesso: '',
      svantaggio: '',
      tagSkillBudget: 3,
      description: '',
    };
    component['submitAdd']();
    fixture.detectChanges();

    expect(patchSpy).not.toHaveBeenCalled();
    expect(component['rowError']()).toBeTruthy();
  });

  it.each([0, -1])('rejects a tagSkillBudget of %s client-side', (budget) => {
    component['showAddRow']();
    component['draft'] = {
      slug: 'synth',
      name: 'Sintetico',
      permesso: 'a',
      svantaggio: 'b',
      tagSkillBudget: budget,
      description: '',
    };
    component['submitAdd']();
    fixture.detectChanges();

    expect(patchSpy).not.toHaveBeenCalled();
    expect(component['rowError']()).toBe('Il budget maestria deve essere un intero positivo');
  });

  it("changes a species' drawback copy via an update op", () => {
    component['startEdit'](GHOUL);
    fixture.detectChanges();
    component['draft'].svantaggio = 'Rischio di selvatichire.';
    component['submitEdit'](GHOUL);
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([
      {
        action: 'update',
        slug: 'ghoul',
        entry: {
          name: 'Ghoul',
          permesso: 'Immune alle radiazioni.',
          svantaggio: 'Rischio di selvatichire.',
          tagSkillBudget: 3,
          description: undefined,
        },
      },
    ]);
  });

  it("changes a species' tag-skill budget via an update op", () => {
    const human = { ...GHOUL, slug: 'human', name: 'Umano', tagSkillBudget: 4 };
    component['startEdit'](human);
    fixture.detectChanges();
    component['draft'].tagSkillBudget = 5;
    component['submitEdit'](human);
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([
      { action: 'update', slug: 'human', entry: expect.objectContaining({ tagSkillBudget: 5 }) },
    ]);
  });

  it('renames a species via a single rename op when only the slug changes', () => {
    component['startEdit'](GHOUL);
    fixture.detectChanges();
    component['draft'].slug = 'necrotic';
    component['submitEdit'](GHOUL);
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([
      { action: 'rename', slug: 'ghoul', rename: 'necrotic' },
    ]);
  });

  it('deletes a species via a delete op after confirmation', () => {
    const confirmationService = TestBed.inject(ConfirmationService);
    vi.spyOn(confirmationService, 'confirm').mockImplementation((opts) => {
      opts.accept?.();
      return confirmationService;
    });

    component['confirmDelete'](GHOUL);
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([{ action: 'delete', slug: 'ghoul' }]);
  });

  // 3.T.3 — a 409 renders inline and the draft survives for a retry.
  it('surfaces a 409 duplicate-slug error inline without discarding pending edits', () => {
    patchSpy.mockReturnValueOnce({
      subscribe: ({ error }: { error: (e: unknown) => void }) => error({ status: 409 }),
    });
    component['showAddRow']();
    component['draft'] = {
      slug: 'ghoul',
      name: 'Ghoul',
      permesso: 'a',
      svantaggio: 'b',
      tagSkillBudget: 3,
      description: '',
    };
    component['submitAdd']();
    fixture.detectChanges();

    expect(component['rowError']()).toBe('Slug già esistente');
    expect(component['addRowVisible']()).toBe(true);
    expect(component['draft'].slug).toBe('ghoul');
  });

  it('surfaces an in-use 409 on delete as an inline error and keeps the entry listed', () => {
    const confirmationService = TestBed.inject(ConfirmationService);
    vi.spyOn(confirmationService, 'confirm').mockImplementation((opts) => {
      opts.accept?.();
      return confirmationService;
    });
    patchSpy.mockReturnValueOnce({
      subscribe: ({ error }: { error: (e: unknown) => void }) => error({ status: 409 }),
    });

    component['confirmDelete'](GHOUL);
    fixture.detectChanges();

    expect(component['deleteError']()).toBe('ghoul');
    expect(component['deleteErrorText']()).toBe('Specie in uso da un personaggio');
    expect(component['entries']()).toEqual([GHOUL]);
  });

  it('surfaces an in-use 409 on rename as an inline error', () => {
    patchSpy.mockReturnValueOnce({
      subscribe: ({ error }: { error: (e: unknown) => void }) => error({ status: 409 }),
    });
    component['startEdit'](GHOUL);
    component['draft'].slug = 'necrotic';
    component['submitEdit'](GHOUL);
    fixture.detectChanges();

    expect(component['rowError']()).toBe('Specie in uso da un personaggio');
    expect(component['editingSlug']()).toBe('ghoul');
  });

  it('renders the empty message when the catalog has no entries', async () => {
    TestBed.resetTestingModule();
    await setup([]);
    const emptyFixture = TestBed.createComponent(SpeciesCatalogPage);
    emptyFixture.detectChanges();
    expect(emptyFixture.nativeElement.textContent).toContain('Nessuna specie nel catalogo');
  });
});
