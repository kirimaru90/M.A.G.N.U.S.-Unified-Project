import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { CurrentCampaignService } from '../core/campaign/current-campaign.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="bo-sidebar">
      <div>
        <div class="section-label">Campagna</div>
        <nav class="bo-nav">
          <a routerLink="/campaigns" [class.active]="isCampagneActive()">
            <span class="ico">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
            </span>
            <span>Campagne</span>
          </a>

          @if (terminaliLink(); as link) {
            <a [routerLink]="link" [class.active]="isTerminaliActive()">
              <span class="ico">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </span>
              <span>Terminali</span>
            </a>
          } @else {
            <button type="button" class="nav-link" disabled aria-disabled="true">
              <span class="ico">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </span>
              <span>Terminali</span>
            </button>
          }
        </nav>
      </div>

      <div>
        <div class="section-label">Sistema</div>
        <nav class="bo-nav">
          <a routerLink="/users" [class.active]="isUtentiActive()">
            <span class="ico">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            <span>Utenti</span>
          </a>
        </nav>
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  private readonly currentCampaign = inject(CurrentCampaignService);
  private readonly router = inject(Router);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly terminaliLink = computed(() => {
    const id = this.currentCampaign.currentCampaign()?.id;
    return id ? `/campaigns/${id}/terminals` : null;
  });

  protected readonly isCampagneActive = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/campaigns') && !url.includes('/terminals');
  });

  protected readonly isTerminaliActive = computed(() => {
    const url = this.currentUrl();
    return url.includes('/terminals');
  });

  protected readonly isUtentiActive = computed(() => {
    return this.currentUrl().startsWith('/users');
  });
}
