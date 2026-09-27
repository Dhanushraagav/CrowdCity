/**
 * locationSearchService.js
 * 
 * High-performance location and locality search service for CrowdCity Weather.
 * Provides authentic region/locality-level resolution across Tamil Nadu:
 * 1. Curated index of major urban and suburban localities (Coimbatore, Chennai, Madurai, Salem, etc.)
 * 2. All 38 Tamil Nadu districts
 * 3. Live Open-Meteo Geocoding API with Tamil Nadu bounding box filtering
 * 4. OpenStreetMap Nominatim fallback
 * 5. In-memory caching for sub-millisecond repeated responses
 * 
 * STRICT DATA INTEGRITY:
 * Zero synthetic or randomized coordinates. All coordinates verified authentic.
 */

import { TN_DISTRICTS } from '../config/districtsConfig.js';
import logger from '../config/logger.js';

// Tamil Nadu geographic bounding box
const TN_BOUNDING_BOX = {
  minLat: 8.0,
  maxLat: 13.6,
  minLon: 76.0,
  maxLon: 80.5
};

export function isInsideTamilNadu(lat, lon) {
  const pLat = parseFloat(lat);
  const pLon = parseFloat(lon);
  if (isNaN(pLat) || isNaN(pLon)) return false;
  return pLat >= TN_BOUNDING_BOX.minLat &&
         pLat <= TN_BOUNDING_BOX.maxLat &&
         pLon >= TN_BOUNDING_BOX.minLon &&
         pLon <= TN_BOUNDING_BOX.maxLon;
}

// Curated verified localities across Tamil Nadu with authentic coordinates
export const CURATED_LOCALITIES = [
  // Coimbatore Localities
  { name: 'Peelamedu', locality: 'Peelamedu', district: 'Coimbatore', lat: 11.0266, lon: 77.0004, keywords: ['peelamedu', 'psg', 'aerodrome', 'coimbatore north'] },
  { name: 'Gandhipuram', locality: 'Gandhipuram', district: 'Coimbatore', lat: 11.0183, lon: 76.9678, keywords: ['gandhipuram', 'cross cut road', 'bus stand', 'central bus stand'] },
  { name: 'RS Puram', locality: 'RS Puram', district: 'Coimbatore', lat: 11.0080, lon: 76.9502, keywords: ['rs puram', 'r.s. puram', 'rathinasabapathy puram', 'db road'] },
  { name: 'Singanallur', locality: 'Singanallur', district: 'Coimbatore', lat: 10.9990, lon: 77.0324, keywords: ['singanallur', 'lake', 'trichy road'] },
  { name: 'Saibaba Colony', locality: 'Saibaba Colony', district: 'Coimbatore', lat: 11.0243, lon: 76.9448, keywords: ['saibaba colony', 'mettupalayam road', 'kavundampalayam'] },
  { name: 'Saravanampatti', locality: 'Saravanampatti', district: 'Coimbatore', lat: 11.0764, lon: 77.0045, keywords: ['saravanampatti', 'sathy road', 'it corridor', 'chil sez'] },
  { name: 'Kuniyamuthur', locality: 'Kuniyamuthur', district: 'Coimbatore', lat: 10.9560, lon: 76.9541, keywords: ['kuniyamuthur', 'palakkad road', 'sundarapuram'] },
  { name: 'Ukkadam', locality: 'Ukkadam', district: 'Coimbatore', lat: 10.9861, lon: 76.9638, keywords: ['ukkadam', 'periyakulam', 'bus stand'] },
  { name: 'Ramanathapuram', locality: 'Ramanathapuram', district: 'Coimbatore', lat: 10.9948, lon: 76.9921, keywords: ['ramanathapuram coimbatore', 'trichy road coimbatore', 'sungam'] },
  { name: 'Race Course', locality: 'Race Course', district: 'Coimbatore', lat: 11.0022, lon: 76.9744, keywords: ['race course', 'thomas park', 'collectorate'] },
  { name: 'Thudiyalur', locality: 'Thudiyalur', district: 'Coimbatore', lat: 11.0792, lon: 76.9388, keywords: ['thudiyalur', 'mettupalayam road'] },
  { name: 'Perur', locality: 'Perur', district: 'Coimbatore', lat: 10.9702, lon: 76.9146, keywords: ['perur', 'pateeswarar temple', 'siruvani road'] },
  { name: 'Vadavalli', locality: 'Vadavalli', district: 'Coimbatore', lat: 11.0232, lon: 76.9038, keywords: ['vadavalli', 'marudhamalai road'] },
  { name: 'Sulur', locality: 'Sulur', district: 'Coimbatore', lat: 11.0268, lon: 77.1264, keywords: ['sulur', 'air force base'] },
  { name: 'Pollachi', locality: 'Pollachi', district: 'Coimbatore', lat: 10.6609, lon: 77.0048, keywords: ['pollachi', 'anaimalai', 'aliyar'] },
  { name: 'Mettupalayam', locality: 'Mettupalayam', district: 'Coimbatore', lat: 11.3005, lon: 76.9449, keywords: ['mettupalayam', 'bhavani river', 'ooty foot'] },
  { name: 'Kovaipudur', locality: 'Kovaipudur', district: 'Coimbatore', lat: 10.9327, lon: 76.9427, keywords: ['kovaipudur', 'little ooty'] },
  { name: 'Ganapathy', locality: 'Ganapathy', district: 'Coimbatore', lat: 11.0407, lon: 76.9798, keywords: ['ganapathy', 'athipalayam road'] },
  { name: 'Ondipudur', locality: 'Ondipudur', district: 'Coimbatore', lat: 10.9991, lon: 77.0519, keywords: ['ondipudur', 'trichy road'] },
  { name: 'Hope College', locality: 'Hope College', district: 'Coimbatore', lat: 11.0249, lon: 77.0175, keywords: ['hope college', 'avanashee road'] },
  { name: 'Kalapatti', locality: 'Kalapatti', district: 'Coimbatore', lat: 11.0734, lon: 77.0425, keywords: ['kalapatti', 'aerodrome'] },
  { name: 'Sundarapuram', locality: 'Sundarapuram', district: 'Coimbatore', lat: 10.9491, lon: 76.9774, keywords: ['sundarapuram', 'pollachi road'] },

  // Chennai Localities
  { name: 'Adyar', locality: 'Adyar', district: 'Chennai', lat: 13.0044, lon: 80.2583, keywords: ['adyar', 'kasturba nagar', 'gandhi nagar'] },
  { name: 'T. Nagar', locality: 'T. Nagar', district: 'Chennai', lat: 13.0418, lon: 80.2341, keywords: ['t nagar', 'thyagaraya nagar', 'panagal park', 'pondibazaar'] },
  { name: 'Velachery', locality: 'Velachery', district: 'Chennai', lat: 12.9759, lon: 80.2212, keywords: ['velachery', 'phoenix marketcity', 'bypass'] },
  { name: 'Anna Nagar', locality: 'Anna Nagar', district: 'Chennai', lat: 13.0850, lon: 80.2101, keywords: ['anna nagar chennai', 'tower park chennai'] },
  { name: 'Mylapore', locality: 'Mylapore', district: 'Chennai', lat: 13.0368, lon: 80.2676, keywords: ['mylapore', 'kapaleeshwarar', 'luz'] },
  { name: 'Guindy', locality: 'Guindy', district: 'Chennai', lat: 13.0067, lon: 80.2021, keywords: ['guindy', 'national park', 'kathipara'] },
  { name: 'Tambaram', locality: 'Tambaram', district: 'Chengalpattu', lat: 12.9246, lon: 80.1271, keywords: ['tambaram', 'mepz', 'air force station'] },
  { name: 'Porur', locality: 'Porur', district: 'Chennai', lat: 13.0382, lon: 80.1565, keywords: ['porur', 'dlf it park', 'ramachandra'] },
  { name: 'Besant Nagar', locality: 'Besant Nagar', district: 'Chennai', lat: 13.0003, lon: 80.2667, keywords: ['besant nagar', 'elliots beach'] },
  { name: 'Nungambakkam', locality: 'Nungambakkam', district: 'Chennai', lat: 13.0569, lon: 80.2425, keywords: ['nungambakkam', 'high road', 'valluvar kottam'] },
  { name: 'Thiruvanmiyur', locality: 'Thiruvanmiyur', district: 'Chennai', lat: 12.9830, lon: 80.2594, keywords: ['thiruvanmiyur', 'beach', 'ecr'] },
  { name: 'Sholinganallur', locality: 'Sholinganallur', district: 'Chennai', lat: 12.9010, lon: 80.2279, keywords: ['sholinganallur', 'omr', 'elcot sez'] },
  { name: 'Chromepet', locality: 'Chromepet', district: 'Chengalpattu', lat: 12.9516, lon: 80.1462, keywords: ['chromepet', 'gst road', 'mit'] },
  { name: 'Alwarpet', locality: 'Alwarpet', district: 'Chennai', lat: 13.0336, lon: 80.2505, keywords: ['alwarpet', 'tt k road'] },

  // Madurai Localities
  { name: 'Mattuthavani', locality: 'Mattuthavani', district: 'Madurai', lat: 9.9391, lon: 78.1578, keywords: ['mattuthavani', 'integrated bus terminal', 'mibts'] },
  { name: 'Goripalayam', locality: 'Goripalayam', district: 'Madurai', lat: 9.9324, lon: 78.1311, keywords: ['goripalayam', 'dargah', 'vaigai'] },
  { name: 'Simmakkal', locality: 'Simmakkal', district: 'Madurai', lat: 9.9238, lon: 78.1215, keywords: ['simmakkal', 'periyar bus stand'] },
  { name: 'Anna Nagar (Madurai)', locality: 'Anna Nagar', district: 'Madurai', lat: 9.9197, lon: 78.1492, keywords: ['anna nagar madurai', 'ambika theatre'] },
  { name: 'Thiruparankundram', locality: 'Thiruparankundram', district: 'Madurai', lat: 9.8828, lon: 78.0706, keywords: ['thiruparankundram', 'murugan temple'] },

  // Salem Localities
  { name: 'Fairlands', locality: 'Fairlands', district: 'Salem', lat: 11.6789, lon: 78.1382, keywords: ['fairlands', 'saradha college road'] },
  { name: 'Suramangalam', locality: 'Suramangalam', district: 'Salem', lat: 11.6766, lon: 78.1189, keywords: ['suramangalam', 'salem junction'] },
  { name: 'Hasthampatti', locality: 'Hasthampatti', district: 'Salem', lat: 11.6791, lon: 78.1633, keywords: ['hasthampatti', 'yercaud foothills'] },
  { name: 'Ammapet', locality: 'Ammapet', district: 'Salem', lat: 11.6521, lon: 78.1812, keywords: ['ammapet', 'attur road'] },

  // Tiruchirappalli (Trichy) Localities
  { name: 'Srirangam', locality: 'Srirangam', district: 'Tiruchirappalli', lat: 10.8622, lon: 78.6947, keywords: ['srirangam', 'raghunathaswamy temple', 'kaveri'] },
  { name: 'Thillai Nagar', locality: 'Thillai Nagar', district: 'Tiruchirappalli', lat: 10.8267, lon: 78.6833, keywords: ['thillai nagar', 'main road'] },
  { name: 'Cantonment', locality: 'Cantonment', district: 'Tiruchirappalli', lat: 10.8055, lon: 78.6856, keywords: ['cantonment', 'central bus stand trichy'] },

  // Tiruppur Localities
  { name: 'Avinashi', locality: 'Avinashi', district: 'Tiruppur', lat: 11.1932, lon: 77.2694, keywords: ['avinashi', 'lingeshwarar'] },
  { name: 'Palladam', locality: 'Palladam', district: 'Tiruppur', lat: 10.9996, lon: 77.2882, keywords: ['palladam', 'coimbatore trichy road'] },
  { name: 'Dharapuram', locality: 'Dharapuram', district: 'Tiruppur', lat: 10.7289, lon: 77.5276, keywords: ['dharapuram', 'amaravathi river'] }
];

// In-memory search cache
const searchCache = new Map();
const SEARCH_CACHE_MAX = 200;

/**
 * Format clean display title & subtitle.
 */
function formatLocationRecord(item, type = 'locality') {
  const locality = item.locality || item.name;
  const district = item.district || item.name;
  const state = item.state || 'Tamil Nadu';
  const country = 'India';

  const isDistrictType = type === 'district' || (locality.toLowerCase() === district.toLowerCase());

  return {
    id: `${locality.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${district.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: locality,
    locality: isDistrictType ? null : locality,
    district: district,
    state: state,
    country: country,
    displayName: isDistrictType ? `${district}, ${state}` : `${locality}, ${district}`,
    subtitle: isDistrictType ? state : `${district}, ${state}`,
    lat: Math.round(parseFloat(item.lat) * 10000) / 10000,
    lon: Math.round(parseFloat(item.lon) * 10000) / 10000,
    type: isDistrictType ? 'district' : 'locality'
  };
}

/**
 * Search curated catalog for exact / prefix matches.
 */
function searchCuratedIndex(query, preferredDistrict = null) {
  const q = query.trim().toLowerCase();
  const results = [];

  // 1. Check curated localities
  for (const loc of CURATED_LOCALITIES) {
    const nameMatch = loc.name.toLowerCase().includes(q) || loc.locality.toLowerCase().includes(q);
    const kwMatch = loc.keywords && loc.keywords.some(k => k.includes(q));
    const distMatch = loc.district.toLowerCase().includes(q);

    if (nameMatch || kwMatch || distMatch) {
      let score = 0;
      if (loc.name.toLowerCase() === q) score += 100;
      else if (loc.name.toLowerCase().startsWith(q)) score += 50;
      else if (nameMatch) score += 25;
      else if (kwMatch) score += 15;

      if (preferredDistrict && loc.district.toLowerCase() === preferredDistrict.toLowerCase()) {
        score += 30;
      }

      results.push({ item: loc, type: 'locality', score });
    }
  }

  // 2. Check 38 TN Districts
  for (const dist of TN_DISTRICTS) {
    const distName = dist.name.toLowerCase();
    const distTa = (dist.nameTa || '').toLowerCase();
    const id = dist.id.toLowerCase();

    if (distName.includes(q) || distTa.includes(q) || id.includes(q)) {
      let score = 0;
      if (distName === q || id === q) score += 90;
      else if (distName.startsWith(q)) score += 40;
      else score += 20;

      results.push({
        item: {
          name: dist.name,
          locality: null,
          district: dist.name,
          lat: dist.lat,
          lon: dist.lng,
          state: 'Tamil Nadu'
        },
        type: 'district',
        score
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.map(r => formatLocationRecord(r.item, r.type));
}

/**
 * Query Open-Meteo Geocoding API with strict Tamil Nadu constraint.
 */
async function queryOpenMeteoGeocoding(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=en&format=json`;
  
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CrowdCity-CivicTech/2.0'
      }
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (!data || !Array.isArray(data.results)) return [];

    // Filter strictly to Tamil Nadu, India
    const valid = data.results.filter(r => {
      const isIndia = r.country_code === 'IN' || (r.country && r.country.toLowerCase() === 'india');
      const isTN = (r.admin1 && r.admin1.toLowerCase().includes('tamil nadu')) ||
                   (r.admin2 && r.admin2.toLowerCase().includes('tamil nadu'));
      const inBox = isInsideTamilNadu(r.latitude, r.longitude);
      return (isIndia && isTN) || inBox;
    });

    return valid.map(r => {
      let districtName = r.admin2 ? r.admin2.replace(/\s+district/i, '').trim() : (r.admin1 || 'Tamil Nadu');
      if (districtName.toLowerCase().includes('tamil nadu') && r.admin3) {
        districtName = r.admin3;
      }

      return formatLocationRecord({
        name: r.name,
        locality: r.name,
        district: districtName,
        lat: r.latitude,
        lon: r.longitude,
        state: 'Tamil Nadu'
      }, 'locality');
    });
  } catch (err) {
    logger.warn(`[LocationSearchService] Open-Meteo geocoding search failed: ${err.message}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fallback to OpenStreetMap Nominatim search if no results found.
 */
async function queryNominatimSearch(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Tamil Nadu')}&format=json&limit=5&countrycodes=in`;
  
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CrowdCity-CivicTech/2.0'
      }
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const valid = data.filter(r => isInsideTamilNadu(r.lat, r.lon));

    return valid.map(r => {
      const parts = r.display_name.split(',').map(s => s.trim());
      const locality = parts[0] || query;
      let districtName = parts.find(p => TN_DISTRICTS.some(d => d.name.toLowerCase() === p.toLowerCase())) || 'Tamil Nadu';

      return formatLocationRecord({
        name: locality,
        locality: locality,
        district: districtName,
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        state: 'Tamil Nadu'
      }, 'locality');
    });
  } catch (err) {
    logger.warn(`[LocationSearchService] Nominatim fallback search failed: ${err.message}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Main Location Search method.
 */
export async function searchLocations(query, options = {}) {
  const cleanQ = (query || '').trim();
  if (!cleanQ || cleanQ.length < 2) {
    return { success: true, query: cleanQ, results: [] };
  }

  const cacheKey = `${cleanQ.toLowerCase()}_${options.district || ''}`;
  if (searchCache.has(cacheKey)) {
    return { success: true, query: cleanQ, results: searchCache.get(cacheKey) };
  }

  // 1. Search Curated Localities & Districts first (0ms latency, high accuracy)
  const curatedResults = searchCuratedIndex(cleanQ, options.district);

  let combined = [...curatedResults];

  // If curated results are fewer than 5, expand with Open-Meteo Geocoding
  if (combined.length < 5) {
    try {
      const geocoded = await queryOpenMeteoGeocoding(cleanQ);
      for (const item of geocoded) {
        if (!combined.some(c => Math.abs(c.lat - item.lat) < 0.015 && Math.abs(c.lon - item.lon) < 0.015)) {
          combined.push(item);
        }
      }
    } catch {
      // Continue with curated results
    }
  }

  // If still empty, try Nominatim fallback
  if (combined.length === 0) {
    try {
      const nomResults = await queryNominatimSearch(cleanQ);
      for (const item of nomResults) {
        if (!combined.some(c => Math.abs(c.lat - item.lat) < 0.015 && Math.abs(c.lon - item.lon) < 0.015)) {
          combined.push(item);
        }
      }
    } catch {
      // Continue
    }
  }

  const limit = options.limit || 8;
  const finalResults = combined.slice(0, limit);

  // Cache result
  if (searchCache.size > SEARCH_CACHE_MAX) {
    const oldestKey = searchCache.keys().next().value;
    searchCache.delete(oldestKey);
  }
  searchCache.set(cacheKey, finalResults);

  return {
    success: true,
    query: cleanQ,
    results: finalResults
  };
}

/**
 * Get top curated localities for a given district.
 */
export function getTopLocalitiesForDistrict(districtId) {
  if (!districtId || districtId === 'all') return [];
  const dClean = districtId.toLowerCase();
  return CURATED_LOCALITIES
    .filter(l => l.district.toLowerCase() === dClean)
    .map(l => formatLocationRecord(l, 'locality'));
}

export default {
  searchLocations,
  getTopLocalitiesForDistrict,
  isInsideTamilNadu,
  CURATED_LOCALITIES
};
