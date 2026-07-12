import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { SidebarComponent } from './sidebar';
import { AuthService } from '../core/auth/auth.service';
import { CurrentCampaignService } from '../core/campaign/current-campaign.service';
import type { AuthUser } from '../../api/auth.api';

function render(user: AuthUser | null) {
  TestBed.configureTestingModule({
    imports: [SidebarComponent],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { currentUser: signal(user) } },
      { provide: CurrentCampaignService, useValue: { currentCampaign: signal(null) } },
    ],
  });
  const fixture = TestBed.createComponent(SidebarComponent);
  fixture.detectChanges();
  return fixture;
}

describe('SidebarComponent — Catalogo visibility', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('hides the Catalogo section for a non-admin', () => {
    const fixture = render({ id: '2', username: 'player', role: 'player' });
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Catalogo');
    expect(text).not.toContain('Equipaggiamento');
    expect(fixture.nativeElement.querySelector('a[href="/equipment-catalog"]')).toBeNull();
  });

  it('hides the Catalogo section when there is no resolved user', () => {
    const fixture = render(null);
    expect(fixture.nativeElement.textContent).not.toContain('Catalogo');
  });

  it('shows the Catalogo section with its links for an admin', () => {
    const fixture = render({ id: '1', username: 'admin', role: 'admin' });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Catalogo');
    expect(text).toContain('Equipaggiamento');
    expect(fixture.nativeElement.querySelector('a[href="/equipment-catalog"]')).toBeTruthy();
  });
});
