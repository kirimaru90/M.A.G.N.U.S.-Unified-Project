import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { UserDto } from './user.types';

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/users`;

  list(): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(this.base);
  }

  get(id: string): Observable<UserDto> {
    return this.http.get<UserDto>(`${this.base}/${id}`);
  }

  create(dto: { username: string; role: string; password: string }): Observable<UserDto> {
    return this.http.post<UserDto>(this.base, dto);
  }

  update(id: string, dto: Partial<{ username: string; role: string; password: string }>): Observable<UserDto> {
    return this.http.put<UserDto>(`${this.base}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
