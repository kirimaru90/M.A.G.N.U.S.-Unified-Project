import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import type { components } from './generated/openapi-types';

export type LoginDto = components['schemas']['LoginDto'];

// TODO(openapi-gap): the OpenAPI spec (reference/API-docs.json) declares the 200 responses for
// POST /auth/login and GET /auth/me without a schema. The shapes below are derived from
// design.md Decision 1 and the MSW mock layer. When the backend spec is tightened to declare
// these schemas in components.schemas, regenerate (`npm run api:gen`) and replace these
// hand-typed interfaces with the generated ones.
export interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'player';
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export type MeResponse = AuthUser;

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  login(body: LoginDto): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/auth/login`, body);
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/logout`, null);
  }

  me(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.base}/auth/me`);
  }
}
