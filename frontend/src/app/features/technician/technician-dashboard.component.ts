import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription, interval } from 'rxjs';

import { AuthService } from '../../core/auth.service';
import {
  AvailabilitySlotPayload,
  Category,
  TechnicianProfileResponse,
  TechnicianService,
} from '../../core/technician.service';
import { MissionInvoiceData, UserService } from '../../core/user.service';
import { WebSocketService } from '../../core/websocket.service';
import { MapPickerComponent } from '../../shared/components/map-picker.component';
import { MessagingTabComponent } from '../../shared/components/messaging-tab.component';

type TechTab = 'profile' | 'schedule' | 'missions' | 'messages' | 'reviews';

interface WeekdayOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-technician-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MapPickerComponent, MessagingTabComponent],
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
            <span class="ws-status-badge online" title="Synchronisation directe HTTP active">
              <span class="ws-dot"></span>
              Contact & Messagerie actifs
            </span>

            <button
              type="button"
              class="btn-logout"
              (click)="activeTab.set('messages')"
              style="border-color: #2563eb; color: #2563eb; background: #eff6ff;"
            >
              <i class="fa-solid fa-comments"></i>
              <span>Messagerie ({{ unreadCount() }})</span>
            </button>

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
              <span>Missions ({{ incomingMissions().length + availableMissions().length }})</span>
            </button>

            <button
              class="tab-btn"
              [class.active]="activeTab() === 'messages'"
              (click)="activeTab.set('messages')"
            >
              <i class="fa-solid fa-comments"></i>
              <span>Messagerie Clients ({{ unreadCount() }})</span>
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

                <form novalidate (ngSubmit)="saveProfile()" class="profile-form">
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

                  <!-- Location OpenStreetMap / Leaflet -->
                  <div class="form-section">
                    <label class="section-label"><i class="fa-solid fa-map-location-dot"></i> Emplacement géographique de votre base d'intervention</label>
                    <app-map-picker
                      [latitude]="profileForm.latitude"
                      [longitude]="profileForm.longitude"
                      height="260px"
                      (locationChange)="onLocationPicked($event)"
                    ></app-map-picker>
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

            <!-- TAB 3: MISSIONS -->
            @if (activeTab() === 'missions') {
              <div class="tab-pane">
                <div class="pane-header">
                  <h2><i class="fa-solid fa-clipboard-check"></i> Gestion des missions</h2>
                  <p>Acceptez de nouvelles demandes de clients et mettez à jour l'avancement de vos interventions.</p>
                </div>

                <!-- Section 1 : Demandes disponibles à accepter -->
                <div style="margin-bottom: 2rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
                    <h3 style="font-size: 1.1rem; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 8px;">
                      <i class="fa-solid fa-bell" style="color: #2563eb;"></i>
                      Demandes disponibles ({{ availableMissions().length }})
                    </h3>

                    <label style="display: inline-flex; align-items: center; gap: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer; background: #f8fafc; padding: 6px 14px; border-radius: 8px; border: 1px solid #cbd5e1; user-select: none;">
                      <input
                        type="checkbox"
                        [checked]="expandZones()"
                        (change)="onToggleExpandZones($event)"
                        style="cursor: pointer; width: 16px; height: 16px; accent-color: #2563eb;"
                      />
                      <span>Élargir à toutes les zones (au-delà de mon rayon)</span>
                    </label>
                  </div>

                  <div class="missions-list">
                    @for (m of availableMissions(); track m.id) {
                      <div class="mission-card" style="border-left: 4px solid #2563eb;">
                        <div class="mission-header">
                          <div class="cat-badge">
                            <i class="fa-solid" [class]="getCategoryIcon(m.category_name)"></i>
                            <span>{{ m.category_name || 'Service' }}</span>
                          </div>
                          @if (m.distance_km !== null && m.distance_km !== undefined) {
                            <span style="display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; background: #eff6ff; color: #1d4ed8; padding: 4px 8px; border-radius: 6px; border: 1px solid #bfdbfe;">
                              <i class="fa-solid fa-route"></i> à {{ m.distance_km }} km de votre base
                            </span>
                          }
                          <span class="urgency-pill" [class]="m.urgency">
                            Urgence : {{ m.urgency }}
                          </span>
                        </div>

                        <h3 class="mission-title">Demande #{{ m.id }} — {{ m.address || 'Tunis' }}</h3>
                        <p class="mission-desc">{{ m.description }}</p>

                        <div class="mission-footer" style="flex-wrap: wrap; gap: 10px;">
                          <div class="client-meta" style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px;">
                            <span><i class="fa-regular fa-user"></i> Client : <strong>{{ m.client_name || '#' + m.client }}</strong></span>
                            @if (m.client_email) {
                              <a [href]="'mailto:' + m.client_email" style="font-size: 12px; color: #2563eb; text-decoration: none; font-weight: 600;">
                                <i class="fa-regular fa-envelope"></i> {{ m.client_email }}
                              </a>
                            }
                            @if (m.client_phone) {
                              <a [href]="'tel:' + m.client_phone" style="font-size: 12px; color: #059669; text-decoration: none; font-weight: 700;">
                                <i class="fa-solid fa-phone"></i> {{ m.client_phone }}
                              </a>
                            }
                          </div>
                          <div class="action-btns" style="display: flex; flex-wrap: wrap; gap: 8px;">
                            <button
                              type="button"
                              (click)="openClientChat(m)"
                              style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 8px; font-weight: 700; cursor: pointer;"
                            >
                              <i class="fa-solid fa-comments"></i> Contacter / Messagerie
                            </button>
                            <button class="btn-decline" (click)="declineMission(m.id)">Ignorer</button>
                            <button class="btn-accept" (click)="acceptMission(m.id)">
                              <i class="fa-solid fa-check"></i> Accepter la mission
                            </button>
                          </div>
                        </div>
                      </div>
                    } @empty {
                      <div class="empty-state" style="padding: 2.5rem 1.5rem; text-align: center; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">
                        <i class="fa-solid fa-location-crosshairs" style="font-size: 2.2rem; color: #94a3b8; margin-bottom: 0.75rem; display: block;"></i>
                        <p style="margin: 0 0 0.5rem 0; color: #1e293b; font-weight: 600; font-size: 1rem;">
                          Aucune demande en attente pour le moment
                        </p>
                        <p style="margin: 0 0 1.25rem 0; color: #64748b; font-size: 0.875rem;">
                          Vous pouvez également consulter la Messagerie Clients pour discuter directement avec vos clients.
                        </p>
                      </div>
                    }
                  </div>
                </div>

                <!-- Section 2 : Mes missions assignées -->
                <div>
                  <h3 style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-briefcase" style="color: #10b981;"></i>
                    Mes interventions assignées ({{ incomingMissions().length }})
                  </h3>

                  <div class="missions-list">
                    @for (m of incomingMissions(); track m.id) {
                      <div class="mission-card" style="border-left: 4px solid #10b981;">
                        <div class="mission-header">
                          <div class="cat-badge">
                            <i class="fa-solid" [class]="getCategoryIcon(m.category_name)"></i>
                            <span>{{ m.category_name || 'Service' }}</span>
                          </div>
                          <span style="display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; background: #ecfdf5; color: #047857;">
                            <i class="fa-solid fa-clock"></i> {{ getStatusBadgeLabel(m.status) }}
                          </span>
                        </div>

                        <h3 class="mission-title">Mission #{{ m.id }} — {{ m.address || 'Tunis' }}</h3>
                        <p class="mission-desc">{{ m.description }}</p>

                        <!-- Devis sur place établi par Ahmed (Sprint 7) -->
                        @if (m.quote) {
                          <div style="margin: 10px 0; padding: 10px 14px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; font-size: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                            <div>
                              <strong><i class="fa-solid fa-file-invoice-dollar text-primary"></i> Devis : {{ m.quote.total_price }} TND</strong>
                              <span style="color: #64748b; margin-left: 8px;">(MO: {{ m.quote.labor_price }} TND, Pièces: {{ m.quote.parts_price }} TND)</span>
                            </div>
                            <span style="padding: 3px 8px; border-radius: 6px; font-weight: 700;" [style.background]="m.quote.status === 'accepted' ? '#dcfce7' : (m.quote.status === 'rejected' ? '#fee2e2' : '#fef3c7')" [style.color]="m.quote.status === 'accepted' ? '#166534' : (m.quote.status === 'rejected' ? '#991b1b' : '#92400e')">
                              {{ m.quote.status === 'accepted' ? 'Accepté par Molka' : (m.quote.status === 'rejected' ? 'Refusé' : 'En attente client') }}
                            </span>
                          </div>
                        }

                        <div class="mission-footer" style="flex-wrap: wrap; gap: 10px;">
                          <div class="client-meta" style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px;">
                            <span><i class="fa-regular fa-user"></i> Client : <strong>{{ m.client_name || '#' + m.client }}</strong></span>
                            @if (m.client_email) {
                              <a [href]="'mailto:' + m.client_email" style="font-size: 12px; color: #2563eb; text-decoration: none; font-weight: 600;">
                                <i class="fa-regular fa-envelope"></i> {{ m.client_email }}
                              </a>
                            }
                            @if (m.client_phone) {
                              <a [href]="'tel:' + m.client_phone" style="font-size: 12px; color: #059669; text-decoration: none; font-weight: 700;">
                                <i class="fa-solid fa-phone"></i> {{ m.client_phone }}
                              </a>
                            }
                          </div>

                          <div class="action-btns" style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                            <button
                              type="button"
                              (click)="openClientChat(m)"
                              style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #0f172a; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;"
                            >
                              <i class="fa-solid fa-comments"></i> Ouvrir la messagerie
                            </button>
                            @if (m.status === 'accepted') {
                              <button
                                type="button"
                                (click)="advanceMissionStatus(m.id, 'en_route')"
                                style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;"
                              >
                                <i class="fa-solid fa-car"></i> Je suis en route
                              </button>
                            }
                            @if (m.status === 'en_route') {
                              <button
                                type="button"
                                (click)="advanceMissionStatus(m.id, 'in_progress')"
                                style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #d97706; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;"
                              >
                                <i class="fa-solid fa-wrench"></i> Démarrer l'intervention
                              </button>
                            }
                            @if (m.status === 'in_progress') {
                              <button
                                type="button"
                                (click)="openQuoteModal(m)"
                                style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #6366f1; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;"
                              >
                                <i class="fa-solid fa-file-invoice-dollar"></i> {{ m.quote ? 'Modifier le devis' : 'Établir devis' }}
                              </button>
                              <button
                                type="button"
                                (click)="advanceMissionStatus(m.id, 'completed')"
                                style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #16a34a; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;"
                              >
                                <i class="fa-solid fa-circle-check"></i> Terminer l'intervention
                              </button>
                            }
                            @if (m.status === 'completed') {
                              <button
                                type="button"
                                (click)="confirmCashReceipt(m)"
                                style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #059669; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;"
                              >
                                <i class="fa-solid fa-hand-holding-dollar"></i> Confirmer règlement espèces
                              </button>
                              <span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: #854d0e; font-size: 13px; background: #fef9c3; padding: 4px 10px; border-radius: 6px;">
                                <i class="fa-solid fa-hourglass-half"></i> En attente du règlement
                              </span>
                            }
                            @if (m.status === 'paid') {
                              <span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: #16a34a; font-size: 13px;">
                                <i class="fa-solid fa-circle-check"></i> Clôturée & Payée ({{ m.payment?.method === 'cash' ? '💵 Espèces' : '💳 En ligne' }})
                              </span>
                              <button
                                type="button"
                                (click)="openInvoice(m.id)"
                                style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: #0f172a; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 12px;"
                              >
                                <i class="fa-solid fa-receipt"></i> Voir Facture
                              </button>
                            }
                          </div>
                        </div>
                      </div>
                    } @empty {
                      <div class="empty-state" style="padding: 1.5rem; text-align: center; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">
                        <p style="margin: 0; color: #64748b; font-size: 0.95rem;">Vous n'avez aucune intervention assignée en cours.</p>
                      </div>
                    }
                  </div>
                </div>
              </div>
            }

            <!-- TAB 3.b: MESSAGERIE CLIENTS -->
            @if (activeTab() === 'messages') {
              <app-messaging-tab
                [initialPartnerId]="selectedClientId()"
                [initialRequestId]="selectedMissionId()"
                (unreadTotalChange)="unreadCount.set($event)"
              ></app-messaging-tab>
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

        <!-- Modal Établissement Devis (Sprint 7) -->
        @if (quotingMission()) {
          <div class="modal-backdrop" (click)="quotingMission.set(null)" style="position: fixed; inset: 0; background: rgba(15,23,42,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;">
            <div class="modal-card" (click)="$event.stopPropagation()" style="background: #fff; border-radius: 16px; width: 100%; max-width: 480px; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px;">
                <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: #0f172a;">
                  <i class="fa-solid fa-file-invoice-dollar text-primary"></i> Devis pour Mission #{{ quotingMission()!.id }}
                </h3>
                <button type="button" (click)="quotingMission.set(null)" style="background: #f1f5f9; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer;">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div style="display: flex; flex-direction: column; gap: 14px;">
                <div>
                  <label style="display: block; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 4px;">Main d'œuvre (TND)</label>
                  <input type="number" [(ngModel)]="quoteForm.labor_price" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 4px;">Pièces et fournitures (TND)</label>
                  <input type="number" [(ngModel)]="quoteForm.parts_price" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 4px;">Détails & description des travaux</label>
                  <textarea [(ngModel)]="quoteForm.description" rows="3" placeholder="Remplacement joint, flexible ou pièces..." style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; box-sizing: border-box;"></textarea>
                </div>

                <div style="padding: 12px; background: #eff6ff; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 15px; color: #1e40af;">
                  <span>Montant Total du Devis :</span>
                  <span>{{ (+quoteForm.labor_price || 0) + (+quoteForm.parts_price || 0) }} TND</span>
                </div>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                <button type="button" (click)="quotingMission.set(null)" style="padding: 9px 16px; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; border-radius: 8px; font-weight: 700; cursor: pointer;">
                  Annuler
                </button>
                <button type="button" (click)="submitQuote()" style="padding: 9px 20px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-weight: 800; cursor: pointer;">
                  Transmettre au client
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Modal Facture d'intervention (Sprint 7) -->
        @if (activeInvoice()) {
          <div class="modal-backdrop" (click)="activeInvoice.set(null)" style="position: fixed; inset: 0; background: rgba(15,23,42,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;">
            <div class="modal-card" (click)="$event.stopPropagation()" style="background: #fff; border-radius: 16px; width: 100%; max-width: 620px; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); max-height: 90vh; overflow-y: auto;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px;">
                <div>
                  <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a;">Facture {{ activeInvoice()!.invoice_number }}</h3>
                  <small style="color: #64748b;">Règlement certifié ServiceHome</small>
                </div>
                <button type="button" (click)="activeInvoice.set(null)" style="background: #f1f5f9; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer;">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; padding: 14px; border-radius: 10px; margin-bottom: 16px; font-size: 12px;">
                <div>
                  <span style="color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 10px;">Client</span>
                  <div style="font-size: 14px; font-weight: 800; color: #0f172a;">{{ activeInvoice()!.client.name }}</div>
                  <div>{{ activeInvoice()!.client.email }}</div>
                  <div>{{ activeInvoice()!.address }}</div>
                </div>
                <div>
                  <span style="color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 10px;">Intervention</span>
                  <div style="font-size: 14px; font-weight: 800; color: #0f172a;">{{ activeInvoice()!.category_name }}</div>
                  <div>Mode : {{ activeInvoice()!.payment_method }}</div>
                  <div>Réf : <code>{{ activeInvoice()!.transaction_id || 'N/A' }}</code></div>
                </div>
              </div>

              <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
                <thead>
                  <tr style="background: #f1f5f9; text-align: left;">
                    <th style="padding: 8px 12px;">Prestation</th>
                    <th style="padding: 8px 12px; text-align: right;">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  @for (it of activeInvoice()!.items; track it.label) {
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 10px 12px;">{{ it.label }}</td>
                      <td style="padding: 10px 12px; text-align: right; font-weight: 700;">{{ it.amount | number: '1.2-2' }} TND</td>
                    </tr>
                  }
                  <tr style="border-top: 2px solid #0f172a; font-weight: 800; font-size: 15px; background: #f8fafc;">
                    <td style="padding: 12px;">Total encaissé</td>
                    <td style="padding: 12px; text-align: right; color: #16a34a;">{{ activeInvoice()!.total_amount | number: '1.2-2' }} TND</td>
                  </tr>
                  <tr style="font-size: 12px; color: #475569;">
                    <td style="padding: 8px 12px;">Commission plateforme (10%)</td>
                    <td style="padding: 8px 12px; text-align: right;">- {{ activeInvoice()!.platform_fee | number: '1.2-2' }} TND</td>
                  </tr>
                  <tr style="font-size: 13px; font-weight: 800; color: #1e40af; background: #eff6ff;">
                    <td style="padding: 8px 12px;">Net Prestataire (90%)</td>
                    <td style="padding: 8px 12px; text-align: right;">{{ activeInvoice()!.technician_net | number: '1.2-2' }} TND</td>
                  </tr>
                </tbody>
              </table>

              <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" (click)="activeInvoice.set(null)" style="padding: 8px 16px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; font-weight: 700; cursor: pointer;">
                  Fermer
                </button>
                <button type="button" (click)="printInvoice()" style="padding: 8px 18px; background: #0f172a; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">
                  <i class="fa-solid fa-print"></i> Imprimer
                </button>
              </div>
            </div>
          </div>
        }
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
export class TechnicianDashboardComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  techService = inject(TechnicianService);
  private userService = inject(UserService);
  wsService = inject(WebSocketService);
  sanitizer = inject(DomSanitizer);
  private subs = new Subscription();

  profile = signal<TechnicianProfileResponse | null>(null);
  allCategories = signal<Category[]>([]);
  incomingMissions = signal<any[]>([]);
  availableMissions = signal<any[]>([]);
  scheduleSlots = signal<AvailabilitySlotPayload[]>([]);
  expandZones = signal<boolean>(true);
  unreadCount = signal<number>(0);
  selectedClientId = signal<number | null>(null);
  selectedMissionId = signal<number | null>(null);

  // Devis et Facture (Sprint 7)
  quotingMission = signal<any | null>(null);
  quoteForm = {
    labor_price: 45,
    parts_price: 35,
    description: '',
  };
  activeInvoice = signal<MissionInvoiceData | null>(null);

  activeTab = signal<TechTab>('missions');
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
        this.loadMissions();
        this.loadUnreadMessages();
      })
    );
  }

  loadUnreadMessages(): void {
    this.userService.getConversations().subscribe({
      next: (list) => {
        const total = (list || []).reduce((acc, c) => acc + (c.unread_count || 0), 0);
        if (total > this.unreadCount() && this.activeTab() !== 'messages') {
          this.showToast('Nouveau message client reçu dans votre messagerie !');
        }
        this.unreadCount.set(total);
      },
    });
  }

  openClientChat(mission: any): void {
    if (mission.client) {
      this.selectedClientId.set(Number(mission.client));
    }
    if (mission.id) {
      this.selectedMissionId.set(Number(mission.id));
    }
    this.activeTab.set('messages');
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
    this.loadAvailableMissions();
  }

  loadAvailableMissions(): void {
    this.techService.getAvailableMissions(this.expandZones()).subscribe({
      next: (list) => this.availableMissions.set(list || []),
    });
  }

  onToggleExpandZones(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.expandZones.set(checked);
    this.loadAvailableMissions();
  }

  enableAllZones(): void {
    this.expandZones.set(true);
    this.loadAvailableMissions();
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

  onLocationPicked(coords: { lat: number; lng: number }): void {
    this.profileForm.latitude = coords.lat;
    this.profileForm.longitude = coords.lng;
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

    const expYears = Number(this.profileForm.experience_years);
    const radius = Number(this.profileForm.service_radius_km);

    const payload: any = {
      bio: (this.profileForm.bio || '').trim(),
      experience_years: isNaN(expYears) || expYears < 0 ? 0 : Math.min(expYears, 60),
      service_radius_km: isNaN(radius) || radius < 1 ? 10 : Math.min(radius, 100),
      categories: Array.isArray(this.profileForm.categories) ? this.profileForm.categories : [],
    };

    if (
      this.profileForm.latitude !== null &&
      this.profileForm.latitude !== undefined &&
      this.profileForm.longitude !== null &&
      this.profileForm.longitude !== undefined
    ) {
      payload.latitude = Number(this.profileForm.latitude);
      payload.longitude = Number(this.profileForm.longitude);
    } else {
      payload.latitude = null;
      payload.longitude = null;
    }

    this.techService.updateProfile(payload).subscribe({
      next: (updated) => {
        this.isSubmitting.set(false);
        this.profile.set(updated);
        this.showToast('Profil mis à jour avec succès !');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        let errorMsg = 'Erreur lors de la sauvegarde du profil.';
        if (err.error) {
          if (typeof err.error === 'string') {
            errorMsg = err.error;
          } else if (err.error.detail) {
            errorMsg = err.error.detail;
          } else if (typeof err.error === 'object') {
            const firstKey = Object.keys(err.error)[0];
            if (firstKey) {
              const val = err.error[firstKey];
              const fieldLabels: Record<string, string> = {
                experience_years: "Années d'expérience",
                service_radius_km: "Rayon d'action",
                categories: "Métiers",
                latitude: "Latitude",
                longitude: "Longitude",
                bio: "Bio",
              };
              const label = fieldLabels[firstKey] || firstKey;
              const detail = Array.isArray(val) ? val.join(' ') : String(val);
              errorMsg = `${label} : ${detail}`;
            }
          }
        }
        this.showToast(errorMsg, true);
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

  // --- MISSIONS ACTIONS ---
  acceptMission(id: number): void {
    this.techService.acceptMission(id).subscribe({
      next: () => {
        this.showToast(`Mission #${id} acceptée avec succès ! Elle apparaît maintenant dans vos missions assignées.`);
        this.loadMissions();
      },
      error: (err) => {
        const msg = err.error?.detail || 'Impossible d\'accepter cette mission.';
        this.showToast(msg, true);
      },
    });
  }

  advanceMissionStatus(id: number, nextStatus: string): void {
    this.techService.updateMissionStatus(id, nextStatus).subscribe({
      next: () => {
        this.showToast('Statut de la mission mis à jour !');
        this.loadMissions();
      },
      error: (err) => {
        const msg = err.error?.detail || 'Transition de statut impossible.';
        this.showToast(msg, true);
      },
    });
  }

  declineMission(id: number): void {
    this.availableMissions.update((list) => list.filter((m) => m.id !== id));
    this.showToast(`Mission #${id} retirée de la liste.`);
  }

  // --- SPRINT 7: DEVIS, RÈGLEMENT & FACTURATION ---
  openQuoteModal(m: any): void {
    this.quotingMission.set(m);
    if (m.quote) {
      this.quoteForm.labor_price = Number(m.quote.labor_price) || 0;
      this.quoteForm.parts_price = Number(m.quote.parts_price) || 0;
      this.quoteForm.description = m.quote.description || '';
    } else {
      this.quoteForm.labor_price = 45;
      this.quoteForm.parts_price = 35;
      this.quoteForm.description = 'Diagnostic sur place & réparation';
    }
  }

  submitQuote(): void {
    const m = this.quotingMission();
    if (!m) return;

    this.techService.submitQuote(m.id, {
      labor_price: Number(this.quoteForm.labor_price) || 0,
      parts_price: Number(this.quoteForm.parts_price) || 0,
      description: this.quoteForm.description,
    }).subscribe({
      next: (quote) => {
        this.quotingMission.set(null);
        this.showToast(`Devis de ${quote.total_price} TND transmis au client avec succès !`);
        this.loadMissions();
      },
      error: (err) => {
        this.showToast(err?.error?.detail || 'Erreur lors de la transmission du devis.', true);
      },
    });
  }

  confirmCashReceipt(m: any): void {
    const total = m.quote ? Number(m.quote.total_price) : (Number(m.estimated_price) || 50);
    if (!confirm(`Confirmez-vous avoir reçu ${total} TND en espèces de la part du client ?`)) return;

    this.techService.confirmCashPayment(m.id, total).subscribe({
      next: () => {
        this.showToast(`Règlement en espèces de ${total} TND confirmé ! Mission clôturée.`);
        this.loadMissions();
      },
      error: (err) => {
        this.showToast(err?.error?.detail || 'Erreur lors de la confirmation du paiement.', true);
      },
    });
  }

  openInvoice(missionId: number): void {
    this.techService.getInvoice(missionId).subscribe({
      next: (inv) => {
        this.activeInvoice.set(inv);
      },
      error: () => {
        this.showToast('Impossible de récupérer la facture.', true);
      },
    });
  }

  printInvoice(): void {
    window.print();
  }

  getStatusBadgeLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'En attente',
      accepted: 'Acceptée',
      en_route: 'Technicien en route',
      in_progress: 'En cours d\'intervention',
      completed: 'Terminée',
      paid: 'Payée',
      cancelled: 'Annulée',
    };
    return labels[status] || status;
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
