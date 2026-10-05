import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { AuthService } from '../../core/auth.service';

interface ProviderProfile {
  id: number;
  name: string;
  roleType: 'technician' | 'housekeeper';
  categoryKey: 'menage' | 'plomberie' | 'electricite' | 'menuiserie' | 'serrurerie' | 'peinture';
  roleTitle: string;
  photo: string;
  specialty: string;
  rating: number;
  reviewsCount: number;
  experienceYears: number;
  city: string;
  hourlyRate: string;
  isAvailable: boolean;
  badges: string[];
}

@Component({
  selector: 'app-role-home',
  standalone: true,
  template: `
    <div class="dashboard-page">
      <!-- Top Navigation Bar -->
      <header class="navbar">
        <div class="nav-container">
          <div class="brand">
            <i class="fa-solid fa-house-chimney-crack brand-icon"></i>
            <span class="brand-name">ServiceHome</span>
            <span class="role-badge" [class]="roleBadgeClass()">
              <i class="fa-solid" [class]="roleIcon()"></i> {{ roleLabel() }}
            </span>
          </div>

          <div class="user-menu">
            <div class="user-avatar">
              <img [src]="userPhoto()" [alt]="auth.user()?.username || 'User'" />
            </div>
            <div class="user-details">
              <span class="username">{{ auth.user()?.username || 'Utilisateur' }}</span>
              <span class="email">{{ auth.user()?.email }}</span>
            </div>
            <button class="btn-logout" (click)="auth.logout()" title="Déconnexion">
              <i class="fa-solid fa-power-off"></i>
              <span class="logout-text">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      <!-- Main Dashboard Body -->
      <main class="dashboard-content">
        <!-- Hero Welcome Header -->
        <section class="welcome-hero">
          <div class="hero-text">
            <h1>Bonjour, {{ auth.user()?.username }} 👋</h1>
            <p>
              Bienvenue sur votre espace <strong>{{ title }}</strong>. Trouvez en quelques clics des <strong>électriciens</strong>, <strong>menuisiers</strong>, <strong>plombiers</strong>, <strong>serruriers</strong> et <strong>femmes de ménage</strong> qualifiés.
            </p>

            @if (activeRole() === 'client') {
              <!-- Search Bar for Clients -->
              <div class="search-box">
                <i class="fa-solid fa-magnifying-glass search-icon"></i>
                <input
                  type="text"
                  placeholder="Rechercher (ex: Menuisier, Électricien, Plombier, Femme de ménage, Serrurier...)"
                  [value]="searchQuery()"
                  (input)="onSearchInput($event)"
                />
                <button class="btn-search">Rechercher</button>
              </div>
            }
          </div>

          <div class="hero-illustration">
            <img [src]="userPhoto()" alt="Illustration rôle" class="hero-role-img" />
          </div>
        </section>

        <!-- Toast Alert Notification -->
        @if (toastMessage()) {
          <div class="toast-notification">
            <i class="fa-solid fa-circle-check"></i>
            <span>{{ toastMessage() }}</span>
          </div>
        }

        <!-- Service Categories Showcase -->
        <section class="section-container">
          <div class="section-header">
            <div>
              <h2><i class="fa-solid fa-shapes icon-title"></i> Nos spécialités de techniciens & services</h2>
              <p>Des professionnels vérifiés pour tous les métiers de l'habitat et du ménage</p>
            </div>
          </div>

          <div class="categories-grid">
            <!-- Category 1: Ménage & Entretien -->
            <div
              class="category-card"
              [class.active]="selectedCategory() === 'menage'"
              (click)="filterCategory('menage')"
            >
              <div class="cat-img-wrapper">
                <img src="/assets/images/service_cleaning.jpg" alt="Femme de ménage" />
                <span class="badge-tag maid"><i class="fa-solid fa-broom"></i> Femme de ménage</span>
              </div>
              <div class="cat-body">
                <h3><i class="fa-solid fa-broom cat-icon"></i> Ménage & Entretien</h3>
                <p>Nettoyage à domicile, repassage, nettoyage de printemps et vitres.</p>
              </div>
            </div>

            <!-- Category 2: Plomberie & Sanitaire -->
            <div
              class="category-card"
              [class.active]="selectedCategory() === 'plomberie'"
              (click)="filterCategory('plomberie')"
            >
              <div class="cat-img-wrapper">
                <img src="/assets/images/service_plumbing.jpg" alt="Plombier" />
                <span class="badge-tag tech"><i class="fa-solid fa-faucet-drip"></i> Plombier</span>
              </div>
              <div class="cat-body">
                <h3><i class="fa-solid fa-faucet-drip cat-icon"></i> Plomberie & Sanitaire</h3>
                <p>Débouchage canalisation, réparation fuite d'eau, robinetterie & ballon d'eau.</p>
              </div>
            </div>

            <!-- Category 3: Électricité -->
            <div
              class="category-card"
              [class.active]="selectedCategory() === 'electricite'"
              (click)="filterCategory('electricite')"
            >
              <div class="cat-img-wrapper">
                <img src="/assets/images/technician.jpg" alt="Électricien" />
                <span class="badge-tag tech"><i class="fa-solid fa-bolt"></i> Électricien</span>
              </div>
              <div class="cat-body">
                <h3><i class="fa-solid fa-bolt cat-icon"></i> Électricité & Domotique</h3>
                <p>Court-circuit, mise aux normes, tableau électrique & installation de luminaires.</p>
              </div>
            </div>

            <!-- Category 4: Menuiserie -->
            <div
              class="category-card"
              [class.active]="selectedCategory() === 'menuiserie'"
              (click)="filterCategory('menuiserie')"
            >
              <div class="cat-img-wrapper">
                <img src="/assets/images/hero.jpg" alt="Menuisier" />
                <span class="badge-tag wood"><i class="fa-solid fa-ruler-combined"></i> Menuisier</span>
              </div>
              <div class="cat-body">
                <h3><i class="fa-solid fa-ruler-combined cat-icon"></i> Menuiserie & Agencement</h3>
                <p>Pose de portes, parquets, meubles sur-mesure, placards & fenêtres en bois/PVC.</p>
              </div>
            </div>

            <!-- Category 5: Serrurerie -->
            <div
              class="category-card"
              [class.active]="selectedCategory() === 'serrurerie'"
              (click)="filterCategory('serrurerie')"
            >
              <div class="cat-img-wrapper">
                <img src="/assets/images/client.jpg" alt="Serrurier" />
                <span class="badge-tag lock"><i class="fa-solid fa-key"></i> Serrurier</span>
              </div>
              <div class="cat-body">
                <h3><i class="fa-solid fa-key cat-icon"></i> Serrurerie & Dépannage</h3>
                <p>Ouverture de porte blindée, changement de serrure, verrous de sécurité.</p>
              </div>
            </div>
          </div>
        </section>

        <!-- Professional Providers Showcase Section -->
        <section class="section-container">
          <div class="section-header">
            <div>
              <h2><i class="fa-solid fa-user-shield icon-title"></i> Nos Techniciens & Intervenants qualifiés</h2>
              <p>Contactez directement le spécialiste dont vous avez besoin pour votre intervention</p>
            </div>

            <!-- Filter Pills for Specialties -->
            <div class="filter-pills">
              <button
                class="pill-btn"
                [class.active]="providerFilter() === 'all'"
                (click)="providerFilter.set('all')"
              >
                Tous ({{ providers.length }})
              </button>
              <button
                class="pill-btn"
                [class.active]="providerFilter() === 'housekeeper'"
                (click)="providerFilter.set('housekeeper')"
              >
                <i class="fa-solid fa-broom"></i> Ménage
              </button>
              <button
                class="pill-btn"
                [class.active]="providerFilter() === 'electricite'"
                (click)="providerFilter.set('electricite')"
              >
                <i class="fa-solid fa-bolt"></i> Électriciens
              </button>
              <button
                class="pill-btn"
                [class.active]="providerFilter() === 'menuiserie'"
                (click)="providerFilter.set('menuiserie')"
              >
                <i class="fa-solid fa-ruler-combined"></i> Menuisiers
              </button>
              <button
                class="pill-btn"
                [class.active]="providerFilter() === 'plomberie'"
                (click)="providerFilter.set('plomberie')"
              >
                <i class="fa-solid fa-faucet-drip"></i> Plombiers
              </button>
              <button
                class="pill-btn"
                [class.active]="providerFilter() === 'serrurerie'"
                (click)="providerFilter.set('serrurerie')"
              >
                <i class="fa-solid fa-key"></i> Serruriers
              </button>
            </div>
          </div>

          <div class="providers-grid">
            @for (p of filteredProviders(); track p.id) {
              <div class="provider-card">
                <div class="provider-card-header">
                  <div class="provider-photo-wrapper">
                    <img [src]="p.photo" [alt]="p.name" />
                    @if (p.isAvailable) {
                      <span class="online-indicator" title="Disponible actuellement"></span>
                    }
                  </div>
                  <div class="provider-main-info">
                    <h3>{{ p.name }}</h3>
                    <span
                      class="provider-role-badge"
                      [class.maid]="p.roleType === 'housekeeper'"
                      [class.tech]="p.roleType === 'technician'"
                    >
                      <i class="fa-solid" [class.fa-broom]="p.roleType === 'housekeeper'" [class.fa-wrench]="p.roleType === 'technician'"></i>
                      {{ p.roleTitle }}
                    </span>
                    <div class="rating-box">
                      <i class="fa-solid fa-star star-icon"></i>
                      <strong>{{ p.rating }}</strong>
                      <span class="reviews-count">({{ p.reviewsCount }} avis)</span>
                    </div>
                  </div>
                </div>

                <div class="provider-details">
                  <div class="detail-item">
                    <i class="fa-solid fa-award"></i>
                    <span>{{ p.experienceYears }} ans d'expérience</span>
                  </div>
                  <div class="detail-item">
                    <i class="fa-solid fa-location-dot"></i>
                    <span>{{ p.city }}</span>
                  </div>
                  <div class="detail-item price">
                    <i class="fa-solid fa-tag"></i>
                    <span>Tarif : <strong>{{ p.hourlyRate }}</strong></span>
                  </div>
                </div>

                <div class="badges-row">
                  @for (badge of p.badges; track badge) {
                    <span class="spec-badge">{{ badge }}</span>
                  }
                </div>

                <div class="provider-card-footer">
                  <button class="btn-book" (click)="requestService(p)">
                    <i class="fa-regular fa-paper-plane"></i> Réserver une intervention
                  </button>
                </div>
              </div>
            }
          </div>
        </section>

        <!-- Stats Section -->
        @if (activeRole() === 'technician') {
          <section class="role-management-panel">
            <h2><i class="fa-solid fa-sliders"></i> Tableau de bord Prestataire</h2>
            <div class="stats-grid">
              <div class="stat-card">
                <i class="fa-solid fa-calendar-check stat-icon blue"></i>
                <div>
                  <span class="stat-number">18</span>
                  <span class="stat-label">Missions réussies</span>
                </div>
              </div>
              <div class="stat-card">
                <i class="fa-solid fa-star stat-icon yellow"></i>
                <div>
                  <span class="stat-number">4.9 / 5</span>
                  <span class="stat-label">Note moyenne</span>
                </div>
              </div>
              <div class="stat-card">
                <i class="fa-solid fa-clock stat-icon green"></i>
                <div>
                  <span class="stat-number">Disponible</span>
                  <span class="stat-label">Statut en ligne</span>
                </div>
              </div>
            </div>
          </section>
        }
      </main>
    </div>
  `,
  styles: [
    `
      .dashboard-page {
        min-height: 100vh;
        background-color: #f8fafc;
        font-family: var(--font-primary, sans-serif);
      }

      /* Navbar */
      .navbar {
        background: #ffffff;
        border-bottom: 1px solid #e2e8f0;
        position: sticky;
        top: 0;
        z-index: 100;
        box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.05);
      }

      .nav-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 14px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .brand-icon {
        font-size: 24px;
        color: #2563eb;
      }

      .brand-name {
        font-size: 22px;
        font-weight: 800;
        color: #0f172a;
      }

      .role-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 9999px;
        font-size: 13px;
        font-weight: 700;
      }

      .role-badge.client { background: #eff6ff; color: #2563eb; }
      .role-badge.technician { background: #fffbebfb; color: #d97706; }
      .role-badge.admin { background: #f3e8ff; color: #7c3aed; }

      .user-menu {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .user-avatar {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        overflow: hidden;
        border: 2px solid #2563eb;
      }

      .user-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .user-details {
        display: flex;
        flex-direction: column;
      }

      .username {
        font-size: 14px;
        font-weight: 700;
        color: #0f172a;
      }

      .email {
        font-size: 12px;
        color: #64748b;
      }

      .btn-logout {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        background: #fef2f2;
        color: #dc2626;
        border: 1px solid #fecaca;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-logout:hover { background: #fee2e2; }

      /* Main Content */
      .dashboard-content {
        max-width: 1200px;
        margin: 0 auto;
        padding: 32px 24px 60px 24px;
      }

      .welcome-hero {
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border-radius: 24px;
        padding: 40px;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 36px;
        box-shadow: 0 12px 30px -5px rgba(15, 23, 42, 0.2);
        overflow: hidden;
      }

      .hero-text { max-width: 650px; }
      .hero-text h1 { font-size: 32px; font-weight: 800; margin-bottom: 10px; }
      .hero-text p { font-size: 16px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }

      .search-box {
        position: relative;
        display: flex;
        align-items: center;
        background: #ffffff;
        border-radius: 16px;
        padding: 6px 8px 6px 18px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
      }

      .search-icon { color: #64748b; font-size: 18px; margin-right: 12px; }
      .search-box input { flex: 1; border: none; outline: none; font-size: 15px; color: #0f172a; background: transparent; }

      .btn-search {
        padding: 12px 24px;
        background: #2563eb;
        color: #ffffff;
        border: none;
        border-radius: 12px;
        font-weight: 700;
        font-size: 14px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .btn-search:hover { background: #1d4ed8; }

      .hero-role-img {
        width: 140px;
        height: 140px;
        border-radius: 50%;
        object-fit: cover;
        border: 4px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
      }

      /* Toast Notification */
      .toast-notification {
        display: flex;
        align-items: center;
        gap: 12px;
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        color: #047857;
        padding: 16px 20px;
        border-radius: 14px;
        font-weight: 600;
        font-size: 15px;
        margin-bottom: 32px;
      }

      .section-container { margin-bottom: 48px; }

      .section-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        margin-bottom: 24px;
        flex-wrap: wrap;
        gap: 16px;
      }

      .section-header h2 {
        font-size: 22px;
        font-weight: 800;
        color: #0f172a;
        display: flex;
        align-items: center;
        gap: 10px;

        .icon-title { color: #2563eb; }
      }

      .section-header p { font-size: 14px; color: #64748b; margin-top: 4px; }

      /* Categories Grid */
      .categories-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
      }

      .category-card {
        background: #ffffff;
        border-radius: 20px;
        overflow: hidden;
        border: 1px solid #e2e8f0;
        transition: all 0.3s ease;
        cursor: pointer;
      }

      .category-card:hover, .category-card.active {
        transform: translateY(-6px);
        box-shadow: 0 12px 25px -5px rgba(37, 99, 235, 0.15);
        border-color: #2563eb;
      }

      .cat-img-wrapper {
        position: relative;
        height: 150px;
        width: 100%;
        overflow: hidden;
      }

      .cat-img-wrapper img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.4s ease;
      }

      .category-card:hover .cat-img-wrapper img { transform: scale(1.08); }

      .badge-tag {
        position: absolute;
        top: 12px;
        left: 12px;
        padding: 4px 12px;
        border-radius: 9999px;
        font-size: 12px;
        font-weight: 700;
      }

      .badge-tag.maid { background: rgba(16, 185, 129, 0.9); color: #ffffff; }
      .badge-tag.tech { background: rgba(37, 99, 235, 0.9); color: #ffffff; }
      .badge-tag.wood { background: rgba(217, 119, 6, 0.9); color: #ffffff; }
      .badge-tag.lock { background: rgba(124, 58, 237, 0.9); color: #ffffff; }

      .cat-body { padding: 18px; }

      .cat-body h3 {
        font-size: 17px;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .cat-icon { color: #2563eb; font-size: 16px; }

      .cat-body p { font-size: 13px; color: #64748b; line-height: 1.5; }

      /* Filter Pills */
      .filter-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .pill-btn {
        padding: 8px 16px;
        border-radius: 9999px;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        font-size: 13px;
        font-weight: 600;
        color: #475569;
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .pill-btn:hover { background: #f1f5f9; }

      .pill-btn.active {
        background: #2563eb;
        color: #ffffff;
        border-color: #2563eb;
      }

      /* Providers Grid */
      .providers-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 24px;
      }

      .provider-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 20px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        transition: all 0.25s ease;
      }

      .provider-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 24px -5px rgba(0, 0, 0, 0.08);
        border-color: #cbd5e1;
      }

      .provider-card-header {
        display: flex;
        gap: 14px;
        margin-bottom: 16px;
      }

      .provider-photo-wrapper {
        position: relative;
        width: 64px;
        height: 64px;
        border-radius: 16px;
        overflow: hidden;
        flex-shrink: 0;
      }

      .provider-photo-wrapper img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .online-indicator {
        position: absolute;
        bottom: 4px;
        right: 4px;
        width: 12px;
        height: 12px;
        background-color: #10b981;
        border: 2px solid #ffffff;
        border-radius: 50%;
      }

      .provider-main-info h3 { font-size: 17px; font-weight: 800; color: #0f172a; margin-bottom: 2px; }

      .provider-role-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 6px;
        margin-bottom: 6px;
      }

      .provider-role-badge.maid { background: #ecfdf5; color: #047857; }
      .provider-role-badge.tech { background: #eff6ff; color: #1d4ed8; }

      .rating-box { display: flex; align-items: center; gap: 4px; font-size: 13px; }
      .star-icon { color: #f59e0b; }
      .reviews-count { color: #94a3b8; font-size: 12px; }

      .provider-details {
        display: flex;
        flex-direction: column;
        gap: 8px;
        background: #f8fafc;
        padding: 12px;
        border-radius: 12px;
        margin-bottom: 14px;
        font-size: 13px;
        color: #475569;
      }

      .detail-item { display: flex; align-items: center; gap: 8px; }
      .detail-item i { color: #64748b; width: 16px; }

      .badges-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 18px;
      }

      .spec-badge {
        background: #f1f5f9;
        color: #334155;
        font-size: 11px;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 6px;
      }

      .btn-book {
        width: 100%;
        padding: 12px;
        background: #0f172a;
        color: #ffffff;
        border: none;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .btn-book:hover { background: #2563eb; }

      .role-management-panel {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 20px;
        padding: 28px;
      }

      .role-management-panel h2 {
        font-size: 20px;
        font-weight: 800;
        color: #0f172a;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
      }

      .stat-card {
        display: flex;
        align-items: center;
        gap: 16px;
        background: #f8fafc;
        padding: 20px;
        border-radius: 16px;
        border: 1px solid #e2e8f0;
      }

      .stat-icon { font-size: 28px; padding: 14px; border-radius: 14px; }
      .stat-icon.blue { background: #eff6ff; color: #2563eb; }
      .stat-icon.yellow { background: #fffbeefb; color: #d97706; }
      .stat-icon.green { background: #ecfdf5; color: #059669; }

      .stat-number { display: block; font-size: 22px; font-weight: 800; color: #0f172a; }
      .stat-label { font-size: 13px; color: #64748b; }

      @media (max-width: 992px) {
        .categories-grid, .providers-grid, .stats-grid { grid-template-columns: repeat(2, 1fr); }
        .welcome-hero { flex-direction: column; align-items: flex-start; }
        .hero-role-img { display: none; }
      }

      @media (max-width: 640px) {
        .categories-grid, .providers-grid, .stats-grid { grid-template-columns: 1fr; }
        .user-details, .logout-text { display: none; }
      }
    `,
  ],
})
export class RoleHomeComponent {
  auth = inject(AuthService);
  title: string = inject(ActivatedRoute).snapshot.data['title'];

  searchQuery = signal('');
  selectedCategory = signal<string | null>(null);
  providerFilter = signal<string>('all');
  toastMessage = signal<string | null>(null);

  // Diverse list of specialized technicians and housekeepers
  providers: ProviderProfile[] = [
    {
      id: 1,
      name: 'Sophie Ben Salem',
      roleType: 'housekeeper',
      categoryKey: 'menage',
      roleTitle: 'Femme de ménage certifiée',
      photo: '/assets/images/housekeeper.jpg',
      specialty: 'Ménage régulier & Repassage',
      rating: 4.9,
      reviewsCount: 42,
      experienceYears: 6,
      city: 'Tunis / Ariana',
      hourlyRate: '25 DT / heure',
      isAvailable: true,
      badges: ['Ménage complet', 'Nettoyage vitres', 'Eco-produits'],
    },
    {
      id: 2,
      name: 'Karim Mansouri',
      roleType: 'technician',
      categoryKey: 'electricite',
      roleTitle: 'Électricien & Domotique',
      photo: '/assets/images/hero.jpg',
      specialty: 'Dépannage électrique & Tableau',
      rating: 5.0,
      reviewsCount: 51,
      experienceYears: 7,
      city: 'Lyon / Villeurbanne',
      hourlyRate: '45 € / heure',
      isAvailable: true,
      badges: ['Normes NFC', 'Court-circuit', 'Luminaires'],
    },
    {
      id: 3,
      name: 'Youssef Bennani',
      roleType: 'technician',
      categoryKey: 'menuiserie',
      roleTitle: 'Menuisier & Ebéniste',
      photo: '/assets/images/technician.jpg',
      specialty: 'Meubles sur-mesure & Parquets',
      rating: 4.9,
      reviewsCount: 29,
      experienceYears: 10,
      city: 'Paris & Île-de-France',
      hourlyRate: '50 € / heure',
      isAvailable: true,
      badges: ['Menuiserie Bois/PVC', 'Parquet', 'Cuisine sur mesure'],
    },
    {
      id: 4,
      name: 'Marc Laurent',
      roleType: 'technician',
      categoryKey: 'plomberie',
      roleTitle: 'Technicien Plombier',
      photo: '/assets/images/service_plumbing.jpg',
      specialty: 'Dépannage plomberie d\'urgence',
      rating: 4.8,
      reviewsCount: 38,
      experienceYears: 8,
      city: 'Marseille & Environs',
      hourlyRate: '40 € / heure',
      isAvailable: true,
      badges: ['Chauffe-eau', 'Fuites d\'eau', 'Débouchage'],
    },
    {
      id: 5,
      name: 'Thomas Dubois',
      roleType: 'technician',
      categoryKey: 'serrurerie',
      roleTitle: 'Serrurier & Sécurité',
      photo: '/assets/images/client.jpg',
      specialty: 'Ouverture de porte & Changement serrure',
      rating: 4.9,
      reviewsCount: 34,
      experienceYears: 9,
      city: 'Bordeaux Centre',
      hourlyRate: '55 € / heure',
      isAvailable: true,
      badges: ['Urgence 24/7', 'Portes blindées', 'Serrures haute sécurité'],
    },
  ];

  activeRole(): string {
    return this.auth.user()?.role || 'client';
  }

  roleLabel(): string {
    const role = this.activeRole();
    if (role === 'technician') return 'Espace Prestataire (Technicien / Ménage)';
    if (role === 'admin') return 'Espace Administrateur';
    return 'Espace Client';
  }

  roleBadgeClass(): string {
    return this.activeRole();
  }

  roleIcon(): string {
    const role = this.activeRole();
    if (role === 'technician') return 'fa-wrench';
    if (role === 'admin') return 'fa-user-gear';
    return 'fa-user';
  }

  userPhoto(): string {
    const role = this.activeRole();
    if (role === 'technician') return '/assets/images/technician.jpg';
    return '/assets/images/client.jpg';
  }

  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchQuery.set(val);
  }

  filterCategory(cat: string): void {
    if (this.selectedCategory() === cat) {
      this.selectedCategory.set(null);
      this.providerFilter.set('all');
    } else {
      this.selectedCategory.set(cat);
      this.providerFilter.set(cat);
    }
  }

  filteredProviders(): ProviderProfile[] {
    const filter = this.providerFilter();
    const query = this.searchQuery().toLowerCase().trim();

    return this.providers.filter((p) => {
      const matchFilter =
        filter === 'all' ||
        p.categoryKey === filter ||
        (filter === 'housekeeper' && p.roleType === 'housekeeper') ||
        (filter === 'technician' && p.roleType === 'technician');

      const matchQuery =
        !query ||
        p.name.toLowerCase().includes(query) ||
        p.specialty.toLowerCase().includes(query) ||
        p.roleTitle.toLowerCase().includes(query) ||
        p.city.toLowerCase().includes(query);

      return matchFilter && matchQuery;
    });
  }

  requestService(provider: ProviderProfile): void {
    this.toastMessage.set(
      `Votre demande d'intervention auprès de ${provider.name} (${provider.roleTitle}) a été transmise avec succès !`
    );
    setTimeout(() => this.toastMessage.set(null), 5000);
  }
}
