import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { adminGuard } from './admin.guard';
import { AuthService } from './auth.service';
import type { AuthUser } from '../../../api/auth.api';

function runGuard(user: AuthUser | null): boolean | UrlTree {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { currentUser: signal(user) } },
    ],
  });
  return TestBed.runInInjectionContext(
    () => adminGuard({ path: 'species-catalog' }, []) as boolean | UrlTree,
  );
}

describe('adminGuard', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('allows an admin through', () => {
    expect(runGuard({ id: '1', username: 'admin', role: 'admin' })).toBe(true);
  });

  it('redirects a player away from a catalog route', () => {
    const result = runGuard({ id: '2', username: 'player', role: 'player' });
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/campaigns');
  });

  it('redirects when there is no resolved user', () => {
    const result = runGuard(null);
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/campaigns');
  });
});
