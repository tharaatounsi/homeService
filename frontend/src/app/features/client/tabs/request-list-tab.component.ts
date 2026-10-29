import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';

import { ClientServiceRequestSummary } from '../../../core/user.service';
import { LiveTrackingMapComponent } from '../../../shared/components/live-tracking-map.component';

@Component({
  selector: 'app-request-list-tab',
  standalone: true,
  imports: [DatePipe, DecimalPipe, LiveTrackingMapComponent],
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

      <div class="requests-list">
        @for (req of requests; track req.id) {
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

            <!-- Real-time status event timeline -->
            @if (req.events && req.events.length > 0) {
              <div class="events-timeline">
                <h4><i class="fa-solid fa-timeline"></i> Suivi en direct de l'intervention :</h4>
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

            <!-- Actions footer -->
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
        font-size: 14px;
        color: #64748b;
      }

      .btn-refresh {
        padding: 8px 16px;
        background: #f1f5f9;
        color: #334155;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
      }

      .btn-refresh:hover {
        background: #e2e8f0;
      }

      .requests-list {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .request-item-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 22px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        transition: all 0.2s;
      }

      .request-item-card:hover {
        border-color: #cbd5e1;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
      }

      .request-main-info {
        display: flex;
        gap: 16px;
        align-items: flex-start;
      }

      .cat-icon-badge {
        width: 48px;
        height: 48px;
        border-radius: 14px;
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
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .req-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
      }

      .req-header h3 {
        font-size: 16px;
        font-weight: 700;
        color: #0f172a;
      }

      .status-pill {
        font-size: 11px;
        font-weight: 800;
        padding: 4px 10px;
        border-radius: 9999px;
        text-transform: uppercase;
      }

      .status-pill.pending { background: #fef3c7; color: #92400e; }
      .status-pill.accepted { background: #dbeafe; color: #1e40af; }
      .status-pill.en_route { background: #e0e7ff; color: #3730a3; }
      .status-pill.in_progress { background: #fae8ff; color: #86198f; }
      .status-pill.completed { background: #dcfce7; color: #166534; }
      .status-pill.cancelled { background: #fee2e2; color: #991b1b; }

      .req-desc {
        font-size: 14px;
        color: #475569;
        line-height: 1.5;
      }

      .req-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        font-size: 13px;
        color: #64748b;
      }

      .req-meta span {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .req-price {
        color: #059669;
        font-weight: 700;
      }

      /* Technician Box */
      .technician-assigned-box {
        display: flex;
        align-items: center;
        gap: 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 10px 14px;
      }

      .technician-assigned-box img {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        object-fit: cover;
      }

      .tech-label {
        display: block;
        font-size: 11px;
        color: #64748b;
      }

      .technician-assigned-box strong {
        font-size: 13px;
        color: #0f172a;
        display: block;
      }

      .tech-email {
        font-size: 12px;
        color: #475569;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-top: 2px;
      }

      .tech-contact-actions {
        margin-left: auto;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }

      .btn-call-tech {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        background: #ecfdf5;
        color: #059669;
        border: 1px solid #a7f3d0;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 700;
        text-decoration: none;
        transition: all 0.2s;
      }

      .btn-call-tech:hover {
        background: #059669;
        color: #ffffff;
      }

      .btn-chat-tech {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        background: #2563eb;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-chat-tech:hover {
        background: #1d4ed8;
      }

      .live-tracking-wrapper {
        margin: 12px 0 6px 0;
      }

      /* Events Timeline */
      .events-timeline {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 14px 18px;
      }

      .events-timeline h4 {
        font-size: 13px;
        font-weight: 700;
        color: #334155;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .timeline-steps {
        display: flex;
        flex-direction: column;
        gap: 10px;
        border-left: 2px solid #cbd5e1;
        margin-left: 8px;
        padding-left: 14px;
      }

      .timeline-step {
        position: relative;
      }

      .step-dot {
        position: absolute;
        left: -19px;
        top: 4px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #94a3b8;
      }

      .step-dot.accepted { background: #3b82f6; }
      .step-dot.en_route { background: #6366f1; }
      .step-dot.in_progress { background: #a855f7; }
      .step-dot.completed { background: #10b981; }
      .step-dot.cancelled { background: #ef4444; }

      .step-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .step-content strong {
        font-size: 13px;
        color: #1e293b;
      }

      .step-meta {
        font-size: 11px;
        color: #64748b;
      }

      .step-note {
        font-size: 12px;
        color: #334155;
        font-style: italic;
      }

      /* Card Footer */
      .request-card-footer {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 10px;
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
        transition: all 0.2s;
      }

      .btn-cancel:hover {
        background: #dc2626;
        color: #ffffff;
      }

      /* Empty State */
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
  @Input() requests: ClientServiceRequestSummary[] = [];
  @Input() isLoading: boolean = false;
  @Output() refresh = new EventEmitter<void>();
  @Output() cancelRequest = new EventEmitter<number>();
  @Output() createNew = new EventEmitter<void>();
  @Output() openChat = new EventEmitter<{ requestId: number; technicianId?: number }>();

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
