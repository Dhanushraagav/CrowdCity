/**
 * emergencyService.js
 * 
 * Location-first emergency services discovery engine for CrowdCity AI.
 * Discovers nearby verified hospitals, ambulances, police stations, and fire stations
 * across Tamil Nadu using exact geographic coordinates (Haversine calculation).
 * 
 * Sources:
 * - Tamil Nadu Health & Family Welfare / HMIS (https://tnhealth.tn.gov.in)
 * - TNHSP 108 Emergency Ambulance System
 * - Tamil Nadu Police Directorate (https://eservices.tnpolice.gov.in)
 * - Tamil Nadu Fire and Rescue Services (https://tnfrs.tn.gov.in)
 * - TNGIS Spatial Asset Directory (https://tngis.tn.gov.in)
 * 
 * Privacy & Compliance:
 * - Coordinates are processed in-memory for proximity distance calculation only.
 * - User GPS coordinates are NEVER stored in database or logged to persistent storage.
 * - Zero hallucinated facilities, zero fake coordinates, zero fabricated phone numbers.
 */

import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';
import { AUTHORITATIVE_EMERGENCY_SERVICES } from '../data/authoritativeEmergencyServices.js';
import { TN_DISTRICTS, getDistrictById } from '../config/districtsConfig.js';

// Cache for authoritative directory records (15 minutes)
let memoryCache = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Haversine formula to calculate great-circle distance between two points in km
 */
export function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format distance cleanly (e.g., "850 m" or "2.4 km")
 */
export function formatDistance(distanceKm) {
  if (typeof distanceKm !== 'number' || isNaN(distanceKm)) return '';
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Standard Google Maps directions URL with destination lat/lng
 */
export function getDirectionsUrl(destLat, destLng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;
}

/**
 * Fetch all active emergency services from Supabase or fallback to authoritative dataset
 */
export async function getAllEmergencyServices() {
  const now = Date.now();
  if (memoryCache && (now - lastCacheTime < CACHE_TTL_MS)) {
    return memoryCache;
  }

  // 1. Try Supabase query
  try {
    const { data, error } = await supabase
      .from('emergency_services')
      .select('*')
      .eq('is_active', true);

    if (!error && Array.isArray(data) && data.length > 0) {
      memoryCache = data;
      lastCacheTime = now;
      return memoryCache;
    }
    if (error) {
      logger.warn('[EmergencyService] Supabase query notice (falling back to authoritative dataset): %s', error.message);
    }
  } catch (err) {
    logger.warn('[EmergencyService] Error fetching from Supabase: %s', err.message);
  }

  // 2. Authoritative Fallback Dataset
  memoryCache = AUTHORITATIVE_EMERGENCY_SERVICES;
  lastCacheTime = now;
  return memoryCache;
}

/**
 * Find nearby emergency services based on coordinates or manual district selection
 * 
 * @param {Object} params
 * @param {number} params.latitude User's current latitude
 * @param {number} params.longitude User's current longitude
 * @param {string} [params.districtId] Optional manual district selection fallback
 * @param {string} [params.serviceType] Optional filter ('hospital', 'ambulance', 'police_station', 'fire_station')
 * @param {number} [params.radiusKm=35] Search radius in kilometers (auto-expands if sparse)
 * @param {number} [params.limit=5] Maximum results to return per category
 */
export async function getNearbyEmergencyServices({
  latitude,
  longitude,
  districtId,
  serviceType,
  radiusKm = 35,
  limit = 5
}) {
  let targetLat = parseFloat(latitude);
  let targetLng = parseFloat(longitude);
  let resolvedDistrict = null;

  // If coordinates not provided or invalid, resolve from manual districtId
  if (isNaN(targetLat) || isNaN(targetLng)) {
    if (districtId) {
      const distMatch = TN_DISTRICTS.find(d =>
        d.id.toLowerCase() === districtId.toLowerCase() ||
        d.name.toLowerCase() === districtId.toLowerCase() ||
        d.code.toLowerCase() === districtId.toLowerCase()
      );
      if (distMatch) {
        targetLat = distMatch.lat;
        targetLng = distMatch.lng;
        resolvedDistrict = distMatch;
      }
    }
  }

  if (isNaN(targetLat) || isNaN(targetLng)) {
    return {
      success: false,
      error: 'Valid coordinates (latitude, longitude) or a valid districtId are required.',
      location: null,
      results: {
        hospitals: [],
        ambulances: [],
        police_stations: [],
        fire_stations: []
      },
      counts: { hospitals: 0, ambulances: 0, police_stations: 0, fire_stations: 0 },
      hasMore: { hospitals: false, ambulances: false, police_stations: false, fire_stations: false }
    };
  }

  // If district wasn't resolved yet, find nearest district centroid
  if (!resolvedDistrict) {
    let nearestDist = null;
    let minD = Infinity;
    for (const d of TN_DISTRICTS) {
      const dist = calculateHaversineDistanceKm(targetLat, targetLng, d.lat, d.lng);
      if (dist < minD) {
        minD = dist;
        nearestDist = d;
      }
    }
    resolvedDistrict = nearestDist;
  }

  const allServices = await getAllEmergencyServices();

  // Calculate distance for all services
  const mapped = allServices.map(item => {
    const dKm = calculateHaversineDistanceKm(targetLat, targetLng, item.latitude, item.longitude);
    return {
      id: item.id,
      name: item.name,
      service_type: item.service_type,
      latitude: item.latitude,
      longitude: item.longitude,
      address: item.address,
      phone: item.phone,
      district_id: item.district_id,
      source_name: item.source_name,
      source_url: item.source_url,
      is_verified: item.is_verified,
      distanceKm: Math.round(dKm * 10) / 10,
      formattedDistance: formatDistance(dKm),
      directionsUrl: getDirectionsUrl(item.latitude, item.longitude)
    };
  });

  // Sort strictly nearest first
  mapped.sort((a, b) => a.distanceKm - b.distanceKm);

  // Group by category
  const groups = {
    hospitals: mapped.filter(s => s.service_type === 'hospital'),
    ambulances: mapped.filter(s => s.service_type === 'ambulance'),
    police_stations: mapped.filter(s => s.service_type === 'police_station'),
    fire_stations: mapped.filter(s => s.service_type === 'fire_station')
  };

  // Filter within radius if applicable, but ensure at least nearest items exist if overall dataset has them
  const maxSearchRadius = Math.max(radiusKm, 100);

  const filterAndLimit = (list) => {
    // First try strict radius
    let inRadius = list.filter(item => item.distanceKm <= radiusKm);
    // If sparse (e.g. rural boundary), expand up to maxSearchRadius
    if (inRadius.length === 0) {
      inRadius = list.filter(item => item.distanceKm <= maxSearchRadius);
    }
    // If still 0, return top 2 nearest regardless so citizen has emergency recourse
    if (inRadius.length === 0 && list.length > 0) {
      inRadius = list.slice(0, 2);
    }

    const totalCount = inRadius.length;
    const returnedItems = inRadius.slice(0, limit);
    return {
      items: returnedItems,
      totalCount,
      hasMore: totalCount > limit
    };
  };

  const hospitalsResult = filterAndLimit(groups.hospitals);
  const ambulancesResult = filterAndLimit(groups.ambulances);
  const policeResult = filterAndLimit(groups.police_stations);
  const fireResult = filterAndLimit(groups.fire_stations);

  // If single serviceType requested
  if (serviceType) {
    let key = 'hospitals';
    if (serviceType === 'ambulance') key = 'ambulances';
    else if (serviceType === 'police_station') key = 'police_stations';
    else if (serviceType === 'fire_station') key = 'fire_stations';

    const selectedGroup = groups[key] || [];
    const res = filterAndLimit(selectedGroup);
    return {
      success: true,
      location: {
        latitude: targetLat,
        longitude: targetLng,
        district: resolvedDistrict ? resolvedDistrict.name : 'Tamil Nadu',
        districtId: resolvedDistrict ? resolvedDistrict.id : 'tamil_nadu'
      },
      results: { [key]: res.items },
      counts: { [key]: res.totalCount },
      hasMore: { [key]: res.hasMore }
    };
  }

  return {
    success: true,
    location: {
      latitude: targetLat,
      longitude: targetLng,
      district: resolvedDistrict ? resolvedDistrict.name : 'Tamil Nadu',
      districtTa: resolvedDistrict ? resolvedDistrict.nameTa : 'தமிழ்நாடு',
      districtId: resolvedDistrict ? resolvedDistrict.id : 'tamil_nadu'
    },
    results: {
      hospitals: hospitalsResult.items,
      ambulances: ambulancesResult.items,
      police_stations: policeResult.items,
      fire_stations: fireResult.items
    },
    counts: {
      hospitals: hospitalsResult.totalCount,
      ambulances: ambulancesResult.totalCount,
      police_stations: policeResult.totalCount,
      fire_stations: fireResult.totalCount
    },
    hasMore: {
      hospitals: hospitalsResult.hasMore,
      ambulances: ambulancesResult.hasMore,
      police_stations: policeResult.hasMore,
      fire_stations: fireResult.hasMore
    }
  };
}

/**
 * Returns official verification status and source attributions
 */
export function getOfficialSourceStatus() {
  return {
    sources: [
      {
        authority: 'Tamil Nadu Health and Family Welfare Department / HMIS',
        url: 'https://tnhealth.tn.gov.in',
        domain: 'Medical Colleges, District Headquarters Hospitals & CHCs'
      },
      {
        authority: 'Tamil Nadu Health Systems Project (TNHSP) 108 EMRI',
        url: 'https://tnhealth.tn.gov.in',
        domain: 'Emergency Ambulance Response Network'
      },
      {
        authority: 'Tamil Nadu Police Directorate',
        url: 'https://eservices.tnpolice.gov.in',
        domain: 'City Commissionerates & Taluk Police Stations'
      },
      {
        authority: 'Tamil Nadu Fire and Rescue Services (TNFRS)',
        url: 'https://tnfrs.tn.gov.in',
        domain: 'Divisional & Taluk Fire and Rescue Stations'
      },
      {
        authority: 'TNGIS Central Spatial Data Platform',
        url: 'https://tngis.tn.gov.in',
        domain: 'Government Asset Spatial Coordinates'
      }
    ],
    verifiedAt: '2026-03-01T00:00:00.000Z',
    compliance: 'Zero AI-generated records; strict Haversine sorting; no permanent storage of citizen GPS coordinates.'
  };
}

export default {
  calculateHaversineDistanceKm,
  formatDistance,
  getDirectionsUrl,
  getAllEmergencyServices,
  getNearbyEmergencyServices,
  getOfficialSourceStatus
};
