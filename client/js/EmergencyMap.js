/**
 * CrowdCity AI v2.5 - Emergency Interactive Leaflet Map Module
 * Renders high-contrast Leaflet map, custom emergency markers, and popups.
 */

window.EmergencyMap = (function() {
  let mapInstance = null;
  let markersGroup = null;
  let userMarker = null;

  // Custom SVG icon generator
  function createCustomIcon(type) {
    let color = '#ef4444';
    let iconClass = 'fa-hospital';

    if (type === 'police') {
      color = '#2563eb';
      iconClass = 'fa-shield-halved';
    } else if (type === 'fire') {
      color = '#f97316';
      iconClass = 'fa-fire-extinguisher';
    } else if (type === 'user') {
      color = '#0d9488';
      iconClass = 'fa-location-crosshairs';
    }

    const svgHtml = `
      <div style="
        background: ${color};
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border: 2px solid #ffffff;
        font-size: 1.1rem;
      ">
        <i class="fa-solid ${iconClass}"></i>
      </div>
    `;

    return L.divIcon({
      html: svgHtml,
      className: 'emergency-custom-marker',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18]
    });
  }

  /**
   * Initialize Leaflet map
   */
  function initMap(containerId, centerLat, centerLng, zoom = 13) {
    if (mapInstance) {
      mapInstance.setView([centerLat, centerLng], zoom);
      return mapInstance;
    }

    mapInstance = L.map(containerId, {
      zoomControl: true,
      attributionControl: false
    }).setView([centerLat, centerLng], zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c']
    }).addTo(mapInstance);

    markersGroup = L.layerGroup().addTo(mapInstance);
    setUserLocation(centerLat, centerLng);

    return mapInstance;
  }

  /**
   * Render User GPS marker with pulsing aura
   */
  function setUserLocation(lat, lng) {
    if (!mapInstance) return;

    if (userMarker) {
      userMarker.setLatLng([lat, lng]);
    } else {
      const userSvg = `
        <div style="position: relative; width: 32px; height: 32px;">
          <div style="
            position: absolute; width: 32px; height: 32px; border-radius: 50%; background: rgba(37, 99, 235, 0.3);
            animation: userPulse 2s infinite ease-out;
          "></div>
          <div style="
            position: absolute; top: 6px; left: 6px; width: 20px; height: 20px; border-radius: 50%;
            background: #2563eb; border: 3px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          "></div>
        </div>
      `;
      const icon = L.divIcon({
        html: userSvg,
        className: 'user-location-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      userMarker.bindPopup('<strong style="font-size: 0.88rem;"><i class="fa-solid fa-location-crosshairs" style="color: #2563eb;"></i> Your Current Location</strong>');
    }
  }

  /**
   * Render array of responder locations on map
   */
  function renderRespondersOnMap(responders) {
    if (!mapInstance || !markersGroup) return;

    markersGroup.clearLayers();

    responders.forEach(r => {
      const icon = createCustomIcon(r.type);
      const marker = L.marker([r.lat, r.lng], { icon });

      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`;
      const popupHtml = `
        <div style="min-width: 180px; font-family: system-ui;">
          <div style="font-weight: 800; font-size: 0.9rem; color: var(--text-main); margin-bottom: 0.25rem;">${r.name}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.5rem;">${r.address || ''} (${r.distance} km away)</div>
          <div style="display: flex; gap: 0.4rem;">
            <a href="tel:${r.phone}" style="flex: 1; text-align: center; background: #10b981; color: white; padding: 0.35rem; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 0.75rem;">
              <i class="fa-solid fa-phone"></i> Call ${r.phone}
            </a>
            <a href="${googleMapsUrl}" target="_blank" rel="noopener" style="flex: 1; text-align: center; background: #2563eb; color: white; padding: 0.35rem; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 0.75rem;">
              <i class="fa-solid fa-diamond-turn-right"></i> Route
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      markersGroup.addLayer(marker);
    });
  }

  function centerMap(lat, lng, zoom = 14) {
    if (mapInstance) {
      mapInstance.setView([lat, lng], zoom);
    }
  }

  function invalidateSize() {
    if (mapInstance) {
      setTimeout(() => mapInstance.invalidateSize(), 300);
    }
  }

  return {
    initMap,
    setUserLocation,
    renderRespondersOnMap,
    centerMap,
    invalidateSize
  };
})();
