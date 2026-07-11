import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Restricts a route to admin sessions. `AuthService.restore()` runs as an app
 * initializer, so `currentUser()` is already resolved by the time this runs.
 *
 * Guards the game-data catalog screens (skills, conditions, species, equipment):
 * the API rejects a non-admin `PATCH` with 403, and this keeps the UI honest
 * about it rather than rendering controls whose writes cannot land.
 */
export const adminGuard: CanMatchFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.currentUser()?.role === 'admin') {
    return true;
  }
  return router.createUrlTree(['/campaigns']);
};
