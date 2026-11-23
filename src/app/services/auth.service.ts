import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import {
  AuthResponse,
  AuthSessionResponse,
  AuthUser,
  LoginDraft,
  RegistrationDraft,
} from '../models/auth.model';

const AUTH_API_URL = '/api/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<AuthUser | null>(null);
  readonly loading = signal(true);
  readonly sessionError = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  private readonly http = inject(HttpClient);

  constructor() {
    this.http.get<AuthSessionResponse>(`${AUTH_API_URL}/me`).subscribe({
      next: ({ user }) => {
        this.user.set(user);
        this.loading.set(false);
      },
      error: () => {
        this.sessionError.set('Could not check your sign-in status. Please refresh the page.');
        this.loading.set(false);
      },
    });
  }

  register(draft: RegistrationDraft): Observable<AuthUser> {
    return this.http.post<AuthResponse>(`${AUTH_API_URL}/register`, draft).pipe(
      map(({ user }) => user),
      tap((user) => this.setUser(user)),
    );
  }

  login(draft: LoginDraft): Observable<AuthUser> {
    return this.http.post<AuthResponse>(`${AUTH_API_URL}/login`, draft).pipe(
      map(({ user }) => user),
      tap((user) => this.setUser(user)),
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${AUTH_API_URL}/logout`, null).pipe(
      tap(() => {
        this.user.set(null);
        this.error.set(null);
      }),
    );
  }

  setError(message: string): void {
    this.error.set(message);
  }

  private setUser(user: AuthUser): void {
    this.user.set(user);
    this.error.set(null);
    this.sessionError.set(null);
  }
}
