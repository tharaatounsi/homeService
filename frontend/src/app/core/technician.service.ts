import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from './config';
import { MissionInvoiceData, MissionPaymentData, MissionQuoteData } from './user.service';

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface AvailabilitySlotPayload {
  weekday: number; // 0=Lundi, 6=Dimanche
  start_time: string; // "08:00:00"
  end_time: string;   // "17:00:00"
}

export interface TechnicianProfileResponse {
  id: number;
  username: string;
  email: string;
  phone: string;
  bio: string;
  experience_years: number;
  categories: number[];
  latitude: number | null;
  longitude: number | null;
  service_radius_km: number;
  is_available: boolean;
  is_approved: boolean;
  is_complete: boolean;
  rating_avg: string | number;
  rating_count: number;
}

export interface PublicTechnicianProfile {
  id: number;
  user_id?: number;
  username: string;
  bio: string;
  experience_years: number;
  category_list: Category[];
  latitude: number | null;
  longitude: number | null;
  service_radius_km: number;
  is_available: boolean;
  rating_avg: string | number;
  rating_count: number;
}

export interface ProfileUpdatePayload {
  bio?: string;
  experience_years?: number;
  categories?: number[];
  latitude?: number | null;
  longitude?: number | null;
  service_radius_km?: number;
}

@Injectable({ providedIn: 'root' })
export class TechnicianService {
  private http = inject(HttpClient);

  getPublicTechnicians(): Observable<PublicTechnicianProfile[]> {
    return this.http.get<PublicTechnicianProfile[]>(`${API_URL}/technicians/public/`);
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${API_URL}/catalog/categories/`);
  }

  getProfile(): Observable<TechnicianProfileResponse> {
    return this.http.get<TechnicianProfileResponse>(`${API_URL}/technicians/me/`);
  }

  updateProfile(payload: ProfileUpdatePayload): Observable<TechnicianProfileResponse> {
    return this.http.patch<TechnicianProfileResponse>(`${API_URL}/technicians/me/`, payload);
  }

  updateStatus(isAvailable: boolean): Observable<TechnicianProfileResponse> {
    return this.http.post<TechnicianProfileResponse>(`${API_URL}/technicians/me/status/`, {
      is_available: isAvailable,
    });
  }

  getSchedule(): Observable<{ slots: AvailabilitySlotPayload[] }> {
    return this.http.get<{ slots: AvailabilitySlotPayload[] }>(`${API_URL}/technicians/me/schedule/`);
  }

  updateSchedule(slots: AvailabilitySlotPayload[]): Observable<{ slots: AvailabilitySlotPayload[] }> {
    return this.http.put<{ slots: AvailabilitySlotPayload[] }>(`${API_URL}/technicians/me/schedule/`, { slots });
  }

  getIncomingMissions(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/missions/requests/`);
  }

  getAvailableMissions(allZones: boolean = false): Observable<any[]> {
    const url = allZones
      ? `${API_URL}/missions/requests/?scope=available&all_zones=true`
      : `${API_URL}/missions/requests/?scope=available`;
    return this.http.get<any[]>(url);
  }

  acceptMission(id: number): Observable<any> {
    return this.http.post<any>(`${API_URL}/missions/requests/${id}/accept/`, {});
  }

  updateMissionStatus(id: number, status: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/missions/requests/${id}/status/`, { status });
  }

  cancelMission(id: number): Observable<any> {
    return this.http.post<any>(`${API_URL}/missions/requests/${id}/cancel/`, {});
  }

  emitMissionLocation(id: number, lat: number, lng: number): Observable<any> {
    return this.http.post<any>(`${API_URL}/missions/requests/${id}/location/`, {
      latitude: lat,
      longitude: lng,
    });
  }

  submitQuote(
    id: number,
    payload: { labor_price: number; parts_price?: number; description?: string }
  ): Observable<MissionQuoteData> {
    return this.http.post<MissionQuoteData>(`${API_URL}/missions/requests/${id}/quote/`, payload);
  }

  confirmCashPayment(id: number, amount?: number): Observable<any> {
    return this.http.post<any>(`${API_URL}/missions/requests/${id}/pay/`, {
      method: 'cash',
      amount,
    });
  }

  getInvoice(id: number): Observable<MissionInvoiceData> {
    return this.http.get<MissionInvoiceData>(`${API_URL}/missions/requests/${id}/invoice/`);
  }
}

