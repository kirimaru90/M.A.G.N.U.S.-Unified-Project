import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import type { LoginDto } from '../../../api/auth.api';

const base = environment.apiBaseUrl;
const TOKEN_KEY = 'magnus.auth.token';
const CREDS: LoginDto = { username: 'admin', password: 'pw' };

/** Drain the microtask queue so login()'s awaited continuation issues /auth/me. */
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  async function loginWith(rememberMe?: boolean) {
    const promise = service.login({ ...CREDS, rememberMe });
    httpMock.expectOne(`${base}/auth/login`).flush({ accessToken: 'jwt', role: 'admin', expiresIn: 86400 });
    await flushMicrotasks();
    httpMock.expectOne(`${base}/auth/me`).flush({ id: 'u1', username: 'admin', role: 'admin' });
    await promise;
  }

  /** Re-create the service so the token signal re-reads storage, as on app boot. */
  function reboot(): AuthService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    httpMock = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  it('stores the token in localStorage only when rememberMe is true', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'stale');
    await loginWith(true);
    expect(localStorage.getItem(TOKEN_KEY)).toBe('jwt');
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('stores the token in sessionStorage only when rememberMe is false or absent', async () => {
    localStorage.setItem(TOKEN_KEY, 'stale');
    await loginWith(false);
    expect(sessionStorage.getItem(TOKEN_KEY)).toBe('jwt');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();

    sessionStorage.clear();
    await loginWith(undefined);
    expect(sessionStorage.getItem(TOKEN_KEY)).toBe('jwt');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('restores the token from localStorage', () => {
    localStorage.setItem(TOKEN_KEY, 'from-local');
    expect(reboot().token()).toBe('from-local');
  });

  it('restores the token from sessionStorage when localStorage has none', () => {
    sessionStorage.setItem(TOKEN_KEY, 'from-session');
    expect(reboot().token()).toBe('from-session');
  });

  it('prefers localStorage over sessionStorage on restore', () => {
    localStorage.setItem(TOKEN_KEY, 'from-local');
    sessionStorage.setItem(TOKEN_KEY, 'from-session');
    expect(reboot().token()).toBe('from-local');
  });

  it('clear() removes the token from both stores', () => {
    localStorage.setItem(TOKEN_KEY, 'a');
    sessionStorage.setItem(TOKEN_KEY, 'b');
    service.clear();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(service.token()).toBeNull();
  });

  it('hydrates currentUser (with role) from /auth/me during login, since login carries no user', async () => {
    const promise = service.login(CREDS);

    // The login response is only the token/role/expiry scalars — no user object.
    const loginReq = httpMock.expectOne(`${base}/auth/login`);
    expect(loginReq.request.method).toBe('POST');
    expect(loginReq.request.body).toEqual(CREDS);
    loginReq.flush({ accessToken: 'jwt-123', role: 'admin', expiresIn: 86400 });

    // login() then fetches the full user from /auth/me before it resolves.
    await flushMicrotasks();
    const meReq = httpMock.expectOne(`${base}/auth/me`);
    expect(meReq.request.method).toBe('GET');
    meReq.flush({ id: 'u1', username: 'admin', role: 'admin' });

    const user = await promise;

    expect(service.token()).toBe('jwt-123');
    expect(service.currentUser()?.role).toBe('admin');
    expect(service.isAuthenticated()).toBe(true);
    expect(user?.role).toBe('admin');
  });

  it('hydrates a non-admin user just the same', async () => {
    const promise = service.login(CREDS);
    httpMock.expectOne(`${base}/auth/login`).flush({ accessToken: 'jwt', role: 'player', expiresIn: 86400 });

    await flushMicrotasks();
    httpMock.expectOne(`${base}/auth/me`).flush({ id: 'u2', username: 'player1', role: 'player' });
    await promise;

    expect(service.currentUser()?.role).toBe('player');
    expect(service.isAuthenticated()).toBe(true);
  });

  it('clears every session signal on logout', async () => {
    const promise = service.login(CREDS);
    httpMock.expectOne(`${base}/auth/login`).flush({ accessToken: 'jwt', role: 'admin', expiresIn: 86400 });
    await flushMicrotasks();
    httpMock.expectOne(`${base}/auth/me`).flush({ id: 'u1', username: 'admin', role: 'admin' });
    await promise;

    const logout = service.logout();
    httpMock.expectOne(`${base}/auth/logout`).flush(null);
    await logout;

    expect(service.token()).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });
});
