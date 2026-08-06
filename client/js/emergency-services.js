/**
 * emergency-services.js - Controller Script for CrowdCity AI v3.0 Emergency Services Center
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Render Emergency Contacts Table
  window.EmergencyContacts.renderTable('emergency-contacts-tbody');

  // 2. Fetch User Geolocation Position
  const location = await window.EmergencyLocation.getCurrentPosition();
  
  // 3. Initialize Interactive Emergency Map
  window.EmergencyMap.init('emergency-map', location.latitude, location.longitude);

  // 4. Initial Responders Search (Default 10 km radius, all types)
  await loadResponders(location.latitude, location.longitude, 10, 'all');

  // 5. Setup Event Listeners (Search Bar, Radius Selector, Type Filters)
  setupEventListeners(location);
});

let currentRadiusKm = 10;
let currentFilterType = 'all';

async function loadResponders(lat, lng, radiusKm, type) {
  const container = document.getElementById('responders-grid');
  if (!container) return;

  // Show Skeleton Loaders
  container.innerHTML = `
    <div class="skeleton-box" style="height: 180px;"></div>
    <div class="skeleton-box" style="height: 180px;"></div>
    <div class="skeleton-box" style="height: 180px;"></div>
  `;

  let responders = await window.EmergencySearch.fetchNearbyResponders(lat, lng, radiusKm, type);

  // Auto-expand search radius if 0 results found initially
  if ((!responders || responders.length === 0) && radiusKm < 50) {
    currentRadiusKm = radiusKm === 5 ? 10 : (radiusKm === 10 ? 20 : 50);
    updateRadiusButtonsUI(currentRadiusKm);
    responders = await window.EmergencySearch.fetchNearbyResponders(lat, lng, currentRadiusKm, type);
  }

  // Render Markers on Leaflet Map
  window.EmergencyMap.renderResponders(responders);

  // Render Responder Cards
  if (!responders || responders.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 2.5rem; background: #ffffff; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); text-align: center; color: var(--text-muted);">
        <i class="fa-solid fa-compass" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 0.75rem;"></i>
        <h4 style="margin: 0 0 0.5rem 0; color: var(--text-dark); font-weight: 700;">Unable to find nearby services</h4>
        <p style="margin: 0; font-size: 0.9rem; color: var(--text-muted);">Try searching another location or increase the search radius.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = responders.map(res => {
    const distFormatted = window.EmergencyLocation.formatDistance(res.distanceKm);
    const directionsUrl = window.EmergencyLocation.getGoogleMapsDirectionsUrl(res.lat, res.lng, res.name);

    return `
      <div class="responder-card">
        <div class="responder-card-header">
          <span class="responder-type-badge badge-${res.type}">${res.type}</span>
          <span class="responder-distance">${distFormatted} away</span>
        </div>
        <div>
          <h3 class="responder-name">${res.name}</h3>
          <p class="responder-address"><i class="fa-solid fa-location-dot" style="margin-right: 4px;"></i> ${res.address}</p>
        </div>
        <div class="responder-card-actions">
          <a href="tel:${res.phone}" class="btn-card-action btn-card-call">
            <i class="fa-solid fa-phone"></i> Call ${res.phone}
          </a>
          <a href="${directionsUrl}" target="_blank" class="btn-card-action btn-card-nav">
            <i class="fa-solid fa-diamond-turn-right"></i> Directions
          </a>
        </div>
      </div>
    `;
  }).join('');
}

function setupEventListeners(userLocation) {
  // Radius Buttons
  const radiusBtns = document.querySelectorAll('.radius-btn');
  radiusBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const radius = parseInt(e.target.getAttribute('data-radius'), 10);
      currentRadiusKm = radius;
      updateRadiusButtonsUI(radius);

      const center = window.EmergencyLocation.currentLocation || userLocation;
      await loadResponders(center.latitude, center.longitude, currentRadiusKm, currentFilterType);
    });
  });

  // Type Filter Buttons
  const filterBtns = document.querySelectorAll('.type-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      filterBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilterType = e.target.getAttribute('data-type');

      const center = window.EmergencyLocation.currentLocation || userLocation;
      await loadResponders(center.latitude, center.longitude, currentRadiusKm, currentFilterType);
    });
  });

  // Search Input (City / Area / Pincode) with Debouncing
  const searchInput = document.getElementById('emergency-search-input');
  let debounceTimer = null;

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const query = e.target.value.trim();
        if (!query) {
          const loc = window.EmergencyLocation.currentLocation || userLocation;
          window.EmergencyMap.setUserLocation(loc.latitude, loc.longitude);
          await loadResponders(loc.latitude, loc.longitude, currentRadiusKm, currentFilterType);
          return;
        }

        const geocoded = await window.EmergencySearch.geocodeQuery(query);
        if (geocoded) {
          window.EmergencyLocation.currentLocation = {
            latitude: geocoded.latitude,
            longitude: geocoded.longitude,
            isFallback: false
          };
          window.EmergencyMap.setUserLocation(geocoded.latitude, geocoded.longitude);
          window.EmergencyMap.map.setView([geocoded.latitude, geocoded.longitude], 13);
          await loadResponders(geocoded.latitude, geocoded.longitude, currentRadiusKm, currentFilterType);
        }
      }, 500);
    });
  }

  // Accordions Toggle
  const accordionHeaders = document.querySelectorAll('.accordion-header');
  accordionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const item = header.closest('.accordion-item');
      const isActive = item.classList.contains('active');

      document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('active'));

      if (!isActive) {
        item.classList.add('active');
      }
    });
  });
}

function updateRadiusButtonsUI(activeRadius) {
  const radiusBtns = document.querySelectorAll('.radius-btn');
  radiusBtns.forEach(b => {
    if (parseInt(b.getAttribute('data-radius'), 10) === activeRadius) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });
}

/**
 * Global Share Location Trigger
 */
window.openShareLocationModal = async function() {
  if (window.EmergencyContacts && window.EmergencyContacts.showToast) {
    window.EmergencyContacts.showToast('Fetching real-time GPS location...');
  }
  
  const loc = await window.EmergencyLocation.getCurrentPosition();
  const shareUrl = window.EmergencyLocation.getShareableLocationUrl(loc.latitude, loc.longitude);
  const shareText = `EMERGENCY GPS LOCATION: I need emergency assistance. My live location: ${shareUrl}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Emergency GPS Location - CrowdCity AI',
        text: shareText,
        url: shareUrl
      });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  // Native share fallback: Copy to clipboard with toast
  window.EmergencyLocation.copyToClipboard(shareUrl);
  if (window.EmergencyContacts && window.EmergencyContacts.showToast) {
    window.EmergencyContacts.showToast('Live GPS Location link copied to clipboard!');
  } else {
    alert('Live GPS location link copied to clipboard:\n' + shareUrl);
  }
};

window.recenterMap = function() {
  window.EmergencyMap.recenterToUser();
};
