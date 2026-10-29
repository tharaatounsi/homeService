import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  ClientServiceRequestSummary,
  MissionInvoiceData,
  UserService,
} from '../../../core/user.service';
import { LiveTrackingMapComponent } from '../../../shared/components/live-tracking-map.component';

@Component({
  selector: 'app-request-list-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, DecimalPipe, LiveTrackingMapComponent],
  template: `
    <div class="tab-pane">
      <div class="pane-header flex-between">
        <div>
          <h2><i class="fa-solid fa-clock-rotate-left"></i> Historique de mes interventions</h2>
          <p>Consultez l'état de vos demandes actuelles et suivez les interventions en direct.</p>
        </div>
        <button type="button" class="btn-refresh" (click)="refresh.emit()" title="Actualiser la liste">
          <i class="fa-solid fa-arrows-rotate" [class.fa-spin]="isLoading"></i>
          <span>Actualiser</span>
        </button>
      </div>

      <!-- Toast Feedback -->
      @if (actionToast()) {
        <div class="tab-toast" [class.error]="isToastError()">
          <i class="fa-solid" [class.fa-circle-check]="!isToastError()" [class.fa-triangle-exclamation]="isToastError()"></i>
          <span>{{ actionToast() }}</span>
        </div>
      }

      <div class="requests-list">
        @for (req of requests; track req.id) {
          <div class="request-item-card" [class.card-paid]="req.status === 'paid'">
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
                    <span class="req-price"><i class="fa-solid fa-coins"></i> {{ req.price | number: '1.2-2' }} TND</span>
                  }
                </div>
              </div>
            </div>

            @if (req.technicianName) {
              <div class="technician-assigned-box">
                <img [src]="req.technicianPhoto || '/assets/images/technician.jpg'" [alt]="req.technicianName" />
                <div class="tech-info">
                  <span class="tech-label">Technicien assigné :</span>
                  <strong>{{ req.technicianName }}</strong>
                  @if (req.technicianEmail) {
                    <span class="tech-email"><i class="fa-regular fa-envelope"></i> {{ req.technicianEmail }}</span>
                  }
                </div>
                <div class="tech-contact-actions">
                  @if (req.technicianPhone) {
                    <a [href]="'tel:' + req.technicianPhone" class="btn-call-tech" title="Appeler le technicien">
                      <i class="fa-solid fa-phone"></i>
                      <span>{{ req.technicianPhone }}</span>
                    </a>
                  }
                  <button
                    type="button"
                    class="btn-chat-tech"
                    (click)="openChat.emit({ requestId: req.id, technicianId: req.technicianId })"
                  >
                    <i class="fa-solid fa-comments"></i>
                    <span>Ouvrir la messagerie</span>
                  </button>
                </div>
              </div>
            }

            <!-- Suivi GPS en direct du technicien en route (Sprint 6) -->
            @if (req.status === 'en_route') {
              <div class="live-tracking-wrapper">
                <app-live-tracking-map
                  [requestId]="req.id"
                  [clientLat]="req.latitude || 36.8065"
                  [clientLng]="req.longitude || 10.1815"
                  [technicianName]="req.technicianName || 'Technicien'"
                ></app-live-tracking-map>
              </div>
            }

            <!-- Devis sur place établi par le technicien (Sprint 7) -->
            @if (req.quote) {
              <div class="quote-card-box" [class.pending]="req.quote.status === 'pending'" [class.accepted]="req.quote.status === 'accepted'">
                <div class="quote-header">
                  <span class="quote-title">
                    <i class="fa-solid fa-file-invoice-dollar"></i> Devis établi sur place par le technicien
                  </span>
                  <span class="quote-status-badge" [class]="req.quote.status">
                    {{ req.quote.status === 'accepted' ? 'Accepté' : (req.quote.status === 'rejected' ? 'Refusé' : 'En attente de votre accord') }}
                  </span>
                </div>
                <div class="quote-body">
                  <div class="quote-line">
                    <span>Main d'œuvre :</span>
                    <strong>{{ req.quote.labor_price | number: '1.2-2' }} TND</strong>
                  </div>
                  @if (+req.quote.parts_price > 0) {
                    <div class="quote-line">
                      <span>Fournitures & pièces de rechange :</span>
                      <strong>{{ req.quote.parts_price | number: '1.2-2' }} TND</strong>
                    </div>
                  }
                  <div class="quote-total-line">
                    <span>Total du devis :</span>
                    <strong class="total-amount">{{ req.quote.total_price | number: '1.2-2' }} TND</strong>
                  </div>
                  @if (req.quote.description) {
                    <p class="quote-desc"><i class="fa-solid fa-circle-info"></i> {{ req.quote.description }}</p>
                  }
                </div>
                @if (req.quote.status === 'pending') {
                  <div class="quote-actions">
                    <button type="button" class="btn-quote-accept" (click)="respondToQuote(req.id, 'accept')">
                      <i class="fa-solid fa-check"></i> Accepter le devis
                    </button>
                    <button type="button" class="btn-quote-reject" (click)="respondToQuote(req.id, 'reject')">
                      <i class="fa-solid fa-xmark"></i> Refuser
                    </button>
                  </div>
                }
              </div>
            }

            <!-- Real-time status event timeline -->
            @if (req.events && req.events.length > 0) {
              <div class="events-timeline">
                <h4><i class="fa-solid fa-timeline"></i> Suivi chronologique de la mission :</h4>
                <div class="timeline-steps">
                  @for (ev of req.events; track ev.id) {
                    <div class="timeline-step">
                      <span class="step-dot" [class]="ev.to_status"></span>
                      <div class="step-content">
                        <strong>{{ getStatusLabel(ev.to_status) }}</strong>
                        <span class="step-meta">
                          par {{ ev.actor_name || ev.author_name || 'Système' }} le {{ ev.created_at | date: 'dd/MM/yyyy HH:mm' }}
                        </span>
                        @if (ev.note) {
                          <span class="step-note">{{ ev.note }}</span>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Actions footer & Hybrid Payment Section (Sprint 7) -->
            <div class="request-card-footer">
              @if (!req.technicianName) {
                <button
                  type="button"
                  class="btn-chat-tech"
                  (click)="openChat.emit({ requestId: req.id, technicianId: req.technicianId })"
                >
                  <i class="fa-solid fa-comments"></i>
                  <span>Messagerie Technicien</span>
                </button>
              }

              <!-- Bouton de règlement lorsque l'intervention est terminée -->
              @if (req.status === 'completed') {
                <button
                  type="button"
                  class="btn-pay-now"
                  (click)="openPaymentModal(req)"
                >
                  <i class="fa-solid fa-credit-card"></i>
                  <span>Régler l'intervention ({{ getMissionPrice(req) | number: '1.2-2' }} TND)</span>
                </button>
              }

              <!-- Mission Payée : Badge et consultation facture -->
              @if (req.status === 'paid') {
                <div class="paid-action-group">
                  <span class="paid-badge">
                    <i class="fa-solid fa-circle-check"></i> Réglée
                    @if (req.payment?.method === 'cash') {
                      <span>(💵 Espèces)</span>
                    } @else {
                      <span>(💳 En ligne)</span>
                    }
                  </span>
                  <button type="button" class="btn-invoice-link" (click)="openInvoiceModal(req.id)">
                    <i class="fa-solid fa-receipt"></i> Voir Facture
                  </button>
                </div>
              }

              @if (req.status === 'pending' || req.status === 'accepted') {
                <button
                  type="button"
                  class="btn-cancel"
                  (click)="cancelRequest.emit(req.id)"
                >
                  <i class="fa-solid fa-ban"></i> Annuler cette demande
                </button>
              }
            </div>
          </div>
        } @empty {
          <div class="empty-state">
            <i class="fa-solid fa-clipboard-list"></i>
            <p class="empty-title">Aucune demande d'intervention en cours</p>
            <p class="empty-desc">Vous n'avez pas encore publié de demande de service.</p>
            <button
              type="button"
              class="btn-create-first"
              (click)="createNew.emit()"
            >
              <i class="fa-solid fa-plus-circle"></i> Créer ma première demande
            </button>
          </div>
        }
      </div>

      <!-- ================= MODAL DE PAIEMENT HYBRIDE (Sprint 7) ================= -->
      @if (payingRequest()) {
        <div class="modal-backdrop" (click)="payingRequest.set(null)">
          <div class="modal-card payment-modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div>
                <h3><i class="fa-solid fa-shield-halved text-primary"></i> Règlement de l'Intervention #{{ payingRequest()!.id }}</h3>
                <p class="modal-subtitle">Montant total certifié : <strong>{{ paymentAmount() | number: '1.2-2' }} TND</strong></p>
              </div>
              <button type="button" class="btn-close-modal" (click)="payingRequest.set(null)">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>

            <!-- Choix du mode de règlement : Espèces ou En ligne (Mock) -->
            <div class="pay-method-tabs">
              <button
                type="button"
                class="method-btn"
                [class.active]="paymentMethod() === 'online'"
                (click)="paymentMethod.set('online')"
              >
                <i class="fa-solid fa-credit-card"></i>
                <span>💳 En ligne (Carte Bancaire / Konnect Mock)</span>
              </button>
              <button
                type="button"
                class="method-btn"
                [class.active]="paymentMethod() === 'cash'"
                (click)="paymentMethod.set('cash')"
              >
                <i class="fa-solid fa-money-bill-wave"></i>
                <span>💵 Espèces sur place</span>
              </button>
            </div>

            <div class="modal-body">
              @if (paymentMethod() === 'online') {
                <div class="online-mock-container">
                  <div class="secure-mock-badge">
                    <i class="fa-solid fa-lock"></i>
                    <span>Simulation sécurisée — Passerelle de paiement agréée Konnect / CMI</span>
                  </div>

                  <!-- Aperçu de Carte Bancaire stylisée -->
                  <div class="credit-card-chip-ui">
                    <div class="card-chip-gold"></div>
                    <div class="card-number-mock">{{ cardForm.number || '•••• •••• •••• 4242' }}</div>
                    <div class="card-meta-row">
                      <div>
                        <span class="card-lbl">TITULAIRE</span>
                        <div class="card-val">{{ cardForm.holder || 'MOLKA CLIENTE' }}</div>
                      </div>
                      <div>
                        <span class="card-lbl">EXPIRE</span>
                        <div class="card-val">{{ cardForm.exp || '12/28' }}</div>
                      </div>
                      <div class="card-logo-visa">
                        <i class="fa-brands fa-cc-visa"></i>
                      </div>
                    </div>
                  </div>

                  <!-- Formulaire de saisie de carte -->
                  <div class="card-form-grid">
                    <div class="form-group full-width">
                      <label>Nom sur la carte</label>
                      <input type="text" [(ngModel)]="cardForm.holder" placeholder="Nom et prénom du titulaire" />
                    </div>
                    <div class="form-group full-width">
                      <label>Numéro de carte bancaire</label>
                      <input type="text" maxlength="19" [(ngModel)]="cardForm.number" placeholder="4242 4242 4242 4242" />
                    </div>
                    <div class="form-group">
                      <label>Date d'expiration</label>
                      <input type="text" maxlength="5" [(ngModel)]="cardForm.exp" placeholder="MM/AA" />
                    </div>
                    <div class="form-group">
                      <label>Cryptogramme (CVV)</label>
                      <input type="password" maxlength="4" [(ngModel)]="cardForm.cvv" placeholder="•••" />
                    </div>
                  </div>
                </div>
              } @else {
                <div class="cash-instructions-card">
                  <div class="cash-icon-circle">
                    <i class="fa-solid fa-hand-holding-dollar"></i>
                  </div>
                  <h4>Règlement direct en espèces sur place</h4>
                  <p>
                    Remettez la somme exacte de <strong>{{ paymentAmount() | number: '1.2-2' }} TND</strong> en main propre au technicien.
                  </p>
                  <div class="cash-guarantee-note">
                    <i class="fa-solid fa-circle-check"></i>
                    <span>La mission sera instantanément clôturée et votre reçu/facture téléchargeable sera disponible.</span>
                  </div>
                </div>
              }
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-cancel" (click)="payingRequest.set(null)">
                Annuler
              </button>
              <button
                type="button"
                class="btn-confirm-payment"
                [disabled]="isProcessingPayment()"
                (click)="executePayment()"
              >
                @if (isProcessingPayment()) {
                  <i class="fa-solid fa-circle-notch fa-spin"></i> Traitement du paiement...
                } @else {
                  <i class="fa-solid" [class.fa-lock]="paymentMethod() === 'online'" [class.fa-check]="paymentMethod() === 'cash'"></i>
                  {{ paymentMethod() === 'online' ? 'Valider le paiement de ' + (paymentAmount() | number: '1.2-2') + ' TND' : 'Confirmer le règlement en espèces' }}
                }
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ================= MODAL FACTURE OFFICIELLE (Sprint 7) ================= -->
      @if (activeInvoice()) {
        <div class="modal-backdrop" (click)="activeInvoice.set(null)">
          <div class="modal-card invoice-modal-card" (click)="$event.stopPropagation()">
            <div class="invoice-paper" id="invoice-printable-area">
              <!-- En-tête facture -->
              <div class="invoice-header-row">
                <div class="inv-brand">
                  <div class="inv-logo">
                    <i class="fa-solid fa-shield-halved"></i>
                  </div>
                  <div>
                    <h2 class="inv-brand-name">ServiceHome</h2>
                    <p class="inv-brand-sub">Plateforme Nationale de Services à Domicile</p>
                  </div>
                </div>
                <div class="inv-meta-right">
                  <span class="inv-badge-paid">FACTURE ACQUITTÉE</span>
                  <div class="inv-num">{{ activeInvoice()!.invoice_number }}</div>
                  <div class="inv-date">{{ activeInvoice()!.invoice_date | date: 'dd/MM/yyyy HH:mm' }}</div>
                </div>
              </div>

              <!-- Coordonnées Client / Prestataire -->
              <div class="inv-parties-grid">
                <div class="inv-party-card">
                  <span class="party-label">CLIENT (Bénéficiaire)</span>
                  <h4 class="party-name">{{ activeInvoice()!.client.name }}</h4>
                  <p class="party-line"><i class="fa-regular fa-envelope"></i> {{ activeInvoice()!.client.email }}</p>
                  @if (activeInvoice()!.client.phone) {
                    <p class="party-line"><i class="fa-solid fa-phone"></i> {{ activeInvoice()!.client.phone }}</p>
                  }
                  <p class="party-line"><i class="fa-solid fa-location-dot"></i> {{ activeInvoice()!.address }}</p>
                </div>
                <div class="inv-party-card">
                  <span class="party-label">PRESTATAIRE CERTIFIÉ</span>
                  <h4 class="party-name">{{ activeInvoice()!.technician.name }}</h4>
                  <p class="party-line"><i class="fa-regular fa-envelope"></i> {{ activeInvoice()!.technician.email }}</p>
                  @if (activeInvoice()!.technician.phone) {
                    <p class="party-line"><i class="fa-solid fa-phone"></i> {{ activeInvoice()!.technician.phone }}</p>
                  }
                  <p class="party-line"><i class="fa-solid fa-tag"></i> {{ activeInvoice()!.category_name }}</p>
                </div>
              </div>

              <!-- Lignes de facturation -->
              <table class="inv-details-table">
                <thead>
                  <tr>
                    <th>Désignation de la prestation / Fournitures</th>
                    <th style="text-align: right; width: 140px;">Montant Net</th>
                  </tr>
                </thead>
                <tbody>
                  @for (it of activeInvoice()!.items; track it.label) {
                    <tr>
                      <td>
                        <strong>{{ it.label }}</strong>
                        <div class="item-desc">{{ activeInvoice()!.description }}</div>
                      </td>
                      <td style="text-align: right; font-weight: 700;">
                        {{ it.amount | number: '1.2-2' }} TND
                      </td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr class="inv-foot-total">
                    <td>TOTAL GÉNÉRAL RÉGLÉ TTC</td>
                    <td style="text-align: right;" class="total-big">
                      {{ activeInvoice()!.total_amount | number: '1.2-2' }} TND
                    </td>
                  </tr>
                </tfoot>
              </table>

              <!-- Mention de règlement & Réf transaction -->
              <div class="inv-settlement-row">
                <div>
                  <span class="set-lbl">Mode de paiement :</span>
                  <strong>{{ activeInvoice()!.payment_method }}</strong>
                </div>
                <div>
                  <span class="set-lbl">Référence Transaction :</span>
                  <code>{{ activeInvoice()!.transaction_id || 'N/A' }}</code>
                </div>
                <div>
                  <span class="set-lbl">Statut comptable :</span>
                  <strong style="color: #16a34a;">Validé & Clôturé</strong>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-cancel" (click)="activeInvoice.set(null)">
                Fermer
              </button>
              <button type="button" class="btn-print" (click)="printInvoice()">
                <i class="fa-solid fa-print"></i> Imprimer / Enregistrer PDF
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .tab-pane {
        padding: 24px;
      }

      .flex-between {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
      }

      .pane-header {
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid #f1f5f9;
      }

      .pane-header h2 {
        font-size: 20px;
        font-weight: 800;
        color: #0f172a;
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 6px;
      }

      .pane-header p {
        color: #64748b;
        font-size: 13px;
        margin: 0;
      }

      .btn-refresh {
        padding: 8px 16px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        color: #334155;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s;
      }

      .btn-refresh:hover {
        background: #f1f5f9;
        color: #0f172a;
      }

      .tab-toast {
        margin-bottom: 16px;
        padding: 12px 16px;
        border-radius: 10px;
        background: #ecfdf5;
        color: #065f46;
        border: 1px solid #a7f3d0;
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 600;
        font-size: 14px;
      }

      .tab-toast.error {
        background: #fef2f2;
        color: #991b1b;
        border-color: #fecaca;
      }

      .requests-list {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .request-item-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        transition: all 0.2s;
      }

      .request-item-card.card-paid {
        border-color: #bbf7d0;
        background: linear-gradient(to bottom, #ffffff, #f0fdf4);
      }

      .request-main-info {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 16px;
      }

      .cat-icon-badge {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: #eff6ff;
        color: #2563eb;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        flex-shrink: 0;
      }

      .req-details {
        flex: 1;
      }

      .req-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
      }

      .req-header h3 {
        font-size: 17px;
        font-weight: 800;
        color: #0f172a;
        margin: 0;
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 9999px;
        font-size: 12px;
        font-weight: 700;
      }

      .status-pill.pending { background: #fef3c7; color: #92400e; }
      .status-pill.accepted { background: #dbeafe; color: #1e40af; }
      .status-pill.en_route { background: #e0e7ff; color: #3730a3; }
      .status-pill.in_progress { background: #ffedd5; color: #9a3412; }
      .status-pill.completed { background: #fef9c3; color: #854d0e; }
      .status-pill.paid { background: #dcfce7; color: #166534; }
      .status-pill.cancelled { background: #fee2e2; color: #991b1b; }

      .req-desc {
        color: #475569;
        font-size: 14px;
        line-height: 1.5;
        margin-bottom: 12px;
      }

      .req-meta {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        font-size: 12px;
        color: #64748b;
        font-weight: 500;
      }

      .req-price {
        color: #059669;
        font-weight: 700;
      }

      .technician-assigned-box {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 12px 16px;
        background: #f8fafc;
        border-radius: 12px;
        margin-bottom: 16px;
        border: 1px solid #f1f5f9;
        flex-wrap: wrap;
      }

      .technician-assigned-box img {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        object-fit: cover;
      }

      .tech-info {
        flex: 1;
        display: flex;
        flex-direction: column;
      }

      .tech-label {
        font-size: 11px;
        color: #64748b;
        text-transform: uppercase;
        font-weight: 600;
      }

      .tech-info strong {
        color: #0f172a;
        font-size: 15px;
      }

      .tech-email {
        font-size: 12px;
        color: #64748b;
      }

      .tech-contact-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .btn-call-tech, .btn-chat-tech {
        padding: 7px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        text-decoration: none;
      }

      .btn-call-tech {
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
      }

      .btn-chat-tech {
        background: #0f172a;
        color: #ffffff;
        border: none;
      }

      .live-tracking-wrapper {
        margin-bottom: 16px;
      }

      /* Quote card styling (Sprint 7) */
      .quote-card-box {
        background: #f8fafc;
        border: 2px dashed #cbd5e1;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
      }

      .quote-card-box.pending {
        border-color: #f59e0b;
        background: #fffbeb;
      }

      .quote-card-box.accepted {
        border-color: #10b981;
        background: #f0fdf4;
      }

      .quote-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .quote-title {
        font-weight: 800;
        font-size: 14px;
        color: #1e293b;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .quote-status-badge {
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
      }

      .quote-status-badge.pending { background: #fef3c7; color: #b45309; }
      .quote-status-badge.accepted { background: #dcfce7; color: #15803d; }
      .quote-status-badge.rejected { background: #fee2e2; color: #b91c1c; }

      .quote-body {
        font-size: 13px;
        color: #334155;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .quote-line {
        display: flex;
        justify-content: space-between;
      }

      .quote-total-line {
        display: flex;
        justify-content: space-between;
        padding-top: 8px;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
        font-size: 15px;
      }

      .total-amount {
        color: #0f172a;
        font-weight: 800;
      }

      .quote-desc {
        margin: 6px 0 0;
        font-size: 12px;
        color: #64748b;
      }

      .quote-actions {
        display: flex;
        gap: 10px;
        margin-top: 12px;
      }

      .btn-quote-accept {
        padding: 8px 16px;
        background: #16a34a;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-weight: 700;
        font-size: 12px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .btn-quote-reject {
        padding: 8px 14px;
        background: #f1f5f9;
        color: #64748b;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-weight: 700;
        font-size: 12px;
        cursor: pointer;
      }

      /* Events timeline */
      .events-timeline {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #f1f5f9;
      }

      .events-timeline h4 {
        font-size: 12px;
        text-transform: uppercase;
        color: #64748b;
        margin-bottom: 8px;
        font-weight: 700;
      }

      .timeline-steps {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .timeline-step {
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }

      .step-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        margin-top: 4px;
        flex-shrink: 0;
        background: #94a3b8;
      }

      .step-dot.accepted { background: #2563eb; }
      .step-dot.en_route { background: #6366f1; }
      .step-dot.in_progress { background: #ea580c; }
      .step-dot.completed { background: #16a34a; }
      .step-dot.paid { background: #059669; }

      .step-content {
        font-size: 12px;
      }

      .step-content strong {
        color: #0f172a;
      }

      .step-meta {
        color: #94a3b8;
        margin-left: 6px;
      }

      .step-note {
        display: block;
        color: #475569;
        font-style: italic;
        margin-top: 2px;
      }

      .request-card-footer {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 10px;
        margin-top: 16px;
        padding-top: 14px;
        border-top: 1px solid #f1f5f9;
      }

      .btn-pay-now {
        padding: 9px 18px;
        background: #16a34a;
        color: #ffffff;
        border: none;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 12px rgba(22, 163, 74, 0.25);
        transition: all 0.2s;
      }

      .btn-pay-now:hover {
        background: #15803d;
        transform: translateY(-1px);
      }

      .paid-action-group {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .paid-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-weight: 700;
        font-size: 13px;
        color: #16a34a;
        background: #f0fdf4;
        padding: 6px 12px;
        border-radius: 8px;
        border: 1px solid #bbf7d0;
      }

      .btn-invoice-link {
        padding: 6px 12px;
        background: #0f172a;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .btn-cancel {
        padding: 7px 14px;
        background: #fef2f2;
        color: #dc2626;
        border: 1px solid #fecaca;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      /* Modal backdrop & card */
      .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(15, 23, 42, 0.6);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
      }

      .modal-card {
        background: #ffffff;
        border-radius: 20px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        max-height: 90vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      }

      .payment-modal-card {
        max-width: 520px;
        width: 100%;
      }

      .invoice-modal-card {
        max-width: 680px;
        width: 100%;
      }

      .modal-header {
        padding: 20px 24px;
        border-bottom: 1px solid #f1f5f9;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .modal-header h3 {
        margin: 0 0 4px;
        font-size: 18px;
        font-weight: 800;
        color: #0f172a;
      }

      .modal-subtitle {
        margin: 0;
        font-size: 13px;
        color: #64748b;
      }

      .btn-close-modal {
        background: #f1f5f9;
        border: none;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #64748b;
        cursor: pointer;
      }

      .pay-method-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        padding: 16px 24px 0;
        gap: 12px;
      }

      .method-btn {
        padding: 12px;
        border-radius: 12px;
        border: 2px solid #e2e8f0;
        background: #f8fafc;
        font-size: 12px;
        font-weight: 700;
        color: #475569;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        text-align: center;
        transition: all 0.2s;
      }

      .method-btn.active {
        border-color: #2563eb;
        background: #eff6ff;
        color: #1d4ed8;
      }

      .modal-body {
        padding: 20px 24px;
      }

      .secure-mock-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: #f1f5f9;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 600;
        color: #475569;
        margin-bottom: 16px;
      }

      /* Stylized Credit Card */
      .credit-card-chip-ui {
        background: linear-gradient(135deg, #1e293b, #0f172a);
        color: #ffffff;
        border-radius: 14px;
        padding: 20px;
        box-shadow: 0 10px 25px rgba(15, 23, 42, 0.25);
        margin-bottom: 20px;
        position: relative;
      }

      .card-chip-gold {
        width: 36px;
        height: 28px;
        background: linear-gradient(135deg, #fcd34d, #f59e0b);
        border-radius: 6px;
        margin-bottom: 16px;
      }

      .card-number-mock {
        font-family: monospace;
        font-size: 18px;
        letter-spacing: 2px;
        font-weight: 700;
        margin-bottom: 16px;
      }

      .card-meta-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
      }

      .card-lbl {
        font-size: 9px;
        color: #94a3b8;
        display: block;
      }

      .card-val {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.5px;
      }

      .card-logo-visa {
        font-size: 26px;
        color: #38bdf8;
      }

      .card-form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .card-form-grid .full-width {
        grid-column: span 2;
      }

      .form-group label {
        display: block;
        font-size: 11px;
        font-weight: 700;
        color: #475569;
        margin-bottom: 4px;
        text-transform: uppercase;
      }

      .form-group input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-size: 13px;
        color: #0f172a;
        box-sizing: border-box;
      }

      .cash-instructions-card {
        text-align: center;
        padding: 24px 16px;
        background: #f8fafc;
        border-radius: 14px;
        border: 1px solid #e2e8f0;
      }

      .cash-icon-circle {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #dcfce7;
        color: #16a34a;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        margin: 0 auto 16px;
      }

      .cash-instructions-card h4 {
        margin: 0 0 8px;
        font-size: 16px;
        font-weight: 800;
        color: #0f172a;
      }

      .cash-instructions-card p {
        font-size: 13px;
        color: #475569;
        margin-bottom: 16px;
      }

      .cash-guarantee-note {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        color: #065f46;
        text-align: left;
      }

      .modal-footer {
        padding: 16px 24px;
        border-top: 1px solid #f1f5f9;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }

      .btn-confirm-payment {
        padding: 10px 20px;
        background: #16a34a;
        color: #fff;
        border: none;
        border-radius: 10px;
        font-weight: 800;
        font-size: 13px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .btn-confirm-payment:hover:not(:disabled) {
        background: #15803d;
      }

      .btn-print {
        padding: 10px 20px;
        background: #2563eb;
        color: #fff;
        border: none;
        border-radius: 10px;
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      /* Printable Invoice Layout */
      .invoice-paper {
        padding: 30px;
        background: #ffffff;
      }

      .invoice-header-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 2px solid #e2e8f0;
        padding-bottom: 20px;
        margin-bottom: 24px;
      }

      .inv-brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .inv-logo {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        background: #2563eb;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
      }

      .inv-brand-name {
        margin: 0;
        font-size: 22px;
        font-weight: 900;
        color: #0f172a;
      }

      .inv-brand-sub {
        margin: 0;
        font-size: 11px;
        color: #64748b;
      }

      .inv-meta-right {
        text-align: right;
      }

      .inv-badge-paid {
        display: inline-block;
        padding: 4px 10px;
        background: #dcfce7;
        color: #16a34a;
        font-weight: 800;
        border-radius: 6px;
        font-size: 11px;
        letter-spacing: 0.5px;
        margin-bottom: 6px;
      }

      .inv-num {
        font-size: 16px;
        font-weight: 800;
        color: #0f172a;
      }

      .inv-date {
        font-size: 12px;
        color: #64748b;
      }

      .inv-parties-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-bottom: 24px;
      }

      .inv-party-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px;
      }

      .party-label {
        font-size: 10px;
        text-transform: uppercase;
        font-weight: 800;
        color: #64748b;
        letter-spacing: 0.5px;
        display: block;
        margin-bottom: 6px;
      }

      .party-name {
        margin: 0 0 6px;
        font-size: 15px;
        font-weight: 800;
        color: #0f172a;
      }

      .party-line {
        margin: 0 0 4px;
        font-size: 12px;
        color: #475569;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .inv-details-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 24px;
      }

      .inv-details-table th {
        background: #f1f5f9;
        padding: 10px 14px;
        font-size: 11px;
        text-transform: uppercase;
        font-weight: 800;
        color: #475569;
        border-top: 1px solid #e2e8f0;
        border-bottom: 1px solid #e2e8f0;
      }

      .inv-details-table td {
        padding: 12px 14px;
        font-size: 13px;
        color: #1e293b;
        border-bottom: 1px solid #f1f5f9;
      }

      .item-desc {
        font-size: 11px;
        color: #64748b;
        margin-top: 2px;
      }

      .inv-foot-total td {
        font-size: 14px;
        font-weight: 800;
        color: #0f172a;
        padding: 14px;
        border-top: 2px solid #0f172a;
        background: #f8fafc;
      }

      .total-big {
        font-size: 18px !important;
        color: #16a34a !important;
      }

      .inv-settlement-row {
        display: flex;
        justify-content: space-between;
        background: #f8fafc;
        border-radius: 10px;
        padding: 12px 16px;
        font-size: 12px;
        color: #475569;
        flex-wrap: wrap;
        gap: 12px;
      }

      .set-lbl {
        color: #64748b;
        margin-right: 6px;
      }

      .empty-state {
        text-align: center;
        padding: 56px 24px;
        background: #f8fafc;
        border: 2px dashed #cbd5e1;
        border-radius: 16px;
      }

      .empty-state i {
        font-size: 44px;
        color: #94a3b8;
        margin-bottom: 12px;
        display: block;
      }

      .empty-title {
        font-size: 16px;
        font-weight: 700;
        color: #334155;
        margin-bottom: 6px;
      }

      .empty-desc {
        font-size: 14px;
        color: #64748b;
        margin-bottom: 20px;
      }

      .btn-create-first {
        padding: 10px 22px;
        background: #2563eb;
        color: #ffffff;
        border: none;
        border-radius: 10px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
    `,
  ],
})
export class RequestListTabComponent {
  private userService = inject(UserService);

  @Input() requests: ClientServiceRequestSummary[] = [];
  @Input() isLoading: boolean = false;
  @Output() refresh = new EventEmitter<void>();
  @Output() cancelRequest = new EventEmitter<number>();
  @Output() createNew = new EventEmitter<void>();
  @Output() openChat = new EventEmitter<{ requestId: number; technicianId?: number }>();

  actionToast = signal<string | null>(null);
  isToastError = signal(false);

  // Paiement Modal Signals
  payingRequest = signal<ClientServiceRequestSummary | null>(null);
  paymentMethod = signal<'online' | 'cash'>('online');
  paymentAmount = signal<number>(50);
  isProcessingPayment = signal(false);

  // Formulaire Mock CB
  cardForm = {
    holder: 'MOLKA CLIENTE',
    number: '4242 •••• •••• 4242',
    exp: '12/28',
    cvv: '123',
  };

  // Facture Modal Signal
  activeInvoice = signal<MissionInvoiceData | null>(null);

  getMissionPrice(req: ClientServiceRequestSummary): number {
    if (req.quote && req.quote.total_price) {
      return Number(req.quote.total_price);
    }
    return req.price || 50;
  }

  respondToQuote(requestId: number, action: 'accept' | 'reject'): void {
    this.userService.respondQuote(requestId, action).subscribe({
      next: (updatedQuote) => {
        const msg = action === 'accept' ? 'Devis accepté avec succès !' : 'Devis refusé.';
        this.showToast(msg);
        this.refresh.emit();
      },
      error: (err) => {
        this.showToast(err?.error?.detail || 'Erreur lors de la réponse au devis.', true);
      },
    });
  }

  openPaymentModal(req: ClientServiceRequestSummary): void {
    this.payingRequest.set(req);
    this.paymentMethod.set('online');
    this.paymentAmount.set(this.getMissionPrice(req));
  }

  executePayment(): void {
    const req = this.payingRequest();
    if (!req) return;

    this.isProcessingPayment.set(true);
    const method = this.paymentMethod();
    const cardLast4 = method === 'online' ? (this.cardForm.number.slice(-4) || '4242') : 'CASH';

    this.userService.payMission(req.id, {
      method,
      amount: this.paymentAmount(),
      card_last4: cardLast4,
    }).subscribe({
      next: () => {
        this.isProcessingPayment.set(false);
        this.payingRequest.set(null);
        this.showToast(`Paiement de ${this.paymentAmount()} TND validé avec succès !`);
        this.refresh.emit();
      },
      error: (err) => {
        this.isProcessingPayment.set(false);
        this.showToast(err?.error?.detail || 'Erreur lors du traitement du paiement.', true);
      },
    });
  }

  openInvoiceModal(requestId: number): void {
    this.userService.getInvoice(requestId).subscribe({
      next: (invoice) => {
        this.activeInvoice.set(invoice);
      },
      error: () => {
        this.showToast('Impossible de charger la facture.', true);
      },
    });
  }

  printInvoice(): void {
    window.print();
  }

  showToast(msg: string, isError = false): void {
    this.actionToast.set(msg);
    this.isToastError.set(isError);
    setTimeout(() => this.actionToast.set(null), 4000);
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'En attente de prestataire',
      accepted: 'Mission acceptée',
      en_route: 'Prestataire en route',
      in_progress: 'Intervention en cours',
      completed: 'Intervention terminée',
      paid: 'Payée & clôturée',
      cancelled: 'Demande annulée',
    };
    return labels[status] || status;
  }
}