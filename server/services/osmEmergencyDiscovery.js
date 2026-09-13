/**
 * osmEmergencyDiscovery.js
 * 
 * High-performance OpenStreetMap (Overpass API) Emergency Discovery Service for CrowdCity AI.
 * Queries live nearby real-world emergency services:
 * - Government & Private Hospitals, Multispeciality Centers, Nursing Homes
 * - Clinics & Primary Health Centers (explicitly distinguished from Hospitals)
 * - Ambulance Stations & Dispatch Hubs
 * - Police Stations & Outposts
 * - Fire & Rescue Stations
 * 
 * Performance & Reliability:
 * - Server-side geo-tile cache (in-memory + disk cache, 6 hours TTL)
 * - AbortController 3.5-second hard timeout
 * - Silent fallback to authoritative dataset if Overpass API is slow or unreachable
 * - Zero client-side API quota leaks
 */

import fs from 'fs';
import path from 'path';
import logger from '../config/logger.js';

// Tile cache TTL: 6 hours
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const memoryTileCache = new Map();

// Disk cache directory
const CACHE_DIR = path.resolve(process.cwd(), 'server', 'cache', 'osm_tiles');
try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch (e) {
  // Ignore disk cache dir creation errors
}

/**
 * Generate a consistent tile key from coordinates (approx 2.2km grid resolution)
 */
function getTileKey(lat, lon) {
  const roundLat = (Math.floor(lat * 50) / 50).toFixed(2);
  const roundLon = (Math.floor(lon * 50) / 50).toFixed(2);
  return `osm_tile_${roundLat}_${roundLon}`;
}

/**
 * Read tile from memory or disk cache
 */
function getCachedTile(tileKey) {
  const now = Date.now();

  // 1. Check in-memory cache
  if (memoryTileCache.has(tileKey)) {
    const entry = memoryTileCache.get(tileKey);
    if (now - entry.timestamp < CACHE_TTL_MS) {
      return entry.data;
    }
    memoryTileCache.delete(tileKey);
  }

  // 2. Check disk cache
  try {
    const diskPath = path.join(CACHE_DIR, `${tileKey}.json`);
    if (fs.existsSync(diskPath)) {
      const content = fs.readFileSync(diskPath, 'utf8');
      const parsed = JSON.parse(content);
      if (now - parsed.timestamp < CACHE_TTL_MS) {
        memoryTileCache.set(tileKey, parsed);
        return parsed.data;
      } else {
        fs.unlinkSync(diskPath);
      }
    }
  } catch (err) {
    // Disk read error - continue to fetch
  }

  return null;
}

/**
 * Write tile to memory and disk cache
 */
function setCachedTile(tileKey, data) {
  const entry = {
    timestamp: Date.now(),
    data
  };
  memoryTileCache.set(tileKey, entry);

  try {
    const diskPath = path.join(CACHE_DIR, `${tileKey}.json`);
    fs.writeFileSync(diskPath, JSON.stringify(entry), 'utf8');
  } catch (err) {
    // Disk write error ignored
  }
}

/**
 * Parse an Overpass element into a CrowdCity emergency service object
 */
function parseOverpassElement(element) {
  const tags = element.tags || {};
  const rawName = tags.name || tags['name:en'] || tags['name:ta'];

  // Skip unnamed elements or elements with test names
  if (!rawName || rawName.trim().length < 2) return null;
  const name = rawName.trim();

  // Get coordinates (node vs way/relation center)
  const lat = element.lat || (element.center && element.center.lat);
  const lon = element.lon || (element.center && element.center.lon);
  if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) return null;

  const amenity = tags.amenity;
  const emergencyTag = tags.emergency;

  let service_type = null;
  let facility_type = 'General Facility';
  let ownership_type = 'private';
  let operates_24x7 = false;
  let emergency_available = false;

  // Infer Ownership
  const operatorType = (tags['operator:type'] || tags.operator || '').toLowerCase();
  const nameLower = name.toLowerCase();

  if (
    operatorType.includes('government') ||
    operatorType.includes('public') ||
    /\b(government|govt|corporation|municipality)\b/i.test(name) ||
    nameLower.includes('tamil nadu government') ||
    /\bgh\b/i.test(name)
  ) {
    ownership_type = 'government';
  } else if (/\b(trust|mission|csi|foundation|charitable)\b/i.test(name)) {
    ownership_type = 'trust';
  } else {
    ownership_type = 'private';
  }

  // Determine Service and Facility Type
  if (amenity === 'clinic' || amenity === 'doctors') {
    // CLINIC — NEVER LABEL AS HOSPITAL
    service_type = 'clinic';
    facility_type = 'Clinic / Health Centre';
    emergency_available = false; // Clinics rarely have full 24x7 trauma emergency
  } else if (amenity === 'hospital') {
    service_type = 'hospital';
    if (nameLower.includes('dental')) {
      facility_type = ownership_type === 'government' ? 'Government Dental Hospital' : 'Speciality Hospital (Dental)';
      emergency_available = false;
    } else if (ownership_type === 'government') {
      if (nameLower.includes('medical college')) {
        facility_type = 'Government Medical College Hospital';
        emergency_available = true;
        operates_24x7 = true;
      } else if (nameLower.includes('headquarters') || nameLower.includes('gh')) {
        facility_type = 'District Headquarters Hospital';
        emergency_available = true;
        operates_24x7 = true;
      } else {
        facility_type = 'Government Hospital';
        emergency_available = true;
        operates_24x7 = true;
      }
    } else {
      if (nameLower.includes('multispeciality') || nameLower.includes('multi speciality') || nameLower.includes('super speciality')) {
        facility_type = 'Multispeciality Hospital';
      } else if (nameLower.includes('nursing home')) {
        facility_type = 'Nursing Home';
      } else if (nameLower.includes('maternity')) {
        facility_type = 'Speciality Hospital (Maternity)';
      } else if (nameLower.includes('eye')) {
        facility_type = 'Speciality Hospital (Eye)';
      } else {
        facility_type = 'Private Hospital';
      }

      // Check emergency capability
      if (
        tags.emergency === 'yes' ||
        tags['healthcare:speciality']?.includes('emergency') ||
        nameLower.includes('emergency') ||
        nameLower.includes('trauma') ||
        tags.opening_hours === '24/7'
      ) {
        emergency_available = true;
        operates_24x7 = true;
      } else {
        emergency_available = false; // Display as "Emergency availability not verified"
      }
    }
  } else if (amenity === 'police') {
    service_type = 'police_station';
    facility_type = 'Police Station';
    ownership_type = 'government';
    operates_24x7 = true;
    emergency_available = true;
  } else if (amenity === 'fire_station') {
    service_type = 'fire_station';
    facility_type = 'Fire & Rescue Station';
    ownership_type = 'government';
    operates_24x7 = true;
    emergency_available = true;
  } else if (emergencyTag === 'ambulance_station' || amenity === 'ambulance_station') {
    service_type = 'ambulance';
    facility_type = 'Ambulance Station';
    operates_24x7 = true;
    emergency_available = true;
  } else {
    return null;
  }

  // Address construction
  const addrParts = [];
  if (tags['addr:street']) addrParts.push(tags['addr:street']);
  if (tags['addr:suburb']) addrParts.push(tags['addr:suburb']);
  if (tags['addr:city']) addrParts.push(tags['addr:city']);
  if (tags['addr:postcode']) addrParts.push(tags['addr:postcode']);
  
  const address = addrParts.length > 0 ? addrParts.join(', ') : `${name}, Tamil Nadu`;

  // Phone number extraction
  const phone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || null;

  return {
    id: `osm_${element.type}_${element.id}`,
    name,
    service_type,
    facility_type,
    ownership_type,
    latitude: parseFloat(lat.toFixed(6)),
    longitude: parseFloat(lon.toFixed(6)),
    address,
    phone,
    operates_24x7,
    emergency_available,
    source_name: 'OpenStreetMap Live Discovery',
    source_url: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    source_priority: 3,
    verified_at: new Date().toISOString(),
    is_verified: false,
    verification_status: 'community_reported'
  };
}

/**
 * Discover live nearby emergency facilities using OpenStreetMap Overpass API
 * 
 * @param {Object} params
 * @param {number} params.latitude Center latitude
 * @param {number} params.longitude Center longitude
 * @param {number} [params.radiusKm=12] Search radius in km
 * @returns {Promise<Array>} Array of parsed emergency service records
 */
export async function discoverOsmEmergencyServices({ latitude, longitude, radiusKm = 12 }) {
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lon)) return [];

  // Check tile cache
  const tileKey = getTileKey(lat, lon);
  const cached = getCachedTile(tileKey);
  if (cached && Array.isArray(cached)) {
    return cached;
  }

  // Calculate bounding box (cap radius at 15km to keep query execution under 2 seconds)
  const effectiveRadiusKm = Math.min(radiusKm, 15);
  const deltaLat = effectiveRadiusKm / 111.0;
  const deltaLon = effectiveRadiusKm / (111.0 * Math.cos(lat * (Math.PI / 180)));

  const south = (lat - deltaLat).toFixed(4);
  const north = (lat + deltaLat).toFixed(4);
  const west = (lon - deltaLon).toFixed(4);
  const east = (lon + deltaLon).toFixed(4);

  const query = `[out:json][timeout:3];
(
  node["amenity"="hospital"](${south},${west},${north},${east});
  way["amenity"="hospital"](${south},${west},${north},${east});
  node["amenity"="clinic"](${south},${west},${north},${east});
  way["amenity"="clinic"](${south},${west},${north},${east});
  node["amenity"="police"](${south},${west},${north},${east});
  way["amenity"="police"](${south},${west},${north},${east});
  node["amenity"="fire_station"](${south},${west},${north},${east});
  way["amenity"="fire_station"](${south},${west},${north},${east});
  node["emergency"="ambulance_station"](${south},${west},${north},${east});
  way["emergency"="ambulance_station"](${south},${west},${north},${east});
);
out center 60;`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'CrowdCity-Emergency-Discovery/2.0 (contact@crowdcity.co.in)'
      },
      body: 'data=' + encodeURIComponent(query),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      logger.warn(`[OsmDiscovery] Overpass returned status ${res.status}`);
      return [];
    }

    const data = await res.json();
    if (!data.elements || !Array.isArray(data.elements)) {
      return [];
    }

    const parsed = [];
    for (const el of data.elements) {
      const item = parseOverpassElement(el);
      if (item) {
        parsed.push(item);
      }
    }

    // Cache the discovered elements
    setCachedTile(tileKey, parsed);
    return parsed;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      logger.info('[OsmDiscovery] Overpass request reached 3.5s timeout; seamlessly falling back to authoritative directory.');
    } else {
      logger.warn(`[OsmDiscovery] Network error querying Overpass: ${err.message}`);
    }
    return [];
  }
}

export default {
  discoverOsmEmergencyServices
};
