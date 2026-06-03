import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { ThemeService } from '../core/theme/theme.service';
import { MoonIcon } from '../icons/moon-icon';
import { SunIcon } from '../icons/sun-icon';
import { CampaignWorkspaceSwitcherComponent } from './campaign-workspace-switcher';

const APP_VERSION = 'v0.1.0';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [SunIcon, MoonIcon, CampaignWorkspaceSwitcherComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="bo-topbar">
      <span class="bo-logo">
        <span class="bo-logo-mark"></span>
        <span>MAGNUS</span>
      </span>

      <span class="bo-crumbs">
        <span class="c-current">Backoffice</span>
      </span>

      <app-campaign-workspace-switcher />

      <div class="bo-topbar-right">
        <span>{{ version }}</span>
        <button
          type="button"
          class="bo-btn ghost icon"
          [attr.aria-label]="themeToggleLabel()"
          (click)="theme.toggle()"
        >
          @if (theme.theme() === 'dark') {
            <app-sun-icon />
          } @else {
            <app-moon-icon />
          }
        </button>
        <span class="bo-user-chip">
          <span class="dot"></span>
          <span>{{ username() }}</span>
        </span>
        <button type="button" class="bo-btn ghost" (click)="logout()">Esci</button>
      </div>
    </header>
  `,
})
export class TopbarComponent {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  protected readonly version = APP_VERSION;
  protected readonly username = computed(() => this.auth.currentUser()?.username ?? '');
  protected readonly themeToggleLabel = computed(() =>
    this.theme.theme() === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro',
  );

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
