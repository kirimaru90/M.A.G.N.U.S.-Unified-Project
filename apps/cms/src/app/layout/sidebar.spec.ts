import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SidebarComponent } from './sidebar';
import { AuthService } from '../core/auth/auth.service';
import { CurrentCampaignService } from '../core/campaign/current-campaign.service';
import { environment } from '../../environments/environment';
import type { AuthUser, LoginDto } from '../../api/auth.api';

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
    expect(fixture.nativeElement.querySelector('a[href="/tag-catalog"]')).toBeNull();
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
    expect(text).toContain('Tag');
    expect(fixture.nativeElement.querySelector('a[href="/equipment-catalog"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="/tag-catalog"]')).toBeTruthy();
  });
});

// Drives the *real* AuthService through login (no page reload / restore()) and
// renders the sidebar off the same instance, proving role-gated UI is available
// immediately after login.
describe('SidebarComponent — Catalogo appears immediately after login', () => {
  const base = environment.apiBaseUrl;
  const CREDS: LoginDto = { username: 'admin', password: 'pw' };
  const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

  let auth: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CurrentCampaignService, useValue: { currentCampaign: signal(null) } },
      ],
    });
    auth = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  async function loginAs(role: AuthUser['role']) {
    const promise = auth.login(CREDS);
    httpMock.expectOne(`${base}/auth/login`).flush({ accessToken: 'jwt', role, expiresIn: 86400 });
    await flushMicrotasks();
    httpMock.expectOne(`${base}/auth/me`).flush({ id: 'u1', username: 'admin', role });
    await promise;
  }

  it('renders Catalogo for an admin right after login, with no refresh', async () => {
    await loginAs('admin');

    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Catalogo');
    expect(fixture.nativeElement.querySelector('a[href="/equipment-catalog"]')).toBeTruthy();
  });

  it('keeps Catalogo hidden for a non-admin after login', async () => {
    await loginAs('player');

    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Catalogo');
    expect(fixture.nativeElement.querySelector('a[href="/equipment-catalog"]')).toBeNull();
  });
});
