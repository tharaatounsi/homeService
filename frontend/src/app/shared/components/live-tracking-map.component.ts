import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import * as L from 'leaflet';

import { MissionTrackingData, UserService } from '../../core/user.service';

@Component({
  selector: 'app-live-tracking-map',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  template: `
    <div class="live-tracking-container">
      <!-- Live Metrics Bar -->
      <div class="tracking-metrics-bar">
        <div class="metric-block main">
          <div class="metric-icon pulse">
            <i class="fa-solid fa-car-side"></i>
          </div>
          <div class="metric-info">
            <span class="metric-title">{{ technicianName }} est en route</span>
            <span class="metric-sub">
              @if (tracking()?.distance_km !== null && tracking()?.distance_km !== undefined) {
                Distance restante : <strong>{{ tracking()!.distance_km | number: '1.1-1' }} km</strong>
              } @else {
                Localisation en cours...
              }
            </span>
          </div>
        </div>

        <div class="metrics-right">
          @if (tracking()?.eta_minutes !== null && tracking()?.eta_minutes !== undefined) {
            <div class="eta-box">
              <span class="eta-label">Arrivée estimée</span>
              <span class="eta-value">~{{ tracking()!.eta_minutes }} min</span>
            </div>
          }
          <div class="live-dot-pill" title="Actualisation GPS en direct">
            <span class="live-dot"></span>
            <span>En direct</span>
          </div>
        </div>
      </div>

      <!-- Leaflet Map Container -->
      <div class="map-wrapper">
        <div #trackingMapContainer class="leaflet-map-element"></div>
      </div>
    </div>
  `,
  styles: [
    `
      .live-tracking-container {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      }

      .tracking-metrics-bar {
        padding: 14px 18px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
      }

      .metric-block {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .metric-icon {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        background: #eff6ff;
        color: #2563eb;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
      }

      .metric-icon.pulse {
        animation: subtlePulse 2s infinite ease-in-out;
      }

      @keyframes subtlePulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.06); }
      }

      .metric-info {
        display: flex;
        flex-direction: column;
      }

      .metric-title {
        font-size: 14px;
        font-weight: 800;
        color: #0f172a;
      }

      .metric-sub {
        font-size: 12px;
        color: #64748b;
      }

      .metrics-right {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .eta-box {
        text-align: right;
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        padding: 6px 12px;
        border-radius: 8px;
      }

      .eta-label {
        display: block;
        font-size: 10px;
        text-transform: uppercase;
        font-weight: 800;
        color: #047857;
      }

      .eta-value {
        font-size: 15px;
        font-weight: 800;
        color: #065f46;
      }

      .live-dot-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 700;
        color: #334155;
      }

      .live-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ef4444;
        box-shadow: 0 0 6px #ef4444;
        animation: blink 1.2s infinite;
      }

      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }

      .map-wrapper {
        position: relative;
        height: 320px;
        width: 100%;
      }

      .leaflet-map-element {
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class LiveTrackingMapComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) requestId!: number;
  @Input() clientLat = 36.8065;
  @Input() clientLng = 10.1815;
  @Input() technicianName = 'Technicien';

  @ViewChild('trackingMapContainer') mapContainer!: ElementRef<HTMLDivElement>;

  private userService = inject(UserService);
  private pollSub?: Subscription;

  tracking = signal<MissionTrackingData | null>(null);

  private map?: L.Map;
  private clientMarker?: L.Marker;
  private techMarker?: L.Marker;
  private polyline?: L.Polyline;

  ngOnInit(): void {
    this.fetchTracking();
    // Rafraîchissement automatique toutes les 2 secondes pour suivre le déplacement GPS
    this.pollSub = interval(2000).subscribe(() => {
      this.fetchTracking();
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
    if (this.map) {
      this.map.remove();
    }
  }

  private fetchTracking(): void {
    if (!this.requestId) return;
    this.userService.getMissionTracking(this.requestId).subscribe({
      next: (data) => {
        this.tracking.set(data);
        this.updateMapLayers(data);
      },
    });
  }

  private initMap(): void {
    if (!this.mapContainer) return;

    const startLat = this.clientLat || 36.8065;
    const startLng = this.clientLng || 10.1815;

    this.map = L.map(this.mapContainer.nativeElement).setView([startLat, startLng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    // Marqueur Destination Client (Maison 🏠)
    const clientIcon = L.divIcon({
      className: 'custom-client-icon',
      html: `
        <div style="background: #ef4444; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.3); border: 2px solid white;">
          <i class="fa-solid fa-house" style="font-size: 15px;"></i>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    this.clientMarker = L.marker([startLat, startLng], { icon: clientIcon }).addTo(this.map);
    this.clientMarker.bindPopup('<strong>Votre adresse (Destination)</strong>');

    setTimeout(() => {
      this.map?.invalidateSize();
    }, 250);
  }

  private updateMapLayers(data: MissionTrackingData): void {
    if (!this.map) return;

    const clientPos: [number, number] = [
      data.client_lat || this.clientLat || 36.8065,
      data.client_lng || this.clientLng || 10.1815,
    ];

    if (this.clientMarker) {
      this.clientMarker.setLatLng(clientPos);
    }

    if (data.technician_lat !== null && data.technician_lng !== null) {
      const techPos: [number, number] = [data.technician_lat, data.technician_lng];

      // Marqueur Véhicule Technicien (Voiture 🚗)
      const techIcon = L.divIcon({
        className: 'custom-tech-car-icon',
        html: `
          <div style="background: #2563eb; color: white; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(37,99,235,0.4); border: 2.5px solid white;">
            <i class="fa-solid fa-car-side" style="font-size: 17px;"></i>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      if (this.techMarker) {
        this.techMarker.setLatLng(techPos);
      } else {
        this.techMarker = L.marker(techPos, { icon: techIcon }).addTo(this.map);
        this.techMarker.bindPopup(`<strong>${data.technician_name || this.technicianName}</strong><br>En déplacement`);
      }

      // Tracé d'itinéraire direct
      if (this.polyline) {
        this.polyline.setLatLngs([techPos, clientPos]);
      } else {
        this.polyline = L.polyline([techPos, clientPos], {
          color: '#2563eb',
          weight: 4,
          opacity: 0.8,
          dashArray: '6, 8',
        }).addTo(this.map);
      }

      // Ajuster le zoom pour cadrer les deux points
      const bounds = L.latLngBounds([techPos, clientPos]);
      this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }
}
