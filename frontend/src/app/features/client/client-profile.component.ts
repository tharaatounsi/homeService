import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { AuthService } from '../../core/auth.service';
import { User } from '../../core/models';
import { ClientAddress, ClientServiceRequestSummary, UserService } from '../../core/user.service';

type ProfileTab = 'new_request' | 'info' | 'addresses' | 'requests' | 'security';

interface PhotoFile {
  file: File;
  previewUrl: string;
}

@Component({
  selector: 'app-client-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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
              <button class="btn-change-photo" title="Changer la photo">
                <i class="fa-solid fa-camera"></i>
              </button>
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
              <span class="stat-label">Demandes publiées</span>
            </div>
            <div class="stat-box">
              <span class="stat-number">{{ addresses().length }}</span>
              <span class="stat-label">Adresses enregistrées</span>
            </div>
          </div>
        </section>

        <!-- Main Layout with Navigation Tabs & Content -->
        <div class="profile-layout">
          <!-- Sidebar Navigation Tabs -->
          <aside class="sidebar-nav">
            <button
              class="tab-btn highlight-tab"
              [class.active]="activeTab() === 'new_request'"
              (click)="activeTab.set('new_request')"
            >
              <i class="fa-solid fa-circle-plus icon-plus"></i>
              <span>Décrire mon problème</span>
            </button>

            <button
              class="tab-btn"
              [class.active]="activeTab() === 'info'"
              (click)="activeTab.set('info')"
            >
              <i class="fa-solid fa-user-gear"></i>
              <span>Informations personnelles</span>
            </button>

            <button
              class="tab-btn"
              [class.active]="activeTab() === 'addresses'"
              (click)="activeTab.set('addresses')"
            >
              <i class="fa-solid fa-location-dot"></i>
              <span>Mes adresses ({{ addresses().length }})</span>
            </button>

            <button
              class="tab-btn"
              [class.active]="activeTab() === 'requests'"
              (click)="activeTab.set('requests')"
            >
              <i class="fa-solid fa-list-check"></i>
              <span>Historique des demandes ({{ requests().length }})</span>
            </button>

            <button
              class="tab-btn"
              [class.active]="activeTab() === 'security'"
              (click)="activeTab.set('security')"
            >
              <i class="fa-solid fa-lock"></i>
              <span>Sécurité & Préférences</span>
            </button>
          </aside>

          <!-- Tab Content Area -->
          <div class="tab-content-card">
            <!-- TAB 0: CRÉER UNE NOUVELLE DEMANDE (DÉCRIS TON PROBLÈME + PHOTO + GOOGLE MAPS) -->
            @if (activeTab() === 'new_request') {
              <div class="tab-pane">
                <div class="pane-header">
                  <h2><i class="fa-solid fa-triangle-exclamation icon-problem"></i> Décrivez votre problème & demandez un technicien</h2>
                  <p>Sélectionnez le métier, prenez des photos de la panne et indiquez votre position sur la carte Google Maps.</p>
                </div>

                <form (ngSubmit)="submitNewRequest()" class="new-request-form">
                  <!-- Step 1: Métier & Urgence -->
                  <div class="form-section">
                    <label class="section-title"><i class="fa-solid fa-list"></i> 1. Catégorie du service</label>
                    <div class="categories-selector-grid">
                      @for (cat of categoryOptions; track cat.id) {
                        <div
                          class="category-option-card"
                          [class.selected]="newRequestData.category === cat.id"
                          (click)="newRequestData.category = cat.id"
                        >
                          <i class="fa-solid" [class]="cat.icon"></i>
                          <span>{{ cat.name }}</span>
                        </div>
                      }
                    </div>
                  </div>

                  <!-- Urgency Selector -->
                  <div class="form-section">
                    <label class="section-title"><i class="fa-solid fa-bolt"></i> Niveau d'urgence</label>
                    <div class="urgency-pills">
                      <button
                        type="button"
                        class="urgency-pill low"
                        [class.selected]="newRequestData.urgency === 'low'"
                        (click)="newRequestData.urgency = 'low'"
                      >
                        <i class="fa-solid fa-leaf"></i> Faible (Dans la semaine)
                      </button>
                      <button
                        type="button"
                        class="urgency-pill medium"
                        [class.selected]="newRequestData.urgency === 'medium'"
                        (click)="newRequestData.urgency = 'medium'"
                      >
                        <i class="fa-solid fa-clock"></i> Moyenne (Sous 24h à 48h)
                      </button>
                      <button
                        type="button"
                        class="urgency-pill high"
                        [class.selected]="newRequestData.urgency === 'high'"
                        (click)="newRequestData.urgency = 'high'"
                      >
                        <i class="fa-solid fa-triangle-exclamation"></i> Élevée (Aujourd'hui)
                      </button>
                      <button
                        type="button"
                        class="urgency-pill critical"
                        [class.selected]="newRequestData.urgency === 'critical'"
                        (click)="newRequestData.urgency = 'critical'"
                      >
                        <i class="fa-solid fa-fire"></i> Critique (Urgence immédiate)
                      </button>
                    </div>
                  </div>

                  <!-- Step 2: Description du problème -->
                  <div class="form-section">
                    <label class="section-title" for="req_desc">
                      <i class="fa-solid fa-pen-to-square"></i> 2. Décrivez votre problème en détail
                    </label>
                    <textarea
                      id="req_desc"
                      rows="4"
                      [(ngModel)]="newRequestData.description"
                      name="description"
                      placeholder="Ex: J'ai une fuite d'eau sous l'évier de la cuisine. Le tuyau en cuivre semble fissuré et l'eau s'écoule rapidement sur le parquet..."
                      required
                      class="problem-textarea"
                    ></textarea>
                  </div>

                  <!-- Step 3: Prendre une photo / Joindre une image -->
                  <div class="form-section">
                    <label class="section-title">
                      <i class="fa-solid fa-camera"></i> 3. Prenez une photo ou joignez des images du problème
                    </label>

                    <div class="photo-upload-zone">
                      <div class="upload-drop-area" (click)="photoInput.click()">
                        <i class="fa-solid fa-cloud-arrow-up upload-icon"></i>
                        <strong>Cliquez pour ajouter une photo ou prendre une photo</strong>
                        <span>Supports: JPG, PNG, WEBP (Max 5Mo par photo)</span>
                        <input
                          #photoInput
                          type="file"
                          accept="image/*"
                          capture="environment"
                          multiple
                          (change)="onPhotosSelected($event)"
                          style="display: none;"
                        />
                      </div>

                      @if (photoFiles().length > 0) {
                        <div class="photos-preview-grid">
                          @for (p of photoFiles(); track $index) {
                            <div class="photo-preview-card">
                              <img [src]="p.previewUrl" alt="Aperçu photo panne" />
                              <button type="button" class="btn-remove-photo" (click)="removePhoto($index)">
                                <i class="fa-solid fa-xmark"></i>
                              </button>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  </div>

                  <!-- Step 4: Emplacement Google Maps -->
                  <div class="form-section">
                    <label class="section-title">
                      <i class="fa-solid fa-map-location-dot"></i> 4. Votre emplacement sur Google Maps
                    </label>

                    <div class="location-picker-box">
                      <div class="location-top-bar">
                        <button type="button" class="btn-gps" (click)="useCurrentLocation()">
                          <i class="fa-solid fa-crosshairs"></i> Détecter ma position GPS actuelle
                        </button>
                        <span class="or-text">ou</span>
                        <div class="search-address-wrapper">
                          <i class="fa-solid fa-magnifying-glass"></i>
                          <input
                            type="text"
                            [(ngModel)]="newRequestData.address"
                            name="address"
                            placeholder="Entrez votre adresse complète (ex: 15 Rue de la Liberté, Tunis)"
                            (change)="onAddressInputChange()"
                          />
                        </div>
                      </div>

                      <!-- Coordonnées GPS sous la carte -->
                      <div class="coords-info-bar">
                        <span><i class="fa-solid fa-location-pin"></i> <strong>Latitude:</strong> {{ newRequestData.latitude.toFixed(4) }}</span>
                        <span><i class="fa-solid fa-location-pin"></i> <strong>Longitude:</strong> {{ newRequestData.longitude.toFixed(4) }}</span>
                      </div>

                      <!-- Integrated Interactive Google Maps Iframe Embed -->
                      <div class="map-iframe-container">
                        <iframe
                          [src]="getGoogleMapsEmbedUrl()"
                          width="100%"
                          height="280"
                          style="border:0; border-radius: 0.75rem;"
                          allowfullscreen=""
                          loading="lazy"
                          referrerpolicy="no-referrer-when-downgrade"
                        ></iframe>
                      </div>
                    </div>
                  </div>

                  <!-- Submit Action -->
                  <div class="form-actions-bar">
                    <button type="submit" class="btn-submit-request" [disabled]="isSubmitting()">
                      @if (isSubmitting()) {
                        <i class="fa-solid fa-spinner fa-spin"></i> Publication de la demande...
                      } @else {
                        <i class="fa-solid fa-paper-plane"></i> Publier ma demande de service
                      }
                    </button>
                  </div>
                </form>
              </div>
            }

            <!-- TAB 1: INFORMATIONS PERSONNELLES -->
            @if (activeTab() === 'info') {
              <div class="tab-pane">
                <div class="pane-header">
                  <h2><i class="fa-solid fa-user-pen"></i> Modifier mon profil</h2>
                  <p>Mettez à jour vos coordonnées personnelles et identifiants de contact.</p>
                </div>

                <form (ngSubmit)="saveProfileInfo()" class="profile-form">
                  <div class="form-row">
                    <div class="form-group">
                      <label for="first_name">Prénom</label>
                      <input
                        type="text"
                        id="first_name"
                        [(ngModel)]="formData.first_name"
                        name="first_name"
                        placeholder="Ex: Ahmed"
                      />
                    </div>
                    <div class="form-group">
                      <label for="last_name">Nom</label>
                      <input
                        type="text"
                        id="last_name"
                        [(ngModel)]="formData.last_name"
                        name="last_name"
                        placeholder="Ex: Ben Ali"
                      />
                    </div>
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label for="username">Nom d'utilisateur</label>
                      <input
                        type="text"
                        id="username"
                        [(ngModel)]="formData.username"
                        name="username"
                        required
                      />
                    </div>
                    <div class="form-group">
                      <label for="phone">Numéro de téléphone</label>
                      <input
                        type="tel"
                        id="phone"
                        [(ngModel)]="formData.phone"
                        name="phone"
                        placeholder="Ex: +216 20 123 456"
                      />
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="email">Adresse email (Non modifiable)</label>
                    <input
                      type="email"
                      id="email"
                      [value]="formData.email"
                      disabled
                      class="input-disabled"
                    />
                    <small class="field-hint">L'email sert d'identifiant de connexion unique.</small>
                  </div>

                  <div class="form-actions">
                    <button type="submit" class="btn-save" [disabled]="isSubmitting()">
                      @if (isSubmitting()) {
                        <i class="fa-solid fa-spinner fa-spin"></i> Enregistrement...
                      } @else {
                        <i class="fa-solid fa-floppy-disk"></i> Enregistrer les modifications
                      }
                    </button>
                  </div>
                </form>
              </div>
            }

            <!-- TAB 2: MES ADRESSES & LOCALISATION -->
            @if (activeTab() === 'addresses') {
              <div class="tab-pane">
                <div class="pane-header flex-between">
                  <div>
                    <h2><i class="fa-solid fa-map-location-dot"></i> Mes adresses d'intervention</h2>
                    <p>Enregistrez vos adresses pour commander rapidement des interventions chez vous ou au bureau.</p>
                  </div>
                  <button class="btn-add" (click)="toggleAddAddressForm()">
                    <i class="fa-solid fa-plus"></i> Ajouter une adresse
                  </button>
                </div>

                <!-- Form to Add Address -->
                @if (showAddAddressForm()) {
                  <div class="add-address-card">
                    <h3>Nouvelle adresse</h3>
                    <div class="form-row">
                      <div class="form-group">
                        <label>Libellé (ex: Domicile, Bureau)</label>
                        <input type="text" [(ngModel)]="newAddress.label" placeholder="Ex: Maison de ville" />
                      </div>
                      <div class="form-group">
                        <label>Ville</label>
                        <input type="text" [(ngModel)]="newAddress.city" placeholder="Ex: Tunis, Ariana, Sousse" />
                      </div>
                    </div>
                    <div class="form-group">
                      <label>Adresse complète</label>
                      <input type="text" [(ngModel)]="newAddress.address" placeholder="Ex: 15 Rue de la Liberté, Appt 4" />
                    </div>
                    <div class="form-row">
                      <div class="form-group">
                        <label>Code postal</label>
                        <input type="text" [(ngModel)]="newAddress.postalCode" placeholder="Ex: 1002" />
                      </div>
                      <div class="form-group">
                        <label>Consignes pour le technicien</label>
                        <input type="text" [(ngModel)]="newAddress.notes" placeholder="Ex: Interphone #12, 2ème étage" />
                      </div>
                    </div>
                    <div class="form-actions">
                      <button class="btn-secondary" (click)="showAddAddressForm.set(false)">Annuler</button>
                      <button class="btn-save" (click)="addAddress()"><i class="fa-solid fa-check"></i> Enregistrer l'adresse</button>
                    </div>
                  </div>
                }

                <!-- Address List Cards -->
                <div class="addresses-grid">
                  @for (addr of addresses(); track addr.id) {
                    <div class="address-card" [class.default]="addr.isDefault">
                      <div class="address-header">
                        <div class="address-title">
                          <i class="fa-solid" [class.fa-house]="addr.label === 'Domicile'" [class.fa-building]="addr.label !== 'Domicile'"></i>
                          <strong>{{ addr.label }}</strong>
                          @if (addr.isDefault) {
                            <span class="badge-default">Par défaut</span>
                          }
                        </div>
                        <button class="btn-delete" (click)="deleteAddress(addr.id)" title="Supprimer">
                          <i class="fa-regular fa-trash-can"></i>
                        </button>
                      </div>
                      <p class="address-text">{{ addr.address }}, {{ addr.postalCode }} {{ addr.city }}</p>
                      @if (addr.notes) {
                        <p class="address-notes"><i class="fa-solid fa-circle-info"></i> {{ addr.notes }}</p>
                      }
                      @if (!addr.isDefault) {
                        <button class="btn-set-default" (click)="setDefaultAddress(addr.id)">
                          Définir comme adresse principale
                        </button>
                      }
                    </div>
                  }
                </div>
              </div>
            }

            <!-- TAB 3: HISTORIQUE DES DEMANDES DE SERVICE -->
            @if (activeTab() === 'requests') {
              <div class="tab-pane">
                <div class="pane-header">
                  <h2><i class="fa-solid fa-clock-rotate-left"></i> Historique de mes interventions</h2>
                  <p>Consultez l'état de vos demandes actuelles et l'historique de vos prestations.</p>
                </div>

                <div class="requests-list">
                  @for (req of requests(); track req.id) {
                    <div class="request-item-card">
                      <div class="request-main-info">
                        <div class="cat-icon-badge">
                          <i class="fa-solid" [class]="req.categoryIcon"></i>
                        </div>
                        <div class="req-details">
                          <div class="req-header">
                            <h3>Demande #{{ req.id }} — {{ req.categoryName }}</h3>
                            <span class="status-pill" [class]="req.status">
                              {{ req.statusLabel }}
                            </span>
                          </div>
                          <p class="req-desc">{{ req.description }}</p>
                          <div class="req-meta">
                            <span><i class="fa-regular fa-calendar"></i> {{ req.date }}</span>
                            <span><i class="fa-solid fa-location-dot"></i> {{ req.address }}</span>
                            @if (req.price) {
                              <span class="req-price"><i class="fa-solid fa-coins"></i> {{ req.price }} TND</span>
                            }
                          </div>
                        </div>
                      </div>

                      @if (req.technicianName) {
                        <div class="technician-assigned-box">
                          <img [src]="req.technicianPhoto || '/assets/images/technician.jpg'" [alt]="req.technicianName" />
                          <div>
                            <span class="tech-label">Technicien assigné :</span>
                            <strong>{{ req.technicianName }}</strong>
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>
            }

            <!-- TAB 4: SÉCURITÉ & PRÉFÉRENCES -->
            @if (activeTab() === 'security') {
              <div class="tab-pane">
                <div class="pane-header">
                  <h2><i class="fa-solid fa-shield-halved"></i> Sécurité & Paramètres du compte</h2>
                  <p>Gérez vos préférences de sécurité et vos notifications.</p>
                </div>

                <div class="security-sections">
                  <!-- Change Password Card -->
                  <div class="security-card">
                    <h3><i class="fa-solid fa-key"></i> Modifier le mot de passe</h3>
                    <form (ngSubmit)="changePassword()" class="password-form">
                      <div class="form-group">
                        <label>Mot de passe actuel</label>
                        <input type="password" [(ngModel)]="pwdData.currentPassword" name="currentPassword" required />
                      </div>
                      <div class="form-row">
                        <div class="form-group">
                          <label>Nouveau mot de passe</label>
                          <input type="password" [(ngModel)]="pwdData.newPassword" name="newPassword" required />
                        </div>
                        <div class="form-group">
                          <label>Confirmer le mot de passe</label>
                          <input type="password" [(ngModel)]="pwdData.confirmPassword" name="confirmPassword" required />
                        </div>
                      </div>
                      <button type="submit" class="btn-save">Mettre à jour le mot de passe</button>
                    </form>
                  </div>

                  <!-- Notifications Card -->
                  <div class="security-card">
                    <h3><i class="fa-solid fa-bell"></i> Notifications & Communication</h3>
                    <div class="toggle-list">
                      <label class="toggle-item">
                        <div>
                          <strong>Notifications SMS</strong>
                          <p>Recevoir un SMS lorsqu'un technicien accepte votre demande.</p>
                        </div>
                        <input type="checkbox" checked />
                      </label>
                      <label class="toggle-item">
                        <div>
                          <strong>Emails de récapitulatif</strong>
                          <p>Recevoir les factures et reçus d'intervention par email.</p>
                        </div>
                        <input type="checkbox" checked />
                      </label>
                    </div>
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

    .btn-back, .btn-logout {
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

    .btn-back:hover, .btn-logout:hover {
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
      animation: fadeIn 0.3s ease-in-out;
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
      width: 100px;
      height: 100px;
    }

    .avatar-wrapper img {
      width: 100%;
      height: 100%;
      border-radius: 9999px;
      object-fit: cover;
      border: 4px solid rgba(255, 255, 255, 0.4);
    }

    .btn-change-photo {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 32px;
      height: 32px;
      border-radius: 9999px;
      background: #ffffff;
      color: #2563eb;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
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
      border-radius: 1rem;
      border: 1px solid #e2e8f0;
      padding: 2rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .pane-header {
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #f1f5f9;
    }

    .pane-header h2 {
      margin: 0 0 0.35rem 0;
      font-size: 1.35rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      color: #1e293b;
    }

    .icon-problem {
      color: #dc2626;
    }

    .pane-header p {
      margin: 0;
      color: #64748b;
      font-size: 0.9rem;
    }

    .flex-between {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* New Request Form */
    .new-request-form {
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }

    .form-section {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .section-title {
      font-size: 1rem;
      font-weight: 700;
      color: #1e293b;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .categories-selector-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 0.75rem;
    }

    .category-option-card {
      border: 1.5px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1rem 0.75rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      transition: all 0.2s;
      background: #ffffff;
      text-align: center;
    }

    .category-option-card i {
      font-size: 1.35rem;
      color: #64748b;
    }

    .category-option-card span {
      font-size: 0.85rem;
      font-weight: 600;
    }

    .category-option-card:hover {
      border-color: #93c5fd;
      background: #f8fafc;
    }

    .category-option-card.selected {
      border-color: #2563eb;
      background: #eff6ff;
      color: #1d4ed8;

      i {
        color: #2563eb;
      }
    }

    .urgency-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .urgency-pill {
      padding: 0.6rem 1rem;
      border-radius: 9999px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.2s;
    }

    .urgency-pill.low.selected { background: #dcfce7; color: #15803d; border-color: #86efac; }
    .urgency-pill.medium.selected { background: #fef3c7; color: #b45309; border-color: #fde047; }
    .urgency-pill.high.selected { background: #ffedd5; color: #c2410c; border-color: #fdba74; }
    .urgency-pill.critical.selected { background: #fee2e2; color: #b91c1c; border-color: #fca5a5; }

    .problem-textarea {
      padding: 1rem;
      border-radius: 0.75rem;
      border: 1px solid #cbd5e1;
      font-size: 0.95rem;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
      resize: vertical;
    }

    .problem-textarea:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }

    /* Photo Upload Zone */
    .photo-upload-zone {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .upload-drop-area {
      border: 2px dashed #cbd5e1;
      border-radius: 0.85rem;
      padding: 1.75rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      background: #f8fafc;
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
    }

    .upload-drop-area:hover {
      border-color: #2563eb;
      background: #eff6ff;
    }

    .upload-icon {
      font-size: 2rem;
      color: #2563eb;
    }

    .upload-drop-area span {
      font-size: 0.8rem;
      color: #64748b;
    }

    .photos-preview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 1rem;
    }

    .photo-preview-card {
      position: relative;
      width: 100px;
      height: 100px;
      border-radius: 0.5rem;
      overflow: hidden;
      border: 1px solid #cbd5e1;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .btn-remove-photo {
      position: absolute;
      top: 4px;
      right: 4px;
      width: 24px;
      height: 24px;
      border-radius: 9999px;
      background: rgba(220, 38, 38, 0.9);
      color: #ffffff;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
    }

    /* Location Google Maps */
    .location-picker-box {
      border: 1px solid #e2e8f0;
      border-radius: 0.85rem;
      padding: 1.25rem;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .location-top-bar {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .btn-gps {
      background: #ffffff;
      color: #2563eb;
      border: 1px solid #2563eb;
      padding: 0.65rem 1rem;
      border-radius: 0.5rem;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      white-space: nowrap;
    }

    .btn-gps:hover {
      background: #eff6ff;
    }

    .or-text {
      color: #94a3b8;
      font-size: 0.85rem;
    }

    .search-address-wrapper {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 0.5rem;
      padding: 0.5rem 0.85rem;

      i {
        color: #94a3b8;
      }

      input {
        border: none;
        outline: none;
        width: 100%;
        font-size: 0.9rem;
      }
    }

    .coords-info-bar {
      display: flex;
      gap: 1.5rem;
      font-size: 0.85rem;
      color: #475569;
      background: #ffffff;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      border: 1px solid #e2e8f0;
    }

    .map-iframe-container {
      border-radius: 0.75rem;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .form-actions-bar {
      display: flex;
      justify-content: flex-end;
      margin-top: 1rem;
    }

    .btn-submit-request {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff;
      border: none;
      padding: 0.9rem 2rem;
      border-radius: 0.75rem;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
      transition: all 0.2s;
    }

    .btn-submit-request:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(37, 99, 235, 0.4);
    }

    /* Profile Forms */
    .profile-form, .password-form {
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
    }

    .form-group label {
      font-size: 0.875rem;
      font-weight: 600;
      color: #334155;
    }

    .form-group input {
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      border: 1px solid #cbd5e1;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s;
    }

    .form-group input:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }

    .input-disabled {
      background: #f8fafc;
      color: #94a3b8;
      cursor: not-allowed;
    }

    .field-hint {
      font-size: 0.775rem;
      color: #94a3b8;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      margin-top: 1rem;
    }

    .btn-save, .btn-add {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: background 0.2s;
    }

    .btn-save:hover, .btn-add:hover {
      background: #1d4ed8;
    }

    .btn-secondary {
      background: #ffffff;
      color: #475569;
      border: 1px solid #cbd5e1;
      padding: 0.75rem 1.25rem;
      border-radius: 0.5rem;
      font-weight: 600;
      cursor: pointer;
    }

    /* Addresses */
    .add-address-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }

    .addresses-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.25rem;
    }

    .address-card {
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      background: #ffffff;
      transition: all 0.2s;
    }

    .address-card.default {
      border-color: #3b82f6;
      background: #eff6ff;
    }

    .address-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .address-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1rem;
    }

    .badge-default {
      font-size: 0.7rem;
      background: #2563eb;
      color: #ffffff;
      padding: 0.15rem 0.5rem;
      border-radius: 0.35rem;
      font-weight: 600;
    }

    .btn-delete {
      background: transparent;
      border: none;
      color: #ef4444;
      cursor: pointer;
      font-size: 1rem;
    }

    .address-text {
      margin: 0;
      color: #475569;
      font-size: 0.9rem;
    }

    .address-notes {
      margin: 0;
      font-size: 0.8rem;
      color: #64748b;
    }

    .btn-set-default {
      align-self: flex-start;
      background: transparent;
      border: none;
      color: #2563eb;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
      text-decoration: underline;
    }

    /* Requests */
    .requests-list {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .request-item-card {
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background: #ffffff;
    }

    .request-main-info {
      display: flex;
      gap: 1.25rem;
    }

    .cat-icon-badge {
      width: 48px;
      height: 48px;
      border-radius: 0.75rem;
      background: #eff6ff;
      color: #2563eb;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.35rem;
      flex-shrink: 0;
    }

    .req-details {
      flex: 1;
    }

    .req-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.35rem;
    }

    .req-header h3 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
    }

    .status-pill {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
      text-transform: uppercase;
    }

    .status-pill.completed, .status-pill.paid {
      background: #dcfce7;
      color: #15803d;
    }

    .status-pill.in_progress, .status-pill.en_route {
      background: #dbeafe;
      color: #1d4ed8;
    }

    .status-pill.pending {
      background: #fef3c7;
      color: #b45309;
    }

    .req-desc {
      margin: 0 0 0.5rem 0;
      color: #475569;
      font-size: 0.9rem;
    }

    .req-meta {
      display: flex;
      gap: 1.25rem;
      font-size: 0.8rem;
      color: #64748b;
    }

    .technician-assigned-box {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: #f8fafc;
      padding: 0.65rem 1rem;
      border-radius: 0.5rem;
      border: 1px solid #f1f5f9;
    }

    .technician-assigned-box img {
      width: 36px;
      height: 36px;
      border-radius: 9999px;
      object-fit: cover;
    }

    .tech-label {
      font-size: 0.775rem;
      color: #64748b;
      display: block;
    }

    /* Security */
    .security-sections {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .security-card {
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1.5rem;

      h3 {
        margin: 0 0 1.25rem 0;
        font-size: 1.1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
    }

    .toggle-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .toggle-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;

      strong {
        display: block;
        font-size: 0.9rem;
      }

      p {
        margin: 0;
        font-size: 0.8rem;
        color: #64748b;
      }

      input {
        width: 20px;
        height: 20px;
        accent-color: #2563eb;
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 900px) {
      .profile-hero-card {
        flex-direction: column;
        gap: 1.5rem;
        align-items: flex-start;
      }
      .profile-layout {
        grid-template-columns: 1fr;
      }
      .form-row {
        grid-template-columns: 1fr;
      }
      .location-top-bar {
        flex-direction: column;
        align-items: stretch;
      }
    }
  `]
})
export class ClientProfileComponent implements OnInit {
  auth = inject(AuthService);
  userService = inject(UserService);
  router = inject(Router);
  sanitizer = inject(DomSanitizer);

  user = signal<User | null>(null);
  activeTab = signal<ProfileTab>('new_request');
  isSubmitting = signal<boolean>(false);
  toastMessage = signal<string | null>(null);
  isToastError = signal<boolean>(false);

  categoryOptions = [
    { id: 1, name: 'Plomberie', icon: 'fa-faucet-drip' },
    { id: 2, name: 'Électricité', icon: 'fa-bolt' },
    { id: 3, name: 'Ménage', icon: 'fa-broom' },
    { id: 4, name: 'Climatisation', icon: 'fa-snowflake' },
    { id: 5, name: 'Peinture', icon: 'fa-paint-roller' },
    { id: 6, name: 'Serrurerie', icon: 'fa-key' },
    { id: 7, name: 'Jardinage', icon: 'fa-seedling' },
    { id: 8, name: 'Menuiserie', icon: 'fa-ruler-combined' },
  ];

  newRequestData = {
    category: 1, // Default Plomberie
    urgency: 'high' as 'low' | 'medium' | 'high' | 'critical',
    description: '',
    address: '12 Rue de la Liberté, Tunis',
    latitude: 36.8065,
    longitude: 10.1815,
  };

  photoFiles = signal<PhotoFile[]>([]);

  formData = {
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    phone: '',
  };

  showAddAddressForm = signal<boolean>(false);
  newAddress = {
    label: '',
    address: '',
    city: '',
    postalCode: '',
    notes: '',
  };

  addresses = signal<ClientAddress[]>([
    {
      id: 'addr_1',
      label: 'Domicile',
      address: '12 Rue de la Liberté, Appt 3B',
      city: 'Tunis',
      postalCode: '1002',
      notes: 'Sonner au 3ème étage à droite',
      isDefault: true,
    },
    {
      id: 'addr_2',
      label: 'Bureau / Espace Pro',
      address: 'Immeuble Les Yasmine, Avenue Habib Bourguiba',
      city: 'Ariana',
      postalCode: '2080',
      notes: 'Secrétariat 1er étage',
      isDefault: false,
    },
  ]);

  requests = signal<ClientServiceRequestSummary[]>([
    {
      id: 104,
      categoryName: 'Plomberie & Sanitaire',
      categoryIcon: 'fa-faucet-drip',
      technicianName: 'Mohamed Ali (Plombier)',
      technicianPhoto: '/assets/images/technician.jpg',
      description: 'Réparation de fuite d\'eau sous évier de cuisine.',
      status: 'completed',
      statusLabel: 'Terminée',
      date: '02 Oct. 2026',
      price: 75,
      address: '12 Rue de la Liberté, Tunis',
    },
    {
      id: 108,
      categoryName: 'Électricité & Domotique',
      categoryIcon: 'fa-bolt',
      technicianName: 'Youssef K. (Électricien)',
      technicianPhoto: '/assets/images/hero.jpg',
      description: 'Dépannage court-circuit tableau électrique principal.',
      status: 'in_progress',
      statusLabel: 'En cours',
      date: '05 Oct. 2026',
      price: 120,
      address: '12 Rue de la Liberté, Tunis',
    },
  ]);

  pwdData = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  };

  ngOnInit(): void {
    this.loadProfile();
    this.fetchRequests();
  }

  loadProfile(): void {
    const currentUser = this.auth.user();
    if (currentUser) {
      this.populateForm(currentUser);
    }

    this.userService.getProfile().subscribe({
      next: (userData) => {
        this.populateForm(userData);
      },
    });
  }

  fetchRequests(): void {
    this.userService.getServiceRequests().subscribe({
      next: (list) => {
        if (list && list.length > 0) {
          const mapped: ClientServiceRequestSummary[] = list.map((item) => ({
            id: item.id,
            categoryName: item.category_name || 'Service',
            categoryIcon: this.getCategoryIcon(item.category_name),
            description: item.description,
            status: item.status,
            statusLabel: this.getStatusLabel(item.status),
            date: new Date(item.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
            address: item.address || 'Tunis',
            price: item.estimated_price ? parseFloat(item.estimated_price) : undefined,
          }));
          this.requests.set(mapped);
        }
      },
    });
  }

  populateForm(u: User): void {
    this.user.set(u);
    this.formData = {
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      username: u.username || '',
      email: u.email || '',
      phone: u.phone || '',
    };
  }

  // --- GOOGLE MAPS & GEOLOCATION ---
  useCurrentLocation(): void {
    if ('geolocation' in navigator) {
      this.showToast('Détection de votre position GPS...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.newRequestData.latitude = pos.coords.latitude;
          this.newRequestData.longitude = pos.coords.longitude;
          this.newRequestData.address = `Position GPS (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}) - Tunis`;
          this.showToast('Position GPS détectée avec succès !');
        },
        () => {
          this.showToast('Impossible d\'accéder à la géolocalisation.', true);
        }
      );
    } else {
      this.showToast('La géolocalisation n\'est pas supportée par votre navigateur.', true);
    }
  }

  onAddressInputChange(): void {
    // Simple geocoding simulation centered on Tunis coordinates offset based on address text length
    const text = this.newRequestData.address.toLowerCase();
    if (text.includes('ariana')) {
      this.newRequestData.latitude = 36.8665;
      this.newRequestData.longitude = 10.1947;
    } else if (text.includes('sousse')) {
      this.newRequestData.latitude = 35.8256;
      this.newRequestData.longitude = 10.6369;
    } else {
      this.newRequestData.latitude = 36.8065;
      this.newRequestData.longitude = 10.1815;
    }
  }

  getGoogleMapsEmbedUrl(): SafeResourceUrl {
    const lat = this.newRequestData.latitude;
    const lng = this.newRequestData.longitude;
    const url = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  // --- PHOTO MANAGEMENT ---
  onPhotosSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const files = Array.from(input.files);
      files.forEach((file) => {
        const previewUrl = URL.createObjectURL(file);
        this.photoFiles.update((list) => [...list, { file, previewUrl }]);
      });
    }
  }

  removePhoto(index: number): void {
    this.photoFiles.update((list) => {
      const copy = [...list];
      URL.revokeObjectURL(copy[index].previewUrl);
      copy.splice(index, 1);
      return copy;
    });
  }

  // --- SUBMIT SERVICE REQUEST ---
  submitNewRequest(): void {
    if (!this.newRequestData.description.trim()) {
      this.showToast('Veuillez décrire le problème avant de publier la demande.', true);
      return;
    }

    this.isSubmitting.set(true);

    const formData = new FormData();
    formData.append('category', this.newRequestData.category.toString());
    formData.append('description', this.newRequestData.description);
    formData.append('address', this.newRequestData.address);
    formData.append('urgency', this.newRequestData.urgency);
    formData.append('latitude', this.newRequestData.latitude.toString());
    formData.append('longitude', this.newRequestData.longitude.toString());

    this.photoFiles().forEach((p) => {
      formData.append('photos', p.file, p.file.name);
    });

    this.userService.createServiceRequest(formData).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.showToast('Votre demande de service a été publiée avec succès !');

        // Add to local history list
        const catObj = this.categoryOptions.find((c) => c.id === this.newRequestData.category);
        const newSummary: ClientServiceRequestSummary = {
          id: res.id || Date.now(),
          categoryName: catObj?.name || 'Service',
          categoryIcon: catObj?.icon || 'fa-wrench',
          description: this.newRequestData.description,
          status: 'pending',
          statusLabel: 'En attente',
          date: 'Aujourd\'hui',
          address: this.newRequestData.address,
        };

        this.requests.update((list) => [newSummary, ...list]);

        // Reset Form
        this.newRequestData.description = '';
        this.photoFiles.set([]);
        this.activeTab.set('requests');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const msg = err.error?.detail || 'Erreur lors de la publication de la demande.';
        this.showToast(msg, true);
      },
    });
  }

  // --- PROFILE INFO & ADDRESSES ---
  saveProfileInfo(): void {
    this.isSubmitting.set(true);
    this.userService.updateProfile({
      first_name: this.formData.first_name,
      last_name: this.formData.last_name,
      username: this.formData.username,
      phone: this.formData.phone,
    }).subscribe({
      next: (updatedUser) => {
        this.isSubmitting.set(false);
        this.user.set(updatedUser);
        this.showToast('Votre profil a été mis à jour avec succès !');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const detail = err.error?.detail || 'Erreur lors de la mise à jour du profil.';
        this.showToast(detail, true);
      }
    });
  }

  toggleAddAddressForm(): void {
    this.showAddAddressForm.update((v) => !v);
  }

  addAddress(): void {
    if (!this.newAddress.label || !this.newAddress.address || !this.newAddress.city) {
      this.showToast('Veuillez remplir au moins le libellé, la ville et l\'adresse.', true);
      return;
    }

    const created: ClientAddress = {
      id: 'addr_' + Date.now(),
      label: this.newAddress.label,
      address: this.newAddress.address,
      city: this.newAddress.city,
      postalCode: this.newAddress.postalCode || '1000',
      notes: this.newAddress.notes,
      isDefault: this.addresses().length === 0,
    };

    this.addresses.update((list) => [...list, created]);
    this.newAddress = { label: '', address: '', city: '', postalCode: '', notes: '' };
    this.showAddAddressForm.set(false);
    this.showToast('Nouvelle adresse enregistrée.');
  }

  deleteAddress(id: string): void {
    this.addresses.update((list) => list.filter((a) => a.id !== id));
    this.showToast('Adresse supprimée.');
  }

  setDefaultAddress(id: string): void {
    this.addresses.update((list) =>
      list.map((a) => ({ ...a, isDefault: a.id === id }))
    );
    this.showToast('Adresse principale mise à jour.');
  }

  changePassword(): void {
    if (this.pwdData.newPassword !== this.pwdData.confirmPassword) {
      this.showToast('Les deux mots de passe ne correspondent pas.', true);
      return;
    }
    this.showToast('Mot de passe mis à jour avec succès.');
    this.pwdData = { currentPassword: '', newPassword: '', confirmPassword: '' };
  }

  private showToast(msg: string, isError = false): void {
    this.toastMessage.set(msg);
    this.isToastError.set(isError);
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 4500);
  }

  private getCategoryIcon(name: string): string {
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

  private getStatusLabel(st: string): string {
    switch (st) {
      case 'pending': return 'En attente';
      case 'accepted': return 'Acceptée';
      case 'en_route': return 'En route';
      case 'in_progress': return 'En cours';
      case 'completed': return 'Terminée';
      case 'paid': return 'Payée';
      case 'cancelled': return 'Annulée';
      default: return st;
    }
  }
}
