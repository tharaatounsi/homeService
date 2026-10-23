import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { AuthService } from '../../core/auth.service';
import {
  AvailabilitySlotPayload,
  Category,
  TechnicianProfileResponse,
  TechnicianService,
} from '../../core/technician.service';

type TechTab = 'profile' | 'schedule' | 'missions' | 'reviews';

interface WeekdayOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-technician-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="tech-dashboard-page">
      <!-- Navbar -->
      <header class="navbar">
        <div class="nav-container">
          <div class="brand" routerLink="/technician" style="cursor: pointer;">
            <i class="fa-solid fa-house-chimney-crack brand-icon"></i>
            <span class="brand-name">ServiceHome</span>
            <span class="role-badge tech">
              <i class="fa-solid fa-wrench"></i> Espace Technicien
            </span>
          </div>

          <div class="user-menu">
            <div class="user-info">
              <span class="username">{{ profile()?.username || auth.user()?.username }}</span>
              <span class="email">{{ profile()?.email || auth.user()?.email }}</span>
            </div>
            <button class="btn-logout" (click)="auth.logout()" title="Déconnexion">
              <i class="fa-solid fa-power-off"></i>
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      <main class="dashboard-container">
        <!-- Toast Notification -->
        @if (toastMessage()) {
          <div class="toast-notification" [class.error]="isToastError()">
            <i class="fa-solid" [class.fa-circle-check]="!isToastError()" [class.fa-triangle-exclamation]="isToastError()"></i>
            <span>{{ toastMessage() }}</span>
          </div>
        }

        <!-- Top Profile & Online Status Banner -->
        <section class="status-hero-card">
          <div class="tech-main-identity">
            <div class="avatar-box">
              <img src="/assets/images/technician.jpg" alt="Photo technicien" />
              @if (profile()?.is_available) {
                <span class="online-indicator" title="En ligne"></span>
              }
            </div>
            <div class="identity-info">
              <h1>Technicien {{ profile()?.username || auth.user()?.username }}</h1>
              <div class="meta-tags">
                <span class="tag-experience"><i class="fa-solid fa-briefcase"></i> {{ profile()?.experience_years || 0 }} an(s) d'expérience</span>
                <span class="tag-rating"><i class="fa-solid fa-star"></i> {{ profile()?.rating_avg || '5.0' }} ({{ profile()?.rating_count || 0 }} avis)</span>
                <span class="tag-radius"><i class="fa-solid fa-location-crosshairs"></i> Rayon {{ profile()?.service_radius_km || 10 }} km</span>
              </div>
            </div>
          </div>

          <!-- Status Switch Box -->
          <div class="online-toggle-card">
            <div class="toggle-status-info">
              <span class="status-title">Statut de disponibilité</span>
              <span class="status-badge" [class.online]="profile()?.is_available" [class.offline]="!profile()?.is_available">
                <i class="fa-solid" [class.fa-circle]="profile()?.is_available" [class.fa-circle-pause]="!profile()?.is_available"></i>
                {{ profile()?.is_available ? 'EN LIGNE (Disponible)' : 'HORS LIGNE (Inactif)' }}
              </span>
            </div>

            <label class="switch">
              <input
                type="checkbox"
                [checked]="profile()?.is_available"
                (change)="onToggleAvailability($event)"
              />
              <span class="slider round"></span>
            </label>
          </div>
        </section>

        <!-- Profile Verification & Completeness Alert Banners -->
        @if (!profile()?.is_approved) {
          <div class="alert-banner warning">
            <i class="fa-solid fa-triangle-exclamation alert-icon"></i>
            <div>
              <strong>En attente d'approbation Administrateur</strong>
              <p>Votre compte doit être validé par l'administrateur de ServiceHome avant de pouvoir passer en ligne et accepter des prestations.</p>
            </div>
          </div>
        }

        @if (!profile()?.is_complete) {
          <div class="alert-banner danger">
            <i class="fa-solid fa-circle-exclamation alert-icon"></i>
            <div>
              <strong>Profil Incomplet</strong>
              <p>Pour passer en ligne, vous devez renseigner votre <strong>position GPS</strong> et sélectionner au moins <strong>une catégorie de métier</strong> dans votre profil.</p>
            </div>
          </div>
        }

        <!-- Main Layout Navigation & Tabs -->
        <div class="dashboard-layout">
          <!-- Sidebar Nav Tabs -->
          <aside class="sidebar-nav">
            <button
              class="tab-btn"
              [class.active]="activeTab() === 'profile'"
              (click)="activeTab.set('profile')"
            >
              <i class="fa-solid fa-user-gear"></i>
              <span>Mon Profil & Métiers</span>
            </button>

            <button
              class="tab-btn"
              [class.active]="activeTab() === 'schedule'"
              (click)="activeTab.set('schedule')"
            >
              <i class="fa-solid fa-calendar-days"></i>
              <span>Planning de disponibilité</span>
            </button>

            <button
              class="tab-btn"
              [class.active]="activeTab() === 'missions'"
              (click)="activeTab.set('missions')"
            >
              <i class="fa-solid fa-clipboard-list"></i>
              <span>Missions reçues ({{ incomingMissions().length }})</span>
            </button>

            <button
              class="tab-btn"
              [class.active]="activeTab() === 'reviews'"
              (click)="activeTab.set('reviews')"
            >
              <i class="fa-solid fa-star-half-stroke"></i>
              <span>Avis & Évaluations</span>
            </button>
          </aside>

          <!-- Content Tab Area -->
          <div class="tab-content-card">
            <!-- TAB 1: MON PROFIL & MÉTIERS -->
            @if (activeTab() === 'profile') {
              <div class="tab-pane">
                <div class="pane-header">
                  <h2><i class="fa-solid fa-user-pen"></i> Modifier mon profil technicien</h2>
                  <p>Mettez à jour vos métiers, années d'expérience, bio et position géographique.</p>
                </div>

                <form (ngSubmit)="saveProfile()" class="profile-form">
                  <!-- Bio & Experience -->
                  <div class="form-row">
                    <div class="form-group">
                      <label for="exp">Années d'expérience (0 à 60)</label>
                      <input
                        type="number"
                        id="exp"
                        [(ngModel)]="profileForm.experience_years"
                        name="experience_years"
                        min="0"
                        max="60"
                      />
                    </div>
                    <div class="form-group">
                      <label for="radius">Rayon d'action d'intervention (km)</label>
                      <input
                        type="number"
                        id="radius"
                        [(ngModel)]="profileForm.service_radius_km"
                        name="service_radius_km"
                        min="1"
                        max="100"
                      />
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="bio">Présentation / Bio professionnelle</label>
                    <textarea
                      id="bio"
                      rows="3"
                      [(ngModel)]="profileForm.bio"
                      name="bio"
                      placeholder="Décrivez vos compétences, diplômes et matériels professionnels..."
                    ></textarea>
                  </div>

                  <!-- Métiers & Catégories Multi-select -->
                  <div class="form-section">
                    <label class="section-label"><i class="fa-solid fa-shapes"></i> Catégories & Métiers d'intervention</label>
                    <div class="categories-chips-grid">
                      @for (cat of allCategories(); track cat.id) {
                        <div
                          class="category-chip"
                          [class.selected]="isCategorySelected(cat.id)"
                          (click)="toggleCategory(cat.id)"
                        >
                          <i class="fa-solid" [class]="getCategoryIcon(cat.name)"></i>
                          <span>{{ cat.name }}</span>
                          <i class="fa-solid fa-check check-icon"></i>
                        </div>
                      }
                    </div>
                  </div>

                  <!-- Location Google Maps -->
                  <div class="form-section">
                    <label class="section-label"><i class="fa-solid fa-map-location-dot"></i> Emplacement géographique (Google Maps)</label>
                    
                    <div class="location-box">
                      <div class="location-bar">
                        <button type="button" class="btn-gps" (click)="detectGPSLocation()">
                          <i class="fa-solid fa-crosshairs"></i> Détecter ma position GPS actuelle
                        </button>
                        <span class="coords-text">
                          Latitude: <strong>{{ profileForm.latitude?.toFixed(4) || 'Non définie' }}</strong> | 
                          Longitude: <strong>{{ profileForm.longitude?.toFixed(4) || 'Non définie' }}</strong>
                        </span>
                      </div>

                      @if (profileForm.latitude && profileForm.longitude) {
                        <div class="map-iframe-container">
                          <iframe
                            [src]="getGoogleMapsEmbedUrl()"
                            width="100%"
                            height="240"
                            style="border:0; border-radius: 0.75rem;"
                            allowfullscreen=""
                            loading="lazy"
                          ></iframe>
                        </div>
                      }
                    </div>
                  </div>

                  <div class="form-actions">
                    <button type="submit" class="btn-save" [disabled]="isSubmitting()">
                      @if (isSubmitting()) {
                        <i class="fa-solid fa-spinner fa-spin"></i> Enregistrement...
                      } @else {
                        <i class="fa-solid fa-floppy-disk"></i> Sauvegarder mon profil
                      }
                    </button>
                  </div>
                </form>
              </div>
            }

            <!-- TAB 2: PLANNING & DISPONIBILITÉS -->
            @if (activeTab() === 'schedule') {
              <div class="tab-pane">
                <div class="pane-header flex-between">
                  <div>
                    <h2><i class="fa-solid fa-calendar-days"></i> Horaires & Planning hebdomadaire</h2>
                    <p>Définissez vos créneaux de travail pour chaque jour de la semaine.</p>
                  </div>
                  <button class="btn-save" (click)="saveSchedule()" [disabled]="isSubmitting()">
                    <i class="fa-solid fa-floppy-disk"></i> Enregistrer le planning
                  </button>
                </div>

                <div class="schedule-editor-grid">
                  @for (day of weekdays; track day.value) {
                    <div class="day-schedule-card">
                      <div class="day-header">
                        <strong>{{ day.label }}</strong>
                        <button type="button" class="btn-add-slot" (click)="addSlot(day.value)">
                          <i class="fa-solid fa-plus"></i> Ajouter un créneau
                        </button>
                      </div>

                      <div class="slots-list">
                        @for (slot of getSlotsForDay(day.value); track $index) {
                          <div class="slot-item">
                            <div class="time-input-group">
                              <label>Début</label>
                              <input type="time" [(ngModel)]="slot.start_time" />
                            </div>
                            <span class="sep">à</span>
                            <div class="time-input-group">
                              <label>Fin</label>
                              <input type="time" [(ngModel)]="slot.end_time" />
                            </div>
                            <button type="button" class="btn-remove-slot" (click)="removeSlot(slot)" title="Supprimer">
                              <i class="fa-regular fa-trash-can"></i>
                            </button>
                          </div>
                        } @empty {
                          <p class="no-slots-text">Aucun créneau configuré (Non disponible)</p>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- TAB 3: MISSIONS REÇUES -->
            @if (activeTab() === 'missions') {
              <div class="tab-pane">
                <div class="pane-header">
                  <h2><i class="fa-solid fa-clipboard-check"></i> Demandes de service reçues</h2>
                  <p>Consultez et acceptez les demandes d'intervention des clients aux alentours.</p>
                </div>

                <div class="missions-list">
                  @for (m of incomingMissions(); track m.id) {
                    <div class="mission-card">
                      <div class="mission-header">
                        <div class="cat-badge">
                          <i class="fa-solid" [class]="getCategoryIcon(m.category_name)"></i>
                          <span>{{ m.category_name || 'Service' }}</span>
                        </div>
                        <span class="urgency-pill" [class]="m.urgency">
                          Urgence : {{ m.urgency }}
                        </span>
                      </div>

                      <h3 class="mission-title">Demande #{{ m.id }} — {{ m.address || 'Tunis' }}</h3>
                      <p class="mission-desc">{{ m.description }}</p>

                      <div class="mission-footer">
                        <div class="client-meta">
                          <i class="fa-regular fa-user"></i> Client #{{ m.client }}
                        </div>
                        <div class="action-btns">
                          <button class="btn-decline" (click)="declineMission(m.id)">Refuser</button>
                          <button class="btn-accept" (click)="acceptMission(m.id)">
                            <i class="fa-solid fa-check"></i> Accepter la mission
                          </button>
                        </div>
                      </div>
                    </div>
                  } @empty {
                    <div class="empty-state">
                      <i class="fa-solid fa-inbox icon-empty"></i>
                      <p>Aucune nouvelle demande de service pour le moment.</p>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- TAB 4: AVIS & ÉVALUATIONS -->
            @if (activeTab() === 'reviews') {
              <div class="tab-pane">
                <div class="pane-header">
                  <h2><i class="fa-solid fa-star-half-stroke"></i> Avis & Réputation</h2>
                  <p>Consultez les notes et retours laissés par vos clients.</p>
                </div>

                <div class="reviews-summary-card">
                  <div class="big-rating-score">
                    <span>{{ profile()?.rating_avg || '5.0' }}</span>
                    <div class="stars-gold">
                      <i class="fa-solid fa-star"></i>
                      <i class="fa-solid fa-star"></i>
                      <i class="fa-solid fa-star"></i>
                      <i class="fa-solid fa-star"></i>
                      <i class="fa-solid fa-star"></i>
                    </div>
                    <small>Basé sur {{ profile()?.rating_count || 0 }} prestation(s)</small>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background-color: #f8fafc;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      color: #0f172a;
    }

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

    .role-badge.tech {
      background: #fef3c7;
      color: #b45309;
      font-weight: 700;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.8rem;
    }

    .user-menu {
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }

    .user-info {
      display: flex;
      flex-direction: column;
      align-items: flex-end;

      .username {
        font-weight: 700;
        font-size: 0.9rem;
      }
      .email {
        font-size: 0.775rem;
        color: #64748b;
      }
    }

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
      color: #dc2626;
      cursor: pointer;

      &:hover {
        background: #fef2f2;
      }
    }

    .dashboard-container {
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

    /* Hero Status Card */
    .status-hero-card {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      border-radius: 1.25rem;
      padding: 2rem;
      color: #ffffff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.3);
    }

    .tech-main-identity {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .avatar-box {
      position: relative;
      width: 84px;
      height: 84px;

      img {
        width: 100%;
        height: 100%;
        border-radius: 9999px;
        object-fit: cover;
        border: 3px solid rgba(255, 255, 255, 0.2);
      }

      .online-indicator {
        position: absolute;
        bottom: 2px;
        right: 2px;
        width: 18px;
        height: 18px;
        border-radius: 9999px;
        background: #22c55e;
        border: 3px solid #0f172a;
      }
    }

    .identity-info h1 {
      margin: 0 0 0.5rem 0;
      font-size: 1.5rem;
      font-weight: 800;
    }

    .meta-tags {
      display: flex;
      gap: 0.85rem;

      span {
        font-size: 0.8rem;
        background: rgba(255, 255, 255, 0.1);
        padding: 0.3rem 0.65rem;
        border-radius: 0.5rem;
        backdrop-filter: blur(4px);
      }
    }

    /* Online Toggle Box */
    .online-toggle-card {
      background: rgba(255, 255, 255, 0.08);
      padding: 1.25rem 1.75rem;
      border-radius: 1rem;
      display: flex;
      align-items: center;
      gap: 1.5rem;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .toggle-status-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .status-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      opacity: 0.7;
    }

    .status-badge {
      font-size: 0.85rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;

      &.online { color: #4ade80; }
      &.offline { color: #f87171; }
    }

    /* Toggle Switch */
    .switch {
      position: relative;
      display: inline-block;
      width: 56px;
      height: 30px;
    }

    .switch input { display: none; }

    .slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: #64748b;
      transition: .3s;
      border-radius: 34px;
    }

    .slider:before {
      position: absolute;
      content: "";
      height: 22px;
      width: 22px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: .3s;
      border-radius: 50%;
    }

    input:checked + .slider {
      background-color: #22c55e;
    }

    input:checked + .slider:before {
      transform: translateX(26px);
    }

    /* Alert Banners */
    .alert-banner {
      padding: 1rem 1.25rem;
      border-radius: 0.75rem;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 1rem;

      &.warning {
        background: #fffbeb;
        border: 1px solid #fcd34d;
        color: #92400e;
      }

      &.danger {
        background: #fef2f2;
        border: 1px solid #fca5a5;
        color: #991b1b;
      }

      .alert-icon {
        font-size: 1.5rem;
      }

      p {
        margin: 0.25rem 0 0 0;
        font-size: 0.875rem;
      }
    }

    /* Layout */
    .dashboard-layout {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 1.75rem;
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

      &:hover { background: #f1f5f9; color: #1e293b; }

      &.active {
        background: #2563eb;
        color: #ffffff;
        border-color: #2563eb;
      }
    }

    .tab-content-card {
      background: #ffffff;
      border-radius: 1rem;
      border: 1px solid #e2e8f0;
      padding: 2rem;
    }

    .pane-header {
      margin-bottom: 1.75rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid #f1f5f9;

      h2 {
        margin: 0 0 0.25rem 0;
        font-size: 1.25rem;
        color: #1e293b;
      }
      p { margin: 0; color: #64748b; font-size: 0.875rem; }
    }

    .flex-between {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Profile Form */
    .profile-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;

      label { font-size: 0.875rem; font-weight: 600; color: #334155; }
      input, textarea {
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        border: 1px solid #cbd5e1;
        font-size: 0.95rem;
        outline: none;
      }
    }

    .categories-chips-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 0.75rem;
    }

    .category-chip {
      border: 1.5px solid #cbd5e1;
      border-radius: 0.75rem;
      padding: 0.75rem 1rem;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.875rem;
      background: #ffffff;

      .check-icon { margin-left: auto; display: none; }

      &.selected {
        border-color: #2563eb;
        background: #eff6ff;
        color: #1d4ed8;

        .check-icon { display: block; color: #2563eb; }
      }
    }

    /* Location Box */
    .location-box {
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1rem;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .location-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .btn-gps {
      background: #ffffff;
      color: #2563eb;
      border: 1px solid #2563eb;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-weight: 600;
      cursor: pointer;
    }

    /* Schedule Editor */
    .schedule-editor-grid {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .day-schedule-card {
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1rem 1.25rem;
      background: #f8fafc;
    }

    .day-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .btn-add-slot {
      background: #ffffff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
      padding: 0.35rem 0.75rem;
      border-radius: 0.5rem;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
    }

    .slots-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .slot-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: #ffffff;
      padding: 0.5rem 0.85rem;
      border-radius: 0.5rem;
      border: 1px solid #e2e8f0;
    }

    .btn-remove-slot {
      background: transparent;
      border: none;
      color: #ef4444;
      cursor: pointer;
    }

    /* Missions */
    .missions-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .mission-card {
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1.25rem;
    }

    .mission-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }

    .mission-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 1rem;
      padding-top: 0.75rem;
      border-top: 1px solid #f1f5f9;
    }

    .action-btns {
      display: flex;
      gap: 0.75rem;
    }

    .btn-accept {
      background: #22c55e;
      color: #ffffff;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-decline {
      background: #ffffff;
      color: #64748b;
      border: 1px solid #cbd5e1;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-save {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      font-weight: 600;
      cursor: pointer;
    }

    @media (max-width: 900px) {
      .status-hero-card { flex-direction: column; gap: 1.5rem; align-items: flex-start; }
      .dashboard-layout { grid-template-columns: 1fr; }
      .form-row { grid-template-columns: 1fr; }
    }
  `]
})
export class TechnicianDashboardComponent implements OnInit {
  auth = inject(AuthService);
  techService = inject(TechnicianService);
  sanitizer = inject(DomSanitizer);

  profile = signal<TechnicianProfileResponse | null>(null);
  allCategories = signal<Category[]>([]);
  incomingMissions = signal<any[]>([]);
  scheduleSlots = signal<AvailabilitySlotPayload[]>([]);

  activeTab = signal<TechTab>('profile');
  isSubmitting = signal<boolean>(false);
  toastMessage = signal<string | null>(null);
  isToastError = signal<boolean>(false);

  weekdays: WeekdayOption[] = [
    { value: 0, label: 'Lundi' },
    { value: 1, label: 'Mardi' },
    { value: 2, label: 'Mercredi' },
    { value: 3, label: 'Jeudi' },
    { value: 4, label: 'Vendredi' },
    { value: 5, label: 'Samedi' },
    { value: 6, label: 'Dimanche' },
  ];

  profileForm = {
    bio: '',
    experience_years: 0,
    service_radius_km: 10,
    categories: [] as number[],
    latitude: null as number | null,
    longitude: null as number | null,
  };

  ngOnInit(): void {
    this.loadCategories();
    this.loadProfile();
    this.loadSchedule();
    this.loadMissions();
  }

  loadCategories(): void {
    this.techService.getCategories().subscribe({
      next: (cats) => this.allCategories.set(cats),
    });
  }

  loadProfile(): void {
    this.techService.getProfile().subscribe({
      next: (data) => {
        this.profile.set(data);
        this.profileForm = {
          bio: data.bio || '',
          experience_years: data.experience_years || 0,
          service_radius_km: data.service_radius_km || 10,
          categories: data.categories || [],
          latitude: data.latitude,
          longitude: data.longitude,
        };
      },
      error: () => this.showToast('Erreur de chargement du profil technicien.', true),
    });
  }

  loadSchedule(): void {
    this.techService.getSchedule().subscribe({
      next: (res) => this.scheduleSlots.set(res.slots || []),
    });
  }

  loadMissions(): void {
    this.techService.getIncomingMissions().subscribe({
      next: (list) => this.incomingMissions.set(list || []),
    });
  }

  // --- ONLINE / OFFLINE TOGGLE ---
  onToggleAvailability(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.techService.updateStatus(checked).subscribe({
      next: (updated) => {
        this.profile.set(updated);
        this.showToast(checked ? 'Vous êtes maintenant EN LIGNE !' : 'Vous êtes maintenant HORS LIGNE.');
      },
      error: (err) => {
        (event.target as HTMLInputElement).checked = !checked;
        const msg = err.error?.detail || err.error?.is_available || 'Impossible de changer le statut.';
        this.showToast(msg, true);
      },
    });
  }

  // --- CATEGORIES SELECTION ---
  isCategorySelected(catId: number): boolean {
    return this.profileForm.categories.includes(catId);
  }

  toggleCategory(catId: number): void {
    const idx = this.profileForm.categories.indexOf(catId);
    if (idx >= 0) {
      this.profileForm.categories.splice(idx, 1);
    } else {
      this.profileForm.categories.push(catId);
    }
  }

  // --- GPS GEOLOCATION ---
  detectGPSLocation(): void {
    if ('geolocation' in navigator) {
      this.showToast('Détection de la position GPS...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.profileForm.latitude = pos.coords.latitude;
          this.profileForm.longitude = pos.coords.longitude;
          this.showToast('Position GPS renseignée avec succès !');
        },
        () => this.showToast('Accès à la géolocalisation refusé.', true)
      );
    }
  }

  getGoogleMapsEmbedUrl(): SafeResourceUrl {
    const lat = this.profileForm.latitude || 36.8065;
    const lng = this.profileForm.longitude || 10.1815;
    const url = `https://maps.google.com/maps?q=${lat},${lng}&z=14&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  // --- SAVE PROFILE ---
  saveProfile(): void {
    this.isSubmitting.set(true);
    this.techService.updateProfile({
      bio: this.profileForm.bio,
      experience_years: this.profileForm.experience_years,
      service_radius_km: this.profileForm.service_radius_km,
      categories: this.profileForm.categories,
      latitude: this.profileForm.latitude,
      longitude: this.profileForm.longitude,
    }).subscribe({
      next: (updated) => {
        this.isSubmitting.set(false);
        this.profile.set(updated);
        this.showToast('Profil mis à jour avec succès !');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const msg = err.error?.detail || 'Erreur lors de la sauvegarde du profil.';
        this.showToast(msg, true);
      },
    });
  }

  // --- SCHEDULE MANAGEMENT ---
  getSlotsForDay(weekday: number): AvailabilitySlotPayload[] {
    return this.scheduleSlots().filter((s) => s.weekday === weekday);
  }

  addSlot(weekday: number): void {
    const newSlot: AvailabilitySlotPayload = {
      weekday,
      start_time: '08:00:00',
      end_time: '17:00:00',
    };
    this.scheduleSlots.update((list) => [...list, newSlot]);
  }

  removeSlot(slot: AvailabilitySlotPayload): void {
    this.scheduleSlots.update((list) => list.filter((s) => s !== slot));
  }

  saveSchedule(): void {
    this.isSubmitting.set(true);
    this.techService.updateSchedule(this.scheduleSlots()).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.scheduleSlots.set(res.slots || []);
        this.showToast('Planning de disponibilité enregistré !');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const msg = err.error?.detail || 'Erreur dans la configuration du planning.';
        this.showToast(msg, true);
      },
    });
  }

  // --- MISSIONS ---
  acceptMission(id: number): void {
    this.showToast(`Mission #${id} acceptée avec succès !`);
  }

  declineMission(id: number): void {
    this.incomingMissions.update((list) => list.filter((m) => m.id !== id));
    this.showToast(`Mission #${id} déclinée.`);
  }

  private showToast(msg: string, isError = false): void {
    this.toastMessage.set(msg);
    this.isToastError.set(isError);
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 4500);
  }

  getCategoryIcon(name?: string): string {
    if (!name) return 'fa-wrench';
    const n = name.toLowerCase();
    if (n.includes('plomb')) return 'fa-faucet-drip';
    if (n.includes('électr')) return 'fa-bolt';
    if (n.includes('ménag')) return 'fa-broom';
    if (n.includes('clim')) return 'fa-snowflake';
    if (n.includes('peint')) return 'fa-paint-roller';
    if (n.includes('serrur')) return 'fa-key';
    if (n.includes('jardin')) return 'fa-seedling';
    if (n.includes('menuis')) return 'fa-ruler-combined';
    return 'fa-wrench';
  }
}
