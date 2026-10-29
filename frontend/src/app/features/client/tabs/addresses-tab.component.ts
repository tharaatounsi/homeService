import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ClientAddress, UserService } from '../../../core/user.service';
import { MapPickerComponent } from '../../../shared/components/map-picker.component';

@Component({
  selector: 'app-addresses-tab',
  standalone: true,
  imports: [DecimalPipe, FormsModule, MapPickerComponent],
  template: `
    <div class="tab-pane">
      <div class="pane-header flex-between">
        <div>
          <h2><i class="fa-solid fa-map-location-dot"></i> Mes adresses d'intervention</h2>
          <p>Enregistrez vos adresses avec repère géographique précis pour vos demandes de dépannage.</p>
        </div>
        <button type="button" class="btn-add" (click)="toggleAddAddressForm()">
          <i class="fa-solid fa-plus"></i> Ajouter une adresse
        </button>
      </div>

      @if (feedbackMessage()) {
        <div class="feedback-banner" [class.error]="isError()">
          <i class="fa-solid" [class.fa-circle-check]="!isError()" [class.fa-triangle-exclamation]="isError()"></i>
          <span>{{ feedbackMessage() }}</span>
        </div>
      }

      <!-- Form to Add Address -->
      @if (showAddAddressForm()) {
        <div class="add-address-card">
          <div class="card-title">
            <h3><i class="fa-solid fa-location-plus"></i> Nouvelle adresse</h3>
            <button type="button" class="btn-close" (click)="showAddAddressForm.set(false)">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <form (ngSubmit)="submitNewAddress()" class="address-form">
            <div class="form-row">
              <div class="form-group">
                <label>Libellé (ex: Domicile, Bureau, Maison de vacances)</label>
                <input
                  type="text"
                  [(ngModel)]="newAddress.label"
                  name="label"
                  placeholder="Ex: Domicile"
                  required
                />
              </div>
              <div class="form-group">
                <label>Ville</label>
                <input
                  type="text"
                  [(ngModel)]="newAddress.city"
                  name="city"
                  placeholder="Ex: Tunis, Ariana, La Marsa"
                  required
                />
              </div>
            </div>

            <div class="form-group">
              <label>Adresse complète (Rue, Numéro, Bâtiment)</label>
              <input
                type="text"
                [(ngModel)]="newAddress.address"
                name="address"
                placeholder="Ex: 15 Rue de la République, Appt 4B"
                required
              />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Code postal</label>
                <input
                  type="text"
                  [(ngModel)]="newAddress.postal_code"
                  name="postal_code"
                  placeholder="Ex: 1001"
                />
              </div>
              <div class="form-group">
                <label>Consignes d'accès pour le technicien</label>
                <input
                  type="text"
                  [(ngModel)]="newAddress.notes"
                  name="notes"
                  placeholder="Ex: Interphone #4, 2ème étage à gauche"
                />
              </div>
            </div>

            <!-- Leaflet Interactive Map Picker -->
            <div class="form-group">
              <label><i class="fa-solid fa-map-pin"></i> Position géographique sur la carte</label>
              <app-map-picker
                [latitude]="newAddress.latitude"
                [longitude]="newAddress.longitude"
                height="240px"
                (locationChange)="onLocationPicked($event)"
              ></app-map-picker>
            </div>

            <div class="form-checkbox">
              <label>
                <input type="checkbox" [(ngModel)]="newAddress.is_default" name="is_default" />
                <span>Définir cette adresse comme adresse par défaut pour mes demandes</span>
              </label>
            </div>

            <div class="form-actions">
              <button type="button" class="btn-secondary" (click)="showAddAddressForm.set(false)">
                Annuler
              </button>
              <button type="submit" class="btn-save" [disabled]="isSubmitting()">
                @if (isSubmitting()) {
                  <i class="fa-solid fa-spinner fa-spin"></i> Enregistrement...
                } @else {
                  <i class="fa-solid fa-check"></i> Enregistrer l'adresse
                }
              </button>
            </div>
          </form>
        </div>
      }

      <!-- Address List Cards -->
      <div class="addresses-grid">
        @for (addr of addresses; track addr.id) {
          <div class="address-card" [class.default]="addr.is_default">
            <div class="address-header">
              <div class="address-title">
                <i
                  class="fa-solid"
                  [class.fa-house]="addr.label === 'Domicile'"
                  [class.fa-building]="addr.label === 'Bureau'"
                  [class.fa-location-dot]="addr.label !== 'Domicile' && addr.label !== 'Bureau'"
                ></i>
                <strong>{{ addr.label }}</strong>
                @if (addr.is_default) {
                  <span class="badge-default">Par défaut</span>
                }
              </div>
              @if (addr.id) {
                <button
                  type="button"
                  class="btn-delete"
                  (click)="deleteAddress(addr.id)"
                  title="Supprimer cette adresse"
                >
                  <i class="fa-regular fa-trash-can"></i>
                </button>
              }
            </div>

            <p class="address-text">
              {{ addr.address }}{{ addr.postal_code ? ', ' + addr.postal_code : '' }} {{ addr.city }}
            </p>

            @if (addr.lat && addr.lng) {
              <div class="address-coords">
                <i class="fa-solid fa-crosshairs"></i> GPS: {{ addr.lat | number: '1.4-4' }}, {{ addr.lng | number: '1.4-4' }}
              </div>
            }

            @if (addr.notes) {
              <p class="address-notes"><i class="fa-solid fa-circle-info"></i> {{ addr.notes }}</p>
            }

            @if (!addr.is_default && addr.id) {
              <div class="address-footer">
                <button
                  type="button"
                  class="btn-set-default"
                  (click)="setDefaultAddress(addr.id)"
                >
                  <i class="fa-regular fa-star"></i> Définir comme adresse principale
                </button>
              </div>
            }
          </div>
        } @empty {
          <div class="empty-state">
            <i class="fa-solid fa-map-location"></i>
            <p class="empty-title">Aucune adresse enregistrée</p>
            <p class="empty-desc">Ajoutez votre adresse pour commander vos prestations en 1 clic.</p>
            <button type="button" class="btn-add-first" (click)="toggleAddAddressForm()">
              <i class="fa-solid fa-plus"></i> Ajouter ma première adresse
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

      .btn-add {
        padding: 10px 18px;
        background: #0f172a;
        color: #ffffff;
        border: none;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s;
        white-space: nowrap;
      }

      .btn-add:hover {
        background: #2563eb;
      }

      .feedback-banner {
        padding: 12px 16px;
        border-radius: 10px;
        background: #ecfdf5;
        color: #065f46;
        border: 1px solid #a7f3d0;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        font-weight: 600;
      }

      .feedback-banner.error {
        background: #fef2f2;
        color: #b91c1c;
        border-color: #fecaca;
      }

      /* Add Address Card */
      .add-address-card {
        background: #ffffff;
        border: 1.5px solid #2563eb;
        border-radius: 16px;
        padding: 22px;
        margin-bottom: 28px;
        box-shadow: 0 4px 16px rgba(37, 99, 235, 0.08);
      }

      .card-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }

      .card-title h3 {
        font-size: 16px;
        font-weight: 700;
        color: #0f172a;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .btn-close {
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 18px;
        cursor: pointer;
      }

      .btn-close:hover {
        color: #0f172a;
      }

      .address-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .form-group label {
        font-size: 13px;
        font-weight: 700;
        color: #334155;
      }

      .form-group input {
        padding: 10px 14px;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        font-size: 14px;
      }

      .form-group input:focus {
        outline: none;
        border-color: #2563eb;
      }

      .form-checkbox label {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
        font-weight: 600;
        color: #334155;
        cursor: pointer;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 8px;
      }

      .btn-secondary {
        padding: 10px 18px;
        background: #f1f5f9;
        color: #475569;
        border: none;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
      }

      .btn-save {
        padding: 10px 20px;
        background: #2563eb;
        color: #ffffff;
        border: none;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .btn-save:hover:not(:disabled) {
        background: #1d4ed8;
      }

      /* Address Grid */
      .addresses-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 18px;
      }

      .address-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 18px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        transition: all 0.2s;
      }

      .address-card:hover {
        border-color: #cbd5e1;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
      }

      .address-card.default {
        border-color: #3b82f6;
        background: #f8faff;
      }

      .address-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .address-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 15px;
        color: #0f172a;
      }

      .badge-default {
        font-size: 10px;
        font-weight: 800;
        padding: 2px 7px;
        border-radius: 6px;
        background: #eff6ff;
        color: #2563eb;
        text-transform: uppercase;
      }

      .btn-delete {
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 15px;
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
      }

      .btn-delete:hover {
        color: #ef4444;
        background: #fef2f2;
      }

      .address-text {
        font-size: 14px;
        color: #334155;
        line-height: 1.4;
      }

      .address-coords {
        font-size: 12px;
        color: #64748b;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .address-notes {
        font-size: 12px;
        color: #64748b;
        background: #f8fafc;
        padding: 6px 10px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .address-footer {
        margin-top: auto;
        padding-top: 8px;
      }

      .btn-set-default {
        background: none;
        border: none;
        color: #2563eb;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        padding: 0;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .btn-set-default:hover {
        text-decoration: underline;
      }

      /* Empty State */
      .empty-state {
        grid-column: 1 / -1;
        text-align: center;
        padding: 48px 24px;
        background: #f8fafc;
        border: 2px dashed #cbd5e1;
        border-radius: 16px;
      }

      .empty-state i {
        font-size: 40px;
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
        margin-bottom: 18px;
      }

      .btn-add-first {
        padding: 10px 20px;
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

      @media (max-width: 640px) {
        .form-row {
          grid-template-columns: 1fr;
        }
        .flex-between {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `,
  ],
})
export class AddressesTabComponent {
  @Input() addresses: ClientAddress[] = [];
  @Output() addressesChanged = new EventEmitter<void>();

  private userService = inject(UserService);

  showAddAddressForm = signal(false);
  isSubmitting = signal(false);
  feedbackMessage = signal<string | null>(null);
  isError = signal(false);

  newAddress = {
    label: 'Domicile',
    address: '',
    city: 'Tunis',
    postal_code: '',
    notes: '',
    latitude: null as number | null,
    longitude: null as number | null,
    is_default: false,
  };

  toggleAddAddressForm(): void {
    this.showAddAddressForm.update((v) => !v);
  }

  onLocationPicked(coords: { lat: number; lng: number }): void {
    this.newAddress.latitude = coords.lat;
    this.newAddress.longitude = coords.lng;
  }

  submitNewAddress(): void {
    if (!this.newAddress.address.trim()) {
      this.isError.set(true);
      this.feedbackMessage.set('Veuillez renseigner votre adresse complète.');
      return;
    }

    this.isSubmitting.set(true);
    this.feedbackMessage.set(null);

    this.userService
      .createAddress({
        label: this.newAddress.label,
        address: this.newAddress.address,
        city: this.newAddress.city,
        postal_code: this.newAddress.postal_code,
        notes: this.newAddress.notes,
        latitude: this.newAddress.latitude,
        longitude: this.newAddress.longitude,
        is_default: this.newAddress.is_default,
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.showAddAddressForm.set(false);
          this.isError.set(false);
          this.feedbackMessage.set('Adresse enregistrée avec succès.');
          this.newAddress = {
            label: 'Domicile',
            address: '',
            city: 'Tunis',
            postal_code: '',
            notes: '',
            latitude: null,
            longitude: null,
            is_default: false,
          };
          this.addressesChanged.emit();
          setTimeout(() => this.feedbackMessage.set(null), 4000);
        },
        error: () => {
          this.isSubmitting.set(false);
          this.isError.set(true);
          this.feedbackMessage.set('Impossible d\'enregistrer cette adresse.');
        },
      });
  }

  deleteAddress(id: number): void {
    if (!confirm('Voulez-vous vraiment supprimer cette adresse ?')) return;

    this.userService.deleteAddress(id).subscribe({
      next: () => {
        this.isError.set(false);
        this.feedbackMessage.set('Adresse supprimée.');
        this.addressesChanged.emit();
        setTimeout(() => this.feedbackMessage.set(null), 4000);
      },
      error: () => {
        this.isError.set(true);
        this.feedbackMessage.set('Impossible de supprimer cette adresse.');
      },
    });
  }

  setDefaultAddress(id: number): void {
    this.userService.setDefaultAddress(id).subscribe({
      next: () => {
        this.isError.set(false);
        this.feedbackMessage.set('Adresse principale mise à jour.');
        this.addressesChanged.emit();
        setTimeout(() => this.feedbackMessage.set(null), 4000);
      },
      error: () => {
        this.isError.set(true);
        this.feedbackMessage.set('Impossible de définir cette adresse par défaut.');
      },
    });
  }
}
