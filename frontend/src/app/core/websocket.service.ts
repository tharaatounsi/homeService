import { Injectable, inject, signal } from '@angular/core';
import { Observable, Subject, filter } from 'rxjs';

import { AuthService } from './auth.service';
import { WS_URL } from './config';

export interface WsEvent<T = any> {
  kind: string;
  [key: string]: any;
}

export interface WsNewRequestEvent {
  kind: 'request.new';
  id: number;
  status: string;
  status_display: string;
  category: number;
  urgency: string;
  updated_at: string;
  description: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;
}

export interface WsStatusEvent {
  kind: 'request.status';
  id: number;
  status: string;
  status_display: string;
  category: number;
  urgency: string;
  updated_at: string;
}

export interface WsClosedEvent {
  kind: 'request.closed';
  id: number;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private messageSubject = new Subject<WsEvent>();

  readonly isConnected = signal<boolean>(true);
  readonly messages$ = this.messageSubject.asObservable();

  readonly newRequest$: Observable<WsNewRequestEvent> = this.messages$.pipe(
    filter((e): e is WsNewRequestEvent => e.kind === 'request.new')
  );

  readonly statusUpdate$: Observable<WsStatusEvent> = this.messages$.pipe(
    filter((e): e is WsStatusEvent => e.kind === 'request.status')
  );

  readonly requestClosed$: Observable<WsClosedEvent> = this.messages$.pipe(
    filter((e): e is WsClosedEvent => e.kind === 'request.closed')
  );

  connect(): void {
    // Synchronisation assurée directement par API HTTP REST (sans WebSocket)
    this.isConnected.set(true);
  }

  disconnect(): void {
    // No-op (HTTP REST mode)
  }
}
