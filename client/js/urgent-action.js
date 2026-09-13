/**
 * urgent-action.js
 * 
 * CrowdCity AI — Location-First Emergency Assistance Controller
 * Discovers verified nearby government and private hospitals, clinics,
 * ambulances, police stations, and fire stations across Tamil Nadu.
 * 
 * Strict Standards:
 * - NO emojis. Pure government-grade civic engineering.
 * - Distance-first: closest real-world services displayed first.
 * - Real private and government coverage with direct call and directions.
 * - Clear distinction: Clinics never labeled as hospitals.
 * - Emergency availability explicitly verified or flagged as unverified.
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
    hospitals: 6,
    ambulances: 6,
    police: 6,
    fire: 6
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
      if (locDisplay) {
        locDisplay.textContent = `Manual Selection: ${found.en} District`;
      }
      hideLocationWarning();

      // Reset coordinates string to district name
      currentCoordinatesString = `District: ${found.en}, Tamil Nadu`;

      loadNearbyServices(null, null, found.id);
    }
  };

  // Detect Emergency GPS Location
  function detectEmergencyLocation() {
    const locDisplay = document.getElementById('urgent-loc-display');
    const locIcon = document.getElementById('urgent-loc-icon');

    if (locDisplay) {
      locDisplay.textContent = 'Detecting current GPS location...';
    }
    if (locIcon) {
      locIcon.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    if (!navigator.geolocation) {
      handleLocationFailure('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        currentCoordinates = { lat, lng };
        currentCoordinatesString = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;

        if (locIcon) {
          locIcon.innerHTML = '<i class="fa-solid fa-location-dot" style="color: #059669;"></i>';
        }
        if (locDisplay) {
          locDisplay.textContent = `Live GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }

        hideLocationWarning();
        loadNearbyServices(lat, lng, null);
      },
      (err) => {
        let msg = 'Unable to retrieve your location.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location access permission was denied.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Location position is currently unavailable.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location request timed out.';
        }
        handleLocationFailure(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  // Handle Location Detection Failure
  function handleLocationFailure(msg) {
    const locDisplay = document.getElementById('urgent-loc-display');
    const locIcon = document.getElementById('urgent-loc-icon');
    const warningBar = document.getElementById('location-warning-bar');

    if (locIcon) {
      locIcon.innerHTML = '<i class="fa-solid fa-location-crosshairs" style="color: #dc2626;"></i>';
    }
    if (locDisplay) {
      locDisplay.textContent = 'Location unavailable - Please select your district';
    }
    if (warningBar) {
      warningBar.style.display = 'block';
    }

    // Default to Chennai or prompt district select
    if (!activeDistrict) {
      const defaultDistrict = OFFICIAL_DISTRICTS.find(d => d.id === 'chennai');
      if (defaultDistrict) {
        updateDistrictCard(defaultDistrict);
      }
    }

    renderEmptyLocationState();
  }

  function hideLocationWarning() {
    const warningBar = document.getElementById('location-warning-bar');
    if (warningBar) {
      warningBar.style.display = 'none';
    }
  }

  // Update District Collectorate Card
  function updateDistrictCard(district) {
    const nameEl = document.getElementById('card-district-name');
    const phoneEl = document.getElementById('card-district-phone');
    const btnEl = document.getElementById('btn-call-collectorate');

    if (nameEl) nameEl.textContent = `District Collectorate Helpline (${district.en})`;
    if (phoneEl) phoneEl.textContent = district.phone;
    if (btnEl) {
      const cleanPhone = district.phone.replace(/[^0-9]/g, '');
      btnEl.href = `tel:${cleanPhone}`;
      const btnText = btnEl.querySelector('.btn-call-text');
      if (btnText) btnText.textContent = `Call ${district.phone}`;
    }

    // Sync select dropdown
    const select = document.getElementById('urgent-district-select');
    if (select) {
      select.value = district.id;
    }
  }

  // Render Empty State when GPS is blocked
  function renderEmptyLocationState() {
    const categories = ['hospitals', 'ambulances', 'police', 'fire'];
    categories.forEach(cat => {
      const grid = document.getElementById(`grid-${cat}`);
      const badge = document.getElementById(`badge-${cat}-count`);
      if (badge) {
        badge.textContent = 'Location Needed';
        badge.style.background = '#fef2f2';
        badge.style.color = '#b91c1c';
      }
      if (grid) {
        grid.innerHTML = `
          <div class="service-empty-fallback">
            <h4 class="service-empty-title">Location Access Required</h4>
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
      url += `lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=35&limit=30`;
    } else if (districtId) {
      url += `districtId=${encodeURIComponent(districtId)}&radius=35&limit=30`;
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

    // Build items list
    let preparedItems = [...items];

    // For Ambulances category: ensure dedicated 108 Emergency Ambulance is pinned at top
    if (categoryKey === 'ambulances') {
      const dedicated108 = {
        id: 'state_108_priority_ambulance',
        name: '108 Free Emergency Ambulance Network (TNHSP / EMRI)',
        service_type: 'ambulance',
        facility_type: 'State Emergency Ambulance',
        ownership_type: 'government',
        emergency_available: true,
        formattedDistance: 'Statewide Priority Dispatch',
        distanceKm: 0,
        address: 'Central 108 Emergency Response Dispatch Network, Tamil Nadu',
        phone: '108',
        source_name: 'TNHSP 108 Emergency System',
        directionsUrl: currentCoordinates
          ? `https://www.google.com/maps/dir/?api=1&destination=${currentCoordinates.lat},${currentCoordinates.lng}`
          : 'https://tnhealth.tn.gov.in',
        isDedicated108: true
      };

      // Filter out duplicate generic 108 records if any, then prepend premier card
      preparedItems = [
        dedicated108,
        ...preparedItems.filter(i => i.phone !== '108' || (i.name && !i.name.includes('TNHSP / EMRI')))
      ];
    }

    const limit = categoryLimits[categoryKey] || 6;
    const displayedItems = preparedItems.slice(0, limit);

    // Update count badge
    if (badge) {
      if (preparedItems.length === 0) {
        badge.textContent = 'None in range';
        badge.style.background = '#fef2f2';
        badge.style.color = '#b91c1c';
      } else {
        badge.textContent = `${preparedItems.length} nearby`;
        badge.style.background = '#ecfdf5';
        badge.style.color = '#047857';
      }
    }

    // Fallback if empty
    if (preparedItems.length === 0) {
      let fallbackNumber = '112';
      let fallbackLabel = 'Call 112 Unified Emergency';
      let fallbackDesc = 'No verified local services found within search range.';

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

    // Render cards with complete vertical hierarchy & badges:
    // Badges Row (Facility Type + Ownership) -> Emergency Status -> Name -> Distance -> Address -> Source -> Actions
    grid.innerHTML = displayedItems.map(item => {
      const cleanPhone = item.phone ? item.phone.replace(/[^0-9]/g, '') : null;
      const phoneDisplay = item.phone ? item.phone : 'Local number unavailable';

      // Fallback dialing rules (never replace private ambulance with 108!)
      let dialHref = cleanPhone
        ? `tel:${cleanPhone}`
        : (serviceType === 'police_station' ? 'tel:100' : (serviceType === 'fire_station' ? 'tel:101' : 'tel:108'));
      let callLabel = cleanPhone
        ? `Call ${phoneDisplay}`
        : (serviceType === 'police_station' ? 'Call 100 Police' : (serviceType === 'fire_station' ? 'Call 101 Fire' : 'Call 108 Ambulance'));

      if (item.isDedicated108) {
        dialHref = 'tel:108';
        callLabel = 'Call 108 (Toll-Free)';
      }

      let rawSource = item.source_name ? item.source_name.trim() : 'Verified Directory';
      let cleanSource = rawSource.replace(/^verified\s*source\s*:\s*/i, '').replace(/^source\s*:\s*/i, '').trim();
      let sourceDisplay = `Source: ${cleanSource}`;

      // Facility Type Badge (Clinic explicitly distinguished)
      const isClinic = item.service_type === 'clinic' || (item.facility_type && item.facility_type.toLowerCase().includes('clinic'));
      const facilityBadgeHtml = isClinic
        ? `<span class="badge-facility-type badge-facility-clinic"><i class="fa-solid fa-stethoscope"></i> Clinic / Health Centre</span>`
        : (item.facility_type
            ? `<span class="badge-facility-type"><i class="fa-solid fa-building-circle-check"></i> ${escapeHtml(item.facility_type)}</span>`
            : '');

      // Ownership Badge (Government vs Private vs Trust/NGO)
      const ownType = (item.ownership_type || 'government').toLowerCase();
      let ownLabel = 'Government';
      let ownClass = 'ownership-government';
      if (ownType === 'private') {
        ownLabel = 'Private';
        ownClass = 'ownership-private';
      } else if (ownType === 'trust' || ownType === 'ngo') {
        ownLabel = 'Trust / NGO';
        ownClass = 'ownership-trust';
      }
      const ownershipBadgeHtml = `<span class="badge-ownership ${ownClass}">${ownLabel}</span>`;

      // Emergency Capability Badge (only on hospitals/clinics)
      let emergencyBadgeHtml = '';
      if (item.service_type === 'hospital' || item.service_type === 'clinic') {
        if (item.emergency_available) {
          emergencyBadgeHtml = `<div class="badge-emergency-status status-verified"><i class="fa-solid fa-circle-check"></i> Emergency services available</div>`;
        } else {
          emergencyBadgeHtml = `<div class="badge-emergency-status status-unverified"><i class="fa-solid fa-circle-info"></i> Emergency availability not verified</div>`;
        }
      }

      const cardDedicatedClass = item.isDedicated108 ? 'service-card-dedicated-108' : '';

      return `
        <div class="service-card ${cardDedicatedClass}" data-service-id="${item.id}">
          <div class="service-card-body">
            <div class="service-badges-row">
              ${item.isDedicated108 ? '<span class="badge-dedicated-108"><i class="fa-solid fa-star"></i> Free State Emergency</span>' : ''}
              ${facilityBadgeHtml}
              ${ownershipBadgeHtml}
            </div>

            ${emergencyBadgeHtml}

            <h4 class="service-name">${escapeHtml(item.name)}</h4>

            <div class="service-distance-wrap">
              <span class="service-distance-badge"><i class="fa-solid fa-location-arrow"></i> ${escapeHtml(item.formattedDistance)}</span>
            </div>

            <p class="service-address">${escapeHtml(item.address)}</p>

            <div class="service-source-tag">
              <span class="service-source-text">${escapeHtml(sourceDisplay)}</span>
            </div>
          </div>

          <div class="service-actions-row">
            <a href="${dialHref}" class="btn-service-call" title="Call ${escapeHtml(item.name)}">
              <i class="fa-solid fa-phone"></i>
              <span class="btn-call-text">${escapeHtml(callLabel)}</span>
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
      if (preparedItems.length > 6) {
        moreWrap.style.display = 'block';
        if (limit >= preparedItems.length) {
          moreText.textContent = `Show Fewer ${categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1)}`;
        } else {
          moreText.textContent = `View More (${preparedItems.length - limit} more available)`;
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
      categoryLimits[categoryKey] = 6; // Collapse back to default 6
    } else {
      categoryLimits[categoryKey] = items.length + 1; // Expand all
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
