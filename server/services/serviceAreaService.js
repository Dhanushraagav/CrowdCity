import logger from '../config/logger.js';

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
 * Validate coordinates using Nominatim reverse geocoding on the backend.
 * Falls back to bounding box check if network is slow, offline, or rate-limited.
 * 
 * @param {number} lat 
 * @param {number} lng 
 * @returns {Promise<boolean>} True if coordinates are inside allowed service area
 */
export const validateServiceArea = async (lat, lng) => {
  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);

  if (isNaN(parsedLat) || isNaN(parsedLng)) {
    logger.warn(`[ServiceArea Backend] Invalid coordinate values: lat=${lat}, lng=${lng}`);
    return false;
  }

  // Pre-check bounding box. If coordinates are completely out of range (e.g. USA, Delhi),
  // reject immediately without wasting external API call quotas.
  if (!isInsideAnyBoundingBox(parsedLat, parsedLng)) {
    logger.info(`[ServiceArea Backend] Coordinates lat=${parsedLat}, lng=${parsedLng} rejected early (outside bounding boxes)`);
    return false;
  }

  try {
    // Attempt reverse geocoding to double check the exact state boundary (resolving borders, overlaps, etc.)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for API response

    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${parsedLat}&lon=${parsedLng}`, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'CrowdCity-AI-Civic-Tech-Server'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Nominatim returned status ${response.status}`);
    }

    const data = await response.json();
    if (data && data.address) {
      const state = data.address.state || data.address.province || data.address.state_district || '';
      const country = data.address.country || '';

      logger.info(`[ServiceArea Backend] Nominatim resolved coordinates to state: "${state}", country: "${country}"`);

      if (isStateAllowed(state)) {
        return true;
      }

      // If state name is missing but it is India and within the bounding box, accept it
      if (!state && country === 'India' && isInsideAnyBoundingBox(parsedLat, parsedLng)) {
        logger.info('[ServiceArea Backend] Assumed Tamil Nadu due to India country matching and bounding box presence.');
        return true;
      }

      logger.warn(`[ServiceArea Backend] Location inside bounding box but state "${state}" is not allowed.`);
      return false;
    }

    throw new Error('Nominatim response did not contain address metadata');
  } catch (err) {
    logger.error(`[ServiceArea Backend] Reverse geocoding failed or timed out: ${err.message}. Falling back to bounding box.`, err);
    // Fallback: trust bounding box check
    return isInsideAnyBoundingBox(parsedLat, parsedLng);
  }
};
