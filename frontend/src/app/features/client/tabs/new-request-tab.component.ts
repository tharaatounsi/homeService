import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PublicTechnicianProfile, TechnicianService } from '../../../core/technician.service';
import { ClientAddress, UserService } from '../../../core/user.service';
import { MapPickerComponent } from '../../../shared/components/map-picker.component';

interface CategoryOption {
  id: number;
  slug: string;
  name: string;
  icon: string;
}

interface PhotoFile {
  file: File;
  previewUrl: string;
}

@Component({
  selector: 'app-new-request-tab',
  standalone: true,
  imports: [FormsModule, MapPickerComponent],
  template: `
    <div class="tab-pane">
      <div class="pane-header">
        <h2><i class="fa-solid fa-triangle-exclamation icon-problem"></i> Décrivez votre besoin & demandez une intervention</h2>
        <p>Sélectionnez le métier, prenez des photos de la panne et pointez votre emplacement sur la carte OpenStreetMap.</p>
      </div>

      @if (feedbackMessage()) {
        <div class="feedback-banner" [class.error]="isError()">
          <i class="fa-solid" [class.fa-circle-check]="!isError()" [class.fa-triangle-exclamation]="isError()"></i>
          <span>{{ feedbackMessage() }}</span>
        </div>
      }

      <form (ngSubmit)="submitRequest()" class="new-request-form">
        <!-- Step 1: Catégorie de service -->
        <div class="form-section">
          <label class="section-title"><i class="fa-solid fa-list"></i> 1. Métier & Spécialité requise</label>
          <div class="categories-selector-grid">
            @for (cat of categoryOptions; track cat.id) {
              <div
                class="category-option-card"
                [class.selected]="selectedCategoryId === cat.id"
                (click)="selectedCategoryId = cat.id"
              >
                <i class="fa-solid" [class]="cat.icon"></i>
                <span>{{ cat.name }}</span>
              </div>
            }
          </div>
        </div>

        <!-- Step 1.b: Choix direct d'un technicien (optionnel) -->
        @if (availableTechnicians().length > 0) {
          <div class="form-section">
            <label class="section-title" for="tech_select">
              <i class="fa-solid fa-user-check"></i> Technicien souhaité (Contact direct ou diffusion ouverte)
            </label>
            <select
              id="tech_select"
              name="selectedTechnicianId"
              [(ngModel)]="selectedTechnicianId"
              style="padding: 12px 14px; border: 1.5px solid #cbd5e1; border-radius: 12px; font-size: 14px; font-weight: 600; color: #0f172a; background: #f8fafc;"
            >
              <option [ngValue]="null">Tous les techniciens disponibles (Attribution ouverte)</option>
              @for (tech of availableTechnicians(); track tech.id) {
                <option [ngValue]="tech.user_id || tech.id">
                  Technicien {{ tech.username }} — {{ tech.experience_years }} an(s) d'expérience
                </option>
              }
            </select>
          </div>
        }

        <!-- Step 2: Niveau d'urgence -->
        <div class="form-section">
          <label class="section-title"><i class="fa-solid fa-bolt"></i> 2. Niveau d'urgence</label>
          <div class="urgency-pills">
            <button
              type="button"
              class="urgency-pill low"
              [class.selected]="urgency === 'low'"
              (click)="urgency = 'low'"
            >
              <i class="fa-solid fa-leaf"></i> Faible (Dans la semaine)
            </button>
            <button
              type="button"
              class="urgency-pill medium"
              [class.selected]="urgency === 'medium'"
              (click)="urgency = 'medium'"
            >
              <i class="fa-solid fa-clock"></i> Moyenne (Sous 24h à 48h)
            </button>
            <button
              type="button"
              class="urgency-pill high"
              [class.selected]="urgency === 'high'"
              (click)="urgency = 'high'"
            >
              <i class="fa-solid fa-triangle-exclamation"></i> Élevée (Aujourd'hui)
            </button>
            <button
              type="button"
              class="urgency-pill critical"
              [class.selected]="urgency === 'critical'"
              (click)="urgency = 'critical'"
            >
              <i class="fa-solid fa-fire"></i> Critique (Urgence immédiate)
            </button>
          </div>
        </div>

        <!-- Step 3: Description du problème -->
        <div class="form-section">
          <label class="section-title" for="req_desc">
            <i class="fa-solid fa-pen-to-square"></i> 3. Description détaillée de l'intervention
          </label>
          <textarea
            id="req_desc"
            rows="4"
            [(ngModel)]="description"
            name="description"
            placeholder="Ex: J'ai une fuite d'eau sous l'évier de la cuisine. Le robinet d'arrêt fuit également..."
            required
            class="problem-textarea"
          ></textarea>
        </div>

        <!-- Step 4: Photos de la panne -->
        <div class="form-section">
          <label class="section-title">
            <i class="fa-solid fa-camera"></i> 4. Prenez une photo ou joignez des images (optionnel)
          </label>

          <div class="photo-upload-zone">
            <div class="upload-drop-area" (click)="photoInput.click()">
              <i class="fa-solid fa-cloud-arrow-up upload-icon"></i>
              <strong>Cliquez pour ajouter des photos de la panne</strong>
              <span>Formats acceptés: JPG, PNG, WEBP</span>
              <input
                #photoInput
                type="file"
                accept="image/*"
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

        <!-- Step 5: Emplacement & Carte Leaflet -->
        <div class="form-section">
          <label class="section-title">
            <i class="fa-solid fa-map-location-dot"></i> 5. Lieu de l'intervention
          </label>

          <!-- Quick pick from saved addresses -->
          @if (savedAddresses.length > 0) {
            <div class="saved-addresses-bar">
              <span class="quick-label"><i class="fa-solid fa-bookmark"></i> Vos adresses enregistrées :</span>
              <div class="address-pills">
                @for (addr of savedAddresses; track addr.id) {
                  <button
                    type="button"
                    class="address-pill-btn"
                    (click)="selectSavedAddress(addr)"
                    title="Utiliser cette adresse"
                  >
                    <i class="fa-solid" [class.fa-house]="addr.label === 'Domicile'" [class.fa-building]="addr.label !== 'Domicile'"></i>
                    {{ addr.label }} ({{ addr.city }})
                  </button>
                }
              </div>
            </div>
          }

          <div class="location-inputs">
            <div class="form-group">
              <label for="address_text">Adresse écrite (Rue, Numéro, Quartier, Ville)</label>
              <input
                type="text"
                id="address_text"
                [(ngModel)]="address"
                name="address"
                placeholder="Ex: 15 Avenue Habib Bourguiba, Tunis"
                required
              />
            </div>

            <div class="map-wrapper">
              <label><i class="fa-solid fa-crosshairs"></i> Emplacement précis sur la carte</label>
              <app-map-picker
                [latitude]="latitude"
                [longitude]="longitude"
                height="260px"
                (locationChange)="onLocationPicked($event)"
              ></app-map-picker>
            </div>
          </div>
        </div>

        <!-- Submit Button -->
        <div class="form-actions-bar">
          <button type="submit" class="btn-submit-request" [disabled]="isSubmitting()">
            @if (isSubmitting()) {
              <i class="fa-solid fa-spinner fa-spin"></i> Publication de la demande...
            } @else {
              <i class="fa-solid fa-paper-plane"></i> Publier ma demande d'intervention
            }
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .tab-pane {
        padding: 24px;
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

      .icon-problem {
        color: #f59e0b;
      }

      .pane-header p {
        font-size: 14px;
        color: #64748b;
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

      .new-request-form {
        display: flex;
        flex-direction: column;
        gap: 28px;
      }

      .form-section {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .section-title {
        font-size: 15px;
        font-weight: 800;
        color: #0f172a;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      /* Categories Selector */
      .categories-selector-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
      }

      .category-option-card {
        background: #ffffff;
        border: 1.5px solid #e2e8f0;
        border-radius: 12px;
        padding: 14px 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        transition: all 0.2s;
        text-align: center;
      }

      .category-option-card i {
        font-size: 22px;
        color: #64748b;
      }

      .category-option-card span {
        font-size: 13px;
        font-weight: 700;
        color: #334155;
      }

      .category-option-card:hover {
        border-color: #93c5fd;
        background: #f8fafc;
      }

      .category-option-card.selected {
        border-color: #2563eb;
        background: #eff6ff;
      }

      .category-option-card.selected i,
      .category-option-card.selected span {
        color: #2563eb;
      }

      /* Urgency Selector */
      .urgency-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .urgency-pill {
        flex: 1;
        min-width: 140px;
        padding: 10px 14px;
        border: 1.5px solid #e2e8f0;
        background: #ffffff;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 700;
        color: #475569;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.2s;
      }

      .urgency-pill.low.selected {
        background: #ecfdf5;
        border-color: #10b981;
        color: #065f46;
      }

      .urgency-pill.medium.selected {
        background: #eff6ff;
        border-color: #3b82f6;
        color: #1e40af;
      }

      .urgency-pill.high.selected {
        background: #fffbeb;
        border-color: #f59e0b;
        color: #92400e;
      }

      .urgency-pill.critical.selected {
        background: #fef2f2;
        border-color: #ef4444;
        color: #b91c1c;
      }

      /* Description */
      .problem-textarea {
        width: 100%;
        padding: 14px;
        border: 1.5px solid #cbd5e1;
        border-radius: 12px;
        font-size: 14px;
        font-family: inherit;
        resize: vertical;
        box-sizing: border-box;
      }

      .problem-textarea:focus {
        outline: none;
        border-color: #2563eb;
      }

      /* Photo Upload */
      .upload-drop-area {
        border: 2px dashed #cbd5e1;
        border-radius: 14px;
        padding: 24px;
        text-align: center;
        cursor: pointer;
        background: #f8fafc;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
      }

      .upload-drop-area:hover {
        border-color: #2563eb;
        background: #eff6ff;
      }

      .upload-icon {
        font-size: 32px;
        color: #2563eb;
        margin-bottom: 4px;
      }

      .upload-drop-area strong {
        font-size: 14px;
        color: #1e293b;
      }

      .upload-drop-area span {
        font-size: 12px;
        color: #64748b;
      }

      .photos-preview-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 14px;
      }

      .photo-preview-card {
        position: relative;
        width: 100px;
        height: 100px;
        border-radius: 10px;
        overflow: hidden;
        border: 1px solid #e2e8f0;
      }

      .photo-preview-card img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .btn-remove-photo {
        position: absolute;
        top: 4px;
        right: 4px;
        background: rgba(0, 0, 0, 0.65);
        color: #ffffff;
        border: none;
        border-radius: 50%;
        width: 22px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        cursor: pointer;
      }

      /* Saved Addresses Bar */
      .saved-addresses-bar {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .quick-label {
        font-size: 12px;
        font-weight: 700;
        color: #475569;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .address-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .address-pill-btn {
        padding: 6px 12px;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        color: #1e293b;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
      }

      .address-pill-btn:hover {
        border-color: #2563eb;
        background: #eff6ff;
        color: #2563eb;
      }

      .location-inputs {
        display: flex;
        flex-direction: column;
        gap: 14px;
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
        padding: 11px 14px;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        font-size: 14px;
      }

      .form-group input:focus {
        outline: none;
        border-color: #2563eb;
      }

      .map-wrapper {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .map-wrapper label {
        font-size: 13px;
        font-weight: 700;
        color: #334155;
      }

      /* Submit */
      .form-actions-bar {
        display: flex;
        justify-content: flex-end;
        padding-top: 10px;
      }

      .btn-submit-request {
        padding: 14px 28px;
        background: #2563eb;
        color: #ffffff;
        border: none;
        border-radius: 12px;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        transition: all 0.2s;
      }

      .btn-submit-request:hover:not(:disabled) {
        background: #1d4ed8;
      }

      .btn-submit-request:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      @media (max-width: 900px) {
        .categories-selector-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 600px) {
        .categories-selector-grid {
          grid-template-columns: 1fr;
        }
        .urgency-pills {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class NewRequestTabComponent implements OnInit, OnChanges {
  @Input() savedAddresses: ClientAddress[] = [];
  @Input() initialCategorySlug?: string;
  @Input() initialTechnicianId?: number | null;
  @Output() requestCreated = new EventEmitter<any>();

  private userService = inject(UserService);
  private techService = inject(TechnicianService);

  categoryOptions: CategoryOption[] = [
    { id: 1, slug: 'plomberie', name: 'Plomberie', icon: 'fa-faucet-drip' },
    { id: 2, slug: 'electricite', name: 'Électricité', icon: 'fa-bolt' },
    { id: 3, slug: 'menage', name: 'Ménage & Entretien', icon: 'fa-broom' },
    { id: 4, slug: 'climatisation', name: 'Climatisation', icon: 'fa-snowflake' },
    { id: 5, slug: 'peinture', name: 'Peinture', icon: 'fa-paint-roller' },
    { id: 6, slug: 'serrurerie', name: 'Serrurerie', icon: 'fa-key' },
    { id: 7, slug: 'jardinage', name: 'Jardinage', icon: 'fa-seedling' },
    { id: 8, slug: 'menuiserie', name: 'Menuiserie', icon: 'fa-ruler-combined' },
  ];

  availableTechnicians = signal<PublicTechnicianProfile[]>([]);
  selectedCategoryId = 1;
  selectedTechnicianId: number | null = null;
  urgency: 'low' | 'medium' | 'high' | 'critical' = 'high';
  description = '';
  address = '';
  latitude: number | null = null;
  longitude: number | null = null;

  photoFiles = signal<PhotoFile[]>([]);
  isSubmitting = signal(false);
  feedbackMessage = signal<string | null>(null);
  isError = signal(false);

  ngOnInit(): void {
    this.techService.getCategories().subscribe({
      next: (cats) => {
        if (cats && cats.length > 0) {
          this.categoryOptions = cats.map((c) => ({
            id: c.id,
            slug: c.slug,
            name: c.name,
            icon: this.getIconForSlug(c.slug),
          }));
          if (this.initialCategorySlug) {
            const match = this.categoryOptions.find((c) => c.slug === this.initialCategorySlug);
            if (match) {
              this.selectedCategoryId = match.id;
              return;
            }
          }
          this.selectedCategoryId = this.categoryOptions[0].id;
        }
      },
    });

    this.techService.getPublicTechnicians().subscribe({
      next: (techs) => {
        this.availableTechnicians.set(techs || []);
        if (this.initialTechnicianId) {
          this.selectedTechnicianId = Number(this.initialTechnicianId);
        }
      },
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialCategorySlug'] && this.initialCategorySlug) {
      const match = this.categoryOptions.find((c) => c.slug === this.initialCategorySlug);
      if (match) {
        this.selectedCategoryId = match.id;
      }
    }

    if (changes['initialTechnicianId'] && this.initialTechnicianId) {
      this.selectedTechnicianId = Number(this.initialTechnicianId);
    }

    if (changes['savedAddresses'] && this.savedAddresses?.length > 0 && !this.address) {
      const def = this.savedAddresses.find((a) => a.is_default) || this.savedAddresses[0];
      if (def) {
        this.selectSavedAddress(def);
      }
    }
  }

  private getIconForSlug(slug: string): string {
    const map: Record<string, string> = {
      plomberie: 'fa-faucet-drip',
      electricite: 'fa-bolt',
      menage: 'fa-broom',
      climatisation: 'fa-snowflake',
      peinture: 'fa-paint-roller',
      serrurerie: 'fa-key',
      jardinage: 'fa-seedling',
      menuiserie: 'fa-ruler-combined',
    };
    return map[slug] || 'fa-wrench';
  }

  selectSavedAddress(addr: ClientAddress): void {
    this.address = `${addr.address}, ${addr.city}`;
    if (addr.lat && addr.lng) {
      this.latitude = addr.lat;
      this.longitude = addr.lng;
    }
  }

  onLocationPicked(coords: { lat: number; lng: number }): void {
    this.latitude = coords.lat;
    this.longitude = coords.lng;
  }

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

  submitRequest(): void {
    if (!this.description.trim()) {
      this.isError.set(true);
      this.feedbackMessage.set('Veuillez décrire le problème rencontré.');
      return;
    }

    if (!this.address.trim()) {
      this.isError.set(true);
      this.feedbackMessage.set('Veuillez renseigner votre adresse d\'intervention.');
      return;
    }

    this.isSubmitting.set(true);
    this.feedbackMessage.set(null);

    const formData = new FormData();
    formData.append('category', String(this.selectedCategoryId));
    formData.append('urgency', this.urgency);
    formData.append('description', this.description);
    formData.append('address', this.address);

    if (this.selectedTechnicianId) {
      formData.append('technician_id', String(this.selectedTechnicianId));
    }

    if (this.latitude !== null && this.longitude !== null) {
      formData.append('latitude', String(this.latitude));
      formData.append('longitude', String(this.longitude));
    }

    this.photoFiles().forEach((p) => {
      formData.append('photos', p.file);
    });

    this.userService.createServiceRequest(formData).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.isError.set(false);
        this.feedbackMessage.set('Votre demande d\'intervention a été enregistrée avec succès !');
        // Reset form
        this.description = '';
        this.photoFiles.set([]);
        this.requestCreated.emit(res);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.isError.set(true);
        const detail = err?.error?.detail || 'Erreur lors de la publication de la demande.';
        this.feedbackMessage.set(detail);
      },
    });
  }
}
