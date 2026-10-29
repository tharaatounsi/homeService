import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { AuthService } from './auth.service';
import { API_URL } from './config';
import { User } from './models';

export interface ClientAddress {
  id?: number;
  label: string;
  address: string;
  city: string;
  postal_code?: string;
  notes?: string;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  is_default: boolean;
  created_at?: string;
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
  new_password_confirm: string;
}

export interface MissionQuoteData {
  id: number;
  request: number;
  labor_price: number | string;
  parts_price: number | string;
  total_price: number | string;
  description: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at?: string;
}

export interface MissionPaymentData {
  id: number;
  request: number;
  method: 'cash' | 'online';
  amount: number | string;
  platform_fee: number | string;
  technician_amount: number | string;
  transaction_id: string;
  card_last4?: string;
  status: 'completed' | 'pending' | 'failed';
  paid_at: string;
}

export interface MissionInvoiceData {
  invoice_number: string;
  invoice_date: string;
  request_id: number;
  category_name: string;
  description: string;
  address: string;
  client: { id: number; name: string; email: string; phone: string };
  technician: { id: number | null; name: string; email: string; phone: string };
  items: { label: string; amount: number }[];
  total_amount: number;
  platform_fee: number;
  technician_net: number;
  payment_method: string;
  payment_method_code?: 'cash' | 'online';
  payment_status: string;
  transaction_id?: string;
  card_last4?: string;
  is_paid: boolean;
}

export interface ClientServiceRequestSummary {
  id: number;
  categoryName: string;
  categoryIcon: string;
  technicianId?: number;
  technicianName?: string;
  technicianEmail?: string;
  technicianPhoto?: string;
  technicianPhone?: string;
  description: string;
  status: 'pending' | 'accepted' | 'en_route' | 'in_progress' | 'completed' | 'paid' | 'cancelled';
  statusLabel: string;
  date: string;
  price?: number;
  address: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  photos?: string[];
  events?: any[];
  quote?: MissionQuoteData;
  payment?: MissionPaymentData;
}

export interface MissionMessageItem {
  id: number;
  request?: number | null;
  sender: number;
  sender_name: string;
  sender_email: string;
  sender_role: string;
  recipient?: number | null;
  recipient_name?: string;
  recipient_email?: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface ConversationSummary {
  partner_id: number;
  partner_name: string;
  partner_email: string;
  partner_phone: string;
  partner_role: string;
  request_id?: number | null;
  request_category?: string | null;
  request_status?: string | null;
  request_address?: string | null;
  last_message: string;
  last_message_at?: string | null;
  unread_count: number;
}

export interface MissionTrackingData {
  request_id: number;
  status: string;
  status_display: string;
  technician_name: string;
  technician_phone: string;
  technician_lat: number | null;
  technician_lng: number | null;
  client_lat: number;
  client_lng: number;
  client_address: string;
  distance_km: number | null;
  eta_minutes: number | null;
  is_en_route: boolean;
}

export interface ConversationDetailResponse {
  partner: {
    id: number;
    username: string;
    email: string;
    phone: string;
    role: string;
  };
  request?: {
    id: number;
    category_name: string;
    status: string;
    description: string;
    address: string;
  } | null;
  messages: MissionMessageItem[];
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
        this.authService.updateCurrentUser(updatedUser);
      })
    );
  }

  createServiceRequest(formData: FormData): Observable<any> {
    return this.http.post<any>(`${API_URL}/missions/requests/`, formData);
  }

  getServiceRequests(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/missions/requests/`);
  }

  getServiceRequestDetail(id: number): Observable<any> {
    return this.http.get<any>(`${API_URL}/missions/requests/${id}/`);
  }

  cancelServiceRequest(id: number): Observable<any> {
    return this.http.post<any>(`${API_URL}/missions/requests/${id}/cancel/`, {});
  }

  getAddresses(): Observable<ClientAddress[]> {
    return this.http.get<ClientAddress[]>(`${API_URL}/auth/addresses/`);
  }

  createAddress(data: Partial<ClientAddress>): Observable<ClientAddress> {
    return this.http.post<ClientAddress>(`${API_URL}/auth/addresses/`, data);
  }

  updateAddress(id: number, data: Partial<ClientAddress>): Observable<ClientAddress> {
    return this.http.patch<ClientAddress>(`${API_URL}/auth/addresses/${id}/`, data);
  }

  deleteAddress(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/auth/addresses/${id}/`);
  }

  setDefaultAddress(id: number): Observable<ClientAddress> {
    return this.http.patch<ClientAddress>(`${API_URL}/auth/addresses/${id}/`, { is_default: true });
  }

  changePassword(payload: ChangePasswordPayload): Observable<any> {
    return this.http.post<any>(`${API_URL}/auth/change-password/`, payload);
  }

  getConversations(): Observable<ConversationSummary[]> {
    return this.http.get<ConversationSummary[]>(`${API_URL}/missions/conversations/`);
  }

  getConversationMessages(partnerId: number): Observable<ConversationDetailResponse> {
    return this.http.get<ConversationDetailResponse>(
      `${API_URL}/missions/conversations/${partnerId}/messages/`
    );
  }

  sendDirectMessage(
    partnerId: number,
    content: string,
    requestId?: number | null
  ): Observable<MissionMessageItem> {
    return this.http.post<MissionMessageItem>(
      `${API_URL}/missions/conversations/${partnerId}/messages/`,
      { content, request_id: requestId ?? null }
    );
  }

  getRequestMessages(requestId: number): Observable<MissionMessageItem[]> {
    return this.http.get<MissionMessageItem[]>(`${API_URL}/missions/requests/${requestId}/messages/`);
  }

  sendRequestMessage(
    requestId: number,
    content: string,
    recipientId?: number
  ): Observable<MissionMessageItem> {
    return this.http.post<MissionMessageItem>(
      `${API_URL}/missions/requests/${requestId}/messages/`,
      { content, recipient_id: recipientId }
    );
  }

  getMissionTracking(requestId: number): Observable<MissionTrackingData> {
    return this.http.get<MissionTrackingData>(`${API_URL}/missions/requests/${requestId}/tracking/`);
  }

  getQuote(requestId: number): Observable<MissionQuoteData> {
    return this.http.get<MissionQuoteData>(`${API_URL}/missions/requests/${requestId}/quote/`);
  }

  respondQuote(requestId: number, action: 'accept' | 'reject'): Observable<MissionQuoteData> {
    return this.http.post<MissionQuoteData>(`${API_URL}/missions/requests/${requestId}/quote/respond/`, {
      action,
    });
  }

  payMission(
    requestId: number,
    payload: { method: 'cash' | 'online'; amount?: number; card_last4?: string }
  ): Observable<any> {
    return this.http.post<any>(`${API_URL}/missions/requests/${requestId}/pay/`, payload);
  }

  getInvoice(requestId: number): Observable<MissionInvoiceData> {
    return this.http.get<MissionInvoiceData>(`${API_URL}/missions/requests/${requestId}/invoice/`);
  }
}

