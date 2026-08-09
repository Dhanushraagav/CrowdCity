/**
 * emergency-services.js - Controller Script for CrowdCity AI v3.0 Emergency Services Center
 * Optimized for instant 0.1s mobile rendering, instant filter clicks, and background GPS lock.
 */

let currentRadiusKm = 10;
let currentFilterType = 'all';
let allLoadedResponders = [];

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Render Emergency Contacts Table
  if (window.EmergencyContacts && window.EmergencyContacts.renderTable) {
    window.EmergencyContacts.renderTable('emergency-contacts-tbody');
  }

  // 2. Use Fallback Coordinates Instantly for 0.1s Map & Responder Render
  const initialLoc = window.EmergencyLocation.fallbackCoords;

  // 3. Initialize Interactive Emergency Map Instantly
  window.EmergencyMap.init('emergency-map', initialLoc.latitude, initialLoc.longitude);

  // 4. Load Responders Instantly (0.1s response)
  await loadResponders(initialLoc.latitude, initialLoc.longitude, currentRadiusKm, currentFilterType);

  // 5. Setup Event Listeners (Search Bar, Radius Buttons, Instant Type Filters)
  setupEventListeners(initialLoc);

  // 6. Asynchronously Fetch Real GPS Position in Background without blocking UI
  window.EmergencyLocation.getCurrentPosition().then(async (realLoc) => {
    if (realLoc && !realLoc.isFallback) {
      window.EmergencyMap.setUserLocation(realLoc.latitude, realLoc.longitude);
      window.EmergencyMap.map.setView([realLoc.latitude, realLoc.longitude], 13);
      await loadResponders(realLoc.latitude, realLoc.longitude, currentRadiusKm, currentFilterType);
    }
  });
});

async function loadResponders(lat, lng, radiusKm, type) {
  const container = document.getElementById('responders-grid');
  if (!container) return;

  // If we already have loaded responders for this location/radius, perform 0ms in-memory filtering
  if (allLoadedResponders.length > 0 && type !== 'all' && container.getAttribute('data-loaded-lat') === String(lat)) {
    renderFilteredRespondersUI(allLoadedResponders, type);
    return;
  }

  // Show Skeleton Loaders for initial load
  container.innerHTML = `
    <div class="skeleton-box" style="height: 160px; border-radius: var(--radius-md);"></div>
    <div class="skeleton-box" style="height: 160px; border-radius: var(--radius-md);"></div>
    <div class="skeleton-box" style="height: 160px; border-radius: var(--radius-md);"></div>
  `;

  // Fetch responders with 1.2s max limit
  const responders = await window.EmergencySearch.fetchNearbyResponders(lat, lng, radiusKm, 'all');
  allLoadedResponders = responders || [];
  container.setAttribute('data-loaded-lat', String(lat));

  renderFilteredRespondersUI(allLoadedResponders, type);
}

function renderFilteredRespondersUI(respondersList, type) {
  const container = document.getElementById('responders-grid');
  if (!container) return;

  const filtered = (type === 'all')
    ? respondersList
    : respondersList.filter(r => r.type === type);

  // Render Markers on Map instantly
  window.EmergencyMap.renderResponders(filtered);

  if (!filtered || filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 2.25rem 1.5rem; background: #ffffff; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); text-align: center; color: var(--text-muted);">
        <i class="fa-solid fa-compass" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 0.75rem;"></i>
        <h4 style="margin: 0 0 0.5rem 0; color: var(--text-dark); font-weight: 700;">No ${type === 'all' ? 'emergency' : type} services found</h4>
        <p style="margin: 0; font-size: 0.88rem; color: var(--text-muted);">Try selecting another filter or increasing the search radius.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(res => {
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
          <p class="responder-address"><i class="fa-solid fa-location-dot" style="margin-right: 4px; color: var(--color-primary);"></i> ${res.address}</p>
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
      allLoadedResponders = []; // Reset for new radius
      await loadResponders(center.latitude, center.longitude, currentRadiusKm, currentFilterType);
    });
  });

  // Instant 0ms Filter Buttons (Hospitals, Police, Fire, All)
  const filterBtns = document.querySelectorAll('.type-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterBtns.forEach(b => b.classList.remove('active'));
      const targetBtn = e.target.closest('.type-filter-btn') || e.target;
      targetBtn.classList.add('active');
      currentFilterType = targetBtn.getAttribute('data-type');

      // Instant 0ms In-Memory Filter Render
      renderFilteredRespondersUI(allLoadedResponders, currentFilterType);
    });
  });

  // Search Input (City / Area / Pincode) with Fast Debounce
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
          allLoadedResponders = [];
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
          allLoadedResponders = [];
          await loadResponders(geocoded.latitude, geocoded.longitude, currentRadiusKm, currentFilterType);
        }
      }, 250);
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
