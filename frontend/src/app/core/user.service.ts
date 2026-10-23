import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { AuthService } from './auth.service';
import { API_URL } from './config';
import { User } from './models';

export interface ClientAddress {
  id: string;
  label: string; 
  address: string;
  city: string;
  postalCode: string;
  notes?: string;
  isDefault: boolean;
}

export interface ClientServiceRequestSummary {
  id: number;
  categoryName: string;
  categoryIcon: string;
  technicianName?: string;
  technicianPhoto?: string;
  description: string;
  status: 'pending' | 'accepted' | 'en_route' | 'in_progress' | 'completed' | 'paid' | 'cancelled';
  statusLabel: string;
  date: string;
  price?: number;
  address: string;
  latitude?: number;
  longitude?: number;
  photos?: string[];
}

export interface CreateServiceRequestPayload {
  category: number;
  description: string;
  address: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  latitude?: number;
  longitude?: number;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  getProfile(): Observable<User> {
    return this.http.get<User>(`${API_URL}/auth/me/`);
  }

  updateProfile(data: Partial<User>): Observable<User> {
    return this.http.patch<User>(`${API_URL}/auth/me/`, data).pipe(
      tap((updatedUser) => {
        // Sync with local storage and signal state in AuthService
        localStorage.setItem('sh_user', JSON.stringify(updatedUser));
        (this.authService as any)._user?.set(updatedUser);
      })
    );
  }

  createServiceRequest(formData: FormData): Observable<any> {
    return this.http.post<any>(`${API_URL}/missions/requests/`, formData);
  }

  getServiceRequests(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/missions/requests/`);
  }
}
