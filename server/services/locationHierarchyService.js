import { supabaseAdmin, supabase } from '../config/supabase.js';
import { DISTRICTS_DATA, TALUKS_DATA, BLOCKS_DATA, LOCATIONS_DATA, LOCAL_BODIES_DATA, URBAN_LOCAL_BODIES_DATA } from '../data/locationHierarchyData.js';
import logger from '../config/logger.js';

// In-memory indexing for ultra-fast response
const districtsMap = new Map();
DISTRICTS_DATA.forEach(d => districtsMap.set(d.id.toLowerCase(), d));

const taluksByDistrictMap = new Map();
const talukByIdMap = new Map();
TALUKS_DATA.forEach(t => {
  const dId = t.district_id.toLowerCase();
  if (!taluksByDistrictMap.has(dId)) {
    taluksByDistrictMap.set(dId, []);
  }
  taluksByDistrictMap.get(dId).push(t);
  talukByIdMap.set(t.id.toLowerCase(), t);
});

const blocksByDistrictMap = new Map();
const blockByIdMap = new Map();
if (Array.isArray(BLOCKS_DATA)) {
  BLOCKS_DATA.forEach(b => {
    const dId = b.district_id.toLowerCase();
    if (!blocksByDistrictMap.has(dId)) {
      blocksByDistrictMap.set(dId, []);
    }
    blocksByDistrictMap.get(dId).push(b);
    blockByIdMap.set(b.id.toLowerCase(), b);
  });
}

// Active locations map (non-quarantined) by Taluk
const locationsByTalukMap = new Map();
// All locations (including historical quarantined)
const allLocationsByTalukMap = new Map();

// 1. Rural Development: Village Panchayats indexed by Block
const villagePanchayatsByBlockMap = new Map();

// 2. Revenue Administration: Revenue Villages indexed by Taluk
const revenueVillagesByTalukMap = new Map();

LOCATIONS_DATA.forEach(loc => {
  if (loc.taluk_id) {
    const tId = loc.taluk_id.toLowerCase();
    if (!allLocationsByTalukMap.has(tId)) {
      allLocationsByTalukMap.set(tId, []);
    }
    allLocationsByTalukMap.get(tId).push(loc);

    if (!loc.is_quarantined) {
      if (!locationsByTalukMap.has(tId)) {
        locationsByTalukMap.set(tId, []);
      }
      locationsByTalukMap.get(tId).push(loc);
    }
  }

  // Index active Village Panchayats strictly under their Rural Block
  if (!loc.is_quarantined && loc.administrative_type === 'village_panchayat' && loc.block_id) {
    const bId = loc.block_id.toLowerCase();
    if (!villagePanchayatsByBlockMap.has(bId)) {
      villagePanchayatsByBlockMap.set(bId, []);
    }
    villagePanchayatsByBlockMap.get(bId).push(loc);
  }

  // Index active Revenue Villages strictly under their Taluk
  if (!loc.is_quarantined && loc.administrative_type === 'revenue_village' && loc.taluk_id) {
    const tId = loc.taluk_id.toLowerCase();
    if (!revenueVillagesByTalukMap.has(tId)) {
      revenueVillagesByTalukMap.set(tId, []);
    }
    revenueVillagesByTalukMap.get(tId).push(loc);
  }
});

// 3. Urban Local Government: Urban Local Bodies (Corporations, Municipalities, Town Panchayats)
const urbanLocalBodiesByDistrictMap = new Map();
const urbanLocalBodyByIdMap = new Map();
const ulbSource = Array.isArray(URBAN_LOCAL_BODIES_DATA) ? URBAN_LOCAL_BODIES_DATA : [];

ulbSource.forEach(ulb => {
  const dId = ulb.district_id.toLowerCase();
  if (!urbanLocalBodiesByDistrictMap.has(dId)) {
    urbanLocalBodiesByDistrictMap.set(dId, []);
  }
  urbanLocalBodiesByDistrictMap.get(dId).push(ulb);
  urbanLocalBodyByIdMap.set(ulb.id.toLowerCase(), ulb);
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
 * Formats human-readable administrative type badge
 */
function formatLocationTypeLabel(type) {
  switch (type) {
    case 'village_panchayat': return 'Village Panchayat';
    case 'revenue_village': return 'Revenue Village';
    case 'town_panchayat': return 'Town Panchayat';
    case 'municipality': return 'Municipality';
    case 'corporation':
    case 'municipal_corporation': return 'Corporation';
    case 'corporation_zone': return 'Corporation Zone';
    case 'locality': return 'Locality / Area';
    default: return 'Settlement';
  }
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
 * 3. Get Rural Blocks belonging to the selected District
 */
export async function getBlocksForDistrict(districtId) {
  if (!districtId) return [];
  const cleanDist = normalizeDistrictKey(districtId);

  if (blocksByDistrictMap.has(cleanDist)) {
    return blocksByDistrictMap.get(cleanDist);
  }

  for (const [dId, blocks] of blocksByDistrictMap.entries()) {
    if (dId.startsWith(cleanDist) || cleanDist.startsWith(dId)) {
      return blocks;
    }
  }

  return [];
}

/**
 * 4. Get all valid Villages / Towns associated with the selected Taluk
 * Excludes quarantined synthetic records by default to protect citizen experience
 */
export async function getLocationsForTaluk(talukId, searchQuery = '', options = {}) {
  if (!talukId) return [];
  const cleanTaluk = normalizeTalukKey(talukId);
  const q = String(searchQuery).trim().toLowerCase();
  const includeQuarantined = !!options.includeQuarantined;

  let locations = [];

  const sourceMap = includeQuarantined ? allLocationsByTalukMap : locationsByTalukMap;

  if (sourceMap.has(cleanTaluk)) {
    locations = sourceMap.get(cleanTaluk);
  } else {
    for (const [tId, list] of sourceMap.entries()) {
      const parts = tId.split('_');
      const suffix = parts.slice(1).join('_');
      if (tId === cleanTaluk || suffix === cleanTaluk || cleanTaluk.endsWith(suffix) || suffix.endsWith(cleanTaluk)) {
        locations = list;
        break;
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
 * 4a. Rural Development Stream: Get Village Panchayats strictly belonging to a Rural Block
 */
export async function getVillagePanchayatsForBlock(blockId) {
  if (!blockId) return [];
  const cleanBlock = String(blockId).trim().toLowerCase();
  if (villagePanchayatsByBlockMap.has(cleanBlock)) {
    return villagePanchayatsByBlockMap.get(cleanBlock);
  }
  for (const [bId, vps] of villagePanchayatsByBlockMap.entries()) {
    if (bId.endsWith(cleanBlock) || cleanBlock.endsWith(bId)) {
      return vps;
    }
  }
  return [];
}

/**
 * 4b. Revenue Administration Stream: Get Revenue Villages strictly belonging to a CRA Taluk
 */
export async function getRevenueVillagesForTaluk(talukId) {
  if (!talukId) return [];
  const cleanTaluk = normalizeTalukKey(talukId);
  if (revenueVillagesByTalukMap.has(cleanTaluk)) {
    return revenueVillagesByTalukMap.get(cleanTaluk);
  }
  for (const [tId, rvs] of revenueVillagesByTalukMap.entries()) {
    if (tId.endsWith(cleanTaluk) || cleanTaluk.endsWith(tId)) {
      return rvs;
    }
  }
  return [];
}

/**
 * 4c. Urban Local Government Stream: Get Urban Local Bodies for a District
 */
export async function getUrbanLocalBodiesForDistrict(districtId, ulbType = 'all') {
  if (!districtId) return [];
  const cleanDist = normalizeDistrictKey(districtId);
  const list = urbanLocalBodiesByDistrictMap.get(cleanDist) || [];
  if (!ulbType || ulbType === 'all') return list;
  return list.filter(u => u.type === ulbType.toLowerCase());
}

/**
 * 5. High-performance Search-First Typeahead Index
 * Debounced lookup matching English and Tamil names with rich parent context
 */
export async function searchLocations({ query = '', districtId = '', adminType = '', limit = 25, includeQuarantined = false }) {
  const q = String(query).trim().toLowerCase();
  if (!q && !districtId) return [];

  const cleanDist = districtId ? normalizeDistrictKey(districtId) : '';
  const cleanType = adminType ? adminType.trim().toLowerCase() : '';
  const maxResults = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);

  const exactPrefixMatches = [];
  const containsMatches = [];

  for (const loc of LOCATIONS_DATA) {
    if (!includeQuarantined && loc.is_quarantined) {
      continue;
    }

    if (cleanDist && loc.district_id.toLowerCase() !== cleanDist) {
      continue;
    }

    if (cleanType && cleanType !== 'all') {
      const lType = (loc.administrative_type || loc.location_type || '').toLowerCase();
      if (cleanType === 'village' || cleanType === 'village_panchayat') {
        if (lType !== 'village_panchayat' && lType !== 'revenue_village') continue;
      } else if (cleanType === 'urban' || cleanType === 'town_panchayat' || cleanType === 'municipality' || cleanType === 'corporation') {
        if (lType !== 'town_panchayat' && lType !== 'municipality' && lType !== 'corporation' && lType !== 'locality') continue;
      } else if (lType !== cleanType) {
        continue;
      }
    }

    if (!q) {
      // Return top locations if no query specified
      containsMatches.push(loc);
      if (containsMatches.length >= maxResults) break;
      continue;
    }

    const enName = (loc.name || '').toLowerCase();
    const taName = (loc.tamil_name || '').toLowerCase();

    if (enName.startsWith(q) || taName.startsWith(q)) {
      exactPrefixMatches.push(loc);
      if (exactPrefixMatches.length >= maxResults) break;
    } else if (enName.includes(q) || taName.includes(q)) {
      containsMatches.push(loc);
    }
  }

  const combined = [...exactPrefixMatches, ...containsMatches].slice(0, maxResults);

  return combined.map(loc => {
    const dist = districtsMap.get(loc.district_id.toLowerCase());
    const taluk = loc.taluk_id ? talukByIdMap.get(loc.taluk_id.toLowerCase()) : null;
    const block = loc.block_id ? blockByIdMap.get(loc.block_id.toLowerCase()) : null;
    const adminType = loc.administrative_type || loc.location_type || 'revenue_village';

    let parentContext = '';
    let parentName = '';
    let parentType = loc.parent_type || 'taluk';

    if (adminType === 'village_panchayat') {
      parentType = 'block';
      parentName = block ? block.name : (loc.block_id || '');
      parentContext = `${parentName || (taluk ? taluk.name : '')} Block, ${dist ? dist.name : loc.district_id}`;
    } else if (adminType === 'revenue_village') {
      parentType = 'taluk';
      parentName = taluk ? taluk.name : (loc.taluk_id || '');
      parentContext = `${parentName} Taluk, ${dist ? dist.name : loc.district_id}`;
    } else if (adminType === 'town_panchayat') {
      parentType = 'district';
      parentName = dist ? dist.name : loc.district_id;
      parentContext = `Town Panchayat, ${dist ? dist.name : loc.district_id}`;
    } else if (adminType === 'municipality') {
      parentType = 'district';
      parentName = dist ? dist.name : loc.district_id;
      parentContext = `Municipality, ${dist ? dist.name : loc.district_id}`;
    } else if (adminType === 'corporation') {
      parentType = 'district';
      parentName = dist ? dist.name : loc.district_id;
      parentContext = `Municipal Corporation, ${dist ? dist.name : loc.district_id}`;
    } else {
      parentType = loc.local_body_id ? 'urban_local_body' : (loc.taluk_id ? 'taluk' : 'district');
      parentName = taluk ? taluk.name : (dist ? dist.name : '');
      parentContext = `${taluk ? `${taluk.name} Taluk, ` : ''}${dist ? dist.name : loc.district_id}`;
    }

    return {
      id: loc.id,
      name: loc.name,
      name_en: loc.name,
      tamil_name: loc.tamil_name || loc.name,
      name_ta: loc.tamil_name || loc.name,
      location_type: adminType,
      administrative_type: adminType,
      type_label: formatLocationTypeLabel(adminType),
      lgd_code: loc.lgd_code || null,
      official_code: loc.lgd_code || null,
      district: dist ? dist.name : loc.district_id,
      district_id: loc.district_id,
      district_name: dist ? dist.name : loc.district_id,
      district_name_ta: dist ? dist.tamil_name : '',
      taluk_id: loc.taluk_id || null,
      taluk_name: taluk ? taluk.name : '',
      taluk_name_ta: taluk ? taluk.tamil_name : '',
      block_id: loc.block_id || null,
      block_name: block ? block.name : '',
      block_name_ta: block ? block.tamil_name : '',
      local_body_id: loc.local_body_id || null,
      urban_local_body_id: loc.local_body_id || null,
      parent_id: loc.parent_id || (adminType === 'village_panchayat' ? loc.block_id : (adminType === 'revenue_village' ? loc.taluk_id : loc.district_id)),
      parent_name: parentName,
      parent_type: parentType,
      parent_context: parentContext,
      verified: !!loc.is_verified,
      is_verified: !!loc.is_verified,
      source_name: loc.source_name || 'tnrd',
      source_url: loc.source_url || null
    };
  });
}

/**
 * 6. Get applicable Local Bodies for a given location / taluk / district
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
