import {
  getDistricts,
  getTaluksForDistrict,
  getLocationsForTaluk,
  getLocalBodiesForLocation
} from '../services/locationHierarchyService.js';
import { DISTRICTS_DATA, TALUKS_DATA, LOCATIONS_DATA, LOCAL_BODIES_DATA } from '../data/locationHierarchyData.js';

async function runValidationSuite() {
  console.log('\n================================================================');
  console.log('CROWD CITY — COMPLETE TAMIL NADU LOCATION HIERARCHY VALIDATION');
  console.log('================================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failedTests++;
    }
  }

  // 1. Validate All 38 Districts
  console.log('--- 1. District Registry Validation ---');
  const districts = await getDistricts();
  assert(districts.length === 38, `District count: Expected 38, Actual ${districts.length}`);
  
  const hasNamakkal = districts.some(d => d.id === 'namakkal' && d.name === 'Namakkal');
  assert(hasNamakkal, 'Namakkal district exists with authentic bilingual naming');

  const hasCoimbatore = districts.some(d => d.id === 'coimbatore' && d.name === 'Coimbatore');
  assert(hasCoimbatore, 'Coimbatore district exists with authentic bilingual naming');

  const hasChennai = districts.some(d => d.id === 'chennai' && d.name === 'Chennai');
  assert(hasChennai, 'Chennai district exists with authentic bilingual naming');

  // 2. Validate Taluk Data & Parent-Child Relationships
  console.log('\n--- 2. Taluk Relationship & Isolation Validation ---');
  assert(TALUKS_DATA.length >= 286, `Total Taluks registered: ${TALUKS_DATA.length}`);
  
  const nmkTaluks = await getTaluksForDistrict('namakkal');
  assert(nmkTaluks.length === 8, `Namakkal taluk count: Expected 8, Actual ${nmkTaluks.length}`);

  const expectedNmkTaluks = ['Namakkal', 'Tiruchengode', 'Rasipuram', 'Paramathi Velur', 'Kolli Hills', 'Sendamangalam', 'Kumarapalayam', 'Mohanur'];
  const nmkTalukNames = nmkTaluks.map(t => t.name);
  const allNmkPresent = expectedNmkTaluks.every(n => nmkTalukNames.includes(n));
  assert(allNmkPresent, `Namakkal contains all 8 authentic taluks: ${nmkTalukNames.join(', ')}`);

  // Ensure zero foreign taluks in Namakkal
  const foreignInNmk = nmkTaluks.filter(t => t.district_id !== 'namakkal');
  assert(foreignInNmk.length === 0, 'Zero foreign/unrelated taluks present under Namakkal');

  // 3. Specific Test: Sendamangalam Taluk Completeness
  console.log('\n--- 3. Specific Test: Sendamangalam Taluk In-Depth Completeness ---');
  const sendamangalamLocations = await getLocationsForTaluk('nmk_sendamangalam');
  assert(sendamangalamLocations.length >= 45, `Sendamangalam locations count: Expected >= 45, Actual ${sendamangalamLocations.length}`);

  const sampleSendamangalam = [
    'Sendamangalam',
    'Kalappanaickenpatti',
    'Erumapatti',
    'Belukurichi',
    'Pottanam',
    'Pachudaiyampatti',
    'Periakulam',
    'Naducombai',
    'Pavithram',
    'Varagur',
    'Bommasamudram',
    'Kalkurichi',
    'Thuthikulam',
    'Akkalampatti',
    'Uthirakidikaval',
    'Valavanthicombai',
    'Valayapatty'
  ];

  const foundAllSample = sampleSendamangalam.every(sName => 
    sendamangalamLocations.some(l => l.name.toLowerCase() === sName.toLowerCase())
  );
  assert(foundAllSample, 'Sendamangalam contains all sample verified settlements (Towns, Village Panchayats, Revenue Villages)');

  // 4. Distinction Between Administrative Types
  console.log('\n--- 4. Administrative Type Preservation Validation ---');
  const locationTypes = new Set(LOCATIONS_DATA.map(l => l.location_type));
  assert(locationTypes.has('revenue_village'), 'Includes location_type: revenue_village');
  assert(locationTypes.has('village_panchayat'), 'Includes location_type: village_panchayat');
  assert(locationTypes.has('town_panchayat'), 'Includes location_type: town_panchayat');

  const smTown = sendamangalamLocations.find(l => l.name === 'Sendamangalam');
  assert(smTown && smTown.location_type === 'town_panchayat', 'Sendamangalam correctly classified as town_panchayat');

  const pottanamVillage = sendamangalamLocations.find(l => l.name === 'Pottanam');
  assert(pottanamVillage && ['village', 'village_panchayat', 'revenue_village'].includes(pottanamVillage.location_type), 'Pottanam correctly classified as rural village settlement');

  // 5. Duplicate Prevention & Stable IDs
  console.log('\n--- 5. Duplicate Prevention & Key Integrity ---');
  const uniqueLocIds = new Set();
  let duplicateLocCount = 0;
  LOCATIONS_DATA.forEach(l => {
    if (uniqueLocIds.has(l.id)) duplicateLocCount++;
    uniqueLocIds.add(l.id);
  });
  assert(duplicateLocCount === 0, `Zero duplicate location IDs across entire dataset (${uniqueLocIds.size} unique IDs)`);

  const uniqueTalukIds = new Set();
  let duplicateTalukCount = 0;
  TALUKS_DATA.forEach(t => {
    if (uniqueTalukIds.has(t.id)) duplicateTalukCount++;
    uniqueTalukIds.add(t.id);
  });
  assert(duplicateTalukCount === 0, `Zero duplicate taluk IDs across entire dataset (${uniqueTalukIds.size} unique IDs)`);

  // 6. Local Bodies Mapping Validation
  console.log('\n--- 6. Local Body Mapping Validation ---');
  const sendamangalamLBs = await getLocalBodiesForLocation({ districtId: 'namakkal', talukId: 'nmk_sendamangalam', villageName: 'Sendamangalam' });
  assert(sendamangalamLBs.length > 0, `Sendamangalam local bodies mapped: ${sendamangalamLBs.length}`);
  
  const hasSmTP = sendamangalamLBs.some(lb => lb.name.includes('Town Panchayat'));
  assert(hasSmTP, 'Contains Sendamangalam Town Panchayat');

  const hasSmPU = sendamangalamLBs.some(lb => lb.name.includes('Panchayat Union'));
  assert(hasSmPU, 'Contains Sendamangalam Panchayat Union');

  // 7. Multi-District Verification (Coimbatore, Chennai, Salem, Madurai, Tiruchirappalli)
  console.log('\n--- 7. Cross-District Multi-Test Validation ---');
  const cbeTaluks = await getTaluksForDistrict('coimbatore');
  assert(cbeTaluks.length >= 10, `Coimbatore taluk count: ${cbeTaluks.length}`);
  const sulurLocs = await getLocationsForTaluk('cbe_sulur');
  assert(sulurLocs.length >= 25, `Sulur taluk location count: ${sulurLocs.length}`);

  const salemTaluks = await getTaluksForDistrict('salem');
  assert(salemTaluks.length >= 9, `Salem taluk count: ${salemTaluks.length}`);

  const mduTaluks = await getTaluksForDistrict('madurai');
  assert(mduTaluks.length >= 8, `Madurai taluk count: ${mduTaluks.length}`);

  // 8. Generate District-By-District Summary Table
  console.log('\n================================================================');
  console.log('DISTRICT-BY-DISTRICT VALIDATION SUMMARY TABLE');
  console.log('================================================================');
  console.log('District               | Taluks | Locations | Validation Status');
  console.log('-----------------------|--------|-----------|------------------');

  for (const d of districts) {
    const taluks = await getTaluksForDistrict(d.id);
    let totalLocsInDist = 0;
    for (const t of taluks) {
      const locs = await getLocationsForTaluk(t.id);
      totalLocsInDist += locs.length;
    }
    const distCol = (d.name + ' (' + d.id + ')').padEnd(23);
    const talukCol = String(taluks.length).padStart(6);
    const locCol = String(totalLocsInDist).padStart(9);
    const status = taluks.length > 0 && totalLocsInDist > 0 ? '✓ VALIDATED' : '✗ INCOMPLETE';
    console.log(`${distCol}| ${talukCol} | ${locCol} | ${status}`);
  }

  console.log('================================================================');
  console.log(`Test Execution Summary:`);
  console.log(`- Tests Passed: ${passedTests}`);
  console.log(`- Tests Failed: ${failedTests}`);
  console.log(`- Overall Result: ${failedTests === 0 ? 'ALL CHECKS PASSED ✓' : 'FAILURES DETECTED ✗'}`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runValidationSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
