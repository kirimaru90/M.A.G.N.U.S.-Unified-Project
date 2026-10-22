import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, firstValueFrom, of, tap } from 'rxjs';
import { AuthApi, AuthUser, LoginDto } from '../../../api/auth.api';

const TOKEN_KEY = 'magnus.auth.token';

/**
 * Read order: localStorage first, then sessionStorage. Accessors, because touching
 * a store can itself throw when storage is disabled by policy.
 */
const STORES: ReadonlyArray<() => Storage> = [() => localStorage, () => sessionStorage];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApi);

  readonly token = signal<string | null>(this.readToken());
  readonly currentUser = signal<AuthUser | null>(null);
  readonly isAuthenticated = computed(() => this.token() !== null);

  async login(creds: LoginDto): Promise<AuthUser | null> {
    const response = await firstValueFrom(this.api.login(creds));
    this.persistToken(response.accessToken, creds.rememberMe ?? false);
    this.token.set(response.accessToken);
    // The login response carries no user object, so hydrate `currentUser`
    // (including `role`) from GET /auth/me before resolving. This makes
    // role-gated UI render immediately, without waiting for a later restore().
    await this.restore();
    return this.currentUser();
  }

  async logout(): Promise<void> {
    if (this.token()) {
      await firstValueFrom(this.api.logout().pipe(catchError(() => of(void 0))));
    }
    this.clear();
  }

  async restore(): Promise<void> {
    if (!this.token()) {
      return;
    }
    await firstValueFrom(
      this.api.me().pipe(
        tap((user) => this.currentUser.set(user)),
        catchError(() => of(null)),
      ),
    );
  }

  clear(): void {
    this.token.set(null);
    this.currentUser.set(null);
    for (const store of STORES) {
      try {
        store().removeItem(TOKEN_KEY);
      } catch {
        // ignore
      }
    }
  }

  /** "Ricordami" → localStorage; otherwise sessionStorage. Only one store holds the key. */
  private persistToken(token: string, remember: boolean): void {
    const [local, session] = STORES;
    const [target, other] = remember ? [local, session] : [session, local];
    try {
      target().setItem(TOKEN_KEY, token);
    } catch {
      // ignore
    }
    try {
      other().removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
  }

  private readToken(): string | null {
    for (const store of STORES) {
      try {
        const token = store().getItem(TOKEN_KEY);
        if (token) return token;
      } catch {
        // ignore
      }
    }
    return null;
  }
}
