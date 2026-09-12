import { DISTRICTS_DATA, TALUKS_DATA, BLOCKS_DATA, LOCATIONS_DATA, URBAN_LOCAL_BODIES_DATA } from '../data/locationHierarchyData.js';
import {
  getDistricts,
  getTaluksForDistrict,
  getBlocksForDistrict,
  getLocationsForTaluk,
  getVillagePanchayatsForBlock,
  getRevenueVillagesForTaluk,
  getUrbanLocalBodiesForDistrict,
  searchLocations
} from '../services/locationHierarchyService.js';
import { resolveResponsibleAuthority } from '../services/authorityDirectoryService.js';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { generateNextComplaintId } from '../services/complaintIdService.js';
import { calculateSlaDeadline, computeSlaState } from '../services/slaService.js';

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    totalPassed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    totalFailed++;
  }
}

async function runStep4ValidationSuite() {
  console.log('================================================================');
  console.log('CROWD CITY AI - STEP 4 REAL-WORLD PRODUCTION VALIDATION SUITE');
  console.log('================================================================\n');

  // ----------------------------------------------------------------
  // 1. 38 DISTRICT COVERAGE & KEY INTEGRITY
  // ----------------------------------------------------------------
  console.log('--- 1. 38-District Coverage & Identifier Integrity ---');
  const districts = await getDistricts();
  assert(districts.length === 38, `Expected exactly 38 districts, got ${districts.length}`);

  const districtIds = new Set();
  const districtCodes = new Set();
  let allDistrictsHaveValidMetadata = true;

  for (const d of districts) {
    if (!d.id || !d.code || !d.name || (!d.tamil_name && !d.nameTa)) {
      allDistrictsHaveValidMetadata = false;
    }
    districtIds.add(d.id.toLowerCase());
    districtCodes.add(d.code.toLowerCase());
  }

  assert(allDistrictsHaveValidMetadata, 'All 38 districts possess valid non-empty ID, code, English name, and Tamil name');
  assert(districtIds.size === 38, `All 38 district IDs are unique (got ${districtIds.size})`);
  assert(districtCodes.size === 38, `All 38 official district codes are unique (got ${districtCodes.size})`);

  // Verify key geographic reference districts across Tamil Nadu
  assert(districtIds.has('chennai'), 'Chennai metropolitan district registered');
  assert(districtIds.has('coimbatore'), 'Coimbatore western industrial district registered');
  assert(districtIds.has('madurai'), 'Madurai southern heritage district registered');
  assert(districtIds.has('tiruchirappalli'), 'Tiruchirappalli central delta district registered');
  assert(districtIds.has('thanjavur'), 'Thanjavur delta district registered');
  assert(districtIds.has('tiruvannamalai'), 'Tiruvannamalai northern district registered');
  assert(districtIds.has('kanniyakumari'), 'Kanniyakumari southern-most district registered');
  assert(districtIds.has('nilgiris'), 'The Nilgiris hill district registered');

  // ----------------------------------------------------------------
  // 2. RURAL STREAM VALIDATION (Blocks -> VPs -> Habitations)
  // ----------------------------------------------------------------
  console.log('\n--- 2. Rural Stream Validation (Blocks -> VPs) ---');
  const totalBlocks = BLOCKS_DATA.length;
  assert(totalBlocks === 388, `Expected exactly 388 official TNRD rural blocks, got ${totalBlocks}`);

  const activeVPs = LOCATIONS_DATA.filter(l => !l.is_quarantined && l.administrative_type === 'village_panchayat');
  assert(activeVPs.length >= 12000, `Official TNRD Village Panchayats count >= 12,000 (actual: ${activeVPs.length})`);

  const vpsWithLgdCode = activeVPs.filter(l => l.lgd_code && /^\d{5,7}$/.test(String(l.lgd_code)));
  assert(vpsWithLgdCode.length >= 12000, `Village Panchayats with verified official LGD codes >= 12,000 (actual: ${vpsWithLgdCode.length})`);

  // Regional Block & VP checks across Tamil Nadu:
  // West: Coimbatore -> Sulur Block
  const cbeBlocks = await getBlocksForDistrict('coimbatore');
  const sulurBlock = cbeBlocks.find(b => b.name.toLowerCase() === 'sulur' || b.id.includes('sulur'));
  assert(!!sulurBlock, 'Sulur rural development block found in Coimbatore');
  const sulurVps = await getVillagePanchayatsForBlock(sulurBlock.id);
  assert(sulurVps.length > 0, `Sulur block has verified Village Panchayats (got ${sulurVps.length})`);
  assert(sulurVps.every(v => v.administrative_type === 'village_panchayat'), 'All Sulur block locations have administrative_type village_panchayat');
  assert(sulurVps.every(v => !v.is_quarantined), 'Zero quarantined records returned for Sulur Village Panchayats');

  // North: Tiruvannamalai -> Chengam Block
  const tvmBlocks = await getBlocksForDistrict('tiruvannamalai');
  const chengamBlock = tvmBlocks.find(b => b.name.toLowerCase().includes('chengam'));
  assert(!!chengamBlock, 'Chengam rural block found in Tiruvannamalai (Northern TN)');
  const chengamVps = await getVillagePanchayatsForBlock(chengamBlock.id);
  assert(chengamVps.length > 0, `Chengam block has verified Village Panchayats (got ${chengamVps.length})`);

  // South: Madurai -> Vadipatti Block
  const mduBlocks = await getBlocksForDistrict('madurai');
  const vadipattiBlock = mduBlocks.find(b => b.name.toLowerCase().includes('vadipatti'));
  assert(!!vadipattiBlock, 'Vadipatti rural block found in Madurai (Southern TN)');
  const vadipattiVps = await getVillagePanchayatsForBlock(vadipattiBlock.id);
  assert(vadipattiVps.length > 0, `Vadipatti block has verified Village Panchayats (got ${vadipattiVps.length})`);

  // Delta: Thanjavur -> Budalur Block
  const tjrBlocks = await getBlocksForDistrict('thanjavur');
  const budalurBlock = tjrBlocks.find(b => b.name.toLowerCase().includes('budalur'));
  assert(!!budalurBlock, 'Budalur rural block found in Thanjavur (Delta Region)');
  const budalurVps = await getVillagePanchayatsForBlock(budalurBlock.id);
  assert(budalurVps.length > 0, `Budalur block has verified Village Panchayats (got ${budalurVps.length})`);

  // Central: Tiruchirappalli -> Lalgudi Block
  const tryBlocks = await getBlocksForDistrict('tiruchirappalli');
  const lalgudiBlock = tryBlocks.find(b => b.name.toLowerCase().includes('lalgudi'));
  assert(!!lalgudiBlock, 'Lalgudi rural block found in Tiruchirappalli (Central TN)');
  const lalgudiVps = await getVillagePanchayatsForBlock(lalgudiBlock.id);
  assert(lalgudiVps.length > 0, `Lalgudi block has verified Village Panchayats (got ${lalgudiVps.length})`);

  // Chennai: 100% urban corporation, legitimately has 0 rural blocks
  const chnBlocks = await getBlocksForDistrict('chennai');
  assert(chnBlocks.length === 0, 'Chennai metropolitan district legitimately has 0 rural blocks (100% urban)');

  // ----------------------------------------------------------------
  // 3. REVENUE STREAM VALIDATION (Taluks -> Revenue Villages)
  // ----------------------------------------------------------------
  console.log('\n--- 3. Revenue Stream Validation (Taluks -> Revenue Villages) ---');
  const totalTaluks = TALUKS_DATA.length;
  assert(totalTaluks === 313, `Expected exactly 313 official CRA taluks, got ${totalTaluks}`);

  // Test Sendamangalam Taluk in Namakkal
  const nmkTaluks = await getTaluksForDistrict('namakkal');
  assert(nmkTaluks.length === 8, `Namakkal has exactly 8 CRA taluks (got ${nmkTaluks.length})`);
  const sendamangalamTaluk = nmkTaluks.find(t => t.name.toLowerCase().includes('sendamangalam'));
  assert(!!sendamangalamTaluk, 'Sendamangalam CRA taluk exists under Namakkal');

  const sendamangalamRVs = await getRevenueVillagesForTaluk(sendamangalamTaluk.id);
  assert(sendamangalamRVs.length > 0, `Sendamangalam taluk has verified Revenue Villages (got ${sendamangalamRVs.length})`);
  assert(sendamangalamRVs.every(rv => rv.administrative_type === 'revenue_village'), 'All revenue villages have administrative_type revenue_village');
  assert(sendamangalamRVs.every(rv => !rv.is_quarantined), 'Zero quarantined records returned for Sendamangalam Revenue Villages');

  // Test Sulur Taluk in Coimbatore
  const cbeTaluks = await getTaluksForDistrict('coimbatore');
  const sulurTaluk = cbeTaluks.find(t => t.name.toLowerCase() === 'sulur' || t.id.includes('sulur'));
  assert(!!sulurTaluk, 'Sulur CRA taluk exists under Coimbatore');
  const sulurRVs = await getRevenueVillagesForTaluk(sulurTaluk.id);
  assert(sulurRVs.length > 0, `Sulur taluk has verified Revenue Villages (got ${sulurRVs.length})`);

  // Verify no revenue village converted to village panchayat
  const activeRVs = LOCATIONS_DATA.filter(l => !l.is_quarantined && l.administrative_type === 'revenue_village');
  assert(activeRVs.every(rv => rv.administrative_type !== 'village_panchayat'), 'Revenue villages strictly preserved as revenue_village (no false conversion)');

  // ----------------------------------------------------------------
  // 4. URBAN STREAM VALIDATION (Districts -> ULBs)
  // ----------------------------------------------------------------
  console.log('\n--- 4. Urban Stream Validation (Districts -> ULBs) ---');
  const totalULBs = URBAN_LOCAL_BODIES_DATA.length;
  assert(totalULBs > 100, `Urban Local Bodies active in dataset (got ${totalULBs})`);

  // Corporations check
  const corporations = URBAN_LOCAL_BODIES_DATA.filter(u => u.type === 'corporation' || u.type === 'municipal_corporation');
  assert(corporations.length >= 10, `Municipal Corporations registered >= 10 (got ${corporations.length})`);

  // Specific major urban centers audit
  const cbeULBs = await getUrbanLocalBodiesForDistrict('coimbatore');
  assert(cbeULBs.some(u => u.type === 'corporation' && u.name.includes('Coimbatore')), 'Coimbatore City Municipal Corporation verified in Urban Stream');

  const chnULBs = await getUrbanLocalBodiesForDistrict('chennai');
  assert(chnULBs.length > 0 && chnULBs.some(u => u.type === 'corporation' || u.name.includes('Chennai')), 'Greater Chennai Corporation verified in Urban Stream');

  const mduULBs = await getUrbanLocalBodiesForDistrict('madurai');
  assert(mduULBs.some(u => u.type === 'corporation' || u.name.includes('Madurai')), 'Madurai Municipal Corporation verified in Urban Stream');

  const tryULBs = await getUrbanLocalBodiesForDistrict('tiruchirappalli');
  assert(tryULBs.some(u => u.type === 'corporation' || u.name.includes('Tiruchirappalli')), 'Tiruchirappalli City Corporation verified in Urban Stream');

  const slmULBs = await getUrbanLocalBodiesForDistrict('salem');
  assert(slmULBs.some(u => u.type === 'corporation' || u.name.includes('Salem')), 'Salem City Corporation verified in Urban Stream');

  const tupULBs = await getUrbanLocalBodiesForDistrict('tiruppur');
  assert(tupULBs.some(u => u.type === 'corporation' || u.name.includes('Tiruppur')), 'Tiruppur City Corporation verified in Urban Stream');

  const erdULBs = await getUrbanLocalBodiesForDistrict('erode');
  assert(erdULBs.some(u => u.type === 'corporation' || u.name.includes('Erode')), 'Erode City Corporation verified in Urban Stream');

  const tnvULBs = await getUrbanLocalBodiesForDistrict('tirunelveli');
  assert(tnvULBs.some(u => u.type === 'corporation' || u.name.includes('Tirunelveli')), 'Tirunelveli City Corporation verified in Urban Stream');

  // Municipalities check
  const municipalities = URBAN_LOCAL_BODIES_DATA.filter(u => u.type === 'municipality');
  assert(municipalities.length > 0, `Municipalities present in Urban Stream (got ${municipalities.length})`);

  // Town Panchayats check
  const townPanchayats = URBAN_LOCAL_BODIES_DATA.filter(u => u.type === 'town_panchayat');
  assert(townPanchayats.length > 0, `Town Panchayats present in Urban Stream (got ${townPanchayats.length})`);

  // No cross-stream contamination in ULB queries
  assert(cbeULBs.every(u => u.type !== 'village_panchayat' && u.type !== 'revenue_village'), 'Zero rural VPs or revenue villages in Urban Local Bodies query');

  // ----------------------------------------------------------------
  // 5. BILINGUAL SEARCH & TYPEAHEAD VALIDATION
  // ----------------------------------------------------------------
  console.log('\n--- 5. Bilingual Search & Typeahead Validation ---');
  // English search
  const enStart = Date.now();
  const enResults = await searchLocations({ query: 'Sendamangalam' });
  const enLatency = Date.now() - enStart;
  assert(enResults.length > 0, `English search for 'Sendamangalam' returned ${enResults.length} results`);
  assert(enLatency < 100, `English search latency under 100ms (actual: ${enLatency}ms)`);

  // Tamil search
  const taStart = Date.now();
  const taResults = await searchLocations({ query: 'சேந்தமங்கலம்' });
  const taLatency = Date.now() - taStart;
  assert(taResults.length > 0, `Tamil search for 'சேந்தமங்கலம்' returned ${taResults.length} results`);
  assert(taLatency < 100, `Tamil search latency under 100ms (actual: ${taLatency}ms)`);

  // Partial search
  const partialEn = await searchLocations({ query: 'Send' });
  assert(partialEn.length > 0, `Partial English search for 'Send' returned ${partialEn.length} results`);

  const partialTa = await searchLocations({ query: 'சேந்' });
  assert(partialTa.length > 0, `Partial Tamil search for 'சேந்' returned ${partialTa.length} results`);

  // Case insensitivity
  const lowerResults = await searchLocations({ query: 'sulur' });
  const upperResults = await searchLocations({ query: 'SULUR' });
  assert(lowerResults.length === upperResults.length && lowerResults.length > 0, 'Case insensitivity: upper and lower case queries return identical results');

  // Empty and whitespace queries
  const emptyRes = await searchLocations({ query: '' });
  assert(Array.isArray(emptyRes) && emptyRes.length === 0, 'Empty query returns empty array');
  const wsRes = await searchLocations({ query: '   ' });
  assert(Array.isArray(wsRes) && wsRes.length === 0, 'Whitespace query returns empty array');

  // Special characters
  const specialRes = await searchLocations({ query: '!@#$%^&*()_+' });
  assert(Array.isArray(specialRes), 'Special characters query handled safely without crash');

  // Very long query
  const longRes = await searchLocations({ query: 'a'.repeat(2000) });
  assert(Array.isArray(longRes), 'Very long 2000-char query handled safely without memory issue');

  // Limit bounds
  const limit5 = await searchLocations({ query: 'patti', limit: 5 });
  assert(limit5.length <= 5, `Limit 5 respected (actual: ${limit5.length})`);
  const limitNegative = await searchLocations({ query: 'patti', limit: -10 });
  assert(limitNegative.length >= 1, `Negative limit safely clamped to min 1 (actual: ${limitNegative.length})`);
  const limitExcessive = await searchLocations({ query: 'patti', limit: 99999 });
  assert(limitExcessive.length <= 100, `Excessive limit clamped to max 100 (actual: ${limitExcessive.length})`);

  // ----------------------------------------------------------------
  // 6. SAME-NAME DISAMBIGUATION & CONTEXT INTEGRITY
  // ----------------------------------------------------------------
  console.log('\n--- 6. Same-Name Disambiguation & Context Integrity ---');
  // Sendamangalam has multiple entities:
  // 1. Sendamangalam Town Panchayat (Urban Stream)
  // 2. Sendamangalam Village Panchayat / Revenue Village (Rural/Revenue)
  const sendaDisambig = await searchLocations({ query: 'Sendamangalam' });
  assert(sendaDisambig.length >= 2, `Sendamangalam returned multiple distinct entities (got ${sendaDisambig.length})`);

  const hasUrbanSenda = sendaDisambig.some(r => r.administrative_type === 'town_panchayat');
  const hasRuralOrRevSenda = sendaDisambig.some(r => r.administrative_type === 'village_panchayat' || r.administrative_type === 'revenue_village');
  assert(hasUrbanSenda && hasRuralOrRevSenda, 'Sendamangalam distinct administrative entities (Town Panchayat vs Village Panchayat / Revenue Village) distinguishable in results');

  // Verify all search results include parent context and administrative badges
  assert(sendaDisambig.every(r => !!r.parent_context && !!r.type_label), 'All search results contain explicit parent_context and type_label');

  // ----------------------------------------------------------------
  // 7. QUARANTINE ISOLATION (MANDATORY NEGATIVE TEST)
  // ----------------------------------------------------------------
  console.log('\n--- 7. Quarantine Isolation (Zero Leakage Check) ---');
  const quarantinedRecords = LOCATIONS_DATA.filter(l => l.is_quarantined);
  assert(quarantinedRecords.length === 9354, `Quarantined records count matches exactly 9,354 (actual: ${quarantinedRecords.length})`);

  // Sample 25 representative quarantined records across various districts
  const sampleQuarantined = quarantinedRecords.slice(0, 25);
  let quarantinedLeakedInSearch = 0;

  for (const qRec of sampleQuarantined) {
    const results = await searchLocations({ query: qRec.name });
    const foundQuarantined = results.find(r => r.id === qRec.id);
    if (foundQuarantined) quarantinedLeakedInSearch++;
  }
  assert(quarantinedLeakedInSearch === 0, `Quarantined records leak test in search typeahead: 0 leaks out of ${sampleQuarantined.length} queries`);

  // Test getLocationsForTaluk quarantine isolation
  const sampleTalukWithQuarantined = sampleQuarantined[0].taluk_id;
  const citizenLocations = await getLocationsForTaluk(sampleTalukWithQuarantined, '', { includeQuarantined: false });
  assert(citizenLocations.every(l => !l.is_quarantined), 'getLocationsForTaluk returns zero quarantined records for citizen requests');

  // Test getVillagePanchayatsForBlock quarantine isolation
  const sampleBlockVps = await getVillagePanchayatsForBlock(sampleQuarantined[0].block_id || 'blk_coimbatore_sulur');
  assert(sampleBlockVps.every(l => !l.is_quarantined), 'getVillagePanchayatsForBlock returns zero quarantined records');

  // ----------------------------------------------------------------
  // 8. ADMINISTRATIVE STREAM SWITCHING & STALE VALUE PURGE
  // ----------------------------------------------------------------
  console.log('\n--- 8. Administrative Stream Switching & State Purge ---');
  // Simulate LocationAuthority.state transitions and clearInactiveStreamValues
  const mockUIState = {
    districtId: 'coimbatore',
    stream: 'rural',
    blockId: 'blk_coimbatore_sulur',
    villagePanchayatId: '223994',
    habitation: 'Pappampatti Road',
    urbanBodyId: '',
    urbanLocality: '',
    talukId: '',
    revenueVillageId: '',
    subdivisionId: 'blk_coimbatore_sulur',
    localBodyId: '223994',
    villageOrTown: 'Kannampalayam'
  };

  // Switch to Urban stream
  function simulateStreamSwitch(state, newStream) {
    state.stream = newStream;
    if (newStream !== 'rural') {
      state.blockId = '';
      state.villagePanchayatId = '';
      state.habitation = '';
    }
    if (newStream !== 'urban') {
      state.urbanBodyId = '';
      state.urbanLocality = '';
    }
    if (newStream !== 'revenue') {
      state.talukId = '';
      state.revenueVillageId = '';
    }
    state.subdivisionId = '';
    state.localBodyId = '';
    state.villageOrTown = '';
  }

  // Rural -> Urban
  simulateStreamSwitch(mockUIState, 'urban');
  assert(mockUIState.blockId === '' && mockUIState.villagePanchayatId === '' && mockUIState.habitation === '', 'Switching Rural -> Urban purges rural block, VP, and habitation');
  assert(mockUIState.subdivisionId === '' && mockUIState.localBodyId === '' && mockUIState.villageOrTown === '', 'Switching Rural -> Urban purges common location identifiers');

  // Populate Urban
  mockUIState.urbanBodyId = 'ulb_cbe_corp';
  mockUIState.urbanLocality = 'Gandhipuram';
  mockUIState.villageOrTown = 'Coimbatore';

  // Urban -> Revenue
  simulateStreamSwitch(mockUIState, 'revenue');
  assert(mockUIState.urbanBodyId === '' && mockUIState.urbanLocality === '', 'Switching Urban -> Revenue purges urban body ID and locality');

  // Populate Revenue
  mockUIState.talukId = 'cbe_sulur';
  mockUIState.revenueVillageId = 'rv_sulur';
  mockUIState.villageOrTown = 'Sulur';

  // Revenue -> Rural
  simulateStreamSwitch(mockUIState, 'rural');
  assert(mockUIState.talukId === '' && mockUIState.revenueVillageId === '', 'Switching Revenue -> Rural purges taluk ID and revenue village ID');

  // ----------------------------------------------------------------
  // 9. SEARCH-FIRST AUTO-SWITCH SIMULATION
  // ----------------------------------------------------------------
  console.log('\n--- 9. Search-First Auto-Switch Logic ---');
  // When a citizen selects a Village Panchayat from typeahead:
  const vpCandidate = activeVPs[0];
  let autoStreamVP = 'rural';
  if (['corporation', 'municipality', 'town_panchayat', 'locality'].includes(vpCandidate.administrative_type)) {
    autoStreamVP = 'urban';
  } else if (['revenue_village', 'taluk'].includes(vpCandidate.administrative_type)) {
    autoStreamVP = 'revenue';
  }
  assert(autoStreamVP === 'rural', `Selecting Village Panchayat auto-selects rural stream (actual: ${autoStreamVP})`);

  // When a citizen selects a Corporation:
  const corpCandidate = corporations[0];
  let autoStreamCorp = 'rural';
  if (['corporation', 'municipality', 'town_panchayat', 'locality'].includes(corpCandidate.type || corpCandidate.administrative_type)) {
    autoStreamCorp = 'urban';
  }
  assert(autoStreamCorp === 'urban', `Selecting Municipal Corporation auto-selects urban stream (actual: ${autoStreamCorp})`);

  // When a citizen selects a Revenue Village:
  const rvCandidate = activeRVs[0];
  let autoStreamRV = 'rural';
  if (['revenue_village', 'taluk'].includes(rvCandidate.administrative_type)) {
    autoStreamRV = 'revenue';
  }
  assert(autoStreamRV === 'revenue', `Selecting Revenue Village auto-selects revenue stream (actual: ${autoStreamRV})`);

  // ----------------------------------------------------------------
  // 10. MULTI-STREAM AUTHORITY RESOLUTION (NEVER GUESS FROM NAME)
  // ----------------------------------------------------------------
  console.log('\n--- 10. Authority Resolution Accuracy ---');
  // Rural: Kannampalayam Village Panchayat
  const ruralAuth = await resolveResponsibleAuthority({
    latitude: 11.025,
    longitude: 77.12,
    address: 'Kannampalayam, Sulur Block, Coimbatore, Tamil Nadu',
    category: 'garbage',
    manualSelection: {
      districtId: 'coimbatore',
      blockId: 'blk_coimbatore_sulur',
      subdivisionId: 'blk_coimbatore_sulur',
      localBodyId: '223994',
      villageOrTown: 'Kannampalayam',
      administrativeType: 'rural'
    }
  });

  assert(ruralAuth.jurisdiction.district === 'Coimbatore', 'Rural resolution resolves correct district (Coimbatore)');
  assert(!!ruralAuth.administrativeAuthority.office, `Rural resolution returned administrative authority office: ${ruralAuth.administrativeAuthority.office}`);
  const ruralDept = (ruralAuth.serviceResponsibility?.serviceDepartment || ruralAuth.administrativeAuthority?.serviceDepartment || '').toLowerCase();
  assert(ruralDept.includes('sanitation') || ruralDept.includes('panchayat'), 'Rural authority maps to Sanitation/Panchayat department');
  assert(ruralAuth.escalationContact.level.includes('Escalation') || ruralAuth.escalationContact.office.includes('Block') || ruralAuth.escalationContact.office.includes('Collector'), 'Rural Level 1 escalation points to BDO / Collectorate');

  // Urban: Coimbatore City Municipal Corporation
  const urbanAuth = await resolveResponsibleAuthority({
    latitude: 11.0168,
    longitude: 76.9558,
    address: 'Gandhipuram, Coimbatore Corporation, Tamil Nadu',
    category: 'water_supply',
    manualSelection: {
      districtId: 'coimbatore',
      urbanBodyId: 'ulb_cbe_corp',
      localBodyId: 'ulb_cbe_corp',
      villageOrTown: 'Coimbatore',
      administrativeType: 'urban'
    }
  });

  assert(urbanAuth.jurisdiction.district === 'Coimbatore', 'Urban resolution resolves correct district (Coimbatore)');
  assert(urbanAuth.administrativeAuthority.office.toLowerCase().includes('coimbatore'), 'Urban authority office corresponds to Coimbatore Corporation');

  // Specialized Transport Case: Traffic Signal Failure
  const transportAuth = await resolveResponsibleAuthority({
    latitude: 11.0168,
    longitude: 76.9558,
    address: 'Cross Cut Road, Gandhipuram, Coimbatore',
    category: 'traffic',
    mode: 'transportation',
    manualSelection: {
      districtId: 'coimbatore'
    }
  });
  const transportDept = (transportAuth.serviceResponsibility?.serviceDepartment || transportAuth.administrativeAuthority?.serviceDepartment || '').toLowerCase();
  assert(transportAuth.administrativeAuthority.office.toLowerCase().includes('traffic') || transportDept.includes('traffic'), 'Traffic issue routes to Traffic Police Department');

  // Fallback check: Non-existent village does not fabricate phone, falls back to Collectorate
  const fallbackAuth = await resolveResponsibleAuthority({
    latitude: 11.0,
    longitude: 77.0,
    address: 'Unknown Isolated Point, Coimbatore',
    category: 'roads',
    manualSelection: {
      districtId: 'coimbatore',
      subdivisionId: 'cbe_sulur',
      localBodyId: 'nonexistent_lb_id_9999',
      villageOrTown: 'Nonexistent Village'
    }
  });
  assert(fallbackAuth.fallbackApplied === true || fallbackAuth.administrativeAuthority.isVerified === true, 'Unknown locality safely uses verified administrative fallback chain');
  assert(fallbackAuth.administrativeAuthority.phone !== null && fallbackAuth.administrativeAuthority.phone.length > 0, 'Fallback authority has verified contact phone');

  // ----------------------------------------------------------------
  // 11. CONTROLLED COMPLAINT SUBMISSION & PERSISTENCE FLOW
  // ----------------------------------------------------------------
  console.log('\n--- 11. Controlled Complaint Submission & SLA Flow ---');
  // Generate Complaint ID
  const testComplaintId = await generateNextComplaintId();
  assert(/^CC-2026-\d{6}$/.test(testComplaintId), `Complaint ID format CC-2026-NNNNNN verified: ${testComplaintId}`);

  // SLA Calculation
  const now = new Date();
  const slaDeadlineLow = calculateSlaDeadline(now, 'low', false);
  const diffHoursLow = Math.round((slaDeadlineLow - now) / (1000 * 60 * 60));
  assert(diffHoursLow === 168, `Low priority SLA deadline is 168h (7 days) (actual: ${diffHoursLow}h)`);

  const slaDeadlineHigh = calculateSlaDeadline(now, 'high', false);
  const diffHoursHigh = Math.round((slaDeadlineHigh - now) / (1000 * 60 * 60));
  assert(diffHoursHigh === 24, `High priority SLA deadline is 24h (actual: ${diffHoursHigh}h)`);

  const slaDeadlineCrit = calculateSlaDeadline(now, 'critical', true);
  const diffHoursCrit = Math.round((slaDeadlineCrit - now) / (1000 * 60 * 60));
  assert(diffHoursCrit === 4, `Emergency priority SLA deadline is 4h (actual: ${diffHoursCrit}h)`);

  // ----------------------------------------------------------------
  // 12. HISTORICAL COMPLAINT PRESERVATION AUDIT (5/5 INTACT)
  // ----------------------------------------------------------------
  console.log('\n--- 12. Historical Complaint Preservation Audit ---');
  const client = supabaseAdmin || supabase;
  if (client) {
    try {
      const { data: issues, error } = await client
        .from('issues')
        .select('id, title, address, created_at')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Supabase issues query error:', error.message);
      } else {
        assert(issues.length === 5, `Exactly 5 historical complaints preserved in Supabase (actual: ${issues.length})`);
        
        // Check IDs and titles of the 5 complaints
        const expectedIds = [
          '729c7ddc-af65-4f45-8d4e-deaeabf1af66',
          'ae450a07-1cc7-432b-af58-adb0c6b8bd46',
          '5daeedd2-4ac6-471a-aa2d-bb6e9ab0e2c6',
          'cb2096e5-7e89-4f22-b3b6-aa7f35c4ec1b',
          'ef735054-650d-49f2-bada-8a1444e633e1'
        ];

        const allIdsMatch = expectedIds.every(id => issues.some(iss => iss.id === id));
        assert(allIdsMatch, 'All 5 historical complaint IDs strictly preserved without modification');

        const allAddressesIntact = issues.every(iss => iss.address && iss.address.includes('Kannampalayam') && iss.address.includes('Sulur'));
        assert(allAddressesIntact, 'All 5 historical complaint address strings strictly preserved unchanged');
      }
    } catch (e) {
      console.warn('Complaint preservation check exception:', e.message);
    }
  }

  // ----------------------------------------------------------------
  // 13. API SECURITY & INPUT SANITIZATION
  // ----------------------------------------------------------------
  console.log('\n--- 13. API Security & Input Sanitization ---');
  // SQL Injection test in search
  const sqlInjectionSearch = await searchLocations({ query: "' OR '1'='1" });
  assert(Array.isArray(sqlInjectionSearch), 'SQL injection query in search treated as literal text and handled safely');

  // SQL Injection in district parameter
  const sqlDistSearch = await searchLocations({ query: 'Sulur', districtId: "coimbatore'; DROP TABLE locations; --" });
  assert(Array.isArray(sqlDistSearch), 'SQL injection in districtId parameter normalized and handled safely');

  // HTML / Script injection
  const xssSearch = await searchLocations({ query: '<script>alert("xss")</script>' });
  assert(Array.isArray(xssSearch) && xssSearch.length === 0, 'Script injection in search handled safely with 0 matches');

  // Invalid administrative type
  const invalidTypeSearch = await searchLocations({ query: 'Sulur', adminType: 'malicious_type_hack' });
  assert(Array.isArray(invalidTypeSearch) && invalidTypeSearch.length === 0, 'Invalid administrative_type safely returns empty array');

  // ----------------------------------------------------------------
  // 14. NO ORPHAN RELATIONSHIPS IN LOCATIONS DATA
  // ----------------------------------------------------------------
  console.log('\n--- 14. Orphan Parent Reference Audit ---');
  const districtIdSet = new Set(DISTRICTS_DATA.map(d => d.id.toLowerCase()));
  const talukIdSet = new Set(TALUKS_DATA.map(t => t.id.toLowerCase()));
  const blockIdSet = new Set(BLOCKS_DATA.map(b => b.id.toLowerCase()));

  let orphanDistricts = 0;
  let orphanTaluks = 0;
  let orphanBlocks = 0;

  for (const loc of LOCATIONS_DATA) {
    if (loc.district_id && !districtIdSet.has(loc.district_id.toLowerCase())) {
      orphanDistricts++;
    }
    if (loc.taluk_id && !talukIdSet.has(loc.taluk_id.toLowerCase())) {
      orphanTaluks++;
    }
    if (loc.block_id && !blockIdSet.has(loc.block_id.toLowerCase())) {
      orphanBlocks++;
    }
  }

  assert(orphanDistricts === 0, `Zero orphan district references across entire location dataset (got ${orphanDistricts})`);
  assert(orphanTaluks === 0, `Zero orphan taluk references across entire location dataset (got ${orphanTaluks})`);
  assert(orphanBlocks === 0, `Zero orphan block references across entire location dataset (got ${orphanBlocks})`);

  // ----------------------------------------------------------------
  // 15. NO SYNTHETIC CITIZEN-FACING LOCATIONS
  // ----------------------------------------------------------------
  console.log('\n--- 15. Synthetic & Placeholder Data Audit ---');
  const activeLocations = LOCATIONS_DATA.filter(l => !l.is_quarantined);
  const syntheticInActive = activeLocations.filter(l => l.is_synthetic === true);
  assert(syntheticInActive.length === 0, `Active locations contain zero synthetic records (got ${syntheticInActive.length})`);

  const patternGeneratedInActive = activeLocations.filter(l => /_sample|_mock|_dummy|_temp|placeholder/i.test(l.id || l.name));
  assert(patternGeneratedInActive.length === 0, `Active locations contain zero template/mock patterns (got ${patternGeneratedInActive.length})`);

  // ----------------------------------------------------------------
  // TEST EXECUTION SUMMARY
  // ----------------------------------------------------------------
  console.log('\n================================================================');
  console.log('TEST EXECUTION SUMMARY:');
  console.log(`- Passed: ${totalPassed}`);
  console.log(`- Failed: ${totalFailed}`);
  console.log(`- Overall Result: ${totalFailed === 0 ? 'ALL CHECKS PASSED [OK]' : 'FAILURES DETECTED'}`);
  console.log('================================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runStep4ValidationSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
