import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { API_URL } from './config';
import { LoginResponse, RegisterPayload, Role, User } from './models';

const ACCESS_KEY = 'sh_access';
const REFRESH_KEY = 'sh_refresh';
const USER_KEY = 'sh_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private _user = signal<User | null>(this.readStoredUser());
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);

  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.accessToken && this._user() !== null;
  }

  register(payload: RegisterPayload): Observable<User> {
    return this.http.post<User>(`${API_URL}/auth/register/`, payload);
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${API_URL}/auth/login/`, { email, password }).pipe(
      tap((res) => {
        localStorage.setItem(ACCESS_KEY, res.access);
        localStorage.setItem(REFRESH_KEY, res.refresh);
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        this._user.set(res.user);
      }),
    );
  }

  refresh(): Observable<{ access: string }> {
    return this.http
      .post<{ access: string }>(`${API_URL}/auth/refresh/`, { refresh: this.refreshToken })
      .pipe(tap((res) => localStorage.setItem(ACCESS_KEY, res.access)));
  }

  logout(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  homeRoute(role: Role): string {
    return `/${role}`;
  }

  private readStoredUser(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }
}
