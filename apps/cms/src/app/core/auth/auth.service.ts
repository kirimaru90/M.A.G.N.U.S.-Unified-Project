import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, firstValueFrom, of, tap } from 'rxjs';
import { AuthApi, AuthUser, LoginDto } from '../../../api/auth.api';

const TOKEN_KEY = 'magnus.auth.token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApi);

  readonly token = signal<string | null>(this.readToken());
  readonly currentUser = signal<AuthUser | null>(null);
  readonly isAuthenticated = computed(() => this.token() !== null);

  async login(creds: LoginDto): Promise<AuthUser> {
    const response = await firstValueFrom(this.api.login(creds));
    this.persistToken(response.accessToken);
    this.token.set(response.accessToken);
    this.currentUser.set(response.user);
    return response.user;
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
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
  }

  private persistToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // ignore
    }
  }

  private readToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }
}
