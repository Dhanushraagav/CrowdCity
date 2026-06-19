/**
 * CrowdCity AI - Service Area Validation Service (Client-Side)
 * Keeps validation modular so additional states can be enabled in the future.
 */

(function(window) {
  'use strict';

  // Configured allowed states
  const ALLOWED_STATES = ['Tamil Nadu'];

  // Bounding boxes for allowed states (approximate, used as a network fallback)
  const STATE_BOUNDING_BOXES = {
    'Tamil Nadu': {
      minLat: 8.0,
      maxLat: 13.6,
      minLng: 76.0,
      maxLng: 80.5
    }
  };

  /**
   * Helper to check if a state name is allowed
   */
  function isStateAllowed(stateName) {
    if (!stateName) return false;
    const cleanState = stateName.trim().toLowerCase();
    return ALLOWED_STATES.some(allowed => allowed.toLowerCase() === cleanState);
  }

  /**
   * Helper to check if coordinates are inside any allowed state's bounding box
   */
  function isInsideAnyBoundingBox(lat, lng) {
    for (const state of ALLOWED_STATES) {
      const bbox = STATE_BOUNDING_BOXES[state];
      if (bbox) {
        if (lat >= bbox.minLat && lat <= bbox.maxLat && lng >= bbox.minLng && lng <= bbox.maxLng) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Validate coordinates using Nominatim reverse geocoding with bounding box fallback.
   * @param {number} lat 
   * @param {number} lng 
   * @returns {Promise<{isValid: boolean, state: string, fallbackUsed: boolean}>}
   */
  async function validateCoordinates(lat, lng) {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return { isValid: false, state: '', fallbackUsed: false };
    }

    try {
      // Set a timeout for Nominatim request to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${parsedLat}&lon=${parsedLng}`, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'CrowdCity-AI-Civic-Tech-Client'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Nominatim reverse geocoding failed');
      }

      const data = await response.json();
      if (data && data.address) {
        const state = data.address.state || data.address.province || data.address.state_district || '';
        const country = data.address.country || '';
        
        console.log(`[ServiceArea] Resolved state: "${state}", country: "${country}"`);
        
        // If state is recognized and allowed
        if (isStateAllowed(state)) {
          return { isValid: true, state, fallbackUsed: false };
        }
        
        // Handle specific case where Nominatim doesn't return state but we are inside boundaries
        if (!state && country === 'India' && isInsideAnyBoundingBox(parsedLat, parsedLng)) {
          return { isValid: true, state: 'Tamil Nadu (Assumed)', fallbackUsed: true };
        }

        return { isValid: false, state, fallbackUsed: false };
      }

      throw new Error('Invalid address structure in Nominatim response');
    } catch (err) {
      console.warn('[ServiceArea] Reverse geocoding failed or timed out. Falling back to bounding box validation.', err);
      // Fallback: check if coordinates fall within Tamil Nadu's bounding box
      const isInside = isInsideAnyBoundingBox(parsedLat, parsedLng);
      return { isValid: isInside, state: isInside ? 'Tamil Nadu (Fallback)' : 'Outside Service Area', fallbackUsed: true };
    }
  }

  /**
   * Validate a typed address text using Nominatim search API.
   * @param {string} addressText 
   * @returns {Promise<{isValid: boolean, lat?: number, lng?: number, displayName?: string, errorMsg?: string}>}
   */
  async function validateAddressText(addressText) {
    if (!addressText || addressText.trim().length < 5) {
      return { isValid: false, errorMsg: 'Please enter a detailed address to search.' };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const encodedAddr = encodeURIComponent(addressText.trim());
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddr}&addressdetails=1&limit=1`, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'CrowdCity-AI-Civic-Tech-Client'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Nominatim forward search failed');
      }

      const data = await response.json();
      if (data && data.length > 0) {
        const result = data[0];
        const state = result.address?.state || result.address?.province || result.address?.state_district || '';
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);

        console.log(`[ServiceArea] Search resolved: lat=${lat}, lng=${lng}, state="${state}"`);

        if (isStateAllowed(state)) {
          return { isValid: true, lat, lng, displayName: result.display_name };
        }

        // Bounding box validation fallback for untranslated/unrecognized state names
        if (isInsideAnyBoundingBox(lat, lng)) {
          return { isValid: true, lat, lng, displayName: result.display_name };
        }

        return { isValid: false, errorMsg: 'Currently, CrowdCity AI supports reporting only within Tamil Nadu. We are expanding to other states soon.' };
      }

      return { isValid: false, errorMsg: 'Could not resolve the entered address. Please search again or pinpoint the location on the map.' };
    } catch (err) {
      console.error('[ServiceArea] Forward geocoding failed:', err);
      return { isValid: false, errorMsg: 'Geocoding service is currently unavailable. Please pin your location directly on the map.' };
    }
  }

  // Export to window object
  window.ServiceArea = {
    ALLOWED_STATES,
    isStateAllowed,
    validateCoordinates,
    validateAddressText
  };

})(window);
