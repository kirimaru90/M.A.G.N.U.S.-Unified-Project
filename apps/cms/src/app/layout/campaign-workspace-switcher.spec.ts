import { TestBed } from '@angular/core/testing';
import { WritableSignal, signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CampaignWorkspaceSwitcherComponent } from './campaign-workspace-switcher';
import { CurrentCampaignService } from '../core/campaign/current-campaign.service';
import type { CampaignDto } from '../core/campaign/campaign.types';

const A: CampaignDto = { id: 'a', name: 'A', isActive: true, isPublic: true };
const B: CampaignDto = { id: 'b', name: 'B', isActive: true, isPublic: true };

describe('CampaignWorkspaceSwitcherComponent', () => {
  let currentCampaign: WritableSignal<CampaignDto | null>;
  let setCurrent: ReturnType<typeof vi.fn>;

  function create() {
    currentCampaign = signal<CampaignDto | null>(A);
    setCurrent = vi.fn((c: CampaignDto) => currentCampaign.set(c));

    TestBed.configureTestingModule({
      imports: [CampaignWorkspaceSwitcherComponent],
      providers: [
        {
          provide: CurrentCampaignService,
          useValue: { currentCampaign, campaigns: signal([A, B]), setCurrent },
        },
      ],
    });
    const fixture = TestBed.createComponent(CampaignWorkspaceSwitcherComponent);
    fixture.detectChanges();
    return fixture;
  }

  const model = (c: CampaignWorkspaceSwitcherComponent) =>
    (c as unknown as { model: () => CampaignDto | null }).model();

  beforeEach(() => vi.restoreAllMocks());

  it('commits immediately when no guard is set', async () => {
    const fixture = create();
    await fixture.componentInstance.onSelect(B);
    expect(setCurrent).toHaveBeenCalledWith(B);
  });

  it('commits when the guard resolves truthy', async () => {
    const fixture = create();
    fixture.componentRef.setInput('guard', () => true);
    await fixture.componentInstance.onSelect(B);
    expect(setCurrent).toHaveBeenCalledWith(B);
  });

  it('does not commit and reverts the control when the guard resolves false', async () => {
    const fixture = create();
    fixture.componentRef.setInput('guard', () => false);
    await fixture.componentInstance.onSelect(B);

    expect(setCurrent).not.toHaveBeenCalled();
    // One-way [ngModel] would leave p-select on the rejected pick; the local
    // model snaps the control back to the current campaign.
    expect(model(fixture.componentInstance)).toEqual(A);
  });
});
