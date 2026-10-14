import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TalentsCatalogPage } from './talents-catalog-page';
import { TalentsCatalogApiService } from '../../core/talents-catalog/talents-catalog-api.service';

describe('TalentsCatalogPage', () => {
  let fixture: ComponentFixture<TalentsCatalogPage>;
  let component: TalentsCatalogPage;
  let listSpy: ReturnType<typeof vi.fn>;
  let patchSpy: ReturnType<typeof vi.fn>;

  function setup(entries: unknown[] = []) {
    listSpy = vi.fn().mockReturnValue(of(entries));
    patchSpy = vi.fn().mockReturnValue(of({ ignored: [] }));

    return TestBed.configureTestingModule({
      imports: [TalentsCatalogPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TalentsCatalogApiService, useValue: { list: listSpy, patchSchema: patchSpy } },
        ConfirmationService,
        MessageService,
      ],
    }).compileComponents();
  }

  beforeEach(async () => {
    await setup([{ slug: 'gunslinger', name: 'Gunslinger', description: 'Precisione col revolver' }]);
    fixture = TestBed.createComponent(TalentsCatalogPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the catalog from a single GET on init', () => {
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(component['entries']()).toEqual([
      { slug: 'gunslinger', name: 'Gunslinger', description: 'Precisione col revolver' },
    ]);
  });

  it('renders read-only rows with no inline inputs', () => {
    expect(fixture.nativeElement.querySelector('p-table tbody input')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Precisione col revolver');
  });

  it('opens the dialog empty for create', () => {
    component['openCreate']();
    expect(component['dialogVisible']()).toBe(true);
    expect(component['dialogEntry']()).toBeNull();
  });

  it('opens the dialog with the row entry for edit', () => {
    const entry = { slug: 'gun-fu', name: 'Gun Fu' };
    component['openEdit'](entry);
    expect(component['dialogVisible']()).toBe(true);
    expect(component['dialogEntry']()).toBe(entry);
  });

  it('closes the dialog and reloads after a save', () => {
    component['openCreate']();
    component['onSaved']('created');

    expect(component['dialogVisible']()).toBe(false);
    expect(listSpy).toHaveBeenCalledTimes(2);
  });

  it('deletes a talent via patchSchema with a delete op after confirmation', () => {
    const confirmationService = TestBed.inject(ConfirmationService);
    vi.spyOn(confirmationService, 'confirm').mockImplementation((opts) => {
      opts.accept?.();
      return confirmationService;
    });

    component['confirmDelete']({ slug: 'gunslinger', name: 'Gunslinger' });
    fixture.detectChanges();

    expect(patchSpy).toHaveBeenCalledWith([{ action: 'delete', slug: 'gunslinger' }]);
  });

  it('previews each row requirement, with a dash when there is none', async () => {
    TestBed.resetTestingModule();
    await setup([
      { slug: 'a', name: 'A', specialRequirement: [0, 2, 0, 0, 0, 3, 0] },
      { slug: 'b', name: 'B' },
      { slug: 'c', name: 'C', specialRequirement: [0, 0, 0, 0, 0, 0, 0] },
    ]);
    const f = TestBed.createComponent(TalentsCatalogPage);
    f.detectChanges();

    const cells = Array.from(f.nativeElement.querySelectorAll('[data-testid="requirement-preview"]')) as HTMLElement[];
    expect(cells.map((c) => c.textContent?.trim())).toEqual(['P2 A3', '—', '—']);
  });

  it('offers only edit and delete on each row, with no separate requirement action', () => {
    const rowButtons = Array.from(
      fixture.nativeElement.querySelectorAll('p-table tbody .row-actions button'),
    ) as HTMLButtonElement[];
    expect(rowButtons.map((b) => b.title)).toEqual(['Modifica', 'Elimina']);
  });

  it('exports the loaded catalog as a downloaded JSON blob with no new network request', () => {
    const clickedAnchors: HTMLAnchorElement[] = [];
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      clickedAnchors.push(this);
    };

    listSpy.mockClear();
    component['exportCatalog']();

    expect(listSpy).not.toHaveBeenCalled();
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/json');
    expect(clickedAnchors).toHaveLength(1);
    expect(clickedAnchors[0].download).toBe('talenti-catalogo.json');
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock');

    HTMLAnchorElement.prototype.click = originalClick;
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it('opens and closes the import dialog', () => {
    component['openImportDialog']();
    fixture.detectChanges();
    expect(component['importDialogVisible']()).toBe(true);

    component['closeImportDialog']();
    fixture.detectChanges();
    expect(component['importDialogVisible']()).toBe(false);
  });

  it('reloads the table after a successful import', () => {
    listSpy.mockClear();
    component['onImported']();
    expect(listSpy).toHaveBeenCalledTimes(1);
  });

  it('renders the empty message when the catalog has no entries', async () => {
    TestBed.resetTestingModule();
    await setup([]);
    const emptyFixture = TestBed.createComponent(TalentsCatalogPage);
    emptyFixture.detectChanges();
    expect(emptyFixture.nativeElement.textContent).toContain('Nessun talento nel catalogo');
  });
});
