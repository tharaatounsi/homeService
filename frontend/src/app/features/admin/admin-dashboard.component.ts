import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  AdminCategoryItem,
  AdminClientItem,
  AdminMissionItem,
  AdminService,
  AdminStats,
  AdminTechnicianItem,
} from '../../core/admin.service';
import { AuthService } from '../../core/auth.service';

type AdminTab = 'kpi' | 'technicians' | 'missions' | 'clients' | 'categories';
type TechFilter = 'all' | 'pending' | 'approved';
type MissionFilter = 'all' | 'pending' | 'in_progress' | 'completed' | 'cancelled';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe],
  template: `
    <div class="admin-page">
      <!-- Top Navbar -->
      <header class="navbar">
        <div class="nav-container">
          <div class="brand" routerLink="/admin" style="cursor: pointer;">
            <i class="fa-solid fa-shield-halved brand-icon"></i>
            <span class="brand-name">ServiceHome</span>
            <span class="role-badge admin">
              <i class="fa-solid fa-lock"></i> Administration Centrale
            </span>
          </div>

          <div class="user-menu">
            <button class="btn-refresh-top" (click)="refreshCurrentTab()" title="Actualiser les données">
              <i class="fa-solid fa-arrows-rotate" [class.fa-spin]="isLoading()"></i>
              <span>Actualiser</span>
            </button>

            <div class="user-info">
              <span class="username">{{ auth.user()?.username }}</span>
              <span class="email">{{ auth.user()?.email }}</span>
            </div>

            <button class="btn-logout" (click)="auth.logout()" title="Déconnexion">
              <i class="fa-solid fa-power-off"></i>
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      <main class="admin-container">
        <!-- Toast Notification -->
        @if (toastMessage()) {
          <div class="toast-notification" [class.error]="isToastError()">
            <i class="fa-solid" [class.fa-circle-check]="!isToastError()" [class.fa-triangle-exclamation]="isToastError()"></i>
            <span>{{ toastMessage() }}</span>
          </div>
        }

        <!-- Page Header & Main Tab Navigation -->
        <div class="dashboard-header-block">
          <div>
            <h1>Supervision & Pilotage de la Plateforme</h1>
            <p>Contrôlez les demandes d'intervention, validez les prestataires, gérez les clients et suivez la santé du service.</p>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <nav class="main-tabs-nav">
          <button
            type="button"
            class="tab-nav-btn"
            [class.active]="activeTab() === 'kpi'"
            (click)="activeTab.set('kpi')"
          >
            <i class="fa-solid fa-chart-pie"></i>
            <span>Tableau de bord & KPIs</span>
          </button>

          <button
            type="button"
            class="tab-nav-btn"
            [class.active]="activeTab() === 'missions'"
            (click)="activeTab.set('missions')"
          >
            <i class="fa-solid fa-list-check"></i>
            <span>Demandes & Missions ({{ missions().length }})</span>
          </button>

          <button
            type="button"
            class="tab-nav-btn"
            [class.active]="activeTab() === 'technicians'"
            (click)="activeTab.set('technicians')"
          >
            <i class="fa-solid fa-user-gear"></i>
            <span>Prestataires ({{ technicians().length }})</span>
            @if (pendingCount() > 0) {
              <span class="badge-pending-count">{{ pendingCount() }}</span>
            }
          </button>

          <button
            type="button"
            class="tab-nav-btn"
            [class.active]="activeTab() === 'clients'"
            (click)="activeTab.set('clients')"
          >
            <i class="fa-solid fa-users"></i>
            <span>Clients inscrits ({{ clients().length }})</span>
          </button>

          <button
            type="button"
            class="tab-nav-btn"
            [class.active]="activeTab() === 'categories'"
            (click)="activeTab.set('categories')"
          >
            <i class="fa-solid fa-layer-group"></i>
            <span>Catalogue Métiers ({{ categories().length }})</span>
          </button>
        </nav>

        <!-- ================= TAB 1: KPI & VUE D'ENSEMBLE ================= -->
        @if (activeTab() === 'kpi') {
          <section class="tab-content">
            <!-- Summary KPI Cards -->
            <div class="kpi-grid">
              <div class="kpi-card" (click)="activeTab.set('missions')">
                <div class="kpi-icon blue">
                  <i class="fa-solid fa-file-invoice"></i>
                </div>
                <div class="kpi-info">
                  <span class="kpi-number">{{ stats()?.total_missions ?? missions().length }}</span>
                  <span class="kpi-label">Total Missions créées</span>
                </div>
              </div>

              <div class="kpi-card" (click)="activeTab.set('technicians')">
                <div class="kpi-icon orange">
                  <i class="fa-solid fa-user-clock"></i>
                </div>
                <div class="kpi-info">
                  <span class="kpi-number">{{ pendingCount() }}</span>
                  <span class="kpi-label">Techniciens à valider</span>
                </div>
              </div>

              <div class="kpi-card" (click)="activeTab.set('technicians')">
                <div class="kpi-icon green">
                  <i class="fa-solid fa-user-check"></i>
                </div>
                <div class="kpi-info">
                  <span class="kpi-number">{{ approvedCount() }}</span>
                  <span class="kpi-label">Techniciens approuvés</span>
                </div>
              </div>

              <div class="kpi-card" (click)="activeTab.set('clients')">
                <div class="kpi-icon purple">
                  <i class="fa-solid fa-users"></i>
                </div>
                <div class="kpi-info">
                  <span class="kpi-number">{{ stats()?.total_clients ?? clients().length }}</span>
                  <span class="kpi-label">Clients enregistrés</span>
                </div>
              </div>
            </div>

            <!-- Operational Status Bars -->
            <div class="kpi-breakdown-card">
              <h3><i class="fa-solid fa-chart-simple"></i> État opérationnel des missions</h3>
              <div class="status-summary-grid">
                <div class="status-tile pending">
                  <span class="tile-count">{{ stats()?.pending_missions ?? getMissionsCountByStatus('pending') }}</span>
                  <span class="tile-title">En attente de technicien</span>
                </div>
                <div class="status-tile in-progress">
                  <span class="tile-count">{{ stats()?.in_progress_missions ?? getMissionsCountByStatus('in_progress') }}</span>
                  <span class="tile-title">En cours d'intervention</span>
                </div>
                <div class="status-tile completed">
                  <span class="tile-count">{{ stats()?.completed_missions ?? getMissionsCountByStatus('completed') }}</span>
                  <span class="tile-title">Missions terminées / payées</span>
                </div>
                <div class="status-tile cancelled">
                  <span class="tile-count">{{ stats()?.cancelled_missions ?? getMissionsCountByStatus('cancelled') }}</span>
                  <span class="tile-title">Missions annulées</span>
                </div>
              </div>
            </div>

            <!-- Quick Action Shortcuts -->
            <div class="quick-shortcuts-grid">
              <div class="shortcut-box">
                <h4><i class="fa-solid fa-triangle-exclamation"></i> Actions prioritaires</h4>
                <p>
                  Vous avez <strong>{{ pendingCount() }}</strong> demande(s) d'approbation de prestataires en attente de validation.
                </p>
                <button type="button" class="btn-action-primary" (click)="activeTab.set('technicians'); techFilter.set('pending')">
                  Examiner les profils prestataires
                </button>
              </div>

              <div class="shortcut-box">
                <h4><i class="fa-solid fa-clock-rotate-left"></i> Dernières demandes publiées</h4>
                <p>
                  Supervisez les <strong>{{ missions().length }}</strong> missions et suivez l'avancement des interventions en direct.
                </p>
                <button type="button" class="btn-action-secondary" (click)="activeTab.set('missions')">
                  Ouvrir la liste des missions
                </button>
              </div>
            </div>
          </section>
        }

        <!-- ================= TAB 2: MISSIONS & DÉPANNAGES ================= -->
        @if (activeTab() === 'missions') {
          <section class="tab-content">
            <div class="sub-header-bar">
              <div class="search-box">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input
                  type="text"
                  placeholder="Rechercher par ID, client, technicien, adresse ou catégorie..."
                  [(ngModel)]="missionSearch"
                />
              </div>

              <div class="filter-pills">
                <button
                  type="button"
                  class="pill-btn"
                  [class.active]="missionFilter() === 'all'"
                  (click)="missionFilter.set('all')"
                >
                  Toutes ({{ missions().length }})
                </button>
                <button
                  type="button"
                  class="pill-btn"
                  [class.active]="missionFilter() === 'pending'"
                  (click)="missionFilter.set('pending')"
                >
                  En attente ({{ getMissionsCountByStatus('pending') }})
                </button>
                <button
                  type="button"
                  class="pill-btn"
                  [class.active]="missionFilter() === 'in_progress'"
                  (click)="missionFilter.set('in_progress')"
                >
                  En cours ({{ getMissionsCountByStatus('in_progress') }})
                </button>
                <button
                  type="button"
                  class="pill-btn"
                  [class.active]="missionFilter() === 'completed'"
                  (click)="missionFilter.set('completed')"
                >
                  Terminées ({{ getMissionsCountByStatus('completed') }})
                </button>
                <button
                  type="button"
                  class="pill-btn"
                  [class.active]="missionFilter() === 'cancelled'"
                  (click)="missionFilter.set('cancelled')"
                >
                  Annulées ({{ getMissionsCountByStatus('cancelled') }})
                </button>
              </div>
            </div>

            <!-- Table of Missions -->
            <div class="table-container">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Réf</th>
                    <th>Catégorie</th>
                    <th>Client</th>
                    <th>Technicien assigné</th>
                    <th>Adresse</th>
                    <th>Date</th>
                    <th>Statut</th>
                    <th style="text-align: right;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (m of filteredMissions(); track m.id) {
                    <tr>
                      <td class="cell-id">#{{ m.id }}</td>
                      <td>
                        <span class="category-chip">
                          <i class="fa-solid fa-wrench"></i> {{ m.category_name }}
                        </span>
                      </td>
                      <td>
                        <strong>{{ m.client_name }}</strong>
                        <div class="cell-sub">{{ m.client_email }}</div>
                        @if (m.client_phone) {
                          <div class="cell-sub"><i class="fa-solid fa-phone"></i> {{ m.client_phone }}</div>
                        }
                      </td>
                      <td>
                        @if (m.technician_name) {
                          <strong class="tech-assigned">{{ m.technician_name }}</strong>
                          <div class="cell-sub">{{ m.technician_email }}</div>
                          @if (m.technician_phone) {
                            <div class="cell-sub"><i class="fa-solid fa-phone"></i> {{ m.technician_phone }}</div>
                          }
                        } @else {
                          <span class="unassigned-badge">Non assigné</span>
                        }
                      </td>
                      <td>
                        <span class="address-text" [title]="m.address">{{ m.address || 'Tunis' }}</span>
                      </td>
                      <td class="cell-date">
                        {{ m.created_at | date: 'dd/MM/yyyy HH:mm' }}
                      </td>
                      <td>
                        <span class="status-badge" [class]="m.status">
                          {{ getStatusLabel(m.status) }}
                        </span>
                      </td>
                      <td style="text-align: right;">
                        <button
                          type="button"
                          class="btn-sm btn-inspect"
                          (click)="inspectMission(m)"
                          title="Voir les détails"
                        >
                          <i class="fa-solid fa-eye"></i>
                        </button>
                        @if (m.status !== 'completed' && m.status !== 'cancelled' && m.status !== 'paid') {
                          <button
                            type="button"
                            class="btn-sm btn-cancel-req"
                            (click)="cancelMission(m.id)"
                            title="Annuler cette mission"
                          >
                            <i class="fa-solid fa-ban"></i>
                          </button>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="8" class="empty-table-cell">
                        <i class="fa-solid fa-folder-open"></i>
                        <p>Aucune demande trouvée avec ces critères.</p>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Modal / Detail inspection overlay -->
            @if (selectedMission()) {
              <div class="modal-backdrop" (click)="selectedMission.set(null)">
                <div class="modal-card" (click)="$event.stopPropagation()">
                  <div class="modal-header">
                    <h3>
                      <i class="fa-solid fa-file-lines"></i>
                      Détails de la Demande #{{ selectedMission()!.id }}
                    </h3>
                    <button type="button" class="btn-close-modal" (click)="selectedMission.set(null)">
                      <i class="fa-solid fa-xmark"></i>
                    </button>
                  </div>

                  <div class="modal-body">
                    <div class="modal-meta-grid">
                      <div>
                        <span class="meta-label">Catégorie</span>
                        <strong>{{ selectedMission()!.category_name }}</strong>
                      </div>
                      <div>
                        <span class="meta-label">Statut actuel</span>
                        <span class="status-badge" [class]="selectedMission()!.status">
                          {{ getStatusLabel(selectedMission()!.status) }}
                        </span>
                      </div>
                      <div>
                        <span class="meta-label">Client</span>
                        <strong>{{ selectedMission()!.client_name }}</strong> ({{ selectedMission()!.client_email }})
                      </div>
                      <div>
                        <span class="meta-label">Technicien</span>
                        <strong>{{ selectedMission()!.technician_name || 'Aucun pour le moment' }}</strong>
                      </div>
                      <div>
                        <span class="meta-label">Adresse</span>
                        <span>{{ selectedMission()!.address }}</span>
                      </div>
                      <div>
                        <span class="meta-label">Date de création</span>
                        <span>{{ selectedMission()!.created_at | date: 'dd/MM/yyyy à HH:mm' }}</span>
                      </div>
                    </div>

                    <div class="modal-desc-box">
                      <span class="meta-label">Description du problème</span>
                      <p>{{ selectedMission()!.description }}</p>
                    </div>

                    <!-- Détails Financiers & Règlement (Sprint 7) -->
                    <div class="modal-financial-box" style="margin-top: 16px; padding: 16px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                      <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-coins" style="color: #10b981;"></i> Détails Financiers & Encaissement (Sprint 7)
                      </h4>

                      @if (selectedMission()!.payment) {
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 12px;">
                          <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <span style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block;">Mode de Règlement</span>
                            <strong style="color: #0f172a; font-size: 13px;">
                              {{ selectedMission()!.payment!.method === 'cash' ? '💵 Espèces (sur place)' : '💳 En ligne (CB / Konnect)' }}
                            </strong>
                          </div>
                          <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <span style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block;">Montant Total TTC</span>
                            <strong style="color: #16a34a; font-size: 15px;">{{ selectedMission()!.payment!.amount }} TND</strong>
                          </div>
                          <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <span style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block;">Com. Plateforme (10%)</span>
                            <strong style="color: #2563eb; font-size: 14px;">{{ selectedMission()!.payment!.platform_fee }} TND</strong>
                          </div>
                          <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <span style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block;">Net Prestataire (90%)</span>
                            <strong style="color: #0f172a; font-size: 14px;">{{ selectedMission()!.payment!.technician_amount }} TND</strong>
                          </div>
                        </div>

                        <div style="font-size: 12px; color: #64748b; display: flex; flex-wrap: wrap; gap: 16px; border-top: 1px dashed #e2e8f0; padding-top: 8px;">
                          <span>Réf transaction : <code>{{ selectedMission()!.payment!.transaction_id }}</code></span>
                          @if (selectedMission()!.payment!.card_last4 && selectedMission()!.payment!.card_last4 !== 'CASH') {
                            <span>Carte : <code>•••• •••• •••• {{ selectedMission()!.payment!.card_last4 }}</code></span>
                          }
                          <span>Date règlement : {{ selectedMission()!.payment!.paid_at | date: 'dd/MM/yyyy HH:mm' }}</span>
                        </div>
                      } @else if (selectedMission()!.quote) {
                        <div style="background: #fff; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px;">
                          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <span>Devis établi sur place par le technicien :</span>
                            <strong style="color: #0f172a;">{{ selectedMission()!.quote!.total_price }} TND</strong>
                          </div>
                          <div style="font-size: 12px; color: #64748b;">
                            MO: {{ selectedMission()!.quote!.labor_price }} TND | Pièces: {{ selectedMission()!.quote!.parts_price }} TND | Statut: {{ selectedMission()!.quote!.status }}
                          </div>
                        </div>
                      } @else {
                        <div style="color: #64748b; font-size: 12px; font-style: italic;">
                          Aucun règlement enregistré pour le moment.
                        </div>
                      }
                    </div>

                    @if (selectedMission()!.events && selectedMission()!.events!.length > 0) {
                      <div class="modal-timeline">
                        <h4><i class="fa-solid fa-timeline"></i> Historique d'audit des statuts</h4>
                        <div class="timeline-items">
                          @for (ev of selectedMission()!.events; track ev.id) {
                            <div class="timeline-row">
                              <span class="timeline-dot"></span>
                              <div class="timeline-content">
                                <strong>{{ ev.to_status }}</strong>
                                <span class="timeline-time">{{ ev.created_at | date: 'dd/MM/yyyy HH:mm' }}</span>
                                @if (ev.actor_name) {
                                  <span class="timeline-actor">par {{ ev.actor_name }}</span>
                                }
                              </div>
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </div>

                  <div class="modal-footer">
                    <button type="button" class="btn-action-secondary" (click)="selectedMission.set(null)">
                      Fermer
                    </button>
                    @if (selectedMission()!.status !== 'completed' && selectedMission()!.status !== 'cancelled') {
                      <button type="button" class="btn-cancel-req-modal" (click)="cancelMission(selectedMission()!.id)">
                        <i class="fa-solid fa-ban"></i> Annuler cette demande
                      </button>
                    }
                  </div>
                </div>
              </div>
            }
          </section>
        }

        <!-- ================= TAB 3: TECHNICIENS & PRESTATAIRES ================= -->
        @if (activeTab() === 'technicians') {
          <section class="tab-content">
            <div class="sub-header-bar">
              <div class="search-box">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input
                  type="text"
                  placeholder="Rechercher un technicien (nom, email)..."
                  [(ngModel)]="techSearch"
                />
              </div>

              <div class="filter-pills">
                <button
                  type="button"
                  class="pill-btn"
                  [class.active]="techFilter() === 'pending'"
                  (click)="techFilter.set('pending')"
                >
                  <i class="fa-solid fa-hourglass-half"></i>
                  En attente ({{ pendingCount() }})
                </button>
                <button
                  type="button"
                  class="pill-btn"
                  [class.active]="techFilter() === 'approved'"
                  (click)="techFilter.set('approved')"
                >
                  <i class="fa-solid fa-check"></i>
                  Approuvés ({{ approvedCount() }})
                </button>
                <button
                  type="button"
                  class="pill-btn"
                  [class.active]="techFilter() === 'all'"
                  (click)="techFilter.set('all')"
                >
                  Tous ({{ technicians().length }})
                </button>
              </div>
            </div>

            <!-- Technicians Grid -->
            <div class="technicians-grid">
              @for (tech of filteredTechnicians(); track tech.id) {
                <div class="tech-card" [class.unapproved]="!tech.is_approved">
                  <div class="tech-header">
                    <div class="tech-avatar">
                      <i class="fa-solid fa-user-gear"></i>
                    </div>
                    <div class="tech-id-box">
                      <h3>{{ tech.username }}</h3>
                      <div class="contact-line">
                        <span><i class="fa-regular fa-envelope"></i> {{ tech.email }}</span>
                        @if (tech.phone) {
                          <span><i class="fa-solid fa-phone"></i> {{ tech.phone }}</span>
                        }
                      </div>
                    </div>
                    <div class="approval-badge">
                      @if (tech.is_approved) {
                        <span class="badge approved"><i class="fa-solid fa-circle-check"></i> Approuvé</span>
                      } @else {
                        <span class="badge pending"><i class="fa-solid fa-clock"></i> En attente</span>
                      }
                    </div>
                  </div>

                  <div class="tech-body">
                    <div class="details-row">
                      <div class="detail-item">
                        <span class="label">Expérience :</span>
                        <strong>{{ tech.experience_years }} an(s)</strong>
                      </div>
                      <div class="detail-item">
                        <span class="label">Rayon d'action :</span>
                        <strong>{{ tech.service_radius_km }} km</strong>
                      </div>
                      <div class="detail-item">
                        <span class="label">Statut en ligne :</span>
                        <strong [class.online-text]="tech.is_available">
                          {{ tech.is_available ? 'Disponible' : 'Indisponible' }}
                        </strong>
                      </div>
                    </div>

                    @if (tech.bio) {
                      <div class="bio-box">
                        <p>{{ tech.bio }}</p>
                      </div>
                    }
                  </div>

                  <div class="tech-actions">
                    @if (!tech.is_approved) {
                      <button class="btn-approve" (click)="approveTech(tech.id)">
                        <i class="fa-solid fa-check"></i>
                        <span>Approuver</span>
                      </button>
                    } @else {
                      <button class="btn-reject" (click)="rejectTech(tech.id)">
                        <i class="fa-solid fa-ban"></i>
                        <span>Suspendre</span>
                      </button>
                    }
                    <button class="btn-delete" (click)="deleteTech(tech.id)" title="Supprimer définitivement">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
              } @empty {
                <div class="empty-state">
                  <i class="fa-solid fa-user-slash icon-empty"></i>
                  <h3>Aucun prestataire trouvé</h3>
                  <p>Aucun profil ne correspond aux critères sélectionnés.</p>
                </div>
              }
            </div>
          </section>
        }

        <!-- ================= TAB 4: CLIENTS INSCRITS ================= -->
        @if (activeTab() === 'clients') {
          <section class="tab-content">
            <div class="sub-header-bar">
              <div class="search-box">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input
                  type="text"
                  placeholder="Rechercher un client (nom, email, téléphone)..."
                  [(ngModel)]="clientSearch"
                />
              </div>
              <span class="count-tag">{{ filteredClients().length }} client(s) répertorié(s)</span>
            </div>

            <div class="table-container">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Identifiant</th>
                    <th>Nom complet</th>
                    <th>Adresse Email</th>
                    <th>Téléphone</th>
                    <th>Demandes passées</th>
                    <th>Date d'inscription</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of filteredClients(); track c.id) {
                    <tr>
                      <td class="cell-id">#{{ c.id }}</td>
                      <td>
                        <strong>{{ c.first_name || c.username }} {{ c.last_name || '' }}</strong>
                        <div class="cell-sub">&#64;{{ c.username }}</div>
                      </td>
                      <td>
                        <a [href]="'mailto:' + c.email" class="link-contact">
                          <i class="fa-regular fa-envelope"></i> {{ c.email }}
                        </a>
                      </td>
                      <td>
                        @if (c.phone) {
                          <a [href]="'tel:' + c.phone" class="link-contact">
                            <i class="fa-solid fa-phone"></i> {{ c.phone }}
                          </a>
                        } @else {
                          <span class="cell-muted">Non renseigné</span>
                        }
                      </td>
                      <td>
                        <span class="badge-req-count">
                          <i class="fa-solid fa-receipt"></i> {{ c.requests_count ?? 0 }} demande(s)
                        </span>
                      </td>
                      <td class="cell-date">
                        {{ c.date_joined | date: 'dd/MM/yyyy' }}
                      </td>
                      <td>
                        @if (c.is_active) {
                          <span class="badge approved"><i class="fa-solid fa-circle-check"></i> Actif</span>
                        } @else {
                          <span class="badge pending"><i class="fa-solid fa-circle-xmark"></i> Inactif</span>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="7" class="empty-table-cell">
                        <i class="fa-solid fa-user-xmark"></i>
                        <p>Aucun client trouvé.</p>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        <!-- ================= TAB 5: CATALOGUE MÉTIERS ================= -->
        @if (activeTab() === 'categories') {
          <section class="tab-content">
            <div class="categories-intro">
              <h3><i class="fa-solid fa-layer-group"></i> Catégories de Dépannage & Services</h3>
              <p>Liste des spécialités proposées aux clients avec le nombre de prestataires qualifiés pour chaque métier.</p>
            </div>

            <div class="categories-grid">
              @for (cat of categories(); track cat.id) {
                <div class="category-card">
                  <div class="cat-icon-box">
                    <i class="fa-solid" [class]="cat.icon || 'fa-wrench'"></i>
                  </div>
                  <div class="cat-info">
                    <h4>{{ cat.name }}</h4>
                    <span class="cat-slug">{{ cat.slug }}</span>
                    @if (cat.description) {
                      <p class="cat-desc">{{ cat.description }}</p>
                    }
                    <div class="cat-stats-row">
                      <span class="cat-stat-chip">
                        <i class="fa-solid fa-user-check"></i>
                        {{ cat.technicians_count ?? 0 }} technicien(s)
                      </span>
                      <span class="cat-stat-chip">
                        <i class="fa-solid fa-bolt"></i>
                        {{ cat.requests_count ?? 0 }} demande(s)
                      </span>
                    </div>
                  </div>
                </div>
              } @empty {
                <div class="empty-state">
                  <i class="fa-solid fa-folder-open icon-empty"></i>
                  <h3>Aucune catégorie configurée</h3>
                </div>
              }
            </div>
          </section>
        }
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

      .admin-page {
        min-height: 100vh;
      }

      /* Navbar */
      .navbar {
        background: #ffffff;
        border-bottom: 1px solid #e2e8f0;
        position: sticky;
        top: 0;
        z-index: 50;
      }

      .nav-container {
        max-width: 1400px;
        margin: 0 auto;
        padding: 0.85rem 1.5rem;
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
        font-size: 1.25rem;
        font-weight: 800;
        color: #0f172a;
      }

      .role-badge.admin {
        background: #fef2f2;
        color: #dc2626;
        border: 1px solid #fecaca;
        padding: 0.2rem 0.6rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
      }

      .user-menu {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .btn-refresh-top {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0.45rem 0.9rem;
        background: #eff6ff;
        color: #2563eb;
        border: 1px solid #bfdbfe;
        border-radius: 8px;
        font-size: 0.82rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-refresh-top:hover {
        background: #dbeafe;
      }

      .user-info {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }

      .user-info .username {
        font-weight: 700;
        font-size: 0.875rem;
      }

      .user-info .email {
        font-size: 0.75rem;
        color: #64748b;
      }

      .btn-logout {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.45rem 0.9rem;
        border-radius: 8px;
        font-size: 0.82rem;
        font-weight: 600;
        border: 1px solid #e2e8f0;
        background: #ffffff;
        color: #475569;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-logout:hover {
        border-color: #fca5a5;
        color: #dc2626;
        background: #fef2f2;
      }

      /* Container */
      .admin-container {
        max-width: 1400px;
        margin: 1.5rem auto 3rem auto;
        padding: 0 1.5rem;
      }

      /* Toast */
      .toast-notification {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.9rem 1.25rem;
        background: #ecfdf5;
        color: #065f46;
        border-radius: 10px;
        border: 1px solid #a7f3d0;
        margin-bottom: 1.5rem;
        font-weight: 600;
        font-size: 0.9rem;
      }

      .toast-notification.error {
        background: #fef2f2;
        color: #991b1b;
        border-color: #fecaca;
      }

      /* Header */
      .dashboard-header-block {
        margin-bottom: 1.5rem;
      }

      .dashboard-header-block h1 {
        font-size: 1.5rem;
        font-weight: 800;
        margin-bottom: 0.35rem;
      }

      .dashboard-header-block p {
        color: #64748b;
        font-size: 0.9rem;
        margin: 0;
      }

      /* Main Tabs Navigation */
      .main-tabs-nav {
        display: flex;
        gap: 8px;
        border-bottom: 1px solid #e2e8f0;
        margin-bottom: 1.5rem;
        overflow-x: auto;
        padding-bottom: 2px;
      }

      .tab-nav-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 18px;
        border: none;
        background: transparent;
        color: #64748b;
        font-size: 14px;
        font-weight: 700;
        border-radius: 10px 10px 0 0;
        cursor: pointer;
        position: relative;
        white-space: nowrap;
        transition: all 0.2s;
      }

      .tab-nav-btn:hover {
        color: #1e293b;
        background: #f1f5f9;
      }

      .tab-nav-btn.active {
        color: #2563eb;
        background: #ffffff;
        border-bottom: 2px solid #2563eb;
      }

      .badge-pending-count {
        background: #f97316;
        color: #ffffff;
        font-size: 11px;
        padding: 2px 7px;
        border-radius: 9999px;
        font-weight: 800;
      }

      /* Tab Content Section */
      .tab-content {
        animation: fadeIn 0.2s ease-in-out;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* KPI Cards */
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }

      .kpi-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 20px;
        display: flex;
        align-items: center;
        gap: 16px;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .kpi-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.05);
      }

      .kpi-icon {
        width: 52px;
        height: 52px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
      }

      .kpi-icon.blue { background: #eff6ff; color: #2563eb; }
      .kpi-icon.orange { background: #fff7ed; color: #ea580c; }
      .kpi-icon.green { background: #ecfdf5; color: #059669; }
      .kpi-icon.purple { background: #faf5ff; color: #7c3aed; }

      .kpi-number {
        font-size: 26px;
        font-weight: 800;
        display: block;
        line-height: 1.1;
      }

      .kpi-label {
        font-size: 13px;
        color: #64748b;
        font-weight: 600;
      }

      /* KPI Breakdown */
      .kpi-breakdown-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 24px;
      }

      .kpi-breakdown-card h3 {
        font-size: 16px;
        font-weight: 800;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        gap: 8px;
        color: #1e293b;
      }

      .status-summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 14px;
      }

      .status-tile {
        padding: 16px;
        border-radius: 12px;
        border: 1px solid transparent;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .status-tile.pending { background: #fffbeb; border-color: #fde68a; color: #b45309; }
      .status-tile.in-progress { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
      .status-tile.completed { background: #ecfdf5; border-color: #a7f3d0; color: #047857; }
      .status-tile.cancelled { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }

      .tile-count { font-size: 24px; font-weight: 800; }
      .tile-title { font-size: 13px; font-weight: 600; }

      /* Quick Shortcuts */
      .quick-shortcuts-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      .shortcut-box {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 20px;
      }

      .shortcut-box h4 {
        font-size: 15px;
        font-weight: 700;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .shortcut-box p {
        font-size: 13px;
        color: #64748b;
        margin-bottom: 14px;
      }

      .btn-action-primary,
      .btn-action-secondary {
        padding: 9px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        border: none;
        transition: all 0.2s;
      }

      .btn-action-primary {
        background: #2563eb;
        color: #ffffff;
      }

      .btn-action-primary:hover {
        background: #1d4ed8;
      }

      .btn-action-secondary {
        background: #f1f5f9;
        color: #334155;
      }

      .btn-action-secondary:hover {
        background: #e2e8f0;
      }

      /* Sub Header Bar (Search & Pills) */
      .sub-header-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 14px;
        margin-bottom: 18px;
      }

      .search-box {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        padding: 8px 14px;
        min-width: 320px;
        flex: 1;
        max-width: 480px;
      }

      .search-box i {
        color: #94a3b8;
      }

      .search-box input {
        border: none;
        outline: none;
        font-size: 13px;
        width: 100%;
      }

      .filter-pills {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .pill-btn {
        padding: 7px 14px;
        border-radius: 9999px;
        font-size: 13px;
        font-weight: 600;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        color: #64748b;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
      }

      .pill-btn:hover {
        background: #f8fafc;
        border-color: #94a3b8;
      }

      .pill-btn.active {
        background: #2563eb;
        color: #ffffff;
        border-color: #2563eb;
      }

      .count-tag {
        font-size: 13px;
        font-weight: 700;
        color: #64748b;
      }

      /* Tables */
      .table-container {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }

      .admin-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }

      .admin-table th {
        background: #f8fafc;
        color: #475569;
        font-weight: 700;
        text-align: left;
        padding: 12px 16px;
        border-bottom: 1px solid #e2e8f0;
      }

      .admin-table td {
        padding: 14px 16px;
        border-bottom: 1px solid #f1f5f9;
        vertical-align: middle;
      }

      .admin-table tr:hover td {
        background: #f8fafc;
      }

      .cell-id {
        font-weight: 800;
        color: #2563eb;
      }

      .cell-sub {
        font-size: 11px;
        color: #64748b;
      }

      .cell-date {
        color: #64748b;
        font-size: 12px;
        white-space: nowrap;
      }

      .cell-muted {
        color: #94a3b8;
        font-style: italic;
      }

      .category-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background: #eff6ff;
        color: #1d4ed8;
        border-radius: 6px;
        font-weight: 700;
        font-size: 12px;
      }

      .tech-assigned {
        color: #047857;
      }

      .unassigned-badge {
        font-size: 11px;
        font-weight: 700;
        color: #94a3b8;
        background: #f1f5f9;
        padding: 3px 8px;
        border-radius: 6px;
      }

      .address-text {
        max-width: 220px;
        display: inline-block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .status-badge {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
      }

      .status-badge.pending { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
      .status-badge.accepted { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
      .status-badge.en_route { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
      .status-badge.in_progress { background: #fdf4ff; color: #a21caf; border: 1px solid #f5d0fe; }
      .status-badge.completed { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
      .status-badge.paid { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
      .status-badge.cancelled { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }

      .btn-sm {
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        border: 1px solid transparent;
        margin-left: 6px;
        transition: all 0.2s;
      }

      .btn-inspect {
        background: #f1f5f9;
        color: #334155;
        border-color: #cbd5e1;
      }

      .btn-inspect:hover {
        background: #e2e8f0;
      }

      .btn-cancel-req {
        background: #fef2f2;
        color: #b91c1c;
        border-color: #fecaca;
      }

      .btn-cancel-req:hover {
        background: #fee2e2;
      }

      .empty-table-cell {
        text-align: center;
        padding: 40px !important;
        color: #94a3b8;
      }

      .empty-table-cell i {
        font-size: 32px;
        margin-bottom: 8px;
        display: block;
      }

      .badge-req-count {
        background: #f1f5f9;
        color: #334155;
        padding: 3px 8px;
        border-radius: 6px;
        font-weight: 700;
        font-size: 12px;
      }

      .link-contact {
        color: #2563eb;
        text-decoration: none;
        font-weight: 600;
      }

      .link-contact:hover {
        text-decoration: underline;
      }

      /* Technicians Grid & Cards */
      .technicians-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
        gap: 16px;
      }

      .tech-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }

      .tech-card.unapproved {
        border-left: 4px solid #f97316;
      }

      .tech-header {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        margin-bottom: 14px;
      }

      .tech-avatar {
        width: 44px;
        height: 44px;
        background: #eff6ff;
        color: #2563eb;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
      }

      .tech-id-box h3 {
        font-size: 15px;
        font-weight: 800;
        margin-bottom: 2px;
      }

      .contact-line {
        font-size: 12px;
        color: #64748b;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .approval-badge {
        margin-left: auto;
      }

      .badge.approved {
        background: #ecfdf5;
        color: #047857;
        padding: 4px 10px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 700;
      }

      .badge.pending {
        background: #fff7ed;
        color: #c2410c;
        padding: 4px 10px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 700;
      }

      .details-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        background: #f8fafc;
        padding: 10px 12px;
        border-radius: 10px;
        margin-bottom: 12px;
      }

      .detail-item {
        font-size: 12px;
        display: flex;
        flex-direction: column;
      }

      .detail-item .label {
        color: #64748b;
      }

      .online-text {
        color: #059669;
      }

      .bio-box {
        font-size: 12px;
        color: #475569;
        margin-bottom: 14px;
        line-height: 1.4;
      }

      .tech-actions {
        display: flex;
        gap: 8px;
        margin-top: auto;
      }

      .btn-approve {
        flex: 1;
        padding: 9px;
        background: #059669;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      .btn-approve:hover {
        background: #047857;
      }

      .btn-reject {
        flex: 1;
        padding: 9px;
        background: #fef2f2;
        color: #b91c1c;
        border: 1px solid #fecaca;
        border-radius: 8px;
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      .btn-reject:hover {
        background: #fee2e2;
      }

      .btn-delete {
        padding: 9px 12px;
        background: #f8fafc;
        color: #94a3b8;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        cursor: pointer;
      }

      .btn-delete:hover {
        background: #fee2e2;
        color: #b91c1c;
        border-color: #fecaca;
      }

      /* Categories Tab */
      .categories-intro {
        margin-bottom: 18px;
      }

      .categories-intro h3 {
        font-size: 16px;
        font-weight: 800;
        margin-bottom: 4px;
      }

      .categories-intro p {
        color: #64748b;
        font-size: 13px;
      }

      .categories-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
      }

      .category-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 20px;
        display: flex;
        gap: 16px;
        align-items: flex-start;
      }

      .cat-icon-box {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: #eff6ff;
        color: #2563eb;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        flex-shrink: 0;
      }

      .cat-info h4 {
        font-size: 15px;
        font-weight: 800;
        margin-bottom: 2px;
      }

      .cat-slug {
        font-size: 11px;
        color: #94a3b8;
        display: block;
        margin-bottom: 6px;
      }

      .cat-desc {
        font-size: 12px;
        color: #64748b;
        margin-bottom: 12px;
        line-height: 1.4;
      }

      .cat-stats-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .cat-stat-chip {
        font-size: 11px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 6px;
        background: #f1f5f9;
        color: #334155;
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }

      /* Modal inspection */
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.5);
        backdrop-filter: blur(3px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        padding: 16px;
      }

      .modal-card {
        background: #ffffff;
        border-radius: 16px;
        max-width: 650px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        animation: modalScale 0.2s ease-out;
      }

      @keyframes modalScale {
        from { transform: scale(0.95); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }

      .modal-header {
        padding: 18px 24px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .modal-header h3 {
        font-size: 16px;
        font-weight: 800;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .btn-close-modal {
        background: transparent;
        border: none;
        font-size: 18px;
        color: #94a3b8;
        cursor: pointer;
      }

      .modal-body {
        padding: 24px;
      }

      .modal-meta-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        background: #f8fafc;
        padding: 16px;
        border-radius: 12px;
        margin-bottom: 18px;
      }

      .meta-label {
        font-size: 11px;
        color: #64748b;
        font-weight: 600;
        display: block;
        margin-bottom: 2px;
      }

      .modal-desc-box {
        margin-bottom: 20px;
      }

      .modal-desc-box p {
        font-size: 13px;
        background: #f8fafc;
        padding: 12px;
        border-radius: 8px;
        color: #334155;
      }

      .modal-timeline h4 {
        font-size: 14px;
        font-weight: 700;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .timeline-items {
        border-left: 2px solid #e2e8f0;
        margin-left: 8px;
        padding-left: 14px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .timeline-row {
        position: relative;
      }

      .timeline-dot {
        position: absolute;
        left: -19px;
        top: 4px;
        width: 8px;
        height: 8px;
        background: #2563eb;
        border-radius: 50%;
      }

      .timeline-content {
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .timeline-time {
        color: #94a3b8;
      }

      .timeline-actor {
        color: #64748b;
        font-style: italic;
      }

      .modal-footer {
        padding: 16px 24px;
        border-top: 1px solid #e2e8f0;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      .btn-cancel-req-modal {
        padding: 9px 16px;
        background: #b91c1c;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .btn-cancel-req-modal:hover {
        background: #991b1b;
      }

      @media (max-width: 768px) {
        .quick-shortcuts-grid {
          grid-template-columns: 1fr;
        }
        .modal-meta-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AdminDashboardComponent implements OnInit {
  auth = inject(AuthService);
  adminService = inject(AdminService);

  activeTab = signal<AdminTab>('kpi');
  isLoading = signal<boolean>(false);
  toastMessage = signal<string | null>(null);
  isToastError = signal<boolean>(false);

  // Stats
  stats = signal<AdminStats | null>(null);

  // Technicians
  technicians = signal<AdminTechnicianItem[]>([]);
  techFilter = signal<TechFilter>('pending');
  techSearch = '';

  // Missions
  missions = signal<AdminMissionItem[]>([]);
  missionFilter = signal<MissionFilter>('all');
  missionSearch = '';
  selectedMission = signal<AdminMissionItem | null>(null);

  // Clients
  clients = signal<AdminClientItem[]>([]);
  clientSearch = '';

  // Categories
  categories = signal<AdminCategoryItem[]>([]);

  // Computed counts
  pendingCount = computed(() => this.technicians().filter((t) => !t.is_approved).length);
  approvedCount = computed(() => this.technicians().filter((t) => t.is_approved).length);

  filteredTechnicians = computed(() => {
    const f = this.techFilter();
    const q = this.techSearch.toLowerCase().trim();
    let list = this.technicians();
    if (f === 'pending') list = list.filter((t) => !t.is_approved);
    else if (f === 'approved') list = list.filter((t) => t.is_approved);

    if (q) {
      list = list.filter(
        (t) =>
          t.username.toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q) ||
          (t.phone && t.phone.includes(q))
      );
    }
    return list;
  });

  filteredMissions = computed(() => {
    const f = this.missionFilter();
    const q = this.missionSearch.toLowerCase().trim();
    let list = this.missions();

    if (f === 'pending') {
      list = list.filter((m) => m.status === 'pending');
    } else if (f === 'in_progress') {
      list = list.filter((m) => ['accepted', 'en_route', 'in_progress'].includes(m.status));
    } else if (f === 'completed') {
      list = list.filter((m) => ['completed', 'paid'].includes(m.status));
    } else if (f === 'cancelled') {
      list = list.filter((m) => m.status === 'cancelled');
    }

    if (q) {
      list = list.filter(
        (m) =>
          String(m.id).includes(q) ||
          m.client_name.toLowerCase().includes(q) ||
          (m.technician_name && m.technician_name.toLowerCase().includes(q)) ||
          m.category_name.toLowerCase().includes(q) ||
          (m.address && m.address.toLowerCase().includes(q))
      );
    }
    return list;
  });

  filteredClients = computed(() => {
    const q = this.clientSearch.toLowerCase().trim();
    const list = this.clients();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.username.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.first_name && c.first_name.toLowerCase().includes(q)) ||
        (c.last_name && c.last_name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
    );
  });

  ngOnInit(): void {
    this.loadAllData();
  }

  loadAllData(): void {
    this.isLoading.set(true);
    this.loadStats();
    this.loadTechnicians();
    this.loadMissions();
    this.loadClients();
    this.loadCategories();
  }

  refreshCurrentTab(): void {
    this.loadAllData();
    this.showToast('Données actualisées.');
  }

  loadStats(): void {
    this.adminService.getStats().subscribe({
      next: (s) => this.stats.set(s),
      error: () => {},
    });
  }

  loadTechnicians(): void {
    this.adminService.getTechnicians().subscribe({
      next: (data) => {
        this.technicians.set(data || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.showToast('Erreur lors du chargement des techniciens.', true);
      },
    });
  }

  loadMissions(): void {
    this.adminService.getMissions().subscribe({
      next: (data) => this.missions.set(data || []),
      error: () => {},
    });
  }

  loadClients(): void {
    this.adminService.getClients().subscribe({
      next: (data) => this.clients.set(data || []),
      error: () => {},
    });
  }

  loadCategories(): void {
    this.adminService.getCategories().subscribe({
      next: (data) => this.categories.set(data || []),
      error: () => {},
    });
  }

  approveTech(id: number): void {
    this.adminService.approveTechnician(id).subscribe({
      next: () => {
        this.showToast('Prestataire approuvé ! Il peut désormais passer en ligne.');
        this.loadTechnicians();
        this.loadStats();
      },
      error: () => this.showToast('Erreur lors de l\'approbation.', true),
    });
  }

  rejectTech(id: number): void {
    this.adminService.rejectTechnician(id).subscribe({
      next: () => {
        this.showToast('Prestataire suspendu.');
        this.loadTechnicians();
        this.loadStats();
      },
      error: () => this.showToast('Erreur lors de la suspension.', true),
    });
  }

  deleteTech(id: number): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer définitivement ce prestataire ?')) return;
    this.adminService.deleteTechnician(id).subscribe({
      next: () => {
        this.showToast('Compte prestataire supprimé.');
        this.loadTechnicians();
        this.loadStats();
      },
      error: () => this.showToast('Erreur lors de la suppression.', true),
    });
  }

  inspectMission(m: AdminMissionItem): void {
    this.selectedMission.set(m);
  }

  cancelMission(id: number): void {
    if (!confirm(`Voulez-vous vraiment annuler la mission #${id} d'autorité ?`)) return;
    this.adminService.cancelMission(id).subscribe({
      next: () => {
        this.showToast(`Mission #${id} annulée avec succès.`);
        this.selectedMission.set(null);
        this.loadMissions();
        this.loadStats();
      },
      error: (err) => {
        const msg = err?.error?.detail || 'Impossible d\'annuler cette mission.';
        this.showToast(msg, true);
      },
    });
  }

  getMissionsCountByStatus(statusGroup: 'pending' | 'in_progress' | 'completed' | 'cancelled'): number {
    const list = this.missions();
    if (statusGroup === 'pending') return list.filter((m) => m.status === 'pending').length;
    if (statusGroup === 'in_progress') return list.filter((m) => ['accepted', 'en_route', 'in_progress'].includes(m.status)).length;
    if (statusGroup === 'completed') return list.filter((m) => ['completed', 'paid'].includes(m.status)).length;
    if (statusGroup === 'cancelled') return list.filter((m) => m.status === 'cancelled').length;
    return 0;
  }

  getStatusLabel(status: string): string {
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

  private showToast(msg: string, isError = false): void {
    this.toastMessage.set(msg);
    this.isToastError.set(isError);
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 4500);
  }
}
