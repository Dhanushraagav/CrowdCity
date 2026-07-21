// CrowdCity AI v2.0 - Government Office Locator JavaScript
// Features location search, district filters, Leaflet map integration, and Google Maps directions.

(function() {
  'use strict';

  let mapInstance = null;
  let mapMarkers = [];
  let userCoords = null;
  let allOffices = [];
  let filteredOffices = [];

  // Seed Dataset for Government Offices in Tamil Nadu
  const seedGovernmentOffices = [
    {
      id: 'off-esevai-chn',
      name: 'TNeGA Integrated E-Sevai Center',
      department: 'Tamil Nadu e-Governance Agency (TNeGA)',
      type: 'esevai',
      district: 'Chennai',
      address: 'No. 100, Anna Salai, Guindy, Chennai, Tamil Nadu 600032',
      landmark: 'Opposite Guindy Metro Station',
      contact: '044-22500123',
      hours: 'Mon - Sat: 9:00 AM - 5:00 PM',
      pincode: '600032',
      services: ['Kalaignar Magalir Urimai Application', 'Pudhumai Penn Registration', 'Community Certificate', 'Income Certificate'],
      lat: 13.0067,
      lng: 80.2020
    },
    {
      id: 'off-taluk-guindy',
      name: 'Guindy Taluk Revenue Office',
      department: 'Revenue & Disaster Management Dept, Govt of TN',
      type: 'taluk',
      district: 'Chennai',
      address: 'Taluk Office Complex, Velachery Main Road, Guindy, Chennai, Tamil Nadu 600032',
      landmark: 'Near Guindy Bus Terminus',
      contact: '044-22351234',
      hours: 'Mon - Fri: 10:00 AM - 5:45 PM',
      pincode: '600032',
      services: ['Patta Transfer', 'Income & Native Certificates', 'Ration Card Verification', 'Land Records'],
      lat: 13.0090,
      lng: 80.2130
    },
    {
      id: 'off-collector-chn',
      name: 'Chennai District Collectorate',
      department: 'Department of Revenue Administration',
      type: 'collectorate',
      district: 'Chennai',
      address: 'Singaravelar Maaligai, 62, Rajaji Salai, George Town, Chennai, Tamil Nadu 600001',
      landmark: 'Near Beach Railway Station',
      contact: '044-25268000',
      hours: 'Mon - Fri: 10:00 AM - 5:45 PM',
      pincode: '600001',
      services: ['Public Grievances', 'Chief Minister Special Cell Applications', 'Disability Cards', 'Social Welfare Approvals'],
      lat: 13.0882,
      lng: 80.2885
    },
    {
      id: 'off-vao-adyar',
      name: 'Adyar Village Administrative Officer (VAO) Office',
      department: 'Revenue & Disaster Management Dept, Govt of TN',
      type: 'vao',
      district: 'Chennai',
      address: 'LB Road, Adyar, Chennai, Tamil Nadu 600020',
      landmark: 'Near Adyar Depot',
      contact: '044-24410987',
      hours: 'Mon - Fri: 9:30 AM - 5:00 PM',
      pincode: '600020',
      services: ['VAO Income Verification', 'Heirship Certificates', 'Land Ownership Verification'],
      lat: 13.0012,
      lng: 80.2565
    },
    {
      id: 'off-esevai-cbe',
      name: 'Coimbatore District E-Sevai Main Center',
      department: 'Tamil Nadu e-Governance Agency (TNeGA)',
      type: 'esevai',
      district: 'Coimbatore',
      address: 'Collectorate Campus, State Bank Road, Gopalapuram, Coimbatore, Tamil Nadu 641018',
      landmark: 'Inside Collectorate Premises',
      contact: '0422-2301111',
      hours: 'Mon - Sat: 9:00 AM - 5:00 PM',
      pincode: '641018',
      services: ['Govt Scheme Registration', 'Smart Card Corrections', 'CMCHIS Enrollment'],
      lat: 11.0016,
      lng: 76.9629
    },
    {
      id: 'off-taluk-mdu',
      name: 'Madurai North Taluk Office',
      department: 'Revenue & Disaster Management Dept, Govt of TN',
      type: 'taluk',
      district: 'Madurai',
      address: 'Collectorate Complex, KK Nagar, Madurai, Tamil Nadu 625020',
      landmark: 'Near KK Nagar Arch',
      contact: '0452-2530400',
      hours: 'Mon - Fri: 10:00 AM - 5:45 PM',
      pincode: '625020',
      services: ['Social Welfare Pensions', 'Patta Extraction', 'Legal Heir Certificate'],
      lat: 9.9252,
      lng: 78.1198
    }
  ];

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  }

  function initOfficeMap() {
    const mapContainer = document.getElementById('office-locator-map');
    if (!mapContainer || typeof L === 'undefined') return;

    if (!mapInstance) {
      mapInstance = L.map('office-locator-map', {
        center: [13.0827, 80.2707], // Default Chennai Center
        zoom: 11,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstance);
    }

    renderMapMarkers();
  }

  function renderMapMarkers() {
    if (!mapInstance) return;

    // Clear existing markers
    mapMarkers.forEach(m => mapInstance.removeLayer(m));
    mapMarkers = [];

    if (filteredOffices.length === 0) return;

    const bounds = L.latLngBounds();

    filteredOffices.forEach(off => {
      if (off.lat && off.lng) {
        const marker = L.marker([off.lat, off.lng]).addTo(mapInstance);
        
        const popupContent = `
          <div style="font-family: system-ui; max-width: 220px;">
            <div style="font-size: 0.65rem; font-weight: 800; color: var(--primary); text-transform: uppercase;">${off.type.toUpperCase()} OFFICE</div>
            <h4 style="font-size: 0.95rem; font-weight: 800; margin: 0.2rem 0; color: var(--text-main);">${off.name}</h4>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0 0 0.5rem 0;">${off.address}</p>
            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(off.name + ' ' + off.address)}" target="_blank" rel="noopener noreferrer" style="font-size: 0.78rem; font-weight: 700; color: #10b981; text-decoration: none; display: inline-flex; align-items: center; gap: 0.3rem;">
              <span>Get Directions</span> →
            </a>
          </div>
        `;

        marker.bindPopup(popupContent);
        mapMarkers.push(marker);
        bounds.extend([off.lat, off.lng]);
      }
    });

    if (mapMarkers.length > 0) {
      mapInstance.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  function renderOfficeCards() {
    const container = document.getElementById('office-cards-container');
    const countElem = document.getElementById('office-count-badge');

    if (countElem) countElem.textContent = filteredOffices.length;

    if (!container) return;

    if (filteredOffices.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem 1.5rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px;">
          <i class="fa-solid fa-building-circle-xmark" style="font-size: 2.8rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.5rem 0;">No Government Offices Found</h3>
          <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">Try adjusting your district filter, office category, or search term.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filteredOffices.map(off => {
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(off.name + ' ' + off.address)}`;
      const distStr = userCoords ? calculateDistance(userCoords.lat, userCoords.lng, off.lat, off.lng) + ' km away' : null;

      return `
        <div class="office-card-v2" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px; padding: 1.75rem; margin-bottom: 1.5rem; box-shadow: 0 8px 25px rgba(0,0,0,0.04);">
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.75rem;">
            <div>
              <span style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.25rem 0.65rem; border-radius: 999px; background: rgba(13, 148, 136, 0.12); color: var(--primary); display: inline-block; margin-bottom: 0.35rem;">
                ${off.type.toUpperCase()} OFFICE • ${off.district}
              </span>
              <h3 style="font-size: 1.3rem; font-weight: 800; color: var(--text-main); margin: 0; line-height: 1.3;">${off.name}</h3>
            </div>

            ${distStr ? `
              <span style="font-size: 0.78rem; font-weight: 800; color: #10b981; background: rgba(16, 185, 129, 0.12); padding: 0.3rem 0.75rem; border-radius: 999px; white-space: nowrap;">
                <i class="fa-solid fa-location-arrow"></i> ${distStr}
              </span>
            ` : ''}
          </div>

          <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 1rem 0;">
            <i class="fa-solid fa-building-columns" style="color: var(--primary);"></i> ${off.department}
          </p>

          <div style="display: grid; grid-template-columns: 1fr; gap: 0.6rem; background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">
            <div style="font-size: 0.88rem; color: var(--text-main); line-height: 1.5;">
              <strong style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; display: block; margin-bottom: 0.15rem;">Address:</strong>
              ${off.address}
            </div>

            ${off.landmark ? `
              <div style="font-size: 0.85rem; color: var(--text-main);">
                <strong style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; display: block; margin-bottom: 0.15rem;">Landmark:</strong>
                ${off.landmark}
              </div>
            ` : ''}

            <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; margin-top: 0.25rem;">
              <div style="font-size: 0.85rem; color: var(--text-main);">
                <i class="fa-regular fa-clock" style="color: var(--primary);"></i> <strong>Hours:</strong> ${off.hours}
              </div>
              <div style="font-size: 0.85rem; color: var(--text-main);">
                <i class="fa-solid fa-phone" style="color: var(--primary);"></i> <strong>Contact:</strong> <a href="tel:${off.contact}" style="color: var(--primary); font-weight: 700; text-decoration: none;">${off.contact}</a>
              </div>
            </div>
          </div>

          <!-- Services Available Badges -->
          <div style="margin-bottom: 1.25rem;">
            <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.4rem;">
              Services Available Here
            </div>
            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
              ${off.services.map(svc => `<span style="font-size: 0.75rem; background: var(--bg-surface); border: 1px solid var(--border-color); padding: 0.25rem 0.65rem; border-radius: 6px; color: var(--text-main); font-weight: 600;">${svc}</span>`).join('')}
            </div>
          </div>

          <!-- Card Actions -->
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.85rem; border-top: 1px dashed var(--border-color); padding-top: 1.25rem; flex-wrap: wrap;">
            <a href="tel:${off.contact}" class="btn btn-secondary" style="padding: 0.65rem 1.2rem; font-size: 0.85rem; font-weight: 700; border-radius: 10px; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem;">
              <i class="fa-solid fa-phone"></i> <span>Call Office</span>
            </a>

            <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="padding: 0.65rem 1.4rem; font-size: 0.85rem; font-weight: 800; border-radius: 10px; text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 15px rgba(13, 148, 136, 0.25);">
              <span>Open in Google Maps</span> <i class="fa-solid fa-map-location-dot"></i>
            </a>
          </div>

        </div>
      `;
    }).join('');
  }

  function applyFilters() {
    const searchVal = (document.getElementById('input-office-search')?.value || '').toLowerCase().trim();
    const typeVal = document.getElementById('select-office-type')?.value || 'all';
    const districtVal = document.getElementById('select-office-district')?.value || 'all';

    filteredOffices = allOffices.filter(off => {
      if (typeVal !== 'all' && off.type !== typeVal) return false;
      if (districtVal !== 'all' && off.district.toLowerCase() !== districtVal.toLowerCase()) return false;

      if (searchVal) {
        const matchesName = off.name.toLowerCase().includes(searchVal);
        const matchesDept = off.department.toLowerCase().includes(searchVal);
        const matchesAddr = off.address.toLowerCase().includes(searchVal);
        const matchesSvc = off.services.some(s => s.toLowerCase().includes(searchVal));
        if (!matchesName && !matchesDept && !matchesAddr && !matchesSvc) return false;
      }

      return true;
    });

    renderOfficeCards();
    renderMapMarkers();
  }

  function getUserGeolocation() {
    if (navigator.geolocation) {
      const btn = document.getElementById('btn-use-location');
      if (btn) btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Locating...`;

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (btn) {
            btn.innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> Location Active`;
            btn.style.background = 'rgba(16, 185, 129, 0.12)';
            btn.style.color = '#10b981';
            btn.style.borderColor = 'rgba(16, 185, 129, 0.3)';
          }
          if (mapInstance) {
            mapInstance.setView([userCoords.lat, userCoords.lng], 13);
            L.marker([userCoords.lat, userCoords.lng], {
              title: "Your Location"
            }).addTo(mapInstance).bindPopup("<b>Your Current Location</b>").openPopup();
          }
          applyFilters();
        },
        (err) => {
          console.warn("Geolocation permission denied or error:", err);
          if (btn) btn.innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> Use My Location`;
          if (window.showToast) window.showToast("Could not access device location. You can select your district manually.", "info");
        }
      );
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    allOffices = [...seedGovernmentOffices];
    filteredOffices = [...allOffices];

    initOfficeMap();
    renderOfficeCards();

    // Event Listeners
    const searchInput = document.getElementById('input-office-search');
    if (searchInput) searchInput.addEventListener('input', applyFilters);

    const typeSelect = document.getElementById('select-office-type');
    if (typeSelect) typeSelect.addEventListener('change', applyFilters);

    const districtSelect = document.getElementById('select-office-district');
    if (districtSelect) districtSelect.addEventListener('change', applyFilters);

    const locBtn = document.getElementById('btn-use-location');
    if (locBtn) locBtn.addEventListener('click', getUserGeolocation);
  });

})();
