import { describe, it, expect } from 'vitest';
import type { Route } from '@angular/router';
import { routes } from './app.routes';
import { adminGuard } from './core/auth/admin.guard';

const shellChildren = (): Route[] => routes.find((r) => r.path === '')?.children ?? [];

const CATALOG_ROUTES = [
  'skills-catalog',
  'conditions-catalog',
  'species-catalog',
  'equipment-catalog',
  'tag-catalog',
  'talents-catalog',
];

describe('app routes', () => {
  it.each(CATALOG_ROUTES)('guards the %s route with adminGuard', (path) => {
    const route = shellChildren().find((r) => r.path === path);
    expect(route, `route ${path} is registered`).toBeDefined();
    expect(route?.canMatch).toContain(adminGuard);
  });

  it.each(['species-catalog', 'equipment-catalog', 'tag-catalog', 'talents-catalog'])('lazily loads the %s page', (path) => {
    const route = shellChildren().find((r) => r.path === path);
    expect(route?.loadComponent).toBeTypeOf('function');
  });

  it('leaves non-catalog routes unguarded by adminGuard', () => {
    const campaigns = shellChildren().find((r) => r.path === 'campaigns');
    expect(campaigns?.canMatch ?? []).not.toContain(adminGuard);
  });

  describe('campaign-map', () => {
    const route = () => shellChildren().find((r) => r.path === 'campaign-map');

    it('is registered', () => {
      expect(route()).toBeDefined();
    });

    it('is guarded by adminGuard', () => {
      // Authoring the map exposes non-public places, which the API only ships to
      // an admin. Without this guard the screen would render an empty map for a
      // player and silently drop their edits at the PUT.
      expect(route()?.canMatch).toContain(adminGuard);
    });

    it('lazily loads the page', () => {
      expect(route()?.loadComponent).toBeTypeOf('function');
    });
  });
});
