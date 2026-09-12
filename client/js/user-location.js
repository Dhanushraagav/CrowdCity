/**
 * user-location.js
 * 
 * CrowdCity Universal Client Location Service.
 * Detects citizen district across Tamil Nadu for personalized local experiences
 * (Weather Forecast, Power Outages, Local News, Civic Alerts) without manual search.
 * 
 * Sources (in priority order):
 * 1. Explicitly saved district in localStorage ('user_district' or 'crowdcity_user_district')
 * 2. Dashboard cached weather coordinates ('cc_weather_coords') via 38-district centroid match
 * 3. Dashboard cached weather district ('cc_weather_cache_en' / 'cc_weather_cache_ta')
 * 4. Citizen profile metadata ('cc_user_profile')
 * 5. Browser Geolocation API ('navigator.geolocation')
 * 
 * NO emojis. Strictly clean civic-grade engineering.
 */

(function(root) {
  'use strict';

  // Centroids for all 38 official districts of Tamil Nadu
  const TN_DISTRICTS_CENTROIDS = [
    { id: 'ariyalur', name: 'Ariyalur', lat: 11.1401, lng: 79.0786 },
    { id: 'chengalpattu', name: 'Chengalpattu', lat: 12.6841, lng: 79.9836 },
    { id: 'chennai', name: 'Chennai', lat: 13.0827, lng: 80.2707 },
    { id: 'coimbatore', name: 'Coimbatore', lat: 11.0168, lng: 76.9558 },
    { id: 'cuddalore', name: 'Cuddalore', lat: 11.7480, lng: 79.7714 },
    { id: 'dharmapuri', name: 'Dharmapuri', lat: 12.1211, lng: 78.1582 },
    { id: 'dindigul', name: 'Dindigul', lat: 10.3673, lng: 77.9803 },
    { id: 'erode', name: 'Erode', lat: 11.3410, lng: 77.7172 },
    { id: 'kallakurichi', name: 'Kallakurichi', lat: 11.7383, lng: 78.9639 },
    { id: 'kancheepuram', name: 'Kancheepuram', lat: 12.8342, lng: 79.7036 },
    { id: 'kanniyakumari', name: 'Kanniyakumari', lat: 8.0883, lng: 77.5385 },
    { id: 'karur', name: 'Karur', lat: 10.9601, lng: 78.0766 },
    { id: 'krishnagiri', name: 'Krishnagiri', lat: 12.5186, lng: 78.2137 },
    { id: 'madurai', name: 'Madurai', lat: 9.9252, lng: 78.1198 },
    { id: 'mayiladuthurai', name: 'Mayiladuthurai', lat: 11.1075, lng: 79.6524 },
    { id: 'nagapattinam', name: 'Nagapattinam', lat: 10.7672, lng: 79.8449 },
    { id: 'namakkal', name: 'Namakkal', lat: 11.2189, lng: 78.1674 },
    { id: 'nilgiris', name: 'Nilgiris', lat: 11.4102, lng: 76.6950 },
    { id: 'perambalur', name: 'Perambalur', lat: 11.2342, lng: 78.8820 },
    { id: 'pudukkottai', name: 'Pudukkottai', lat: 10.3797, lng: 78.8208 },
    { id: 'ramanathapuram', name: 'Ramanathapuram', lat: 9.3639, lng: 78.8395 },
    { id: 'ranipet', name: 'Ranipet', lat: 12.9298, lng: 79.3326 },
    { id: 'salem', name: 'Salem', lat: 11.6643, lng: 78.1460 },
    { id: 'sivaganga', name: 'Sivaganga', lat: 9.8433, lng: 78.4809 },
    { id: 'tenkasi', name: 'Tenkasi', lat: 8.9594, lng: 77.3152 },
    { id: 'thanjavur', name: 'Thanjavur', lat: 10.7870, lng: 79.1378 },
    { id: 'theni', name: 'Theni', lat: 10.0104, lng: 77.4768 },
    { id: 'thoothukudi', name: 'Thoothukudi', lat: 8.7642, lng: 78.1348 },
    { id: 'tiruchirappalli', name: 'Tiruchirappalli', lat: 10.7905, lng: 78.7047 },
    { id: 'tirunelveli', name: 'Tirunelveli', lat: 8.7139, lng: 77.7567 },
    { id: 'tirupathur', name: 'Tirupathur', lat: 12.4958, lng: 78.5678 },
    { id: 'tiruppur', name: 'Tiruppur', lat: 11.1085, lng: 77.3411 },
    { id: 'tiruvallur', name: 'Tiruvallur', lat: 13.1437, lng: 79.9083 },
    { id: 'tiruvannamalai', name: 'Tiruvannamalai', lat: 12.2253, lng: 79.0747 },
    { id: 'tiruvarur', name: 'Tiruvarur', lat: 10.7725, lng: 79.6365 },
    { id: 'vellore', name: 'Vellore', lat: 12.9165, lng: 79.1325 },
    { id: 'viluppuram', name: 'Viluppuram', lat: 11.9401, lng: 79.4861 },
    { id: 'virudhunagar', name: 'Virudhunagar', lat: 9.5872, lng: 77.9514 }
  ];

  // Common aliases and variations mapped to official district names
  const DISTRICT_ALIASES = {
    'kanchipuram': 'Kancheepuram',
    'kanyakumari': 'Kanniyakumari',
    'the nilgiris': 'Nilgiris',
    'ooty': 'Nilgiris',
    'udhagamandalam': 'Nilgiris',
    'trichy': 'Tiruchirappalli',
    'tiruchi': 'Tiruchirappalli',
    'tiruchirapalli': 'Tiruchirappalli',
    'tiruchirappally': 'Tiruchirappalli',
    'tiruchy': 'Tiruchirappalli',
    'kovai': 'Coimbatore',
    'madras': 'Chennai',
    'tuticorin': 'Thoothukudi',
    'tanjore': 'Thanjavur',
    'villupuram': 'Viluppuram',
    'tirupur': 'Tiruppur',
    'thiruppur': 'Tiruppur',
    'thiruvallur': 'Tiruvallur',
    'thiruvannamalai': 'Tiruvannamalai',
    'thiruvarur': 'Tiruvarur',
    'thirunelveli': 'Tirunelveli',
    'thirupathur': 'Tirupathur',
    'chengalpet': 'Chengalpattu',
    'ramnad': 'Ramanathapuram'
  };

  /**
   * Normalize an arbitrary location string into an official Tamil Nadu district name.
   */
  function normalizeDistrictName(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const clean = raw.trim().toLowerCase()
      .replace(/ district$/i, '')
      .replace(/ taluk$/i, '')
      .replace(/ corporation$/i, '')
      .replace(/ municipality$/i, '')
      .trim();

    // Check alias mapping
    if (DISTRICT_ALIASES[clean]) {
      return DISTRICT_ALIASES[clean];
    }

    // Direct match against official districts
    const match = TN_DISTRICTS_CENTROIDS.find(d => 
      d.id === clean || d.name.toLowerCase() === clean
    );
    if (match) return match.name;

    // Partial match (e.g. 'Chennai Central' -> 'Chennai')
    const partial = TN_DISTRICTS_CENTROIDS.find(d => 
      clean.includes(d.id) || clean.includes(d.name.toLowerCase())
    );
    if (partial) return partial.name;

    return null;
  }

  /**
   * Find nearest official Tamil Nadu district using geographic coordinates (Haversine formula).
   */
  function findNearestDistrictByCoords(lat, lng) {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) return null;

    let nearest = null;
    let minDistance = Infinity;

    for (const d of TN_DISTRICTS_CENTROIDS) {
      const dLat = (d.lat - parsedLat) * (Math.PI / 180);
      const dLng = (d.lng - parsedLng) * (Math.PI / 180);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(parsedLat * (Math.PI / 180)) * Math.cos(d.lat * (Math.PI / 180)) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const dist = 6371 * c; // km

      if (dist < minDistance) {
        minDistance = dist;
        nearest = d;
      }
    }

    return nearest ? nearest.name : null;
  }

  /**
   * Check all synchronous storage mechanisms for an already known district.
   */
  function getSavedUserDistrict() {
    try {
      // 1. Direct user_district key
      const direct = localStorage.getItem('user_district') || localStorage.getItem('crowdcity_user_district');
      if (direct && direct !== 'all' && direct !== 'Tamil Nadu') {
        const norm = normalizeDistrictName(direct);
        if (norm) return norm;
      }

      // 2. Weather cached coordinates (from citizen dashboard)
      const coordsStr = localStorage.getItem('cc_weather_coords');
      if (coordsStr) {
        try {
          const coords = JSON.parse(coordsStr);
          if (coords && coords.lat && coords.lon) {
            const nearest = findNearestDistrictByCoords(coords.lat, coords.lon);
            if (nearest) {
              localStorage.setItem('user_district', nearest);
              return nearest;
            }
          }
        } catch (e) {}
      }

      // 3. Weather cache (from citizen dashboard)
      const weatherCacheStr = localStorage.getItem('cc_weather_cache_en') || localStorage.getItem('cc_weather_cache_ta');
      if (weatherCacheStr) {
        try {
          const cache = JSON.parse(weatherCacheStr);
          if (cache && cache.district) {
            const norm = normalizeDistrictName(cache.district);
            if (norm) {
              localStorage.setItem('user_district', norm);
              return norm;
            }
          }
        } catch (e) {}
      }

      // 4. User Profile object
      const profileStr = localStorage.getItem('cc_user_profile');
      if (profileStr) {
        try {
          const p = JSON.parse(profileStr);
          const candidate = p.district || p.city || p.location || p.state_district;
          if (candidate) {
            const norm = normalizeDistrictName(candidate);
            if (norm) {
              localStorage.setItem('user_district', norm);
              return norm;
            }
          }
        } catch (e) {}
      }

      // 5. Auth session user metadata
      if (typeof window.getCurrentUser === 'function') {
        const u = window.getCurrentUser();
        const candidate = u?.district || u?.user_metadata?.district || u?.user_metadata?.city;
        if (candidate) {
          const norm = normalizeDistrictName(candidate);
          if (norm) {
            localStorage.setItem('user_district', norm);
            return norm;
          }
        }
      }
    } catch (err) {
      console.warn('[UserLocation] Synchronous storage check warning:', err);
    }

    return null;
  }

  /**
   * Actively detect citizen district.
   * If not already cached synchronously, attempts browser geolocation in non-blocking manner.
   * 
   * @param {Object} options
   * @param {number} options.timeoutMs - Geolocation timeout (default 3500ms)
   * @param {boolean} options.requestGps - Whether to trigger browser GPS if cache empty (default true)
   * @returns {Promise<string|null>} Resolved district name
   */
  async function detectUserDistrict(options = {}) {
    const timeoutMs = options.timeoutMs || 3500;
    const requestGps = options.requestGps !== false;

    // 1. Instant check
    const existing = getSavedUserDistrict();
    if (existing) {
      return existing;
    }

    // 2. Try browser geolocation
    if (requestGps && typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const districtFromGps = await new Promise((resolve) => {
          let hasResolved = false;
          const timer = setTimeout(() => {
            if (!hasResolved) {
              hasResolved = true;
              resolve(null);
            }
          }, timeoutMs);

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (hasResolved) return;
              hasResolved = true;
              clearTimeout(timer);
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              localStorage.setItem('cc_weather_coords', JSON.stringify({ lat, lon: lng, ts: Date.now() }));
              const nearest = findNearestDistrictByCoords(lat, lng);
              if (nearest) {
                localStorage.setItem('user_district', nearest);
                window.dispatchEvent(new CustomEvent('crowdcity:location_detected', {
                  detail: { district: nearest, lat, lng }
                }));
                resolve(nearest);
              } else {
                resolve(null);
              }
            },
            (err) => {
              if (hasResolved) return;
              hasResolved = true;
              clearTimeout(timer);
              resolve(null);
            },
            { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 600000 }
          );
        });

        if (districtFromGps) return districtFromGps;
      } catch (err) {
        console.warn('[UserLocation] Geolocation detection warning:', err);
      }
    }

    return null;
  }

  /**
   * Explicitly set or change the user's preferred district.
   */
  function setUserDistrict(districtName) {
    const norm = normalizeDistrictName(districtName);
    if (norm) {
      localStorage.setItem('user_district', norm);
      window.dispatchEvent(new CustomEvent('crowdcity:location_changed', {
        detail: { district: norm }
      }));
      return norm;
    }
    return null;
  }

  // Export to root (window in browser, global/module in Node)
  root.CrowdCityLocation = {
    TN_DISTRICTS_CENTROIDS,
    normalizeDistrictName,
    findNearestDistrictByCoords,
    getSavedUserDistrict,
    detectUserDistrict,
    setUserDistrict
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.CrowdCityLocation;
  }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
