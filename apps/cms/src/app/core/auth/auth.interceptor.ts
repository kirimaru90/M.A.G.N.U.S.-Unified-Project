import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

const LOGIN_PATH = '/auth/login';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isApiRequest = req.url.startsWith(environment.apiBaseUrl);
  const isLoginRequest = req.url.endsWith(LOGIN_PATH);

  let outgoing = req;
  const token = auth.token();
  if (isApiRequest && token) {
    outgoing = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isApiRequest &&
        !isLoginRequest
      ) {
        auth.clear();
        if (router.url !== '/login') {
          void router.navigate(['/login']);
        }
      }
      return throwError(() => error);
    }),
  );
};
