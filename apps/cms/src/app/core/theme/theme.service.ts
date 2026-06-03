import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'rc.bo.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.resolveInitial());

  private skipNextPersist = true;

  constructor() {
    effect(() => {
      const value = this.theme();
      // Mirror onto <html> so PrimeNG's :root[data-theme="dark"] selector fires.
      document.documentElement.setAttribute('data-theme', value);
      if (this.skipNextPersist) {
        this.skipNextPersist = false;
        return;
      }
      try {
        localStorage.setItem(STORAGE_KEY, value);
      } catch {
        // localStorage may be unavailable (private mode, quota); the in-memory signal is still authoritative for the session.
      }
    });
  }

  toggle(): void {
    this.theme.update((t) => (t === 'light' ? 'dark' : 'light'));
  }

  private resolveInitial(): Theme {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  }
}
