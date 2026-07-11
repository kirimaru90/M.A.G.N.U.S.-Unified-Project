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
];

describe('app routes', () => {
  it.each(CATALOG_ROUTES)('guards the %s route with adminGuard', (path) => {
    const route = shellChildren().find((r) => r.path === path);
    expect(route, `route ${path} is registered`).toBeDefined();
    expect(route?.canMatch).toContain(adminGuard);
  });

  it.each(['species-catalog', 'equipment-catalog'])('lazily loads the %s page', (path) => {
    const route = shellChildren().find((r) => r.path === path);
    expect(route?.loadComponent).toBeTypeOf('function');
  });

  it('leaves non-catalog routes unguarded by adminGuard', () => {
    const campaigns = shellChildren().find((r) => r.path === 'campaigns');
    expect(campaigns?.canMatch ?? []).not.toContain(adminGuard);
  });
});
