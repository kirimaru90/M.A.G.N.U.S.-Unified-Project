import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageService } from 'primeng/api';
import { provideMarkdown } from 'ngx-markdown';
import { TerminalEditorComponent } from './terminal-editor';
import { TerminalsApiService } from '../../../core/terminal/terminals-api.service';
import { CurrentCampaignService } from '../../../core/campaign/current-campaign.service';
import type { TerminalContent } from '../../../domain/terminal-schema';
import type { TerminalDetailEnvelope } from '../../../core/terminal/terminal.types';

function baseContent(): TerminalContent {
  return {
    meta: { title: 'Terminal', public: true },
    state: { local: {}, global: {} },
    login: { users: [{ username: 'tecnico' }] },
    nodes: { start: { text: 'hi' } },
  } as TerminalContent;
}

describe('TerminalEditorComponent', () => {
  let fixture: ComponentFixture<TerminalEditorComponent>;
  let component: TerminalEditorComponent & { dirty: boolean; apiError: string | null };
  let updateSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateSpy = vi.fn();
    TestBed.configureTestingModule({
      imports: [TerminalEditorComponent],
      providers: [
        provideMarkdown(),
        { provide: TerminalsApiService, useValue: { update: updateSpy } },
        { provide: CurrentCampaignService, useValue: { currentCampaign: () => null } },
        MessageService,
      ],
    });

    fixture = TestBed.createComponent(TerminalEditorComponent);
    component = fixture.componentInstance as typeof component;
    component.terminalId = 't1';
    component.content = baseContent();
    component.fictionalUsers = [{ username: 'tecnico', password: 'robco123' }];
    fixture.detectChanges();
  });

  it('a successful save clears dirty, shows the toast, re-hydrates passwords, and does not throw', () => {
    const envelope: TerminalDetailEnvelope = {
      id: 't1',
      campaignId: 'c1',
      title: 'Terminal',
      content: baseContent(),
      state: {},
      fictionalUsers: [{ username: 'tecnico', password: 'robco123-new' }],
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    updateSpy.mockReturnValue(of(envelope));

    const messageService = TestBed.inject(MessageService);
    const addSpy = vi.spyOn(messageService, 'add');

    component.dirty = true;
    expect(() => component.save()).not.toThrow();

    expect(component.dirty).toBe(false);
    expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
    expect(component.usersArray.at(0).get('password')?.value).toBe('robco123-new');
  });

  it('an error response keeps the form dirty and surfaces the API error message', () => {
    updateSpy.mockReturnValue(throwError(() => ({ error: { message: 'Boom' } })));

    component.save();

    expect(component.dirty).toBe(true);
    expect(component.apiError).toBe('Boom');
  });
});
