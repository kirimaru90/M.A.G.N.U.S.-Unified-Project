import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImportCodexDialogComponent, parseCodexFile } from './import-codex-dialog';
import { CodexApiService } from '../../core/codex/codex-api.service';

describe('ImportCodexDialogComponent', () => {
  let fixture: ComponentFixture<ImportCodexDialogComponent>;
  let importSpy: ReturnType<typeof vi.fn>;

  const q = (sel: string) => document.body.querySelector(sel) as HTMLElement | null;

  beforeEach(async () => {
    document.body.innerHTML = '';
    importSpy = vi.fn().mockReturnValue(
      of({
        added: 2,
        skipped: [{ index: 2, name: 'Diamond City', reason: 'collision' }],
      }),
    );
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ImportCodexDialogComponent],
      providers: [{ provide: CodexApiService, useValue: { import: importSpy } }],
    }).compileComponents();
    fixture = TestBed.createComponent(ImportCodexDialogComponent);
    fixture.componentRef.setInput('campaignId', 'c1');
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('rejects a JSON object locally and issues no request', () => {
    fixture.componentInstance.loadText('codex.json', '{"entries": []}');
    fixture.detectChanges();
    expect(q('[data-testid="codex-import-error"]')!.textContent).toContain('array');
    expect((q('[data-testid="codex-import-submit"]') as HTMLButtonElement).disabled).toBe(true);
    fixture.componentInstance.onImport();
    expect(importSpy).not.toHaveBeenCalled();
  });

  it('rejects invalid JSON locally', () => {
    fixture.componentInstance.loadText('codex.json', 'not json');
    fixture.detectChanges();
    expect(q('[data-testid="codex-import-error"]')!.textContent).toContain('JSON valido');
  });

  it('posts the entries and renders the summary with Italian reasons', () => {
    const entries = [{ name: 'A' }, { name: 'B' }, { name: 'Diamond City' }];
    fixture.componentInstance.loadText('codex.json', JSON.stringify(entries));
    fixture.detectChanges();
    (q('[data-testid="codex-import-submit"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(importSpy).toHaveBeenCalledWith('c1', entries);
    const summary = q('[data-testid="codex-import-summary"]')!.textContent!;
    expect(summary).toContain('2 voci aggiunte, 1 saltate.');
    expect(summary).toContain('Diamond City (già presente)');
  });
});

describe('parseCodexFile', () => {
  it('accepts an array and nothing else', () => {
    expect(parseCodexFile('[]')).toEqual({ entries: [] });
    expect(parseCodexFile('{}')).toHaveProperty('error');
    expect(parseCodexFile('nope')).toHaveProperty('error');
  });
});
