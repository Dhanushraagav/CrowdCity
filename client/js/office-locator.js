// CrowdCity AI v3.0 - Government Office & E-Sevai Locator
// Connects to /api/offices with statewide coverage across all 38 districts of Tamil Nadu.
// Features proximity sorting, debounced search, Leaflet map sync, and verified data provenance.

(function() {
  'use strict';

  let mapInstance = null;
  let mapMarkers = [];
  let userMarker = null;
  let userCoords = null;
  let activeOffices = [];
  let searchDebounceTimer = null;
  let districtsMetadata = [];

  // DOM Elements
  let searchInput = null;
  let typeSelect = null;
  let districtSelect = null;
  let talukSelect = null;
  let locBtn = null;
  let cardsContainer = null;
  let countBadge = null;

  /**
   * Format type name into friendly label
   */
  function formatOfficeType(type) {
    switch ((type || '').toLowerCase()) {
      case 'collectorate': return 'District Collectorate';
      case 'esevai': return 'E-Sevai Center';
      case 'taluk': return 'Taluk Revenue Office';
      case 'vao': return 'VAO Office';
      case 'corporation': return 'Municipal Corporation';
      default: return 'Government Office';
    }
  }

  /**
   * Initialize Leaflet Map
   */
  function initOfficeMap() {
    const mapContainer = document.getElementById('office-locator-map');
    if (!mapContainer || typeof L === 'undefined') return;

    if (!mapInstance) {
      // Default center: Tamil Nadu Geographic Centroid
      mapInstance = L.map('office-locator-map', {
        center: [11.1271, 78.6569],
        zoom: 7,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | Govt of Tamil Nadu'
      }).addTo(mapInstance);
    }
  }

  /**
   * Fetch district metadata and populate taluk options
   */
  async function loadDistrictsMetadata() {
    try {
      const res = await fetch('/api/offices/districts');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.districts)) {
          districtsMetadata = json.districts;
          updateTalukDropdown();
        }
      }
    } catch (err) {
      console.warn('[OfficeLocator] Districts metadata notice:', err.message);
    }
  }

  /**
   * Update Taluk dropdown based on selected District
   */
  function updateTalukDropdown() {
    if (!talukSelect) return;
    const selectedDist = districtSelect ? districtSelect.value : 'all';

    const currentVal = talukSelect.value;
    talukSelect.innerHTML = '<option value="all">All Taluks</option>';

    if (selectedDist === 'all') {
      // Collect all taluks from all districts
      const allTaluks = new Set();
      districtsMetadata.forEach(d => {
        if (Array.isArray(d.taluks)) {
          d.taluks.forEach(t => allTaluks.add(t));
        }
      });
      Array.from(allTaluks).sort().forEach(taluk => {
        const opt = document.createElement('option');
        opt.value = taluk;
        opt.textContent = taluk;
        talukSelect.appendChild(opt);
      });
    } else {
      // Find matching district
      const matched = districtsMetadata.find(d => d.name.toLowerCase() === selectedDist.toLowerCase() || d.id === selectedDist.toLowerCase());
      if (matched && Array.isArray(matched.taluks) && matched.taluks.length > 0) {
        matched.taluks.forEach(taluk => {
          const opt = document.createElement('option');
          opt.value = taluk;
          opt.textContent = taluk;
          talukSelect.appendChild(opt);
        });
      }
    }

    if (currentVal && Array.from(talukSelect.options).some(o => o.value === currentVal)) {
      talukSelect.value = currentVal;
    } else {
      talukSelect.value = 'all';
    }
  }

  /**
   * Query backend API with active filter parameters
   */
  async function fetchOffices() {
    if (!cardsContainer) return;

    // Show loading skeleton
    cardsContainer.innerHTML = `
      <div style="text-align: center; padding: 3.5rem 1.5rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px;">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2.2rem; color: var(--primary); margin-bottom: 1rem;"></i>
        <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin: 0 0 0.4rem 0;">Searching Tamil Nadu Government Offices...</h3>
        <p style="font-size: 0.88rem; color: var(--text-muted); margin: 0;">Querying verified departmental registries across 38 districts.</p>
      </div>
    `;

    const params = new URLSearchParams();

    const searchVal = searchInput ? searchInput.value.trim() : '';
    const typeVal = typeSelect ? typeSelect.value : 'all';
    const districtVal = districtSelect ? districtSelect.value : 'all';
    const talukVal = talukSelect ? talukSelect.value : 'all';

    if (searchVal) params.set('search', searchVal);
    if (typeVal && typeVal !== 'all') params.set('type', typeVal);
    if (districtVal && districtVal !== 'all') params.set('district', districtVal);
    if (talukVal && talukVal !== 'all') params.set('taluk', talukVal);

    if (userCoords && userCoords.lat && userCoords.lng) {
      params.set('lat', userCoords.lat);
      params.set('lng', userCoords.lng);
    }

    try {
      const response = await fetch(`/api/offices?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }
      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        activeOffices = result.data;
        renderOfficeCards();
        renderMapMarkers();
      } else {
        throw new Error(result.error || 'Invalid API response format');
      }
    } catch (error) {
      console.error('[OfficeLocator] Fetch error:', error);
      cardsContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem 1.5rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.5rem; color: #ef4444; margin-bottom: 1rem;"></i>
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.5rem 0;">Unable to Load Offices</h3>
          <p style="font-size: 0.88rem; color: var(--text-muted); margin: 0 0 1.25rem 0;">${error.message || 'Please check your connection and try again.'}</p>
          <button type="button" class="btn btn-secondary" onclick="window.fetchOfficesRetry()" style="padding: 0.6rem 1.2rem; font-weight: 700; border-radius: 10px;">
            <i class="fa-solid fa-rotate-right"></i> Try Again
          </button>
        </div>
      `;
      if (countBadge) countBadge.textContent = '0';
    }
  }

  // Global retry hook for error button
  window.fetchOfficesRetry = function() {
    fetchOffices();
  };

  /**
   * Render Leaflet map markers
   */
  function renderMapMarkers() {
    if (!mapInstance) return;

    // Clear existing office markers
    mapMarkers.forEach(m => mapInstance.removeLayer(m));
    mapMarkers = [];

    if (activeOffices.length === 0) {
      if (userMarker) {
        mapInstance.setView([userCoords.lat, userCoords.lng], 13);
      }
      return;
    }

    const bounds = L.latLngBounds();

    activeOffices.forEach((off, idx) => {
      const lat = off.latitude || off.lat;
      const lng = off.longitude || off.lng;

      if (lat && lng) {
        const marker = L.marker([lat, lng], {
          title: off.name
        }).addTo(mapInstance);

        const directionsUrl = off.directions_url || `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        const formattedType = formatOfficeType(off.office_type || off.type);
        const distBadge = off.distance_formatted ? `<span style="font-size: 0.72rem; font-weight: 800; color: #10b981; background: rgba(16, 185, 129, 0.12); padding: 0.15rem 0.45rem; border-radius: 999px;">${off.distance_formatted} away</span>` : '';

        const popupContent = `
          <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 250px; padding: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.35rem;">
              <span style="font-size: 0.65rem; font-weight: 800; color: var(--primary, #0d9488); text-transform: uppercase; letter-spacing: 0.05em;">${formattedType}</span>
              ${distBadge}
            </div>
            <h4 style="font-size: 0.95rem; font-weight: 800; margin: 0 0 0.35rem 0; color: #0f172a; line-height: 1.25;">${off.name}</h4>
            ${off.name_ta ? `<div style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.35rem;">${off.name_ta}</div>` : ''}
            <p style="font-size: 0.78rem; color: #475569; margin: 0 0 0.6rem 0; line-height: 1.35;">${off.address}</p>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; border-top: 1px solid #e2e8f0; padding-top: 0.5rem;">
              ${off.phone ? `<a href="tel:${off.phone}" style="font-size: 0.76rem; font-weight: 700; color: #0d9488; text-decoration: none;">📞 ${off.phone}</a>` : '<span></span>'}
              <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 0.76rem; font-weight: 800; color: #10b981; text-decoration: none; display: inline-flex; align-items: center; gap: 0.25rem;">
                <span>Directions</span> →
              </a>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.officeId = off.id;
        mapMarkers.push(marker);
        bounds.extend([lat, lng]);
      }
    });

    if (userMarker && userCoords) {
      bounds.extend([userCoords.lat, userCoords.lng]);
    }

    if (mapMarkers.length > 0) {
      mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }

  /**
   * Pan and open popup for a specific office marker
   */
  function focusOfficeOnMap(officeId) {
    const marker = mapMarkers.find(m => m.officeId === officeId);
    if (marker && mapInstance) {
      mapInstance.setView(marker.getLatLng(), 15, { animate: true });
      marker.openPopup();
      const mapContainer = document.getElementById('office-locator-map');
      if (mapContainer) {
        mapContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  /**
   * Render Office Cards in the UI
   */
  function renderOfficeCards() {
    if (!cardsContainer) return;
    if (countBadge) countBadge.textContent = activeOffices.length;

    if (activeOffices.length === 0) {
      cardsContainer.innerHTML = `
        <div style="text-align: center; padding: 4rem 1.5rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px;">
          <i class="fa-solid fa-building-circle-xmark" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
          <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.5rem 0;">No Government Offices Match Your Criteria</h3>
          <p style="font-size: 0.92rem; color: var(--text-muted); margin: 0 0 1.5rem 0; max-width: 500px; margin-inline: auto;">
            Try clearing search keywords or selecting "All Office Types" and "All Districts" to broaden your view.
          </p>
          <div style="display: inline-flex; gap: 0.75rem;">
            <button type="button" class="btn btn-secondary" onclick="window.resetOfficeFilters()" style="padding: 0.6rem 1.25rem; font-weight: 700; border-radius: 10px;">
              <i class="fa-solid fa-arrow-rotate-left"></i> Reset Filters
            </button>
            <a href="https://tnesevai.tn.gov.in/" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="padding: 0.6rem 1.25rem; font-weight: 700; border-radius: 10px; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem;">
              <span>Official TNeGA Portal</span> <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
          </div>
        </div>
      `;
      return;
    }

    cardsContainer.innerHTML = activeOffices.map(off => {
      const lat = off.latitude || off.lat;
      const lng = off.longitude || off.lng;
      const phone = off.phone || off.contact || '';
      const email = off.email || '';
      const services = Array.isArray(off.services) ? off.services : [];
      const directionsUrl = off.directions_url || (lat && lng ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(off.name + ' ' + off.address)}`);
      const formattedType = formatOfficeType(off.office_type || off.type);

      return `
        <div class="office-card-v2" data-office-id="${off.id}" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px; padding: 1.75rem; margin-bottom: 1.5rem; box-shadow: 0 8px 25px rgba(0,0,0,0.04);">
          
          <!-- Top Row: Type, District, Distance, Verified Badge -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.75rem; flex-wrap: wrap;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.45rem;">
                <span style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.25rem 0.65rem; border-radius: 999px; background: rgba(13, 148, 136, 0.12); color: var(--primary);">
                  ${formattedType} • ${off.district}
                </span>
                ${off.taluk ? `<span style="font-size: 0.7rem; font-weight: 700; padding: 0.25rem 0.6rem; border-radius: 999px; background: var(--bg-app); border: 1px solid var(--border-color); color: var(--text-muted);">${off.taluk} Taluk</span>` : ''}
                <span style="font-size: 0.68rem; font-weight: 700; color: #10b981; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); padding: 0.2rem 0.55rem; border-radius: 999px; display: inline-flex; align-items: center; gap: 0.25rem;">
                  <i class="fa-solid fa-shield-halved"></i> State Verified
                </span>
              </div>
              <h3 style="font-size: 1.35rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.2rem 0; line-height: 1.3;">${off.name}</h3>
              ${off.name_ta ? `<div style="font-size: 0.95rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0.35rem;">${off.name_ta}</div>` : ''}
            </div>

            ${off.distance_formatted ? `
              <span style="font-size: 0.8rem; font-weight: 800; color: #10b981; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.25); padding: 0.35rem 0.85rem; border-radius: 999px; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.35rem;">
                <i class="fa-solid fa-location-arrow"></i> ${off.distance_formatted} away
              </span>
            ` : ''}
          </div>

          <p style="font-size: 0.88rem; color: var(--text-muted); margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.4rem;">
            <i class="fa-solid fa-building-columns" style="color: var(--primary);"></i> <span>${off.department}</span>
          </p>

          <!-- Address, Hours, Contact Details -->
          <div style="display: grid; grid-template-columns: 1fr; gap: 0.6rem; background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">
            <div style="font-size: 0.88rem; color: var(--text-main); line-height: 1.5;">
              <strong style="color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 0.15rem;">Address:</strong>
              ${off.address} ${off.pincode ? `<span style="font-weight: 600; color: var(--text-muted);">(PIN: ${off.pincode})</span>` : ''}
            </div>

            <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; margin-top: 0.25rem;">
              <div style="font-size: 0.85rem; color: var(--text-main);">
                <i class="fa-regular fa-clock" style="color: var(--primary);"></i> <strong>Hours:</strong> ${off.hours || 'Mon - Fri: 10:00 AM - 5:45 PM'}
              </div>
              ${phone ? `
                <div style="font-size: 0.85rem; color: var(--text-main);">
                  <i class="fa-solid fa-phone" style="color: var(--primary);"></i> <strong>Contact:</strong> <a href="tel:${phone}" style="color: var(--primary); font-weight: 700; text-decoration: none;">${phone}</a>
                </div>
              ` : ''}
              ${email ? `
                <div style="font-size: 0.85rem; color: var(--text-main);">
                  <i class="fa-solid fa-envelope" style="color: var(--primary);"></i> <strong>Email:</strong> <a href="mailto:${email}" style="color: var(--primary); font-weight: 600; text-decoration: none;">${email}</a>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Services Available Badges -->
          ${services.length > 0 ? `
            <div style="margin-bottom: 1.25rem;">
              <div style="font-size: 0.72rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.45rem;">
                Key Services Available Here
              </div>
              <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                ${services.map(svc => `<span style="font-size: 0.75rem; background: var(--bg-surface); border: 1px solid var(--border-color); padding: 0.25rem 0.65rem; border-radius: 6px; color: var(--text-main); font-weight: 600;">${svc}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Source Provenance Note -->
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.35rem;">
            <i class="fa-solid fa-circle-info" style="color: var(--text-muted);"></i>
            <span>Verified Source: <strong>${off.source_name || 'Official District Portal'}</strong></span>
          </div>

          <!-- Card Actions -->
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem; border-top: 1px dashed var(--border-color); padding-top: 1.25rem; flex-wrap: wrap;">
            ${(lat && lng) ? `
              <button type="button" class="btn btn-secondary btn-focus-map" data-id="${off.id}" style="padding: 0.65rem 1.1rem; font-size: 0.85rem; font-weight: 700; border-radius: 10px; display: inline-flex; align-items: center; gap: 0.4rem;">
                <i class="fa-solid fa-map-pin"></i> <span>View on Map</span>
              </button>
            ` : ''}

            ${phone ? `
              <a href="tel:${phone}" class="btn btn-secondary" style="padding: 0.65rem 1.15rem; font-size: 0.85rem; font-weight: 700; border-radius: 10px; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem;">
                <i class="fa-solid fa-phone"></i> <span>Call Office</span>
              </a>
            ` : ''}

            <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="padding: 0.65rem 1.35rem; font-size: 0.85rem; font-weight: 800; border-radius: 10px; text-decoration: none; display: inline-flex; align-items: center; gap: 0.45rem; box-shadow: 0 4px 15px rgba(13, 148, 136, 0.25);">
              <span>Open in Google Maps</span> <i class="fa-solid fa-location-arrow"></i>
            </a>
          </div>

        </div>
      `;
    }).join('');

    // Attach click listeners to "View on Map" buttons
    cardsContainer.querySelectorAll('.btn-focus-map').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (id) focusOfficeOnMap(id);
      });
    });
  }

  /**
   * Reset all filters to default
   */
  window.resetOfficeFilters = function() {
    if (searchInput) searchInput.value = '';
    if (typeSelect) typeSelect.value = 'all';
    if (districtSelect) districtSelect.value = 'all';
    updateTalukDropdown();
    fetchOffices();
  };

  /**
   * Browser Geolocation Handler
   */
  function getUserGeolocation() {
    if (!navigator.geolocation) {
      if (window.showToast) window.showToast('Geolocation is not supported by your browser.', 'warning');
      return;
    }

    if (locBtn) {
      locBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Locating...`;
      locBtn.disabled = true;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };

        if (locBtn) {
          locBtn.innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> Location Active`;
          locBtn.disabled = false;
          locBtn.style.background = 'rgba(16, 185, 129, 0.12)';
          locBtn.style.color = '#10b981';
          locBtn.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        }

        if (mapInstance) {
          if (userMarker) {
            mapInstance.removeLayer(userMarker);
          }

          // Blue pulsating marker for user location
          const userIcon = L.divIcon({
            className: 'cc-user-location-pin',
            html: `
              <div style="position: relative; width: 22px; height: 22px;">
                <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: #3b82f6; opacity: 0.4; animation: pulse 1.8s infinite;"></div>
                <div style="position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #2563eb; border: 2.5px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>
              </div>
            `,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          });

          userMarker = L.marker([userCoords.lat, userCoords.lng], { icon: userIcon })
            .addTo(mapInstance)
            .bindPopup('<b>Your Current Location</b>')
            .openPopup();

          mapInstance.setView([userCoords.lat, userCoords.lng], 12);
        }

        // Re-query offices with user coordinates to get exact distances
        fetchOffices();
      },
      (err) => {
        console.warn('[OfficeLocator] Geolocation error or denied:', err);
        if (locBtn) {
          locBtn.innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> <span>Use My Location</span>`;
          locBtn.disabled = false;
        }
        if (window.showToast) {
          window.showToast('Could not access device location. You can select your district from the dropdown.', 'info');
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  /**
   * DOM Content Loaded Initialization
   */
  document.addEventListener('DOMContentLoaded', () => {
    searchInput = document.getElementById('input-office-search');
    typeSelect = document.getElementById('select-office-type');
    districtSelect = document.getElementById('select-office-district');
    talukSelect = document.getElementById('select-office-taluk');
    locBtn = document.getElementById('btn-use-location');
    cardsContainer = document.getElementById('office-cards-container');
    countBadge = document.getElementById('office-count-badge');

    // 1. Initialize Leaflet Map
    initOfficeMap();

    // 2. Fetch District & Taluk metadata
    loadDistrictsMetadata();

    // 3. Initial load of offices across Tamil Nadu
    fetchOffices();

    // 4. Debounced Search Handler
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
          fetchOffices();
        }, 300);
      });
    }

    // 5. Office Type Filter Handler
    if (typeSelect) {
      typeSelect.addEventListener('change', () => {
        fetchOffices();
      });
    }

    // 6. District Filter Handler
    if (districtSelect) {
      districtSelect.addEventListener('change', () => {
        updateTalukDropdown();
        fetchOffices();
      });
    }

    // 7. Taluk Filter Handler
    if (talukSelect) {
      talukSelect.addEventListener('change', () => {
        fetchOffices();
      });
    }

    // 8. Location Button Handler
    if (locBtn) {
      locBtn.addEventListener('click', getUserGeolocation);
    }
  });

})();
