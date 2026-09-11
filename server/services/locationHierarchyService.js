import { supabaseAdmin, supabase } from '../config/supabase.js';
import { DISTRICTS_DATA, TALUKS_DATA, LOCATIONS_DATA, LOCAL_BODIES_DATA } from '../data/locationHierarchyData.js';
import logger from '../config/logger.js';

// In-memory indexing for ultra-fast response
const districtsMap = new Map();
DISTRICTS_DATA.forEach(d => districtsMap.set(d.id.toLowerCase(), d));

const taluksByDistrictMap = new Map();
TALUKS_DATA.forEach(t => {
  const dId = t.district_id.toLowerCase();
  if (!taluksByDistrictMap.has(dId)) {
    taluksByDistrictMap.set(dId, []);
  }
  taluksByDistrictMap.get(dId).push(t);
});

const locationsByTalukMap = new Map();
LOCATIONS_DATA.forEach(loc => {
  const tId = loc.taluk_id.toLowerCase();
  if (!locationsByTalukMap.has(tId)) {
    locationsByTalukMap.set(tId, []);
  }
  locationsByTalukMap.get(tId).push(loc);
});

const localBodiesByTalukMap = new Map();
LOCAL_BODIES_DATA.forEach(lb => {
  if (lb.taluk_id) {
    const tId = lb.taluk_id.toLowerCase();
    if (!localBodiesByTalukMap.has(tId)) {
      localBodiesByTalukMap.set(tId, []);
    }
    localBodiesByTalukMap.get(tId).push(lb);
  }
});

const localBodiesByDistrictMap = new Map();
LOCAL_BODIES_DATA.forEach(lb => {
  const dId = lb.district_id.toLowerCase();
  if (!localBodiesByDistrictMap.has(dId)) {
    localBodiesByDistrictMap.set(dId, []);
  }
  localBodiesByDistrictMap.get(dId).push(lb);
});

/**
 * Normalizes input district identifier
 */
function normalizeDistrictKey(distInput) {
  if (!distInput) return '';
  const clean = String(distInput).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean === 'kanchipuram') return 'kancheepuram';
  if (clean === 'nilgiri' || clean === 'thenilgiris') return 'nilgiris';
  if (clean === 'kanyakumari') return 'kanniyakumari';
  if (clean === 'villupuram') return 'viluppuram';
  return clean;
}

/**
 * Normalizes input taluk identifier
 */
function normalizeTalukKey(talukInput) {
  if (!talukInput) return '';
  return String(talukInput).trim().toLowerCase();
}

/**
 * 1. Get all 38 districts of Tamil Nadu
 */
export async function getDistricts() {
  const client = supabaseAdmin || supabase;
  if (client) {
    try {
      const { data, error } = await client.from('districts').select('*').order('name');
      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (e) {
      // Graceful fallback to normalized dataset
    }
  }
  return DISTRICTS_DATA;
}

/**
 * 2. Get Taluks strictly belonging to the selected District
 */
export async function getTaluksForDistrict(districtId) {
  if (!districtId) return [];
  const cleanDist = normalizeDistrictKey(districtId);

  const client = supabaseAdmin || supabase;
  if (client) {
    try {
      const { data, error } = await client
        .from('taluks')
        .select('*')
        .eq('district_id', cleanDist)
        .order('name');
      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (e) {
      // Graceful fallback
    }
  }

  // Fallback to in-memory index
  if (taluksByDistrictMap.has(cleanDist)) {
    return taluksByDistrictMap.get(cleanDist);
  }

  // Prefix match
  for (const [dId, taluks] of taluksByDistrictMap.entries()) {
    if (dId.startsWith(cleanDist) || cleanDist.startsWith(dId)) {
      return taluks;
    }
  }

  return [];
}

/**
 * 3. Get all valid Villages / Towns associated with the selected Taluk
 * Supports real-time search query filtering
 */
export async function getLocationsForTaluk(talukId, searchQuery = '') {
  if (!talukId) return [];
  const cleanTaluk = normalizeTalukKey(talukId);
  const q = String(searchQuery).trim().toLowerCase();

  let locations = [];

  // Try DB if query has no search or basic
  const client = supabaseAdmin || supabase;
  if (client && !q) {
    try {
      const { data, error } = await client
        .from('locations')
        .select('*')
        .eq('taluk_id', cleanTaluk)
        .order('name');
      if (!error && data && data.length > 0) {
        locations = data;
      }
    } catch (e) {
      // Fallback
    }
  }

  if (locations.length === 0) {
    // 1. Direct key match
    if (locationsByTalukMap.has(cleanTaluk)) {
      locations = locationsByTalukMap.get(cleanTaluk);
    } else {
      // 2. Suffix match: e.g. 'sendamangalam' matching 'nmk_sendamangalam'
      for (const [tId, list] of locationsByTalukMap.entries()) {
        const parts = tId.split('_');
        const suffix = parts.slice(1).join('_');
        if (tId === cleanTaluk || suffix === cleanTaluk || cleanTaluk.endsWith(suffix) || suffix.endsWith(cleanTaluk)) {
          locations = list;
          break;
        }
      }
    }
  }

  // Filter by search query if provided
  if (q) {
    return locations.filter(loc => {
      const enMatch = (loc.name || '').toLowerCase().includes(q);
      const taMatch = (loc.tamil_name || '').toLowerCase().includes(q);
      return enMatch || taMatch;
    });
  }

  return locations;
}

/**
 * 4. Get applicable Local Bodies for a given location / taluk / district
 */
export async function getLocalBodiesForLocation({ districtId, talukId, villageName, locationId }) {
  const cleanDist = normalizeDistrictKey(districtId);
  const cleanTaluk = normalizeTalukKey(talukId);

  let localBodies = [];

  // If taluk is specified, retrieve taluk local bodies first
  if (cleanTaluk) {
    if (localBodiesByTalukMap.has(cleanTaluk)) {
      localBodies = [...localBodiesByTalukMap.get(cleanTaluk)];
    } else {
      for (const [tId, list] of localBodiesByTalukMap.entries()) {
        const parts = tId.split('_');
        const suffix = parts.slice(1).join('_');
        if (tId === cleanTaluk || suffix === cleanTaluk || cleanTaluk.endsWith(suffix)) {
          localBodies = [...list];
          break;
        }
      }
    }
  }

  // If no taluk local bodies found or district-level query, fetch from district
  if (localBodies.length === 0 && cleanDist) {
    if (localBodiesByDistrictMap.has(cleanDist)) {
      localBodies = [...localBodiesByDistrictMap.get(cleanDist)];
    }
  }

  // If specific villageName is selected, prioritize matching local body
  if (villageName && localBodies.length > 0) {
    const vLower = String(villageName).trim().toLowerCase();
    localBodies.sort((a, b) => {
      const aMatch = a.name.toLowerCase().includes(vLower) ? -1 : 1;
      const bMatch = b.name.toLowerCase().includes(vLower) ? -1 : 1;
      return aMatch - bMatch;
    });
  }

  return localBodies;
}
