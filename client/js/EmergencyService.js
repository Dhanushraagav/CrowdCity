/**
 * CrowdCity AI v2.5 - Emergency Services API Module
 * Uses free Overpass API (OpenStreetMap) for location-based nearby hospitals, police, & fire stations.
 * Includes Haversine distance calculator and local session caching.
 */

window.EmergencyService = (function() {
  const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
  const sessionCache = new Map();

  /**
   * Calculate distance between two lat/lng coordinates in kilometers (Haversine formula)
   */
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return parseFloat(d.toFixed(1));
  }

  /**
   * Overpass Query constructor
   * Amenity types: hospital, clinic, police, fire_station
   */
  function buildOverpassQuery(lat, lng, radiusMeters = 8000) {
    return `
      [out:json][timeout:15];
      (
        node["amenity"="hospital"](around:${radiusMeters},${lat},${lng});
        way["amenity"="hospital"](around:${radiusMeters},${lat},${lng});
        node["amenity"="clinic"](around:${radiusMeters},${lat},${lng});
        node["amenity"="police"](around:${radiusMeters},${lat},${lng});
        way["amenity"="police"](around:${radiusMeters},${lat},${lng});
        node["amenity"="fire_station"](around:${radiusMeters},${lat},${lng});
        way["amenity"="fire_station"](around:${radiusMeters},${lat},${lng});
      );
      out center 35;
    `;
  }

  /**
   * Fallback responder generator if Overpass API request fails or returns no nodes
   */
  function getFallbackResponders(lat, lng) {
    return [
      {
        id: 'fb-1',
        name: 'Government General Hospital Emergency Center',
        type: 'hospital',
        lat: lat + 0.012,
        lng: lng + 0.008,
        distance: 1.4,
        address: 'Civic HQ Medical Zone, Central Avenue',
        phone: '108',
        isEmergency: true
      },
      {
        id: 'fb-2',
        name: 'City Central Police Station',
        type: 'police',
        lat: lat - 0.008,
        lng: lng - 0.005,
        distance: 0.9,
        address: 'Sub-Division Police HQ, Station Road',
        phone: '100',
        isEmergency: true
      },
      {
        id: 'fb-3',
        name: 'Municipal Main Fire & Rescue Station',
        type: 'fire',
        lat: lat + 0.018,
        lng: lng - 0.011,
        distance: 2.1,
        address: 'Disaster Relief Complex, Bypass Road',
        phone: '101',
        isEmergency: true
      },
      {
        id: 'fb-4',
        name: 'District Multi-Specialty Trauma Care Hospital',
        type: 'hospital',
        lat: lat - 0.025,
        lng: lng + 0.015,
        distance: 3.2,
        address: 'State Medical College Campus',
        phone: '112',
        isEmergency: true
      }
    ];
  }

  /**
   * Fetch nearby emergency amenities from Overpass API
   */
  async function fetchNearbyEmergencyServices(lat, lng) {
    const cacheKey = `${lat.toFixed(3)}_${lng.toFixed(3)}`;
    if (sessionCache.has(cacheKey)) {
      return sessionCache.get(cacheKey);
    }

    try {
      const query = buildOverpassQuery(lat, lng);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const response = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Overpass API response error: ${response.status}`);
      }

      const data = await response.json();
      const elements = data.elements || [];

      if (elements.length === 0) {
        const fallbacks = getFallbackResponders(lat, lng);
        sessionCache.set(cacheKey, fallbacks);
        return fallbacks;
      }

      const formatted = elements.map(item => {
        const itemLat = item.lat || (item.center && item.center.lat) || lat;
        const itemLng = item.lon || (item.center && item.center.lon) || lng;
        const tags = item.tags || {};
        
        let type = 'hospital';
        if (tags.amenity === 'police') type = 'police';
        else if (tags.amenity === 'fire_station') type = 'fire';

        const name = tags.name || tags['name:en'] || (
          type === 'hospital' ? 'Emergency Medical Center' :
          type === 'police' ? 'Local Police Station' : 'Fire & Rescue Station'
        );

        const address = [tags['addr:street'], tags['addr:suburb'], tags['addr:city']]
          .filter(Boolean).join(', ') || 'Address details available on map';

        const phone = tags.phone || tags['contact:phone'] || (
          type === 'hospital' ? '108' :
          type === 'police' ? '100' : '101'
        );

        const distance = calculateDistance(lat, lng, itemLat, itemLng);

        return {
          id: item.id,
          name,
          type,
          lat: itemLat,
          lng: itemLng,
          distance,
          address,
          phone,
          isEmergency: true
        };
      });

      // Sort by distance ascending
      formatted.sort((a, b) => a.distance - b.distance);

      sessionCache.set(cacheKey, formatted);
      return formatted;
    } catch (err) {
      console.warn('[EmergencyService] Overpass API failed or timed out. Serving local fallback responder list:', err.message);
      const fallbacks = getFallbackResponders(lat, lng);
      sessionCache.set(cacheKey, fallbacks);
      return fallbacks;
    }
  }

  return {
    calculateDistance,
    fetchNearbyEmergencyServices,
    getFallbackResponders
  };
})();
