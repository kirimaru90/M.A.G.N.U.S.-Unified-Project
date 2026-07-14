import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ImportTerminalDialogComponent } from './import-terminal-dialog';
import { environment } from '../../../environments/environment';

describe('ImportTerminalDialogComponent', () => {
  let fixture: ComponentFixture<ImportTerminalDialogComponent>;
  let component: ImportTerminalDialogComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportTerminalDialogComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), MessageService],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportTerminalDialogComponent);
    component = fixture.componentInstance;
    component.campaignId = 'c1';
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('strips a server-owned meta.id from the imported request body', () => {
    (component as unknown as { jsonText: { set(v: string): void } }).jsonText.set(
      JSON.stringify({
        meta: { id: 'leftover-1', title: 'Demo' },
        nodes: { start: { text: 'x', choices: [] } },
      }),
    );
    (component as unknown as { onImport(): void }).onImport();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/campaigns/c1/terminals/import`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.meta).not.toHaveProperty('id');
    expect(req.request.body.meta.title).toBe('Demo');
    req.flush({ id: 't1', meta: { title: 'Demo' } });
  });

  it('accepts minimal content with no state/login/public and forwards it with defaults applied', () => {
    (component as unknown as { jsonText: { set(v: string): void } }).jsonText.set(
      JSON.stringify({
        meta: { title: 'Minimo' },
        nodes: { start: { text: 'x', choices: [] } },
      }),
    );
    (component as unknown as { onImport(): void }).onImport();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/campaigns/c1/terminals/import`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.state).toEqual({ local: {}, global: {} });
    expect(req.request.body.login).toEqual({ users: [] });
    expect(req.request.body.meta.public).toBe(false);
    req.flush({ id: 't1', meta: { title: 'Minimo' } });
  });
});
