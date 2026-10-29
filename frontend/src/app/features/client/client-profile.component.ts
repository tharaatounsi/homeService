import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, interval } from 'rxjs';

import { AuthService } from '../../core/auth.service';
import { User } from '../../core/models';
import { ClientAddress, ClientServiceRequestSummary, UserService } from '../../core/user.service';
import { WebSocketService } from '../../core/websocket.service';
import { MessagingTabComponent } from '../../shared/components/messaging-tab.component';
import { AddressesTabComponent } from './tabs/addresses-tab.component';
import { ClientInfoTabComponent } from './tabs/client-info-tab.component';
import { NewRequestTabComponent } from './tabs/new-request-tab.component';
import { RequestListTabComponent } from './tabs/request-list-tab.component';
import { SecurityTabComponent } from './tabs/security-tab.component';

export type ProfileTab = 'new_request' | 'info' | 'addresses' | 'requests' | 'messages' | 'security';

@Component({
  selector: 'app-client-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NewRequestTabComponent,
    RequestListTabComponent,
    AddressesTabComponent,
    SecurityTabComponent,
    ClientInfoTabComponent,
    MessagingTabComponent,
  ],
  template: `
    <div class="profile-page">
      <!-- Navbar -->
      <header class="navbar">
        <div class="nav-container">
          <div class="brand" routerLink="/client" style="cursor: pointer;">
            <i class="fa-solid fa-house-chimney-crack brand-icon"></i>
            <span class="brand-name">ServiceHome</span>
            <span class="role-badge client">
              <i class="fa-solid fa-user"></i> Espace Client
            </span>
          </div>

          <div class="user-menu">
            <span class="ws-status-badge online" title="Synchronisation directe HTTP active">
              <span class="ws-dot"></span>
              Contact & Messagerie actifs
            </span>
            <button
              class="btn-back"
              (click)="activeTab.set('messages')"
              style="border-color: #2563eb; color: #2563eb; background: #eff6ff;"
            >
              <i class="fa-solid fa-comments"></i>
              <span>Messagerie ({{ unreadCount() }})</span>
            </button>
            <button class="btn-back" routerLink="/client">
              <i class="fa-solid fa-arrow-left"></i>
              <span>Retour à l'accueil</span>
            </button>
            <button class="btn-logout" (click)="auth.logout()" title="Déconnexion">
              <i class="fa-solid fa-power-off"></i>
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      <main class="profile-container">
        <!-- Toast Notification -->
        @if (toastMessage()) {
          <div class="toast-notification" [class.error]="isToastError()">
            <i class="fa-solid" [class.fa-circle-check]="!isToastError()" [class.fa-triangle-exclamation]="isToastError()"></i>
            <span>{{ toastMessage() }}</span>
          </div>
        }

        <!-- Profile Hero Header -->
        <section class="profile-hero-card">
          <div class="avatar-section">
            <div class="avatar-wrapper">
              <img src="/assets/images/client.jpg" alt="Photo de profil client" />
            </div>
            <div class="user-identity">
              <h1>{{ user()?.first_name || user()?.username }} {{ user()?.last_name || '' }}</h1>
              <p class="user-email"><i class="fa-regular fa-envelope"></i> {{ user()?.email }}</p>
              <div class="user-badges">
                <span class="badge badge-verified"><i class="fa-solid fa-shield-check"></i> Compte Client Vérifié</span>
                <span class="badge badge-phone"><i class="fa-solid fa-phone"></i> {{ user()?.phone || 'Téléphone non renseigné' }}</span>
              </div>
            </div>
          </div>

          <div class="profile-stats">
            <button class="btn-quick-new" (click)="activeTab.set('new_request')">
              <i class="fa-solid fa-plus-circle"></i>
              <span>Nouvelle demande</span>
            </button>
            <div class="stat-box">
              <span class="stat-number">{{ requests().length }}</span>
              <span class="stat-label">Demandes</span>
            </div>
            <div class="stat-box">
              <span class="stat-number">{{ addresses().length }}</span>
              <span class="stat-label">Adresses</span>
            </div>
          </div>
        </section>

        <!-- Main Layout with Navigation Tabs & Content -->
        <div class="profile-layout">
          <!-- Sidebar Navigation Tabs -->
          <aside class="sidebar-nav">
            <button
              type="button"
              class="tab-btn highlight-tab"
              [class.active]="activeTab() === 'new_request'"
              (click)="activeTab.set('new_request')"
            >
              <i class="fa-solid fa-circle-plus icon-plus"></i>
              <span>Décrire mon problème</span>
            </button>

            <button
              type="button"
              class="tab-btn"
              [class.active]="activeTab() === 'requests'"
              (click)="activeTab.set('requests')"
            >
              <i class="fa-solid fa-list-check"></i>
              <span>Historique des demandes ({{ requests().length }})</span>
            </button>

            <button
              type="button"
              class="tab-btn"
              [class.active]="activeTab() === 'messages'"
              (click)="activeTab.set('messages')"
            >
              <i class="fa-solid fa-comments"></i>
              <span>Messagerie Techniciens ({{ unreadCount() }})</span>
            </button>

            <button
              type="button"
              class="tab-btn"
              [class.active]="activeTab() === 'addresses'"
              (click)="activeTab.set('addresses')"
            >
              <i class="fa-solid fa-location-dot"></i>
              <span>Mes adresses ({{ addresses().length }})</span>
            </button>

            <button
              type="button"
              class="tab-btn"
              [class.active]="activeTab() === 'info'"
              (click)="activeTab.set('info')"
            >
              <i class="fa-solid fa-user-gear"></i>
              <span>Informations personnelles</span>
            </button>

            <button
              type="button"
              class="tab-btn"
              [class.active]="activeTab() === 'security'"
              (click)="activeTab.set('security')"
            >
              <i class="fa-solid fa-lock"></i>
              <span>Sécurité & Mot de passe</span>
            </button>
          </aside>

          <!-- Tab Content Area -->
          <div class="tab-content-card">
            @switch (activeTab()) {
              @case ('new_request') {
                <app-new-request-tab
                  [savedAddresses]="addresses()"
                  [initialCategorySlug]="initialCategorySlug()"
                  [initialTechnicianId]="initialTechnicianId()"
                  (requestCreated)="onRequestCreated($event)"
                ></app-new-request-tab>
              }
              @case ('requests') {
                <app-request-list-tab
                  [requests]="requests()"
                  [isLoading]="isLoadingRequests()"
                  (refresh)="loadRequests()"
                  (cancelRequest)="onCancelRequest($event)"
                  (createNew)="activeTab.set('new_request')"
                  (openChat)="onOpenChat($event)"
                ></app-request-list-tab>
              }
              @case ('messages') {
                <app-messaging-tab
                  [initialPartnerId]="selectedPartnerId()"
                  [initialRequestId]="selectedRequestId()"
                  (unreadTotalChange)="unreadCount.set($event)"
                ></app-messaging-tab>
              }
              @case ('addresses') {
                <app-addresses-tab
                  [addresses]="addresses()"
                  (addressesChanged)="loadAddresses()"
                ></app-addresses-tab>
              }
              @case ('info') {
                <app-client-info-tab
                  [user]="user()"
                  (profileUpdated)="user.set($event)"
                ></app-client-info-tab>
              }
              @case ('security') {
                <app-security-tab></app-security-tab>
              }
            }
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background-color: #f8fafc;
        font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
        color: #0f172a;
      }

      .profile-page {
        min-height: 100vh;
      }

      /* Navbar */
      .navbar {
        background: #ffffff;
        border-bottom: 1px solid #e2e8f0;
        position: sticky;
        top: 0;
        z-index: 50;
        padding: 0.75rem 1.5rem;
      }

      .nav-container {
        max-width: 1280px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .brand-icon {
        font-size: 1.5rem;
        color: #2563eb;
      }

      .brand-name {
        font-weight: 800;
        font-size: 1.25rem;
        letter-spacing: -0.02em;
      }

      .role-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.8rem;
        font-weight: 600;
        background: #dbeafe;
        color: #1e40af;
      }

      .user-menu {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .ws-status-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0.3rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 700;
        background: #f1f5f9;
        color: #64748b;
        border: 1px solid #cbd5e1;

        .ws-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #94a3b8;
        }

        &.online {
          background: #ecfdf5;
          color: #047857;
          border-color: #a7f3d0;

          .ws-dot {
            background: #10b981;
            box-shadow: 0 0 6px #10b981;
          }
        }
      }

      .btn-back,
      .btn-logout {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        font-weight: 600;
        border: 1px solid #e2e8f0;
        background: #ffffff;
        color: #475569;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-back:hover,
      .btn-logout:hover {
        background: #f1f5f9;
        color: #1e293b;
      }

      .btn-logout:hover {
        border-color: #fca5a5;
        color: #dc2626;
        background: #fef2f2;
      }

      /* Profile Container */
      .profile-container {
        max-width: 1280px;
        margin: 2rem auto;
        padding: 0 1.5rem;
      }

      /* Toast */
      .toast-notification {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem 1.25rem;
        background: #ecfdf5;
        color: #065f46;
        border: 1px solid #a7f3d0;
        border-radius: 0.75rem;
        margin-bottom: 1.5rem;
        font-weight: 600;
      }

      .toast-notification.error {
        background: #fef2f2;
        color: #991b1b;
        border-color: #fecaca;
      }

      /* Hero Card */
      .profile-hero-card {
        background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
        border-radius: 1.25rem;
        padding: 2rem 2.5rem;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.25);
        margin-bottom: 2rem;
      }

      .avatar-section {
        display: flex;
        align-items: center;
        gap: 1.75rem;
      }

      .avatar-wrapper {
        position: relative;
        width: 90px;
        height: 90px;
      }

      .avatar-wrapper img {
        width: 100%;
        height: 100%;
        border-radius: 9999px;
        object-fit: cover;
        border: 4px solid rgba(255, 255, 255, 0.4);
      }

      .user-identity h1 {
        margin: 0 0 0.25rem 0;
        font-size: 1.75rem;
        font-weight: 800;
      }

      .user-email {
        margin: 0 0 0.75rem 0;
        opacity: 0.9;
        font-size: 0.95rem;
      }

      .user-badges {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.35rem 0.75rem;
        border-radius: 0.5rem;
        font-size: 0.8rem;
        font-weight: 600;
        background: rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(4px);
      }

      .profile-stats {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        background: rgba(255, 255, 255, 0.1);
        padding: 1rem 1.5rem;
        border-radius: 1rem;
        backdrop-filter: blur(6px);
      }

      .btn-quick-new {
        background: #ffffff;
        color: #2563eb;
        border: none;
        padding: 0.75rem 1.25rem;
        border-radius: 0.75rem;
        font-weight: 700;
        font-size: 0.9rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        transition: transform 0.2s;
      }

      .btn-quick-new:hover {
        transform: translateY(-2px);
      }

      .stat-box {
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .stat-number {
        font-size: 1.35rem;
        font-weight: 800;
      }

      .stat-label {
        font-size: 0.725rem;
        opacity: 0.85;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      /* Profile Layout */
      .profile-layout {
        display: grid;
        grid-template-columns: 280px 1fr;
        gap: 2rem;
      }

      .sidebar-nav {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .tab-btn {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        padding: 1rem 1.25rem;
        border-radius: 0.75rem;
        font-weight: 600;
        font-size: 0.95rem;
        background: #ffffff;
        color: #64748b;
        border: 1px solid #e2e8f0;
        cursor: pointer;
        text-align: left;
        transition: all 0.2s;
      }

      .tab-btn.highlight-tab {
        background: #eff6ff;
        border-color: #bfdbfe;
        color: #1d4ed8;
        font-weight: 700;
      }

      .tab-btn i {
        font-size: 1.1rem;
        width: 24px;
      }

      .icon-plus {
        color: #2563eb;
      }

      .tab-btn:hover {
        background: #f1f5f9;
        color: #1e293b;
      }

      .tab-btn.active {
        background: #2563eb;
        color: #ffffff;
        border-color: #2563eb;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
      }

      .tab-btn.active .icon-plus {
        color: #ffffff;
      }

      .tab-content-card {
        background: #ffffff;
        border-radius: 1.25rem;
        border: 1px solid #e2e8f0;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        overflow: hidden;
      }

      @media (max-width: 992px) {
        .profile-layout {
          grid-template-columns: 1fr;
        }
        .profile-hero-card {
          flex-direction: column;
          align-items: flex-start;
          gap: 1.5rem;
        }
        .profile-stats {
          width: 100%;
          justify-content: space-between;
        }
      }
    `,
  ],
})
export class ClientProfileComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  wsService = inject(WebSocketService);
  private userService = inject(UserService);
  private route = inject(ActivatedRoute);
  private subs = new Subscription();

  user = signal<User | null>(null);
  activeTab = signal<ProfileTab>('new_request');
  toastMessage = signal<string | null>(null);
  isToastError = signal(false);

  requests = signal<ClientServiceRequestSummary[]>([]);
  addresses = signal<ClientAddress[]>([]);
  initialCategorySlug = signal<string | undefined>(undefined);
  initialTechnicianId = signal<number | null>(null);
  selectedPartnerId = signal<number | null>(null);
  selectedRequestId = signal<number | null>(null);
  unreadCount = signal<number>(0);
  isLoadingRequests = signal(false);

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['tab']) {
        this.activeTab.set(params['tab'] as ProfileTab);
      }
      if (params['category']) {
        this.initialCategorySlug.set(params['category']);
      }
      if (params['technician']) {
        this.initialTechnicianId.set(Number(params['technician']));
      }
      if (params['partner']) {
        this.selectedPartnerId.set(Number(params['partner']));
      }
      if (params['request']) {
        this.selectedRequestId.set(Number(params['request']));
      }
    });

    this.loadProfile();
    this.loadAddresses();
    this.loadRequests();
    this.loadUnreadMessages();
    this.initPollingSync();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private initPollingSync(): void {
    // Synchronisation automatique par HTTP toutes les 4 secondes (sans WebSocket)
    this.subs.add(
      interval(4000).subscribe(() => {
        this.loadRequests(true);
        this.loadUnreadMessages();
      })
    );
  }

  loadUnreadMessages(): void {
    this.userService.getConversations().subscribe({
      next: (list) => {
        const total = (list || []).reduce((acc, c) => acc + (c.unread_count || 0), 0);
        if (total > this.unreadCount() && this.activeTab() !== 'messages') {
          this.showToast('Nouveau message reçu dans votre messagerie !');
        }
        this.unreadCount.set(total);
      },
    });
  }

  loadProfile(): void {
    const cachedUser = this.auth.user();
    if (cachedUser) {
      this.user.set(cachedUser);
    }
    this.userService.getProfile().subscribe({
      next: (userData) => this.user.set(userData),
    });
  }

  loadAddresses(): void {
    this.userService.getAddresses().subscribe({
      next: (data) => this.addresses.set(data || []),
      error: () => this.addresses.set([]),
    });
  }

  loadRequests(silent = false): void {
    if (!silent) {
      this.isLoadingRequests.set(true);
    }
    this.userService.getServiceRequests().subscribe({
      next: (list) => {
        const mapped: ClientServiceRequestSummary[] = (list || []).map((item) => ({
          id: item.id,
          categoryName: item.category_name || 'Service',
          categoryIcon: this.getCategoryIcon(item.category_name),
          technicianId: item.technician || undefined,
          technicianName: item.technician_name ? `Technicien ${item.technician_name}` : undefined,
          technicianEmail: item.technician_email || undefined,
          technicianPhoto: '/assets/images/technician.jpg',
          technicianPhone: item.technician_phone,
          distanceKm: item.distance_km,
          description: item.description,
          status: item.status,
          statusLabel: this.getStatusLabel(item.status),
          date: new Date(item.created_at).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
          address: item.address || 'Tunis',
          latitude: item.lat ?? item.latitude,
          longitude: item.lng ?? item.longitude,
          price: item.estimated_price ? parseFloat(item.estimated_price) : undefined,
          events: item.events || [],
          quote: item.quote,
          payment: item.payment,
        }));
        this.requests.set(mapped);
        this.isLoadingRequests.set(false);
      },
      error: () => {
        if (!silent) {
          this.requests.set([]);
        }
        this.isLoadingRequests.set(false);
      },
    });
  }

  onOpenChat(target: { requestId: number; technicianId?: number }): void {
    this.selectedRequestId.set(target.requestId);
    if (target.technicianId) {
      this.selectedPartnerId.set(target.technicianId);
    }
    this.activeTab.set('messages');
  }

  onRequestCreated(newReq: any): void {
    this.showToast('Votre demande d\'intervention a été publiée avec succès !');
    this.loadRequests();
    this.activeTab.set('requests');
  }

  onCancelRequest(id: number): void {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette demande ?')) return;

    this.userService.cancelServiceRequest(id).subscribe({
      next: () => {
        this.showToast('Demande annulée avec succès.');
        this.loadRequests();
      },
      error: (err) => {
        const msg = err?.error?.detail || 'Impossible d\'annuler cette demande.';
        this.showToast(msg, true);
      },
    });
  }

  showToast(msg: string, isError = false): void {
    this.toastMessage.set(msg);
    this.isToastError.set(isError);
    setTimeout(() => this.toastMessage.set(null), 5000);
  }

  private getCategoryIcon(catName?: string): string {
    const map: Record<string, string> = {
      Plomberie: 'fa-faucet-drip',
      Électricité: 'fa-bolt',
      Ménage: 'fa-broom',
      Climatisation: 'fa-snowflake',
      Peinture: 'fa-paint-roller',
      Serrurerie: 'fa-key',
      Jardinage: 'fa-seedling',
      Menuiserie: 'fa-ruler-combined',
    };
    return catName && map[catName] ? map[catName] : 'fa-wrench';
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'En attente',
      accepted: 'Acceptée',
      en_route: 'En route',
      in_progress: 'En cours',
      completed: 'Terminée',
      paid: 'Payée',
      cancelled: 'Annulée',
    };
    return labels[status] || status;
  }
}
