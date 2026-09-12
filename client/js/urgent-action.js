/**
 * urgent-action.js
 * 
 * CrowdCity AI — Location-First Emergency Assistance Controller
 * Discovers verified nearby hospitals, ambulances, police stations, and fire stations
 * across Tamil Nadu using live device GPS coordinates.
 * 
 * NO emojis. Strictly clean, government-grade civic engineering.
 */

(function () {
  'use strict';

  // 38 Verified Districts Data with Official District Collectorate Phone Numbers
  const OFFICIAL_DISTRICTS = [
    { id: "ariyalur", en: "Ariyalur", ta: "அரியலூர்", code: "ari", phone: "04329-228200" },
    { id: "chengalpattu", en: "Chengalpattu", ta: "செங்கல்பட்டு", code: "cpt", phone: "044-27427412" },
    { id: "chennai", en: "Chennai", ta: "சென்னை", code: "chn", phone: "044-25268323" },
    { id: "coimbatore", en: "Coimbatore", ta: "கோயம்புத்தூர்", code: "cbe", phone: "0422-2300124" },
    { id: "cuddalore", en: "Cuddalore", ta: "கடலூர்", code: "cud", phone: "04142-220700" },
    { id: "dharmapuri", en: "Dharmapuri", ta: "தர்மபுரி", code: "dpi", phone: "04342-230500" },
    { id: "dindigul", en: "Dindigul", ta: "திண்டுக்கல்", code: "dgl", phone: "0451-2461199" },
    { id: "erode", en: "Erode", ta: "ஈரோடு", code: "erd", phone: "0424-2260211" },
    { id: "kallakurichi", en: "Kallakurichi", ta: "கள்ளக்குறிச்சி", code: "kki", phone: "04151-228800" },
    { id: "kancheepuram", en: "Kancheepuram", ta: "காஞ்சிபுரம்", code: "kpm", phone: "044-27237433" },
    { id: "kanniyakumari", en: "Kanniyakumari", ta: "கன்னியாகுமரி", code: "kkm", phone: "04652-278888" },
    { id: "karur", en: "Karur", ta: "கரூர்", code: "krr", phone: "04324-257555" },
    { id: "krishnagiri", en: "Krishnagiri", ta: "கிருஷ்ணகிரி", code: "kgi", phone: "04343-239500" },
    { id: "madurai", en: "Madurai", ta: "மதுரை", code: "mdu", phone: "0452-2531110" },
    { id: "mayiladuthurai", en: "Mayiladuthurai", ta: "மயிலாடுதுறை", code: "myd", phone: "04364-222800" },
    { id: "nagapattinam", en: "Nagapattinam", ta: "நாகப்பட்டினம்", code: "ngp", phone: "04365-252500" },
    { id: "namakkal", en: "Namakkal", ta: "நாமக்கல்", code: "nmk", phone: "04286-281100" },
    { id: "nilgiris", en: "The Nilgiris", ta: "நீலகிரி", code: "nil", phone: "0423-2441010" },
    { id: "perambalur", en: "Perambalur", ta: "பெரம்பலூர்", code: "pbl", phone: "04328-224133" },
    { id: "pudukkottai", en: "Pudukkottai", ta: "புதுக்கோட்டை", code: "pdk", phone: "04322-221600" },
    { id: "ramanathapuram", en: "Ramanathapuram", ta: "இராமநாதபுரம்", code: "ram", phone: "04567-230055" },
    { id: "ranipet", en: "Ranipet", ta: "ராணிப்பேட்டை", code: "rpt", phone: "04172-273180" },
    { id: "salem", en: "Salem", ta: "சேலம்", code: "slm", phone: "0427-2452244" },
    { id: "sivaganga", en: "Sivaganga", ta: "சிவகங்கை", code: "svg", phone: "04575-241555" },
    { id: "tenkasi", en: "Tenkasi", ta: "தென்காசி", code: "tks", phone: "04633-290500" },
    { id: "thanjavur", en: "Thanjavur", ta: "தஞ்சாவூர்", code: "tjr", phone: "04362-230101" },
    { id: "theni", en: "Theni", ta: "தேனி", code: "tni", phone: "04546-253630" },
    { id: "thoothukudi", en: "Thoothukudi", ta: "தூத்துக்குடி", code: "tcy", phone: "0461-2340600" },
    { id: "tiruchirappalli", en: "Tiruchirappalli", ta: "திருச்சிராப்பள்ளி", code: "try", phone: "0431-2415031" },
    { id: "tirunelveli", en: "Tirunelveli", ta: "திருநெல்வேலி", code: "tnv", phone: "0462-2500820" },
    { id: "tirupathur", en: "Tirupathur", ta: "திருப்பத்தூர்", code: "tpt", phone: "04179-220011" },
    { id: "tiruppur", en: "Tiruppur", ta: "திருப்பூர்", code: "tup", phone: "0421-2971100" },
    { id: "tiruvallur", en: "Tiruvallur", ta: "திருவள்ளூர்", code: "tlr", phone: "044-27661600" },
    { id: "tiruvannamalai", en: "Tiruvannamalai", ta: "திருவண்ணாமலை", code: "tvm", phone: "04175-233333" },
    { id: "tiruvarur", en: "Tiruvarur", ta: "திருவாரூர்", code: "tvr", phone: "04366-226066" },
    { id: "vellore", en: "Vellore", ta: "வேலூர்", code: "vel", phone: "0416-2252525" },
    { id: "viluppuram", en: "Viluppuram", ta: "விழுப்புரம்", code: "vpm", phone: "04146-222450" },
    { id: "virudhunagar", en: "Virudhunagar", ta: "விருதுநகர்", code: "vnr", phone: "04562-252525" }
  ];

  let currentCoordinates = null;
  let currentCoordinatesString = '';
  let activeDistrict = null;
  let cachedServicesData = null;
  let activeSituationCategory = 'all';
  let categoryLimits = {
    hospitals: 4,
    ambulances: 4,
    police: 4,
    fire: 4
  };

  // Initialize on load
  document.addEventListener('DOMContentLoaded', () => {
    populateDistrictSelect();
    detectEmergencyLocation();
  });

  // Populate District Select Dropdown
  function populateDistrictSelect() {
    const select = document.getElementById('urgent-district-select');
    if (!select) return;

    select.innerHTML = '<option value="">Select District</option>';
    OFFICIAL_DISTRICTS.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `${d.en} (${d.ta})`;
      select.appendChild(opt);
    });
  }

  // Focus District Selector from warning action
  window.focusDistrictSelect = function () {
    const select = document.getElementById('urgent-district-select');
    if (select) {
      select.focus();
      select.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Handle District Selector Change
  window.handleDistrictChange = function (districtId) {
    if (!districtId) return;
    const found = OFFICIAL_DISTRICTS.find(d => d.id === districtId || d.en.toLowerCase() === districtId.toLowerCase());
    if (found) {
      activeDistrict = found;
      updateDistrictCard(found);

      const locDisplay = document.getElementById('urgent-loc-display');
      const locTitle = document.getElementById('urgent-loc-status-title');
      const locIcon = document.getElementById('urgent-loc-icon');
      const warningBar = document.getElementById('location-warning-bar');

      if (warningBar) warningBar.classList.remove('show');
      if (locTitle) locTitle.textContent = 'Selected Location';
      if (locDisplay) locDisplay.textContent = `${found.en} (${found.ta}) • Tamil Nadu`;
      if (locIcon) {
        locIcon.className = 'loc-icon-indicator';
        locIcon.innerHTML = '<i class="fa-solid fa-location-pin"></i>';
      }

      currentCoordinates = null;
      currentCoordinatesString = `District: ${found.en}, Tamil Nadu, India`;

      // Fetch nearby services for manual district
      loadNearbyServices(null, null, found.id);
    }
  };

  // Update District Collectorate Card in UI
  function updateDistrictCard(district) {
    const titleEl = document.getElementById('district-collectorate-title');
    const subEl = document.getElementById('district-collectorate-sub');
    const phoneBtn = document.getElementById('district-collectorate-phone-btn');
    const phoneVal = document.getElementById('district-collectorate-phone-val');

    if (titleEl) {
      titleEl.textContent = `${district.en} District Collectorate Control Room`;
    }
    if (subEl) {
      subEl.textContent = `Direct official government administrative control room for ${district.en}.`;
    }
    if (phoneBtn && phoneVal) {
      const cleanPhone = district.phone.replace(/[^0-9]/g, '');
      phoneBtn.href = `tel:${cleanPhone}`;
      phoneVal.textContent = district.phone;
    }

    const select = document.getElementById('urgent-district-select');
    if (select && select.value !== district.id) {
      select.value = district.id;
    }
  }

  // Location Detection Flow (Location-First)
  function detectEmergencyLocation() {
    const locDisplay = document.getElementById('urgent-loc-display');
    const locTitle = document.getElementById('urgent-loc-status-title');
    const locIcon = document.getElementById('urgent-loc-icon');
    const warningBar = document.getElementById('location-warning-bar');

    if (locDisplay) locDisplay.textContent = 'Finding help near you...';
    if (locTitle) locTitle.textContent = 'Current Location';
    if (locIcon) {
      locIcon.className = 'loc-icon-indicator';
      locIcon.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }
    if (warningBar) warningBar.classList.remove('show');

    if (!('geolocation' in navigator)) {
      handleLocationFallback('Geolocation is not supported by this browser.');
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = Math.round(position.coords.accuracy || 0);

        currentCoordinates = { latitude: lat, longitude: lng };

        // Format Coordinates for reading aloud
        const latRef = lat >= 0 ? 'N' : 'S';
        const lngRef = lng >= 0 ? 'E' : 'W';
        const formattedCoords = `${Math.abs(lat).toFixed(4)}° ${latRef}, ${Math.abs(lng).toFixed(4)}° ${lngRef}`;
        currentCoordinatesString = `${formattedCoords} (GPS Accuracy: ±${accuracy}m)`;

        if (locTitle) locTitle.textContent = 'Using your current location';
        if (locIcon) {
          locIcon.className = 'loc-icon-indicator active-gps';
          locIcon.innerHTML = '<i class="fa-solid fa-location-dot"></i>';
        }

        // Fetch nearby services using coordinates
        loadNearbyServices(lat, lng, null);
      },
      (error) => {
        handleLocationFallback(error.message || 'Location permission unavailable.');
      },
      options
    );
  }

  // Handle Location Failure / Denied
  function handleLocationFallback(reason) {
    const locDisplay = document.getElementById('urgent-loc-display');
    const locTitle = document.getElementById('urgent-loc-status-title');
    const locIcon = document.getElementById('urgent-loc-icon');
    const warningBar = document.getElementById('location-warning-bar');

    if (warningBar) warningBar.classList.add('show');
    if (locTitle) locTitle.textContent = 'Location Required';
    if (locDisplay) locDisplay.textContent = 'Location access is required to find nearby emergency services.';
    if (locIcon) {
      locIcon.className = 'loc-icon-indicator error-gps';
      locIcon.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
    }

    // Check if user has saved district
    const savedDistrict = localStorage.getItem('user_district') || localStorage.getItem('crowdcity_user_district');
    if (savedDistrict) {
      const match = OFFICIAL_DISTRICTS.find(d => d.en.toLowerCase() === savedDistrict.toLowerCase() || d.id === savedDistrict.toLowerCase());
      if (match) {
        activeDistrict = match;
        updateDistrictCard(match);
        if (locDisplay) locDisplay.textContent = `Using saved district: ${match.en} (${match.ta})`;
        loadNearbyServices(null, null, match.id);
        return;
      }
    }

    // Render empty state with clean call-to-action
    renderLocationRequiredNotice();
  }

  // Render Location Required state when no coordinates and no district chosen
  function renderLocationRequiredNotice() {
    const categories = ['hospitals', 'ambulances', 'police', 'fire'];
    categories.forEach(cat => {
      const grid = document.getElementById(`grid-${cat}`);
      const badge = document.getElementById(`badge-${cat}-count`);
      if (badge) badge.textContent = 'Location needed';
      if (grid) {
        grid.innerHTML = `
          <div class="service-empty-fallback">
            <h4 class="service-empty-title">Location access needed to discover nearest ${cat.replace('_', ' ')}</h4>
            <p style="font-size: 0.8rem; color: #64748b; margin: 0 0 0.85rem 0;">
              Allow GPS access or select your district from the dropdown above to view real nearby facilities.
            </p>
            <button type="button" class="btn-allow-loc" onclick="retryGpsDetection()">
              <i class="fa-solid fa-location-crosshairs"></i> Allow Location Access
            </button>
          </div>
        `;
      }
    });
  }

  // Fetch Nearby Services from Backend API
  async function loadNearbyServices(lat, lng, districtId) {
    let url = '/api/emergency-services/nearby?';
    if (lat !== null && lat !== undefined && lng !== null && lng !== undefined) {
      url += `lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=35&limit=15`;
    } else if (districtId) {
      url += `districtId=${encodeURIComponent(districtId)}&radius=35&limit=15`;
    } else {
      return;
    }

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data && data.success) {
        cachedServicesData = data;

        // Update district title and collectorate card
        if (data.location && data.location.district) {
          const matchedDistrict = OFFICIAL_DISTRICTS.find(d =>
            d.en.toLowerCase() === data.location.district.toLowerCase() ||
            d.id === (data.location.districtId || '').toLowerCase()
          );

          if (matchedDistrict) {
            activeDistrict = matchedDistrict;
            updateDistrictCard(matchedDistrict);
            const locDisplay = document.getElementById('urgent-loc-display');
            if (locDisplay && currentCoordinates) {
              locDisplay.textContent = `Using your current location (${matchedDistrict.en} District)`;
            }
          }
        }

        renderAllNearbyServices(data);
      } else {
        console.error('Failed to load emergency services:', data ? data.error : 'Unknown error');
      }
    } catch (err) {
      console.error('Network error loading emergency services:', err);
    }
  }

  // Render All Categories
  function renderAllNearbyServices(data) {
    if (!data || !data.results) return;

    renderServiceCategory('hospitals', data.results.hospitals || [], data.counts.hospitals || 0, 'hospital');
    renderServiceCategory('ambulances', data.results.ambulances || [], data.counts.ambulances || 0, 'ambulance');
    renderServiceCategory('police', data.results.police_stations || [], data.counts.police_stations || 0, 'police_station');
    renderServiceCategory('fire', data.results.fire_stations || [], data.counts.fire_stations || 0, 'fire_station');
  }

  // Render a Specific Category Grid
  function renderServiceCategory(categoryKey, items, totalCount, serviceType) {
    const grid = document.getElementById(`grid-${categoryKey}`);
    const badge = document.getElementById(`badge-${categoryKey}-count`);
    const moreWrap = document.getElementById(`wrap-more-${categoryKey}`);
    const moreText = document.getElementById(`text-more-${categoryKey}`);

    if (!grid) return;

    const limit = categoryLimits[categoryKey] || 4;
    const displayedItems = items.slice(0, limit);

    // Update count badge
    if (badge) {
      if (items.length === 0) {
        badge.textContent = 'None in range';
        badge.style.background = '#fef2f2';
        badge.style.color = '#b91c1c';
      } else {
        badge.textContent = `${items.length} nearby`;
        badge.style.background = '#ecfdf5';
        badge.style.color = '#047857';
      }
    }

    // If no verified services found, render authentic fallback option
    if (items.length === 0) {
      let fallbackNumber = '112';
      let fallbackLabel = 'Call 112 Unified Emergency';
      let fallbackDesc = 'No verified local station found within search range.';

      if (categoryKey === 'hospitals' || categoryKey === 'ambulances') {
        fallbackNumber = '108';
        fallbackLabel = 'Call 108 Free Emergency Ambulance';
        fallbackDesc = 'No local facility in range. Dispatch free state ambulance immediately.';
      } else if (categoryKey === 'police') {
        fallbackNumber = '100';
        fallbackLabel = 'Call 100 Police Control Room';
        fallbackDesc = 'Local police station number unavailable. Contact master control room.';
      } else if (categoryKey === 'fire') {
        fallbackNumber = '101';
        fallbackLabel = 'Call 101 Fire & Rescue';
        fallbackDesc = 'Local fire station number unavailable. Contact fire control room.';
      }

      grid.innerHTML = `
        <div class="service-empty-fallback">
          <h4 class="service-empty-title">${fallbackDesc}</h4>
          <a href="tel:${fallbackNumber}" class="btn-service-call" style="max-width: 280px; margin: 0.5rem auto 0 auto;">
            <i class="fa-solid fa-phone"></i> ${fallbackLabel}
          </a>
        </div>
      `;

      if (moreWrap) moreWrap.style.display = 'none';
      return;
    }

    // Render cards
    grid.innerHTML = displayedItems.map(item => {
      const cleanPhone = item.phone ? item.phone.replace(/[^0-9]/g, '') : null;
      const phoneDisplay = item.phone ? item.phone : 'Local number unavailable';
      const isCallAvailable = Boolean(cleanPhone);

      let dialHref = cleanPhone ? `tel:${cleanPhone}` : (serviceType === 'police_station' ? 'tel:100' : (serviceType === 'fire_station' ? 'tel:101' : 'tel:108'));
      let callLabel = cleanPhone ? `Call ${phoneDisplay}` : (serviceType === 'police_station' ? 'Call 100 Police' : (serviceType === 'fire_station' ? 'Call 101 Fire' : 'Call 108 Ambulance'));

      return `
        <div class="service-card" data-service-id="${item.id}">
          <div class="service-card-top">
            <div class="service-header-row">
              <h4 class="service-name">${escapeHtml(item.name)}</h4>
              <span class="service-distance-badge">
                <i class="fa-solid fa-location-arrow"></i> ${escapeHtml(item.formattedDistance)}
              </span>
            </div>
            <p class="service-address">
              <i class="fa-solid fa-location-dot"></i>
              <span>${escapeHtml(item.address)}</span>
            </p>
            <div class="service-source-tag">
              <i class="fa-solid fa-circle-check"></i>
              <span>${escapeHtml(item.source_name || 'Verified Government Directory')}</span>
            </div>
          </div>

          <div class="service-actions-row">
            <a href="${dialHref}" class="btn-service-call" title="Call ${escapeHtml(item.name)}">
              <i class="fa-solid fa-phone"></i>
              <span>${callLabel}</span>
            </a>
            <a href="${item.directionsUrl}" target="_blank" rel="noopener noreferrer" class="btn-service-directions" title="Directions to ${escapeHtml(item.name)}">
              <i class="fa-solid fa-diamond-turn-right"></i>
              <span data-i18n="action_directions">Directions</span>
            </a>
          </div>
        </div>
      `;
    }).join('');

    // Manage "View More" button
    if (moreWrap && moreText) {
      if (items.length > 4) {
        moreWrap.style.display = 'block';
        if (limit >= items.length) {
          moreText.textContent = `Show Fewer ${categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1)}`;
        } else {
          moreText.textContent = `View More (${items.length - limit} more available)`;
        }
      } else {
        moreWrap.style.display = 'none';
      }
    }
  }

  // Toggle View More for a category
  window.toggleViewMore = function (categoryKey) {
    if (!cachedServicesData || !cachedServicesData.results) return;

    let items = [];
    let serviceType = 'hospital';
    if (categoryKey === 'hospitals') {
      items = cachedServicesData.results.hospitals || [];
      serviceType = 'hospital';
    } else if (categoryKey === 'ambulances') {
      items = cachedServicesData.results.ambulances || [];
      serviceType = 'ambulance';
    } else if (categoryKey === 'police') {
      items = cachedServicesData.results.police_stations || [];
      serviceType = 'police_station';
    } else if (categoryKey === 'fire') {
      items = cachedServicesData.results.fire_stations || [];
      serviceType = 'fire_station';
    }

    if (categoryLimits[categoryKey] >= items.length) {
      categoryLimits[categoryKey] = 4; // Collapse back to default
    } else {
      categoryLimits[categoryKey] = items.length; // Expand all
    }

    renderServiceCategory(categoryKey, items, items.length, serviceType);
  };

  // Prioritize Emergency Situation Category (Re-orders sections on tap)
  window.selectSituationCategory = function (category) {
    activeSituationCategory = category;

    // Update active card/pill styling
    const pills = document.querySelectorAll('.situation-pill, .situation-card');
    pills.forEach(p => {
      if (p.getAttribute('data-category') === category) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });

    // Toggle road blockage pivot assistance card
    const roadBlockPivot = document.getElementById('road-block-pivot');
    if (roadBlockPivot) {
      if (category === 'blockage' || category === 'traffic') {
        roadBlockPivot.style.display = 'flex';
      } else {
        roadBlockPivot.style.display = 'none';
      }
    }

    const container = document.getElementById('nearby-services-container');
    const secHosp = document.getElementById('section-hospitals');
    const secAmb = document.getElementById('section-ambulances');
    const secPol = document.getElementById('section-police');
    const secFire = document.getElementById('section-fire');

    if (!container || !secHosp || !secAmb || !secPol || !secFire) return;

    // Define re-order priority based on emergency type
    let order = [secHosp, secAmb, secPol, secFire]; // Default: Hospitals -> Ambulances -> Police -> Fire

    if (category === 'medical' || category === 'accident') {
      // Prioritize Ambulance then Hospitals then Police
      order = [secAmb, secHosp, secPol, secFire];
    } else if (category === 'fire') {
      // Prioritize Fire then Ambulance then Police
      order = [secFire, secAmb, secPol, secHosp];
    } else if (category === 'police' || category === 'traffic' || category === 'blockage') {
      // Prioritize Police then Ambulance then Fire
      order = [secPol, secAmb, secFire, secHosp];
    } else if (category === 'danger') {
      order = [secPol, secFire, secAmb, secHosp];
    }

    // Append in new order
    order.forEach(section => {
      container.appendChild(section);
    });

    // Smooth scroll to top of nearby services
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Retry GPS Detection
  window.retryGpsDetection = function () {
    const btn = document.getElementById('btn-refresh-gps');
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      setTimeout(() => {
        if (btn) btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>';
      }, 2000);
    }
    detectEmergencyLocation();
  };

  // Copy GPS Coordinates for reading aloud to emergency dispatchers
  window.copyGpsCoordinates = function () {
    const copyBtn = document.getElementById('btn-copy-gps');
    const copyText = document.getElementById('copy-btn-text');
    const textToCopy = currentCoordinatesString || (activeDistrict ? `District: ${activeDistrict.en}, Tamil Nadu` : 'Tamil Nadu, India');

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(textToCopy).then(showCopiedNotice).catch(() => fallbackCopy(textToCopy));
    } else {
      fallbackCopy(textToCopy);
    }

    function fallbackCopy(text) {
      const tempInput = document.createElement('textarea');
      tempInput.value = text;
      tempInput.style.position = 'fixed';
      tempInput.style.left = '-9999px';
      document.body.appendChild(tempInput);
      tempInput.focus();
      tempInput.select();
      try {
        document.execCommand('copy');
        showCopiedNotice();
      } catch (err) {
        console.error('Failed to copy coordinates', err);
      }
      document.body.removeChild(tempInput);
    }

    function showCopiedNotice() {
      if (copyBtn && copyText) {
        const originalText = copyText.textContent;
        copyText.textContent = 'Coordinates Copied!';
        copyBtn.style.background = '#059669';
        copyBtn.style.color = '#ffffff';
        setTimeout(() => {
          copyText.textContent = originalText;
          copyBtn.style.background = '#f8fafc';
          copyBtn.style.color = '#334155';
        }, 2500);
      }
    }
  };

  // Escape HTML helper for XSS prevention
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
