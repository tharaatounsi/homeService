import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import * as L from 'leaflet';

// Fix for default Leaflet marker icon with bundlers
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

@Component({
  selector: 'app-map-picker',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div class="map-picker-container">
      <div class="map-toolbar">
        <div class="coord-info">
          @if (currentLat() !== null && currentLng() !== null) {
            <span class="coord-badge valid">
              <i class="fa-solid fa-location-dot"></i>
              {{ currentLat() | number: '1.4-4' }}, {{ currentLng() | number: '1.4-4' }}
            </span>
          } @else {
            <span class="coord-badge empty">
              <i class="fa-solid fa-map-pin"></i>
              Aucun point sélectionné (cliquez sur la carte)
            </span>
          }
        </div>

        @if (!readonly) {
          <button
            type="button"
            class="btn-locate"
            (click)="locateMe()"
            [disabled]="isLocating()"
            title="Utiliser ma position GPS actuelle"
          >
            @if (isLocating()) {
              <i class="fa-solid fa-spinner fa-spin"></i> Détection...
            } @else {
              <i class="fa-solid fa-crosshairs"></i> Me géolocaliser
            }
          </button>
        }
      </div>

      @if (geoError()) {
        <div class="geo-error-alert">
          <i class="fa-solid fa-triangle-exclamation"></i>
          {{ geoError() }}
        </div>
      }

      <div
        #mapContainer
        class="leaflet-map-element"
        [style.height]="height"
      ></div>
      
      @if (!readonly) {
        <div class="map-hint">
          <i class="fa-regular fa-hand-pointer"></i>
          Cliquez sur la carte ou déplacez le repère pour ajuster votre emplacement précis.
        </div>
      }
    </div>
  `,
  styles: [
    `
      .map-picker-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
      }

      .map-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }

      .coord-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 600;
        padding: 5px 10px;
        border-radius: 8px;
      }

      .coord-badge.valid {
        background: #ecfdf5;
        color: #065f46;
        border: 1px solid #a7f3d0;
      }

      .coord-badge.empty {
        background: #f1f5f9;
        color: #64748b;
        border: 1px solid #e2e8f0;
      }

      .btn-locate {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: #eff6ff;
        color: #2563eb;
        border: 1px solid #bfdbfe;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-locate:hover:not(:disabled) {
        background: #2563eb;
        color: #ffffff;
      }

      .btn-locate:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .geo-error-alert {
        padding: 8px 12px;
        border-radius: 8px;
        background: #fef2f2;
        color: #b91c1c;
        border: 1px solid #fecaca;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .leaflet-map-element {
        width: 100%;
        border-radius: 12px;
        border: 1px solid #cbd5e1;
        overflow: hidden;
        z-index: 1;
      }

      .map-hint {
        font-size: 11px;
        color: #64748b;
        display: flex;
        align-items: center;
        gap: 5px;
      }
    `,
  ],
})
export class MapPickerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef<HTMLDivElement>;

  @Input() latitude: number | null = null;
  @Input() longitude: number | null = null;
  @Input() height: string = '280px';
  @Input() readonly: boolean = false;
  @Input() defaultZoom: number = 13;

  @Output() locationChange = new EventEmitter<{ lat: number; lng: number }>();

  currentLat = signal<number | null>(null);
  currentLng = signal<number | null>(null);
  isLocating = signal(false);
  geoError = signal<string | null>(null);

  private map: L.Map | null = null;
  private marker: L.Marker | null = null;

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['latitude'] || changes['longitude']) {
      this.currentLat.set(this.latitude);
      this.currentLng.set(this.longitude);
      this.updateMarkerFromInputs();
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private initMap(): void {
    if (!this.mapContainer?.nativeElement) return;

    this.currentLat.set(this.latitude);
    this.currentLng.set(this.longitude);

    // Default center: if coordinates provided, center on them, otherwise standard zoom center (Tunis region by default view without imposing as coordinate value)
    const initialLat = this.latitude ?? 36.8065;
    const initialLng = this.longitude ?? 10.1815;
    const initialZoom = this.latitude !== null && this.longitude !== null ? this.defaultZoom : 11;

    this.map = L.map(this.mapContainer.nativeElement).setView([initialLat, initialLng], initialZoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);

    if (this.latitude !== null && this.longitude !== null) {
      this.setMarker(this.latitude, this.longitude);
    }

    if (!this.readonly) {
      this.map.on('click', (e: L.LeafletMouseEvent) => {
        this.selectPosition(e.latlng.lat, e.latlng.lng);
      });
    }

    // Leaflet map sometimes needs invalidateSize after rendering
    setTimeout(() => {
      this.map?.invalidateSize();
    }, 200);
  }

  private setMarker(lat: number, lng: number): void {
    if (!this.map) return;

    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      this.marker = L.marker([lat, lng], {
        draggable: !this.readonly,
      }).addTo(this.map);

      if (!this.readonly) {
        this.marker.on('dragend', () => {
          if (!this.marker) return;
          const pos = this.marker.getLatLng();
          this.selectPosition(pos.lat, pos.lng);
        });
      }
    }
  }

  private updateMarkerFromInputs(): void {
    if (!this.map) return;
    if (this.latitude !== null && this.longitude !== null) {
      this.setMarker(this.latitude, this.longitude);
      this.map.setView([this.latitude, this.longitude], this.map.getZoom());
    } else if (this.marker) {
      this.map.removeLayer(this.marker);
      this.marker = null;
    }
  }

  private selectPosition(lat: number, lng: number): void {
    this.currentLat.set(lat);
    this.currentLng.set(lng);
    this.setMarker(lat, lng);
    this.locationChange.emit({ lat, lng });
  }

  locateMe(): void {
    if (!navigator.geolocation) {
      this.geoError.set('La géolocalisation n\'est pas supportée par votre navigateur.');
      return;
    }

    this.isLocating.set(true);
    this.geoError.set(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.isLocating.set(false);
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        this.selectPosition(lat, lng);
        this.map?.setView([lat, lng], 15);
      },
      (err) => {
        this.isLocating.set(false);
        let msg = 'Impossible de récupérer votre position GPS.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Autorisation de géolocalisation refusée. Cliquez sur la carte pour choisir manuellement.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Signal GPS introuvable.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Délai d\'attente dépassé pour la géolocalisation.';
        }
        this.geoError.set(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }
}
