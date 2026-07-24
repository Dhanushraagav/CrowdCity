/**
 * EmergencyMap.js - Leaflet Interactive Map Module for CrowdCity AI v3.0 Emergency Center
 * Renders custom SVG markers for User Location, Hospitals, Police Stations, and Fire Stations.
 */

window.EmergencyMap = {
  map: null,
  markersLayer: null,
  userMarker: null,

  /**
   * Custom SVG Marker Icons (Clean Government Style - 0 Emojis)
   */
  icons: {
    user: L.divIcon({
      className: 'custom-user-marker',
      html: `
        <div style="width: 20px; height: 20px; background: #dc2626; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 0 0 6px rgba(220, 38, 38, 0.3);"></div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    }),

    hospital: L.divIcon({
      className: 'custom-hospital-marker',
      html: `
        <div style="width: 32px; height: 32px; background: #dc2626; border: 2px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 14px; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
          <i class="fa-solid fa-hospital"></i>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    }),

    police: L.divIcon({
      className: 'custom-police-marker',
      html: `
        <div style="width: 32px; height: 32px; background: #1e40af; border: 2px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 14px; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
          <i class="fa-solid fa-shield-halved"></i>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    }),

    fire: L.divIcon({
      className: 'custom-fire-marker',
      html: `
        <div style="width: 32px; height: 32px; background: #d97706; border: 2px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 14px; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
          <i class="fa-solid fa-fire-extinguisher"></i>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    })
  },

  /**
   * Initialize Leaflet map instance
   */
  init: function(containerId, centerLat, centerLng, zoom = 13) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (this.map) {
      this.map.remove();
    }

    this.map = L.map(containerId, {
      center: [centerLat, centerLng],
      zoom: zoom,
      zoomControl: true
    });

    // OpenStreetMap Tile Layer (FREE)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | CrowdCity AI'
    }).addTo(this.map);

    this.markersLayer = L.layerGroup().addTo(this.map);

    // Set User Location Marker
    this.setUserLocation(centerLat, centerLng);
  },

  /**
   * Update User GPS Location Marker on map
   */
  setUserLocation: function(lat, lng) {
    if (!this.map) return;

    if (this.userMarker) {
      this.userMarker.setLatLng([lat, lng]);
    } else {
      this.userMarker = L.marker([lat, lng], { icon: this.icons.user })
        .bindPopup('<strong>Your Location</strong>')
        .addTo(this.map);
    }
  },

  /**
   * Render Responder Markers onto map
   */
  renderResponders: function(respondersList) {
    if (!this.markersLayer) return;

    this.markersLayer.clearLayers();

    if (!respondersList || respondersList.length === 0) return;

    const bounds = L.latLngBounds();

    if (this.userMarker) {
      bounds.extend(this.userMarker.getLatLng());
    }

    respondersList.forEach(responder => {
      const icon = this.icons[responder.type] || this.icons.hospital;
      const marker = L.marker([responder.lat, responder.lng], { icon: icon });

      const distText = window.EmergencyLocation.formatDistance(responder.distanceKm);
      const googleNavUrl = window.EmergencyLocation.getGoogleMapsDirectionsUrl(responder.lat, responder.lng, responder.name);

      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; padding: 4px; max-width: 220px;">
          <div style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #dc2626; margin-bottom: 2px;">
            ${responder.type} &bull; ${distText}
          </div>
          <h4 style="margin: 0 0 6px 0; font-size: 0.95rem; color: #0f172a; font-weight: 700;">${responder.name}</h4>
          <p style="margin: 0 0 10px 0; font-size: 0.8rem; color: #64748b;">${responder.address}</p>
          <div style="display: flex; gap: 6px;">
            <a href="tel:${responder.phone}" style="flex: 1; background: #dc2626; color: #fff; text-decoration: none; font-size: 0.75rem; font-weight: 700; padding: 6px; border-radius: 4px; text-align: center;">
              Call ${responder.phone}
            </a>
            <a href="${googleNavUrl}" target="_blank" style="background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; text-decoration: none; font-size: 0.75rem; font-weight: 600; padding: 6px 8px; border-radius: 4px;">
              Directions
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      this.markersLayer.addLayer(marker);
      bounds.extend([responder.lat, responder.lng]);
    });

    if (respondersList.length > 0 && this.map) {
      this.map.fitBounds(bounds, { padding: [40, 40] });
    }
  },

  /**
   * Recenter Map onto user position
   */
  recenterToUser: function() {
    if (this.map && this.userMarker) {
      this.map.setView(this.userMarker.getLatLng(), 14);
    }
  }
};
