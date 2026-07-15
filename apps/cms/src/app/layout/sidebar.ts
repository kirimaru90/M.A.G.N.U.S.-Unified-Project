import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';

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

          <a routerLink="/terminals" [class.active]="isTerminaliActive()">
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
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </span>
            <span>Terminali</span>
          </a>
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

      @if (isAdmin()) {
      <div>
        <div class="section-label">Catalogo</div>
        <nav class="bo-nav">
          <a routerLink="/skills-catalog" [class.active]="isSkillsCatalogActive()">
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
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" />
              </svg>
            </span>
            <span>Abilità</span>
          </a>
          <a routerLink="/conditions-catalog" [class.active]="isConditionsCatalogActive()">
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
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </span>
            <span>Condizioni</span>
          </a>
          <a routerLink="/species-catalog" [class.active]="isSpeciesCatalogActive()">
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
                <path d="M22 11l-3-3-3 3" />
              </svg>
            </span>
            <span>Specie</span>
          </a>
          <a routerLink="/equipment-catalog" [class.active]="isEquipmentCatalogActive()">
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
                <path
                  d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
                />
              </svg>
            </span>
            <span>Equipaggiamento</span>
          </a>
          <a routerLink="/tag-catalog" [class.active]="isTagCatalogActive()">
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
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
            </span>
            <span>Tag</span>
          </a>
          <a routerLink="/talents-catalog" [class.active]="isTalentsCatalogActive()">
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
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </span>
            <span>Talenti</span>
          </a>
        </nav>
      </div>
      }
    </aside>
  `,
})
export class SidebarComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /**
   * The Catalogo section links to admin-guarded routes; a non-admin who clicked
   * one would just be bounced. Hide the whole section for non-admins (the route
   * guard stays as the security boundary — this is a UX layer on top of it).
   */
  protected readonly isAdmin = computed(
    () => this.auth.currentUser()?.role === 'admin',
  );

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

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

  protected readonly isSkillsCatalogActive = computed(() => {
    return this.currentUrl().startsWith('/skills-catalog');
  });

  protected readonly isConditionsCatalogActive = computed(() => {
    return this.currentUrl().startsWith('/conditions-catalog');
  });

  protected readonly isSpeciesCatalogActive = computed(() => {
    return this.currentUrl().startsWith('/species-catalog');
  });

  protected readonly isEquipmentCatalogActive = computed(() => {
    return this.currentUrl().startsWith('/equipment-catalog');
  });

  protected readonly isTagCatalogActive = computed(() => {
    return this.currentUrl().startsWith('/tag-catalog');
  });

  protected readonly isTalentsCatalogActive = computed(() => {
    return this.currentUrl().startsWith('/talents-catalog');
  });
}
