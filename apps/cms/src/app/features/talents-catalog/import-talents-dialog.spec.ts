import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FileSelectEvent } from 'primeng/fileupload';
import { ImportTalentsDialogComponent } from './import-talents-dialog';
import { environment } from '../../../environments/environment';

describe('ImportTalentsDialogComponent', () => {
  let fixture: ComponentFixture<ImportTalentsDialogComponent>;
  let component: ImportTalentsDialogComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportTalentsDialogComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportTalentsDialogComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function setJson(value: string) {
    (component as unknown as { jsonText: { set(v: string): void } }).jsonText.set(value);
  }

  function callImport() {
    (component as unknown as { onImport(): void }).onImport();
  }

  it('adds only genuinely new slugs via a single PATCH, reporting the summary', () => {
    component.currentEntries = [{ slug: 'gun-fu', name: 'Gun Fu' }];
    setJson(
      JSON.stringify([
        { slug: 'gun-fu', name: 'Gun Fu 2' },
        { slug: 'iron-fist', name: 'Iron Fist' },
      ]),
    );
    callImport();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/talents-catalog`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      ops: [
        { action: 'add', slug: 'iron-fist', entry: { name: 'Iron Fist', description: undefined, specialRequirement: undefined } },
      ],
    });
    req.flush({ ignored: [] });

    const summary = (component as unknown as { summary: { (): { added: number; skipped: unknown[] } | null } }).summary();
    expect(summary).toEqual({ added: 1, skipped: [{ slug: 'gun-fu', reason: 'already_in_catalog' }] });
  });

  it('skips a slug duplicated within the file, importing only the first occurrence', () => {
    component.currentEntries = [];
    setJson(
      JSON.stringify([
        { slug: 'iron-fist', name: 'Iron Fist' },
        { slug: 'iron-fist', name: 'Iron Fist (2nd)' },
      ]),
    );
    callImport();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/talents-catalog`);
    expect(req.request.body.ops).toEqual([
      { action: 'add', slug: 'iron-fist', entry: { name: 'Iron Fist', description: undefined, specialRequirement: undefined } },
    ]);
    req.flush({ ignored: [] });
  });

  it('issues no PATCH when every entry is skipped', () => {
    component.currentEntries = [{ slug: 'gun-fu', name: 'Gun Fu' }];
    setJson(JSON.stringify([{ slug: 'gun-fu', name: 'Gun Fu' }]));
    callImport();

    httpMock.expectNone(`${environment.apiBaseUrl}/talents-catalog`);
    const summary = (component as unknown as { summary: { (): { added: number; skipped: unknown[] } | null } }).summary();
    expect(summary).toEqual({ added: 0, skipped: [{ slug: 'gun-fu', reason: 'already_in_catalog' }] });
  });

  it('rejects invalid JSON before any write', () => {
    setJson('not json');
    callImport();

    httpMock.expectNone(`${environment.apiBaseUrl}/talents-catalog`);
    expect((component as unknown as { parseError: { (): string | null } }).parseError()).toBeTruthy();
  });

  it('rejects a malformed entry (missing name) before any write', () => {
    setJson(JSON.stringify([{ slug: 'no-name' }]));
    callImport();

    httpMock.expectNone(`${environment.apiBaseUrl}/talents-catalog`);
    expect((component as unknown as { zodErrors: { (): unknown[] } }).zodErrors().length).toBeGreaterThan(0);
  });

  it('rejects a malformed entry (wrong-length specialRequirement) before any write', () => {
    setJson(JSON.stringify([{ slug: 'x', name: 'X', specialRequirement: [0, 0, 0] }]));
    callImport();

    httpMock.expectNone(`${environment.apiBaseUrl}/talents-catalog`);
    expect((component as unknown as { zodErrors: { (): unknown[] } }).zodErrors().length).toBeGreaterThan(0);
  });

  it('surfaces the API error message when the PATCH fails', () => {
    component.currentEntries = [];
    setJson(JSON.stringify([{ slug: 'iron-fist', name: 'Iron Fist' }]));
    callImport();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/talents-catalog`);
    req.flush({ message: 'Errore custom' }, { status: 400, statusText: 'Bad Request' });

    expect((component as unknown as { apiError: { (): string | null } }).apiError()).toBe('Errore custom');
    expect((component as unknown as { importing: { (): boolean } }).importing()).toBe(false);
  });

  it('falls back to a generic message when the API error has no message', () => {
    component.currentEntries = [];
    setJson(JSON.stringify([{ slug: 'iron-fist', name: 'Iron Fist' }]));
    callImport();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/talents-catalog`);
    req.flush(null, { status: 500, statusText: 'Server Error' });

    expect((component as unknown as { apiError: { (): string | null } }).apiError()).toBe(
      "Errore durante l'importazione dei talenti.",
    );
  });

  function callFileSelect(event: FileSelectEvent) {
    (component as unknown as { onFileSelect(e: FileSelectEvent): void }).onFileSelect(event);
  }

  async function waitForJsonText(): Promise<string> {
    for (let i = 0; i < 50; i++) {
      const text = component['jsonText']();
      if (text) return text;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return component['jsonText']();
  }

  it('parses and pretty-prints a valid JSON file on select', async () => {
    const file = new File([JSON.stringify([{ slug: 'x', name: 'X' }])], 'talents.json', {
      type: 'application/json',
    });
    callFileSelect({ currentFiles: [file] } as unknown as FileSelectEvent);

    expect(JSON.parse(await waitForJsonText())).toEqual([{ slug: 'x', name: 'X' }]);
  });

  it('falls back to raw text when the selected file is not valid JSON', async () => {
    const file = new File(['not json'], 'talents.json', { type: 'application/json' });
    callFileSelect({ currentFiles: [file] } as unknown as FileSelectEvent);

    expect(await waitForJsonText()).toBe('not json');
  });

  it('does nothing when no file is selected', () => {
    callFileSelect({ currentFiles: [] } as unknown as FileSelectEvent);

    expect(component['jsonText']()).toBe('');
  });
});
