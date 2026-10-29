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

  private _accessToken = signal<string | null>(this.readStoredToken(ACCESS_KEY));
  private _refreshToken = signal<string | null>(this.readStoredToken(REFRESH_KEY));
  private _user = signal<User | null>(this.readStoredUser());
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);

  get accessToken(): string | null {
    return this._accessToken() || sessionStorage.getItem(ACCESS_KEY) || localStorage.getItem(ACCESS_KEY);
  }

  get refreshToken(): string | null {
    return this._refreshToken() || sessionStorage.getItem(REFRESH_KEY) || localStorage.getItem(REFRESH_KEY);
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
        const userJson = JSON.stringify(res.user);
        sessionStorage.setItem(ACCESS_KEY, res.access);
        sessionStorage.setItem(REFRESH_KEY, res.refresh);
        sessionStorage.setItem(USER_KEY, userJson);
        localStorage.setItem(ACCESS_KEY, res.access);
        localStorage.setItem(REFRESH_KEY, res.refresh);
        localStorage.setItem(USER_KEY, userJson);
        this._accessToken.set(res.access);
        this._refreshToken.set(res.refresh);
        this._user.set(res.user);
      }),
    );
  }

  refresh(): Observable<{ access: string }> {
    return this.http
      .post<{ access: string }>(`${API_URL}/auth/refresh/`, { refresh: this.refreshToken })
      .pipe(
        tap((res) => {
          sessionStorage.setItem(ACCESS_KEY, res.access);
          localStorage.setItem(ACCESS_KEY, res.access);
          this._accessToken.set(res.access);
        })
      );
  }

  updateCurrentUser(user: User): void {
    const userJson = JSON.stringify(user);
    sessionStorage.setItem(USER_KEY, userJson);
    localStorage.setItem(USER_KEY, userJson);
    this._user.set(user);
  }

  logout(): void {
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this._accessToken.set(null);
    this._refreshToken.set(null);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  homeRoute(role: Role): string {
    return `/${role}`;
  }

  private readStoredToken(key: string): string | null {
    const sessionVal = sessionStorage.getItem(key);
    if (sessionVal) {
      return sessionVal;
    }
    const localVal = localStorage.getItem(key);
    if (localVal) {
      sessionStorage.setItem(key, localVal);
    }
    return localVal;
  }

  private readStoredUser(): User | null {
    try {
      const sessionRaw = sessionStorage.getItem(USER_KEY);
      if (sessionRaw) {
        return JSON.parse(sessionRaw) as User;
      }
      const localRaw = localStorage.getItem(USER_KEY);
      if (localRaw) {
        sessionStorage.setItem(USER_KEY, localRaw);
        return JSON.parse(localRaw) as User;
      }
      return null;
    } catch {
      return null;
    }
  }
}
