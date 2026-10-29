import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from './config';
import { MissionInvoiceData, MissionPaymentData, MissionQuoteData } from './user.service';

export interface AdminTechnicianItem {
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

export interface AdminStats {
  total_clients: number;
  total_technicians: number;
  approved_technicians: number;
  pending_technicians: number;
  total_missions: number;
  pending_missions: number;
  in_progress_missions: number;
  completed_missions: number;
  cancelled_missions: number;
  total_categories: number;
}

export interface AdminClientItem {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role: string;
  date_joined?: string;
  is_active: boolean;
  requests_count?: number;
}

export interface AdminMissionItem {
  id: number;
  client: number;
  client_name: string;
  client_email: string;
  client_phone: string;
  technician?: number | null;
  technician_name?: string;
  technician_email?: string;
  technician_phone?: string;
  category: number;
  category_name: string;
  description: string;
  address: string;
  status: 'pending' | 'accepted' | 'en_route' | 'in_progress' | 'completed' | 'paid' | 'cancelled';
  urgency: string;
  estimated_price?: number | null;
  created_at: string;
  updated_at?: string;
  events?: any[];
  quote?: MissionQuoteData;
  payment?: MissionPaymentData;
}

export interface AdminCategoryItem {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
  technicians_count?: number;
  requests_count?: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);

  getStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${API_URL}/auth/admin/stats/`);
  }

  getTechnicians(approved?: boolean): Observable<AdminTechnicianItem[]> {
    const url = approved !== undefined
      ? `${API_URL}/technicians/?approved=${approved}`
      : `${API_URL}/technicians/`;
    return this.http.get<AdminTechnicianItem[]>(url);
  }

  approveTechnician(id: number): Observable<AdminTechnicianItem> {
    return this.http.post<AdminTechnicianItem>(`${API_URL}/technicians/${id}/approve/`, {});
  }

  rejectTechnician(id: number): Observable<AdminTechnicianItem> {
    return this.http.post<AdminTechnicianItem>(`${API_URL}/technicians/${id}/reject/`, {});
  }

  deleteTechnician(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/technicians/${id}/`);
  }

  getClients(): Observable<AdminClientItem[]> {
    return this.http.get<AdminClientItem[]>(`${API_URL}/auth/admin/users/?role=client`);
  }

  getMissions(): Observable<AdminMissionItem[]> {
    return this.http.get<AdminMissionItem[]>(`${API_URL}/missions/requests/`);
  }

  cancelMission(id: number): Observable<any> {
    return this.http.post<any>(`${API_URL}/missions/requests/${id}/cancel/`, {});
  }

  getCategories(): Observable<AdminCategoryItem[]> {
    return this.http.get<AdminCategoryItem[]>(`${API_URL}/catalog/categories/`);
  }

  getInvoice(id: number): Observable<MissionInvoiceData> {
    return this.http.get<MissionInvoiceData>(`${API_URL}/missions/requests/${id}/invoice/`);
  }
}
