/**
 * urgent-action.js
 * 
 * CrowdCity AI - Dedicated Urgent / Immediate Action Controller
 * Direct access to verified official emergency helplines and live GPS coordinates across Tamil Nadu.
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

  let currentCoordinatesString = '';
  let activeDistrict = null;

  // Initialize UI on load
  document.addEventListener('DOMContentLoaded', () => {
    initMenuToggle();
    populateDistrictSelect();
    detectEmergencyLocation();
  });

  // Setup Mobile Menu Toggle
  function initMenuToggle() {
    const toggleBtn = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.app-sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }
  }

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

  // Handle District Selector Change
  window.handleDistrictChange = function (districtId) {
    if (!districtId) return;
    const found = OFFICIAL_DISTRICTS.find(d => d.id === districtId || d.en.toLowerCase() === districtId.toLowerCase());
    if (found) {
      activeDistrict = found;
      updateDistrictCard(found);
      const locDisplay = document.getElementById('urgent-loc-display');
      const locTitle = document.getElementById('urgent-loc-status-title');
      if (locTitle) locTitle.textContent = 'Selected District';
      if (locDisplay && !currentCoordinatesString) {
        locDisplay.textContent = `${found.en} (${found.ta}) - Tamil Nadu`;
      }
    }
  };

  // Update District Collectorate Card in UI
  function updateDistrictCard(district) {
    const titleEl = document.getElementById('district-collectorate-title');
    const subEl = document.getElementById('district-collectorate-sub');
    const phoneBtn = document.getElementById('district-collectorate-phone-btn');
    const phoneLabel = document.getElementById('district-collectorate-phone-label');
    const phoneVal = document.getElementById('district-collectorate-phone-val');

    if (titleEl) {
      titleEl.textContent = `${district.en} District Collectorate & Emergency Control`;
    }
    if (subEl) {
      subEl.textContent = `Official administrative disaster and emergency control room for ${district.en}.`;
    }
    if (phoneBtn && phoneVal) {
      const cleanPhone = district.phone.replace(/[^0-9]/g, '');
      phoneBtn.href = `tel:${cleanPhone}`;
      phoneVal.textContent = district.phone;
    }
    if (phoneLabel) {
      phoneLabel.textContent = `Call ${district.en} Control Room`;
    }

    const select = document.getElementById('urgent-district-select');
    if (select && select.value !== district.id) {
      select.value = district.id;
    }
  }

  // Location Detection Flow
  async function detectEmergencyLocation() {
    const locDisplay = document.getElementById('urgent-loc-display');
    const locTitle = document.getElementById('urgent-loc-status-title');
    const locIcon = document.getElementById('urgent-loc-icon');

    if (locDisplay) locDisplay.textContent = 'Acquiring live GPS coordinates...';
    if (locTitle) locTitle.textContent = 'Emergency Location';

    if (!('geolocation' in navigator)) {
      handleLocationFallback('Geolocation is not supported by this browser.');
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 30000
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = Math.round(position.coords.accuracy || 0);

        // Format Coordinates
        const latRef = lat >= 0 ? 'N' : 'S';
        const lngRef = lng >= 0 ? 'E' : 'W';
        const formattedCoords = `${Math.abs(lat).toFixed(4)}° ${latRef}, ${Math.abs(lng).toFixed(4)}° ${lngRef}`;

        // Find nearest district
        let nearestDistrict = null;
        if (window.CrowdCityLocation && typeof window.CrowdCityLocation.findNearestDistrictByCoords === 'function') {
          nearestDistrict = window.CrowdCityLocation.findNearestDistrictByCoords(lat, lng);
        }

        const districtName = nearestDistrict || 'Tamil Nadu';
        currentCoordinatesString = `${formattedCoords} (${districtName}, GPS Accuracy: ±${accuracy}m)`;

        if (locTitle) locTitle.textContent = 'Live GPS Coordinates (Active)';
        if (locDisplay) locDisplay.textContent = `${formattedCoords} • ${districtName}`;
        if (locIcon) {
          locIcon.style.background = 'rgba(16, 185, 129, 0.15)';
          locIcon.style.color = '#059669';
          locIcon.innerHTML = '<i class="fa-solid fa-location-dot"></i>';
        }

        // Match district in official list
        if (nearestDistrict) {
          const match = OFFICIAL_DISTRICTS.find(d => d.en.toLowerCase() === nearestDistrict.toLowerCase());
          if (match) {
            activeDistrict = match;
            updateDistrictCard(match);
          }
        }
      },
      (error) => {
        let msg = 'Live location permission unavailable.';
        if (error.code === 1) msg = 'Location permission denied by user.';
        else if (error.code === 2) msg = 'Location signal unavailable.';
        else if (error.code === 3) msg = 'GPS acquisition timed out.';
        handleLocationFallback(msg);
      },
      options
    );
  }

  // Location Fallback without Blocking or Hardcoding
  function handleLocationFallback(reason) {
    const locDisplay = document.getElementById('urgent-loc-display');
    const locTitle = document.getElementById('urgent-loc-status-title');
    const locIcon = document.getElementById('urgent-loc-icon');

    if (locTitle) locTitle.textContent = 'Manual District Location';
    if (locIcon) {
      locIcon.style.background = 'rgba(239, 68, 68, 0.12)';
      locIcon.style.color = '#dc2626';
      locIcon.innerHTML = '<i class="fa-solid fa-location-pin"></i>';
    }

    // Check if user has saved district in storage or profile
    let savedDistrict = null;
    if (window.CrowdCityLocation && typeof window.CrowdCityLocation.getSavedUserDistrict === 'function') {
      savedDistrict = window.CrowdCityLocation.getSavedUserDistrict();
    } else {
      savedDistrict = localStorage.getItem('user_district') || localStorage.getItem('crowdcity_user_district');
    }

    if (savedDistrict) {
      const match = OFFICIAL_DISTRICTS.find(d => d.en.toLowerCase() === savedDistrict.toLowerCase() || d.id === savedDistrict.toLowerCase());
      if (match) {
        activeDistrict = match;
        updateDistrictCard(match);
        if (locDisplay) locDisplay.textContent = `${match.en} (${match.ta}) - Saved District`;
        return;
      }
    }

    // Default to prompt without picking any fake/hardcoded city
    if (locDisplay) {
      locDisplay.textContent = 'Please select your district from the dropdown';
    }
  }

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
        setTimeout(() => {
          copyText.textContent = originalText;
          copyBtn.style.background = '#0f172a';
        }, 2500);
      }
    }
  };

})();
