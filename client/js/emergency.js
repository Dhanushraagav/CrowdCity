/**
 * CrowdCity AI v2.5 - Emergency SOS Hub Page Controller
 * Binds UI interactions, GPS geolocation, sharing, safety guides, and responder filters.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Default fallback location (Chennai) if GPS is denied or unavailable
  let currentLat = 13.0827;
  let currentLng = 80.2707;
  let allResponders = [];
  let activeCategory = 'all';

  const safetyData = {
    flood: {
      title: 'Flood Emergency',
      icon: 'fa-water',
      before: [
        'Keep emergency supplies, battery-powered radio, and flashlights ready.',
        'Know your local shelter routes and elevated evacuation zones.',
        'Store important documents in waterproof containers.'
      ],
      during: [
        'Move to higher ground or upper floors immediately.',
        'Do NOT walk, swim, or drive through floodwaters.',
        'Disconnect electrical appliances if safe to do so.'
      ],
      after: [
        'Avoid standing water as it may be contaminated or electrically charged.',
        'Drink only boiled or bottled clean water.',
        'Inspect structural damage before re-entering buildings.'
      ]
    },
    fire: {
      title: 'Fire & Building Safety',
      icon: 'fa-fire',
      before: [
        'Install smoke detectors and verify fire extinguisher locations.',
        'Identify at least two escape exits from every room.'
      ],
      during: [
        'Crawl low under smoke to exit safely.',
        'Touch doors before opening—if hot, do NOT open.',
        'If clothes catch fire: STOP, DROP, and ROLL.'
      ],
      after: [
        'Call 101 or emergency services from outside the building.',
        'Do not re-enter a burning structure under any circumstances.'
      ]
    },
    earthquake: {
      title: 'Earthquake Safety',
      icon: 'fa-house-crack',
      before: [
        'Secure heavy furniture and wall hangings to studs.',
        'Prepare an emergency kit with 3 days of non-perishable food.'
      ],
      during: [
        'DROP, COVER, and HOLD ON under a sturdy desk or table.',
        'Stay away from windows, glass, and exterior walls.',
        'If outdoors, move to an open area away from power lines and buildings.'
      ],
      after: [
        'Expect aftershocks. Check yourself and others for injuries.',
        'Inspect gas and water lines for leaks before turning on switches.'
      ]
    },
    cyclone: {
      title: 'Cyclone & Severe Storm',
      icon: 'fa-hurricane',
      before: [
        'Board up windows and secure outdoor items that could become projectiles.',
        'Fully charge mobile devices and power banks.'
      ],
      during: [
        'Stay indoors in an interior room away from doors and windows.',
        'Do not be fooled by the eye of the storm; wind will resume sharply.'
      ],
      after: [
        'Beware of fallen power lines and loose tree branches.',
        'Wait for official all-clear announcements before venturing out.'
      ]
    },
    heatwave: {
      title: 'Severe Heatwave',
      icon: 'fa-sun',
      before: [
        'Keep hydration supplies and electrolyte solutions stocked.',
        'Identify cool shaded rooms in your living space.'
      ],
      during: [
        'Drink plenty of water even if you do not feel thirsty.',
        'Avoid strenuous outdoor activities between 11 AM and 4 PM.',
        'Wear lightweight, loose-fitting, light-colored clothing.'
      ],
      after: [
        'Watch for heat exhaustion signs (dizziness, nausea, rapid pulse).',
        'Apply cool damp cloths to neck and underarms if overheated.'
      ]
    },
    accident: {
      title: 'Road Accident Emergency',
      icon: 'fa-car-burst',
      before: [
        'Always wear seatbelts and helmets while traveling.',
        'Keep a first-aid kit and emergency contact card inside your vehicle.'
      ],
      during: [
        'Park safely, turn on hazard lights, and secure the accident scene.',
        'Call Ambulance (108) and Police (100) immediately.',
        'Do not move seriously injured victims unless there is immediate fire risk.'
      ],
      after: [
        'Provide clear location landmarks to emergency dispatchers.',
        'Cooperate with highway patrol and emergency medical technicians.'
      ]
    },
    medical: {
      title: 'Medical Emergency',
      icon: 'fa-heart-pulse',
      before: [
        'Keep essential personal prescription medications listed and accessible.',
        'Learn basic CPR and first-aid techniques.'
      ],
      during: [
        'Call 108 or 112 instantly for emergency medical response.',
        'Keep the patient calm and comfortable in a well-ventilated space.',
        'Perform CPR if trained and patient is unresponsive.'
      ],
      after: [
        'Accompany medical staff to emergency room and provide medical history.'
      ]
    }
  };

  // Initialize UI components
  initGPSLocation();
  bindCopyHelplineButtons();
  bindShareLocationButton();
  bindCategoryTabs();
  renderSafetyGuides('flood');

  /**
   * Request GPS Geolocation from Browser
   */
  function initGPSLocation() {
    const gpsStatusEl = document.getElementById('gps-status-text');

    if ('geolocation' in navigator) {
      if (gpsStatusEl) gpsStatusEl.textContent = 'Locating GPS position...';

      navigator.geolocation.getCurrentPosition(
        (position) => {
          currentLat = position.coords.latitude;
          currentLng = position.coords.longitude;

          if (gpsStatusEl) {
            gpsStatusEl.textContent = `GPS Active: ${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}`;
          }

          // Initialize Map and load nearby emergency responders
          EmergencyMap.initMap('emergency-map', currentLat, currentLng);
          loadNearbyResponders();
        },
        (error) => {
          console.warn('[Emergency] Geolocation permission denied or failed:', error.message);
          if (gpsStatusEl) {
            gpsStatusEl.textContent = 'Default Region (Chennai Center). GPS Permission Prompt Dismissed.';
          }
          EmergencyMap.initMap('emergency-map', currentLat, currentLng);
          loadNearbyResponders();
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    } else {
      if (gpsStatusEl) gpsStatusEl.textContent = 'Geolocation not supported by browser.';
      EmergencyMap.initMap('emergency-map', currentLat, currentLng);
      loadNearbyResponders();
    }
  }

  /**
   * Load nearby emergency responders from EmergencyService
   */
  async function loadNearbyResponders() {
    const container = document.getElementById('responders-container');
    if (!container) return;

    // Show shimmer skeleton cards
    container.innerHTML = `
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    `;

    allResponders = await EmergencyService.fetchNearbyEmergencyServices(currentLat, currentLng);
    
    // Update map with markers
    EmergencyMap.renderRespondersOnMap(allResponders);
    EmergencyMap.invalidateSize();

    renderRespondersList();
  }

  /**
   * Filter and render responder cards
   */
  function renderRespondersList() {
    const container = document.getElementById('responders-container');
    if (!container) return;

    const filtered = activeCategory === 'all'
      ? allResponders
      : allResponders.filter(r => r.type === activeCategory);

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted); background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 12px;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 0.5rem; display: block; color: #f59e0b;"></i>
          No emergency ${activeCategory} locations found nearby. Call <strong>112</strong> for immediate dispatch.
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(r => {
      const googleMapsDir = `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`;
      let badgeClass = 'hospital';
      let iconClass = 'fa-hospital';

      if (r.type === 'police') {
        badgeClass = 'police';
        iconClass = 'fa-shield-halved';
      } else if (r.type === 'fire') {
        badgeClass = 'fire';
        iconClass = 'fa-fire-extinguisher';
      }

      return `
        <div class="responder-card">
          <div class="responder-header">
            <div class="responder-badge-icon ${badgeClass}">
              <i class="fa-solid ${iconClass}"></i>
            </div>
            <div>
              <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-main); line-height: 1.3;">${escapeHTML(r.name)}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem;">
                <i class="fa-solid fa-location-dot"></i> ${escapeHTML(r.address)} (${r.distance} km away)
              </div>
            </div>
          </div>
          <div class="responder-actions">
            <a href="tel:${r.phone}" class="btn btn-secondary" style="border-color: rgba(16, 185, 129, 0.3); color: #10b981;">
              <i class="fa-solid fa-phone"></i> Call ${r.phone}
            </a>
            <a href="${googleMapsDir}" target="_blank" rel="noopener" class="btn btn-primary">
              <i class="fa-solid fa-diamond-turn-right"></i> Directions
            </a>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Bind category filter tab pills
   */
  function bindCategoryTabs() {
    const tabs = document.querySelectorAll('.category-pill');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeCategory = tab.getAttribute('data-category');
        renderRespondersList();
      });
    });
  }

  /**
   * Bind Share My Location Button
   */
  function bindShareLocationButton() {
    const shareBtn = document.getElementById('btn-share-location');
    if (!shareBtn) return;

    shareBtn.addEventListener('click', async () => {
      const mapsUrl = `https://maps.google.com/?q=${currentLat},${currentLng}`;
      const shareData = {
        title: '🚨 Emergency SOS Location Alert',
        text: `EMERGENCY ALERT: I need assistance. My current GPS location coordinates: ${currentLat.toFixed(5)}, ${currentLng.toFixed(5)}`,
        url: mapsUrl
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
          showToast('Location link shared successfully!');
        } catch (err) {
          copyToClipboard(mapsUrl, 'Emergency Google Maps Location Link copied to clipboard!');
        }
      } else {
        copyToClipboard(mapsUrl, 'Emergency Google Maps Location Link copied to clipboard!');
      }
    });
  }

  /**
   * Bind Copy Helpline Number Buttons
   */
  function bindCopyHelplineButtons() {
    document.querySelectorAll('.btn-copy-num').forEach(btn => {
      btn.addEventListener('click', () => {
        const number = btn.getAttribute('data-number');
        if (number) {
          copyToClipboard(number, `Emergency helpline number ${number} copied!`);
        }
      });
    });
  }

  /**
   * Render Safety Tips for selected category
   */
  function renderSafetyGuides(categoryKey) {
    const guide = safetyData[categoryKey] || safetyData.flood;
    const container = document.getElementById('safety-guide-container');
    if (!container) return;

    container.innerHTML = `
      <div class="safety-guide-content">
        <div class="safety-phase-box">
          <div class="safety-phase-title before"><i class="fa-solid fa-shield-halved"></i> Before Emergency</div>
          <ul class="safety-list">
            ${guide.before.map(item => `<li>${escapeHTML(item)}</li>`).join('')}
          </ul>
        </div>

        <div class="safety-phase-box">
          <div class="safety-phase-title during"><i class="fa-solid fa-triangle-exclamation"></i> During Emergency</div>
          <ul class="safety-list">
            ${guide.during.map(item => `<li>${escapeHTML(item)}</li>`).join('')}
          </ul>
        </div>

        <div class="safety-phase-box">
          <div class="safety-phase-title after"><i class="fa-solid fa-circle-check"></i> After Emergency</div>
          <ul class="safety-list">
            ${guide.after.map(item => `<li>${escapeHTML(item)}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;

    // Highlight active safety tab button
    const tabs = document.querySelectorAll('.safety-tab-btn');
    tabs.forEach(t => {
      if (t.getAttribute('data-safety') === categoryKey) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });
  }

  // Bind Safety Tab buttons
  document.querySelectorAll('.safety-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-safety');
      renderSafetyGuides(key);
    });
  });

  /**
   * Utility helper to copy text to clipboard with toast notification
   */
  function copyToClipboard(text, message) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(message);
      }).catch(() => {
        fallbackCopy(text, message);
      });
    } else {
      fallbackCopy(text, message);
    }
  }

  function fallbackCopy(text, message) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast(message);
    } catch(e) {}
    document.body.removeChild(textarea);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  function showToast(msg) {
    if (window.showToast) {
      window.showToast(msg);
    } else {
      alert(msg);
    }
  }
});
