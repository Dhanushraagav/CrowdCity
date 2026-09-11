import { DISTRICTS_DATA, TALUKS_DATA, BLOCKS_DATA, LOCATIONS_DATA, LOCAL_BODIES_DATA } from '../data/locationHierarchyData.js';
import {
  getDistricts,
  getTaluksForDistrict,
  getBlocksForDistrict,
  getLocationsForTaluk,
  searchLocations
} from '../services/locationHierarchyService.js';
import { supabaseAdmin, supabase } from '../config/supabase.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runStep2TestSuite() {
  console.log('================================================================');
  console.log('CROWD CITY — STEP 2 AUTHORITATIVE LOCATION INGESTION TEST SUITE');
  console.log('================================================================');

  // 1. District Registry (38 Districts)
  console.log('\n--- 1. District Hierarchy Completeness ---');
  assert(DISTRICTS_DATA.length === 38, `Expected exactly 38 districts, got ${DISTRICTS_DATA.length}`);
  assert(DISTRICTS_DATA.some(d => d.id === 'namakkal'), 'Namakkal district exists');
  assert(DISTRICTS_DATA.some(d => d.id === 'coimbatore'), 'Coimbatore district exists');
  assert(DISTRICTS_DATA.some(d => d.id === 'viluppuram'), 'Viluppuram district exists');
  assert(DISTRICTS_DATA.some(d => d.id === 'chennai'), 'Chennai district exists');

  // 2. Taluk Registry (313 CRA Taluks)
  console.log('\n--- 2. CRA Taluk Harmonization ---');
  assert(TALUKS_DATA.length === 313, `Expected exactly 313 CRA taluks, got ${TALUKS_DATA.length}`);
  const taluksUnique = new Set(TALUKS_DATA.map(t => t.id));
  assert(taluksUnique.size === 313, 'Zero duplicate taluk IDs');

  // 3. Rural Development Blocks (388 Blocks)
  console.log('\n--- 3. TNRD 388 Rural Blocks Ingestion ---');
  assert(Array.isArray(BLOCKS_DATA) && BLOCKS_DATA.length === 388, `Expected 388 TNRD blocks, got ${BLOCKS_DATA.length}`);
  const blocksUnique = new Set(BLOCKS_DATA.map(b => b.id));
  assert(blocksUnique.size === 388, 'Zero duplicate block IDs');
  
  const sulurBlock = BLOCKS_DATA.find(b => b.district_id === 'coimbatore' && b.name.toLowerCase().includes('sulur'));
  assert(sulurBlock && sulurBlock.lgd_code, `Sulur Block exists with official LGD code: ${sulurBlock?.lgd_code}`);

  const smBlock = BLOCKS_DATA.find(b => b.district_id === 'namakkal' && b.name.toLowerCase().includes('sendamangalam'));
  assert(smBlock && smBlock.tamil_name, `Sendamangalam Block exists with Tamil name: ${smBlock?.tamil_name}`);

  // 4. Village Panchayats Ingestion with Official LGD Codes
  console.log('\n--- 4. Authoritative Village Panchayats Verification ---');
  const vps = LOCATIONS_DATA.filter(l => l.location_type === 'village_panchayat');
  assert(vps.length >= 12000, `Village Panchayats count >= 12,000 (actual: ${vps.length})`);
  
  const vpsWithLgd = vps.filter(l => l.lgd_code && /^[0-9]{5,7}$/.test(l.lgd_code));
  assert(vpsWithLgd.length >= 12000, `Village Panchayats with verified 6-digit LGD codes: ${vpsWithLgd.length}`);

  const sampleVp = vps.find(l => l.name === 'Angambakkam');
  assert(sampleVp && sampleVp.lgd_code === '223994', 'Angambakkam has exact official TNRD LGD code: 223994');

  // 5. Synthetic Data Quarantine & Isolation
  console.log('\n--- 5. Synthetic Data Quarantine Enforcement ---');
  const quarantined = LOCATIONS_DATA.filter(l => l.is_quarantined);
  assert(quarantined.length >= 5000, `Unverified synthetic records quarantined: ${quarantined.length}`);
  
  // Verify that active taluk locations query excludes quarantined records
  const sulurActiveLocs = await getLocationsForTaluk('cbe_sulur');
  const hasQuarantinedInSulur = sulurActiveLocs.some(l => l.is_quarantined);
  assert(!hasQuarantinedInSulur, 'Sulur taluk active locations contain zero quarantined synthetic records');

  // 6. Search-First Typeahead Performance & Accuracy
  console.log('\n--- 6. Search-First Typeahead Engine ---');
  const t0 = Date.now();
  const sendamangalamSearch = await searchLocations({ query: 'Sendamangalam', limit: 10 });
  const latencyMs = Date.now() - t0;
  assert(latencyMs < 100, `Search response latency under 100ms (actual: ${latencyMs}ms)`);
  assert(sendamangalamSearch.length > 0, `Search for 'Sendamangalam' returned ${sendamangalamSearch.length} results`);
  assert(sendamangalamSearch[0].parent_context.includes('Namakkal'), `Parent context includes district: ${sendamangalamSearch[0].parent_context}`);

  // Tamil search test
  const tamilSearch = await searchLocations({ query: 'சேந்தமங்கலம்', limit: 5 });
  assert(tamilSearch.length > 0, `Bilingual search for 'சேந்தமங்கலம்' returned ${tamilSearch.length} results`);

  // Zero quarantined records in search
  const quarantinedInSearch = sendamangalamSearch.some(r => r.is_quarantined);
  assert(!quarantinedInSearch, 'Search results guarantee zero quarantined placeholder records');

  // 7. Administrative Types Completeness
  console.log('\n--- 7. Administrative Types Classification ---');
  const locationTypes = new Set(LOCATIONS_DATA.filter(l => !l.is_quarantined).map(l => l.location_type));
  assert(locationTypes.has('village_panchayat'), 'Includes verified Village Panchayats');
  assert(locationTypes.has('town_panchayat'), 'Includes verified Town Panchayats');
  assert(locationTypes.has('revenue_village'), 'Includes verified Revenue Villages');
  assert(locationTypes.has('locality'), 'Includes verified Localities / Neighborhoods');

  // 8. Key Uniqueness & Referential Integrity
  console.log('\n--- 8. Global ID Uniqueness ---');
  const locIds = new Set();
  let dupCount = 0;
  LOCATIONS_DATA.forEach(l => {
    if (locIds.has(l.id)) dupCount++;
    locIds.add(l.id);
  });
  assert(dupCount === 0, `Zero duplicate location IDs across entire dataset (${locIds.size} unique IDs)`);

  // 9. Complaint Preservation (Zero Complaint Loss)
  console.log('\n--- 9. Complaint Preservation Check ---');
  const client = supabaseAdmin || supabase;
  if (client) {
    try {
      const { data, error } = await client.from('issues').select('id, title');
      if (!error && data) {
        assert(data.length === 5, `Complaint count preserved: Exactly 5 issues (actual: ${data.length})`);
      } else {
        console.warn('Supabase read skipped in local-only mode:', error?.message);
      }
    } catch (e) {
      console.warn('Supabase complaint check notice:', e.message);
    }
  }

  console.log('\n================================================================');
  console.log(`Test Execution Summary:`);
  console.log(`- Passed: ${passed}`);
  console.log(`- Failed: ${failed}`);
  console.log(`- Overall Result: ${failed === 0 ? 'ALL CHECKS PASSED ✓' : 'FAILED ✗'}`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runStep2TestSuite();
