import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { SidebarComponent } from './sidebar';
import { TopbarComponent } from './topbar';
import { LayoutService } from '../core/layout/layout.service';
import { AuthService } from '../core/auth/auth.service';
import { CurrentCampaignService } from '../core/campaign/current-campaign.service';
import type { AuthUser } from '../../api/auth.api';

const ADMIN: AuthUser = { id: '1', username: 'admin', role: 'admin' };

describe('LayoutService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
  });

  it('starts closed and toggles/opens/closes the sidebar flag', () => {
    const layout = TestBed.inject(LayoutService);
    expect(layout.sidebarOpen()).toBe(false);

    layout.toggleSidebar();
    expect(layout.sidebarOpen()).toBe(true);

    layout.toggleSidebar();
    expect(layout.sidebarOpen()).toBe(false);

    layout.openSidebar();
    expect(layout.sidebarOpen()).toBe(true);

    layout.closeSidebar();
    expect(layout.sidebarOpen()).toBe(false);
  });
});

describe('TopbarComponent — the hamburger opens the drawer', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [TopbarComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: signal(ADMIN), logout: async () => {} } },
      ],
    });
  });

  it('toggles LayoutService.sidebarOpen when clicked', () => {
    const layout = TestBed.inject(LayoutService);
    const fixture = TestBed.createComponent(TopbarComponent);
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="sidebar-toggle"]',
    );
    expect(button).toBeTruthy();
    expect(layout.sidebarOpen()).toBe(false);

    button.click();
    expect(layout.sidebarOpen()).toBe(true);
  });
});

describe('SidebarComponent — the drawer auto-closes on navigation', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([{ path: 'terminals', children: [] }]),
        { provide: AuthService, useValue: { currentUser: signal(ADMIN) } },
        { provide: CurrentCampaignService, useValue: { currentCampaign: signal(null) } },
      ],
    });
  });

  it('closes an open drawer once a navigation completes', async () => {
    const layout = TestBed.inject(LayoutService);
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();

    // Simulate the user having opened the drawer, then tapping a nav link.
    layout.openSidebar();
    expect(layout.sidebarOpen()).toBe(true);

    await router.navigateByUrl('/terminals');
    fixture.detectChanges();

    expect(layout.sidebarOpen()).toBe(false);
  });

  it('renders a dismiss backdrop bound to the drawer state', () => {
    const layout = TestBed.inject(LayoutService);
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();

    const backdrop: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="sidebar-backdrop"]',
    );
    expect(backdrop).toBeTruthy();
    expect(backdrop.classList.contains('show')).toBe(false);

    layout.openSidebar();
    fixture.detectChanges();
    expect(backdrop.classList.contains('show')).toBe(true);

    backdrop.click();
    fixture.detectChanges();
    expect(layout.sidebarOpen()).toBe(false);
  });
});
