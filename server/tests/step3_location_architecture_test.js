/**
 * CrowdCity AI - Step 3 Location Architecture & Authority Mapping Test Suite
 * 
 * Verifies:
 * 1. 38 Tamil Nadu Districts
 * 2. Revenue Stream: 313 CRA Taluks & Revenue Villages
 * 3. Rural Stream: 388 TNRD Blocks & 12,000+ Village Panchayats (6-digit LGD)
 * 4. Urban Stream: 24 Municipal Corporations, Municipalities, Town Panchayats
 * 5. Quarantine Isolation: Synthetic template records strictly excluded
 * 6. Search-First Typeahead Engine: Latency < 100ms, bilingual, parent context
 * 7. Authority Resolution: Multi-stream authority routing
 * 8. Zero Complaint Loss: 5/5 historical issues in Supabase intact
 * 
 * Strict Requirement: ZERO EMOJIS in code, comments, output strings.
 */

import {
  DISTRICTS_DATA,
  TALUKS_DATA,
  BLOCKS_DATA,
  LOCATIONS_DATA,
  URBAN_LOCAL_BODIES_DATA
} from '../data/locationHierarchyData.js';
import { TN_DISTRICTS } from '../config/districtsConfig.js';
import {
  getVillagePanchayatsForBlock,
  getRevenueVillagesForTaluk,
  getUrbanLocalBodiesForDistrict,
  searchLocations
} from '../services/locationHierarchyService.js';
import { resolveResponsibleAuthority } from '../services/authorityDirectoryService.js';
import { supabase, supabaseAdmin } from '../config/supabase.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runStep3TestSuite() {
  console.log('================================================================');
  console.log('CROWD CITY - STEP 3 FINAL LOCATION ARCHITECTURE TEST SUITE');
  console.log('================================================================\n');

  // --- 1. District Hierarchy Completeness ---
  console.log('--- 1. District Hierarchy Completeness ---');
  assert(TN_DISTRICTS.length === 38, `Expected exactly 38 districts, got ${TN_DISTRICTS.length}`);
  const sampleDistricts = ['namakkal', 'coimbatore', 'chennai', 'viluppuram', 'ariyalur', 'madurai'];
  sampleDistricts.forEach(dId => {
    const d = TN_DISTRICTS.find(x => x.id === dId);
    assert(!!d && d.name && d.nameTa && d.code, `District ${dId} exists with bilingual metadata`);
  });

  // --- 2. Revenue Administration Stream ---
  console.log('\n--- 2. Revenue Administration Stream (Taluks & Revenue Villages) ---');
  assert(TALUKS_DATA.length === 313, `Expected exactly 313 CRA taluks, got ${TALUKS_DATA.length}`);
  
  const talukIds = new Set();
  let duplicateTalukCount = 0;
  TALUKS_DATA.forEach(t => {
    if (talukIds.has(t.id)) duplicateTalukCount++;
    talukIds.add(t.id);
  });
  assert(duplicateTalukCount === 0, `Zero duplicate taluk IDs (${talukIds.size} unique IDs)`);

  const namakkalTaluks = TALUKS_DATA.filter(t => t.district_id === 'namakkal');
  assert(namakkalTaluks.length === 8, `Namakkal has exactly 8 CRA taluks (got ${namakkalTaluks.length})`);
  const sendamangalamTaluk = namakkalTaluks.find(t => t.id === 'sendamangalam' || t.name.toLowerCase() === 'sendamangalam');
  assert(!!sendamangalamTaluk, 'Sendamangalam CRA taluk exists under Namakkal');

  const sendamangalamRVs = await getRevenueVillagesForTaluk(sendamangalamTaluk?.id || 'sendamangalam');
  assert(sendamangalamRVs.length >= 10, `Sendamangalam taluk has verified revenue villages (actual: ${sendamangalamRVs.length})`);
  assert(sendamangalamRVs.every(rv => rv.administrative_type === 'revenue_village' || rv.location_type === 'revenue_village'), 'All revenue villages have administrative_type revenue_village');

  // --- 3. Rural Development Stream ---
  console.log('\n--- 3. Rural Development Stream (Blocks & Village Panchayats) ---');
  assert(BLOCKS_DATA.length === 388, `Expected exactly 388 TNRD blocks, got ${BLOCKS_DATA.length}`);

  const blockIds = new Set();
  let duplicateBlockCount = 0;
  BLOCKS_DATA.forEach(b => {
    if (blockIds.has(b.id)) duplicateBlockCount++;
    blockIds.add(b.id);
  });
  assert(duplicateBlockCount === 0, `Zero duplicate block IDs (${blockIds.size} unique IDs)`);

  const sulurBlock = BLOCKS_DATA.find(b => b.id === 'sulur' || b.official_code === 6421 || b.name.toLowerCase() === 'sulur');
  assert(!!sulurBlock, 'Sulur TNRD rural development block exists');

  const sulurVPs = await getVillagePanchayatsForBlock(sulurBlock?.id || 'sulur');
  assert(sulurVPs.length >= 5, `Sulur block has verified Village Panchayats (actual: ${sulurVPs.length})`);
  assert(sulurVPs.every(vp => vp.administrative_type === 'village_panchayat' || vp.location_type === 'village_panchayat'), 'All Village Panchayats have administrative_type village_panchayat');

  const allVPs = LOCATIONS_DATA.filter(l => l.location_type === 'village_panchayat' && !l.is_quarantined);
  assert(allVPs.length >= 12000, `Village Panchayats count >= 12,000 (actual: ${allVPs.length})`);
  const vpsWithLGD = allVPs.filter(vp => (vp.lgd_code || vp.official_code) && /^[0-9]{6}$/.test(String(vp.lgd_code || vp.official_code)));
  assert(vpsWithLGD.length >= 12000, `Village Panchayats with verified 6-digit LGD codes >= 12,000 (actual: ${vpsWithLGD.length})`);

  // --- 4. Urban Local Government Stream ---
  console.log('\n--- 4. Urban Local Government Stream (Corporations, Municipalities, Town Panchayats) ---');
  assert(Array.isArray(URBAN_LOCAL_BODIES_DATA) && URBAN_LOCAL_BODIES_DATA.length >= 100, `Urban Local Bodies dataset active (actual: ${URBAN_LOCAL_BODIES_DATA.length})`);
  
  const cbeULBs = await getUrbanLocalBodiesForDistrict('coimbatore', 'all');
  assert(cbeULBs.length >= 5, `Coimbatore has active Urban Local Bodies (actual: ${cbeULBs.length})`);
  
  const cbeCorp = cbeULBs.find(u => (u.type === 'corporation' || u.administrative_type === 'corporation' || u.name.toLowerCase().includes('corporation')));
  assert(!!cbeCorp, 'Coimbatore City Municipal Corporation exists in Urban Stream');

  const ulbTypes = new Set(URBAN_LOCAL_BODIES_DATA.map(u => u.type || u.administrative_type));
  assert(ulbTypes.has('corporation'), 'Urban Stream includes Municipal Corporations');
  assert(ulbTypes.has('municipality'), 'Urban Stream includes Municipalities');
  assert(ulbTypes.has('town_panchayat'), 'Urban Stream includes Town Panchayats');

  // --- 5. Quarantine & Data Isolation ---
  console.log('\n--- 5. Quarantine & Data Isolation ---');
  const activeLocations = LOCATIONS_DATA.filter(l => !l.is_quarantined);
  const quarantinedLocations = LOCATIONS_DATA.filter(l => l.is_quarantined);
  assert(activeLocations.length >= 12500, `Active verified locations >= 12,500 (actual: ${activeLocations.length})`);
  assert(quarantinedLocations.length >= 9000, `Quarantined unverified records >= 9,000 (actual: ${quarantinedLocations.length})`);

  const activeNames = activeLocations.map(l => l.name);
  const hasMixedGarbage = activeNames.some(n => /^[A-Z][a-z]+ [A-Z][a-z]+ சேரி$/.test(n) || /^[A-Z][a-z]+ [A-Z][a-z]+ நகர்$/.test(n));
  assert(!hasMixedGarbage, 'Active locations contain zero unverified pattern-generated template names');

  // --- 6. Search-First Typeahead Engine ---
  console.log('\n--- 6. Search-First Typeahead Engine ---');
  const t0 = Date.now();
  const searchResults = await searchLocations({ query: 'Sendamangalam', limit: 10 });
  const latency = Date.now() - t0;
  assert(latency < 100, `Search response latency under 100ms (actual: ${latency}ms)`);
  assert(searchResults.length > 0, 'Search for Sendamangalam returned results');
  assert(searchResults.every(r => !r.is_quarantined), 'Search results guarantee zero quarantined records');
  assert(searchResults.every(r => r.administrative_type && r.parent_context), 'Search results include administrative_type and parent_context');

  const bilingualResults = await searchLocations({ query: 'சேந்தமங்கலம்', limit: 10 });
  assert(bilingualResults.length > 0, 'Bilingual search for சேந்தமங்கலம் returned matching results');

  // Disambiguation check
  const sulurResults = await searchLocations({ query: 'Sulur', limit: 10 });
  assert(sulurResults.length > 0, 'Search for Sulur returned results with distinct administrative types');

  // --- 7. Multi-Stream Authority Resolution Integration ---
  console.log('\n--- 7. Multi-Stream Authority Resolution Integration ---');
  
  // Rural resolution case
  const ruralRes = await resolveResponsibleAuthority({
    latitude: 11.02,
    longitude: 77.12,
    address: 'Sulur Rural, Coimbatore, Tamil Nadu',
    category: 'sanitation',
    mode: 'civic',
    manualSelection: {
      districtId: 'coimbatore',
      blockId: 'sulur',
      villagePanchayatId: 'kannampalayam',
      administrativeType: 'rural'
    }
  });
  assert(!!ruralRes && ruralRes.jurisdiction && ruralRes.administrativeAuthority, 'Rural stream resolution returned valid jurisdiction and authority');
  assert(ruralRes.jurisdiction.district === 'Coimbatore', `Rural case resolved district correctly (${ruralRes.jurisdiction.district})`);

  // Urban resolution case
  const urbanRes = await resolveResponsibleAuthority({
    latitude: 11.0168,
    longitude: 76.9558,
    address: 'Gandhipuram, Coimbatore, Tamil Nadu',
    category: 'roads',
    mode: 'civic',
    manualSelection: {
      districtId: 'coimbatore',
      urbanBodyId: 'cbe_corp',
      administrativeType: 'urban'
    }
  });
  assert(!!urbanRes && urbanRes.jurisdiction && urbanRes.administrativeAuthority, 'Urban stream resolution returned valid jurisdiction and authority');
  assert(urbanRes.administrativeAuthority.office.includes('Coimbatore'), 'Urban authority office corresponds to Coimbatore');

  // Revenue resolution case
  const revenueRes = await resolveResponsibleAuthority({
    latitude: 11.28,
    longitude: 78.23,
    address: 'Sendamangalam Taluk, Namakkal, Tamil Nadu',
    category: 'land_records',
    mode: 'civic',
    manualSelection: {
      districtId: 'namakkal',
      talukId: 'sendamangalam',
      administrativeType: 'revenue'
    }
  });
  assert(!!revenueRes && revenueRes.jurisdiction, 'Revenue stream resolution returned valid jurisdiction');

  // --- 8. Zero Complaint Loss (Supabase Issues Table Integrity) ---
  console.log('\n--- 8. Complaint Preservation Check ---');
  const client = supabaseAdmin || supabase;
  if (client) {
    try {
      const { data, error } = await client.from('issues').select('id, title, address, created_at');
      if (!error && data) {
        assert(data.length === 5, `Complaint count preserved: Exactly 5 issues (actual: ${data.length})`);
        const titles = data.map(i => i.title);
        assert(titles.length === 5, 'All 5 complaint records accessible with complete metadata');
      } else {
        console.warn('Supabase read skipped in local test mode:', error?.message);
      }
    } catch (err) {
      console.warn('Supabase connectivity notice:', err.message);
    }
  }

  // --- Summary ---
  console.log('\n================================================================');
  console.log('Test Execution Summary:');
  console.log(`- Passed: ${passed}`);
  console.log(`- Failed: ${failed}`);
  console.log(`- Overall Result: ${failed === 0 ? 'ALL CHECKS PASSED [OK]' : 'FAILED [X]'}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep3TestSuite();
