import { Injectable, signal } from '@angular/core';

/**
 * The single breakpoint below which the sidebar collapses to an off-canvas
 * drawer and `.cm-grid` stacks to one column. This is the CMS's first
 * responsive boundary. CSS `@media` queries cannot read a JS constant, so the
 * literal `768px` is repeated in the stylesheets that key off it — grep for this
 * name (or the value) to find every site if the breakpoint ever moves:
 *   - styles/tokens.css       (sidebar drawer + hamburger)
 *   - features/campaign-map   (.cm-grid single column)
 */
export const MOBILE_BREAKPOINT_PX = 768;

/**
 * Shell-wide layout state shared without prop-drilling. Today it holds only the
 * mobile sidebar drawer's open/closed flag, which the topbar (hamburger button)
 * writes and the shell/sidebar (drawer + backdrop) reads. The flag is
 * meaningful only below {@link MOBILE_BREAKPOINT_PX}; above it the drawer CSS is
 * inert, so leaving the signal set does no harm.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly sidebarOpen = signal(false);

  openSidebar(): void {
    this.sidebarOpen.set(true);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }
}
