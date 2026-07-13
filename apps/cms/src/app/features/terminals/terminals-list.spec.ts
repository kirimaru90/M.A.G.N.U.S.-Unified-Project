import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TerminalsListPage } from './terminals-list';
import { TerminalsApiService } from '../../core/terminal/terminals-api.service';
import { CurrentCampaignService } from '../../core/campaign/current-campaign.service';
import type { CampaignDto } from '../../core/campaign/campaign.types';
import type { TerminalDto } from '../../core/terminal/terminal.types';

const CAMPAIGN = { id: 'c1', name: 'Campagna Uno' } as CampaignDto;
const TERMINAL = {
  id: 't1',
  meta: { title: 'Guida', public: true },
  views: 3,
  createdAt: '2026-01-01T00:00:00Z',
} as unknown as TerminalDto;

describe('TerminalsListPage', () => {
  let listSpy: ReturnType<typeof vi.fn>;

  function setup(current: CampaignDto | null, terminals: TerminalDto[] = []) {
    listSpy = vi.fn().mockReturnValue(of(terminals));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [TerminalsListPage],
      providers: [
        provideRouter([]),
        {
          provide: TerminalsApiService,
          useValue: { listByCampaign: listSpy, delete: vi.fn() },
        },
        {
          provide: CurrentCampaignService,
          useValue: { currentCampaign: signal(current), campaigns: signal([CAMPAIGN]) },
        },
        ConfirmationService,
        MessageService,
      ],
    });
    const fixture: ComponentFixture<TerminalsListPage> =
      TestBed.createComponent(TerminalsListPage);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('shows the select-a-campaign empty state and no table when no campaign is selected', () => {
    const fixture = setup(null);
    expect(fixture.nativeElement.textContent).toContain('Seleziona una campagna');
    expect(fixture.nativeElement.querySelector('p-table')).toBeNull();
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('disables the create and import actions when no campaign is selected', () => {
    const fixture = setup(null);
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.bo-page-head-actions button'),
    ) as HTMLButtonElement[];
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });

  it('loads the selected campaign terminals and renders a row', () => {
    const fixture = setup(CAMPAIGN, [TERMINAL]);
    expect(listSpy).toHaveBeenCalledWith('c1');
    expect(fixture.nativeElement.textContent).toContain('Guida');
    expect(fixture.nativeElement.querySelector('p-table')).toBeTruthy();
  });
});
