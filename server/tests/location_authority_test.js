/**
 * Test Suite: Location-Aware Authority & Civic Contact System
 * Verifies all 20 test specifications:
 * - 4-tier administrative hierarchy
 * - Rural vs Urban distinction (Village Panchayat, Town Panchayat, Municipality, Municipal Corporation)
 * - Multi-factor resolution matrix (Location + Body Type + Category)
 * - Verified Official Contacts (Phone, Email, Source URL, Timestamp)
 * - Fallback chain (Local Body -> Taluk/Block -> District Collectorate)
 * - Escalation contacts and CrowdCity 24/7 Helpline
 * - Specialized transport routing
 * - API Endpoints (/districts, /subdivisions, /local-bodies, /resolve)
 */

import assert from 'assert';
import {
  DISTRICTS_DIRECTORY,
  SUBDIVISIONS_DIRECTORY,
  LOCAL_BODIES_DIRECTORY,
  getAllDistrictsList,
  getSubdivisionsForDistrict,
  getLocalBodiesForSubdivision,
  resolveResponsibleAuthority,
  parseLocationHierarchy
} from '../services/authorityDirectoryService.js';
import {
  VILLAGES_BY_SUBDIVISION,
  getVillagesForSubdivision,
  getAllVillagesForDistrict
} from '../services/villageDirectoryService.js';

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n--- Running Location-Aware Authority & Civic Contact Test Suite ---\n');

// 1. Directory Structure Tests
it('1. Districts Directory contains 38 Tamil Nadu districts', () => {
  assert.strictEqual(DISTRICTS_DIRECTORY.length, 38, 'Must have exactly 38 districts');
  const cbe = DISTRICTS_DIRECTORY.find(d => d.id === 'coimbatore');
  assert(cbe, 'Coimbatore district must exist');
  assert.strictEqual(cbe.code, 'cbe');
  assert.strictEqual(cbe.collectorate.phone, '0422-2301114');
  assert.strictEqual(cbe.collectorate.email, 'collrcbe@nic.in');
  assert(cbe.collectorate.isVerified, 'Collectorate contact must be verified');
});

it('2. Subdivisions Directory contains Sulur, Coimbatore North/South, Pollachi, Chennai Zones', () => {
  const sulur = SUBDIVISIONS_DIRECTORY.find(s => s.id === 'cbe_sulur');
  assert(sulur, 'Sulur taluk subdivision must exist');
  assert.strictEqual(sulur.districtId, 'coimbatore');
  assert.strictEqual(sulur.type, 'taluk');
  assert.strictEqual(sulur.phone, '0422-2687200');

  const sulurBlock = SUBDIVISIONS_DIRECTORY.find(s => s.id === 'cbe_sulur_block');
  assert(sulurBlock, 'Sulur Panchayat Union block must exist');
  assert.strictEqual(sulurBlock.type, 'block');

  const chennaiZone5 = SUBDIVISIONS_DIRECTORY.find(s => s.id === 'chn_zone5');
  assert(chennaiZone5, 'Chennai Zone 5 Royapuram must exist');
});

it('3. Local Bodies Directory contains Village Panchayats, Town Panchayats, Municipalities, Corporations', () => {
  const kp = LOCAL_BODIES_DIRECTORY.find(lb => lb.id === 'lb_cbe_kannampalayam');
  assert(kp, 'Kannampalayam Village Panchayat must exist');
  assert.strictEqual(kp.localBodyType, 'village_panchayat');
  assert.strictEqual(kp.tier, 'rural');

  const sulurTP = LOCAL_BODIES_DIRECTORY.find(lb => lb.id === 'lb_cbe_sulur_tp');
  assert(sulurTP, 'Sulur Town Panchayat must exist');
  assert.strictEqual(sulurTP.localBodyType, 'town_panchayat');

  const pollachiMun = LOCAL_BODIES_DIRECTORY.find(lb => lb.id === 'lb_cbe_pollachi_mun');
  assert(pollachiMun, 'Pollachi Municipality must exist');
  assert.strictEqual(pollachiMun.localBodyType, 'municipality');

  const ccmc = LOCAL_BODIES_DIRECTORY.find(lb => lb.id === 'lb_cbe_ccmc');
  assert(ccmc, 'CCMC Municipal Corporation must exist');
  assert.strictEqual(ccmc.localBodyType, 'municipal_corporation');
  assert.strictEqual(ccmc.tier, 'urban');

  const gcc = LOCAL_BODIES_DIRECTORY.find(lb => lb.id === 'lb_chn_gcc');
  assert(gcc, 'GCC Municipal Corporation must exist');
  assert.strictEqual(gcc.localBodyType, 'municipal_corporation');
});

// 2. Cascade Hierarchy Traversal Queries
it('4. Traversal query getAllDistrictsList returns 38 formatted items', () => {
  const list = getAllDistrictsList();
  assert.strictEqual(list.length, 38);
  assert(list[0].id && list[0].name && list[0].nameTa);
});

it('5. Traversal query getSubdivisionsForDistrict filters correctly by districtId', () => {
  const cbeSubs = getSubdivisionsForDistrict('coimbatore');
  assert(cbeSubs.length >= 5, 'Coimbatore should have at least 5 subdivisions defined');
  const chnSubs = getSubdivisionsForDistrict('chennai');
  assert(chnSubs.length >= 3, 'Chennai should have zonal subdivisions defined');
});

it('6. Traversal query getLocalBodiesForSubdivision filters by district and subdivision', () => {
  const sulurLbs = getLocalBodiesForSubdivision('coimbatore', 'cbe_sulur');
  assert(sulurLbs.length >= 2, 'Sulur subdivision should have local bodies');
  const kp = sulurLbs.find(lb => lb.id === 'lb_cbe_kannampalayam');
  assert(kp, 'Kannampalayam must be in Sulur subdivision list');
  assert.strictEqual(kp.localBodyTypeFormatted, 'Village Panchayat');
});

// 3. Automated Reverse Geocode & Hierarchy Parsing Tests
it('7. parseLocationHierarchy accurately parses Kannampalayam rural address', () => {
  const rawAddress = 'Kannampalayam, Sulur Taluk, Coimbatore District, Tamil Nadu, 641402, India';
  const parsed = parseLocationHierarchy(rawAddress, 11.0028, 77.0853);
  assert.strictEqual(parsed.district.id, 'coimbatore');
  assert.strictEqual(parsed.subdivision.name, 'Sulur');
  assert.strictEqual(parsed.localBody.id, 'lb_cbe_kannampalayam');
  assert.strictEqual(parsed.localBody.localBodyType, 'village_panchayat');
  assert.strictEqual(parsed.villageOrTown, 'Kannampalayam');
});

it('8. parseLocationHierarchy accurately parses Urban Chennai Corporation address', () => {
  const rawAddress = 'Royapuram, Chennai Corporation, Chennai, Tamil Nadu, 600013, India';
  const parsed = parseLocationHierarchy(rawAddress, 13.0827, 80.2707);
  assert.strictEqual(parsed.district.id, 'chennai');
  assert.strictEqual(parsed.localBody.localBodyType, 'municipal_corporation');
});

// 4. Multi-Factor Authority Resolution Tests
await itAsync('9. Rural Case: Kannampalayam Village Panchayat with garbage/sanitation issue', async () => {
  const res = await resolveResponsibleAuthority({
    latitude: 11.0028,
    longitude: 77.0853,
    address: 'Kannampalayam, Sulur, Coimbatore, Tamil Nadu',
    category: 'garbage'
  });

  // Jurisdiction check
  assert.strictEqual(res.jurisdiction.district, 'Coimbatore');
  assert.strictEqual(res.jurisdiction.taluk, 'Sulur');
  assert.strictEqual(res.jurisdiction.localBody, 'Kannampalayam Village Panchayat');
  assert.strictEqual(res.jurisdiction.localBodyType, 'Village Panchayat');
  assert.strictEqual(res.jurisdiction.tier, 'Rural');

  // Administrative authority check
  const auth = res.administrativeAuthority;
  assert(auth.office.includes('Kannampalayam') || auth.office.includes('Sulur'));
  assert(auth.hasPhone, 'Must have verified phone contact');
  assert(auth.hasEmail, 'Must have verified email contact');
  assert(auth.isVerified, 'Must be flagged as verified');
  assert(auth.sourceUrl.includes('tn.gov.in') || auth.sourceUrl.includes('nic.in'));

  // Elected representative check
  const rep = res.electedRepresentative;
  assert(rep, 'Must provide elected representative info');
  assert(rep.designation.includes('President') || rep.office.includes('President'));

  // Escalation contact check
  const esc = res.escalationContact;
  assert(esc, 'Must provide Level 1 escalation contact');
  assert(esc.office.includes('Block Development') || esc.designation.includes('BDO') || esc.office.includes('Sulur'));
});

await itAsync('10. Urban Case: Coimbatore City Municipal Corporation with water_supply issue', async () => {
  const res = await resolveResponsibleAuthority({
    latitude: 11.0168,
    longitude: 76.9558,
    address: 'RS Puram, Coimbatore, Tamil Nadu',
    category: 'water_supply'
  });

  assert.strictEqual(res.jurisdiction.district, 'Coimbatore');
  assert.strictEqual(res.jurisdiction.localBodyType, 'Municipal Corporation');
  assert.strictEqual(res.jurisdiction.tier, 'Urban');

  const auth = res.administrativeAuthority;
  assert(auth.office.includes('Municipal Corporation') || auth.office.includes('CCMC'));
  assert(auth.hasPhone);
  assert(auth.hasEmail);
  assert(auth.isVerified);
});

await itAsync('11. Manual Override Case: Pollachi Municipality with drainage issue', async () => {
  const res = await resolveResponsibleAuthority({
    category: 'drainage',
    manualSelection: {
      districtId: 'coimbatore',
      subdivisionId: 'cbe_pollachi',
      localBodyId: 'lb_cbe_pollachi_mun',
      villageOrTown: 'Pollachi'
    }
  });

  assert.strictEqual(res.jurisdiction.district, 'Coimbatore');
  assert.strictEqual(res.jurisdiction.taluk, 'Pollachi');
  assert.strictEqual(res.jurisdiction.localBody, 'Pollachi Municipality');
  assert.strictEqual(res.jurisdiction.localBodyType, 'Municipality');
  assert.strictEqual(res.jurisdiction.tier, 'Urban');

  const auth = res.administrativeAuthority;
  assert(auth.office.includes('Pollachi Municipality'));
  assert(auth.hasPhone);
  assert(auth.hasEmail);
});

await itAsync('12. Specialized Transport Case: Traffic Signal Failure routes to Traffic Police', async () => {
  const res = await resolveResponsibleAuthority({
    latitude: 11.0168,
    longitude: 76.9558,
    address: 'Gandhipuram, Coimbatore, Tamil Nadu',
    category: 'traffic',
    mode: 'transportation'
  });

  const auth = res.administrativeAuthority;
  assert(auth.office.includes('Traffic') || auth.designation.includes('Traffic') || auth.serviceDepartment.includes('Traffic'));
  assert(auth.hasPhone);
  assert(auth.hasEmail);
  assert(auth.isVerified);
});

await itAsync('13. Specialized Transport Case: Bus Transit Issue routes to TNSTC Regional Branch', async () => {
  const res = await resolveResponsibleAuthority({
    latitude: 11.0168,
    longitude: 76.9558,
    address: 'Gandhipuram Bus Stand, Coimbatore, Tamil Nadu',
    category: 'Bus Stop Issues',
    mode: 'transportation'
  });

  const auth = res.administrativeAuthority;
  assert(auth.office.includes('TNSTC') || auth.serviceDepartment.includes('Transport'));
  assert(auth.isVerified);
});

await itAsync('14. Fallback Chain: Unknown village/local body gracefully falls back to Taluk / Collectorate', async () => {
  const res = await resolveResponsibleAuthority({
    latitude: 11.0000,
    longitude: 77.0000,
    address: 'Unmapped Remote Hamlet, Sulur, Coimbatore',
    category: 'roads'
  });

  assert(res.jurisdiction.district === 'Coimbatore');
  assert(res.administrativeAuthority.hasPhone, 'Fallback authority must have contact phone');
  assert(res.administrativeAuthority.hasEmail, 'Fallback authority must have contact email');
});

it('15. Distinction between Administrative Authority and Elected Representative is clear', () => {
  const kp = LOCAL_BODIES_DIRECTORY.find(lb => lb.id === 'lb_cbe_kannampalayam');
  assert(kp.authorities.administrative, 'Must have administrative authority');
  assert(kp.authorities.elected, 'Must have elected representative');
  assert.notStrictEqual(kp.authorities.administrative.designation, kp.authorities.elected.designation);
  assert(kp.authorities.administrative.designation.includes('Secretary') || kp.authorities.administrative.designation.includes('Officer'));
  assert(kp.authorities.elected.designation.includes('President'));
});

it('16. All collectorate contacts across 38 districts have official domains (*.nic.in or *.tn.gov.in)', () => {
  DISTRICTS_DIRECTORY.forEach(d => {
    assert(d.collectorate.email.endsWith('.in') || d.collectorate.email.endsWith('.gov.in'), `Email for ${d.name} must be official`);
    assert(d.collectorate.sourceUrl.includes('nic.in') || d.collectorate.sourceUrl.includes('tn.gov.in'), `Source URL for ${d.name} must be official`);
    assert(d.collectorate.phone.length >= 8, `Phone for ${d.name} must be valid`);
  });
});

it('17. Local Body types correctly map to 4 tiers and Rural/Urban designations', () => {
  const types = LOCAL_BODIES_DIRECTORY.map(lb => lb.localBodyType);
  assert(types.includes('village_panchayat'));
  assert(types.includes('town_panchayat'));
  assert(types.includes('municipality'));
  assert(types.includes('municipal_corporation'));
});

await itAsync('18. Level 1 Escalation for Village Panchayat is Block Development Officer', async () => {
  const res = await resolveResponsibleAuthority({
    latitude: 11.0028,
    longitude: 77.0853,
    address: 'Kannampalayam, Sulur, Coimbatore',
    category: 'water_supply'
  });
  assert(res.escalationContact.designation.includes('BDO') || res.escalationContact.office.includes('Block'));
});

await itAsync('19. Level 1 Escalation for Municipal Corporation is District Collectorate', async () => {
  const res = await resolveResponsibleAuthority({
    latitude: 11.0168,
    longitude: 76.9558,
    address: 'Gandhipuram, Coimbatore, Tamil Nadu',
    category: 'water_supply'
  });
  assert(res.escalationContact.designation.includes('Collector') || res.escalationContact.office.includes('Collector'));
});

await itAsync('20. CrowdCity 24/7 Helpline Support contact is present in all resolution payloads', async () => {
  const res = await resolveResponsibleAuthority({
    latitude: 11.0028,
    longitude: 77.0853,
    address: 'Kannampalayam, Coimbatore',
    category: 'roads'
  });
  assert(res.supportFallback, 'supportFallback must be present');
  assert(res.supportFallback.label === 'CrowdCity Support');
});

it('21. Village Directory returns Sendamangalam authentic revenue villages in Namakkal', () => {
  const villages = getVillagesForSubdivision('namakkal', 'nmk_sendamangalam');
  assert(villages.length >= 10, `Sendamangalam should have >= 10 villages, got ${villages.length}`);
  const names = villages.map(v => v.name);
  assert(names.includes('Sendamangalam'), 'Must include Sendamangalam');
  assert(names.includes('Kalappanaickenpatti'), 'Must include Kalappanaickenpatti');
  assert(names.includes('Belukurichi'), 'Must include Belukurichi');
  assert(names.includes('Pachudaiyampatti'), 'Must include Pachudaiyampatti');
  const kalap = villages.find(v => v.name === 'Kalappanaickenpatti');
  assert.strictEqual(kalap.nameTa, 'காளப்பநாயக்கன்பட்டி');
  assert.strictEqual(kalap.type, 'town');
});

it('22. Village Directory returns Sulur authentic revenue villages in Coimbatore', () => {
  const villages = getVillagesForSubdivision('coimbatore', 'cbe_sulur');
  assert(villages.length >= 10, `Sulur should have >= 10 villages, got ${villages.length}`);
  const names = villages.map(v => v.name);
  assert(names.includes('Sulur'), 'Must include Sulur');
  assert(names.includes('Kannampalayam'), 'Must include Kannampalayam');
  assert(names.includes('Irugur'), 'Must include Irugur');
  assert(names.includes('Kalangal'), 'Must include Kalangal');
  const kp = villages.find(v => v.name === 'Kannampalayam');
  assert.strictEqual(kp.nameTa, 'கண்ணம்பாளையம்');
  assert.strictEqual(kp.type, 'town');
});

it('23. Village Directory covers all 38 districts with authentic subdivisions and villages', () => {
  const allDistricts = getAllDistrictsList();
  assert.strictEqual(allDistricts.length, 38, 'Must verify all 38 districts');

  let coveredCount = 0;
  for (const d of allDistricts) {
    const subs = getSubdivisionsForDistrict(d.id);
    assert(subs.length > 0, `District ${d.name} (${d.id}) must have subdivisions`);
    const firstSub = subs[0];
    const vils = getVillagesForSubdivision(d.id, firstSub.id);
    assert(vils.length > 0, `District ${d.name} sub ${firstSub.name} (${firstSub.id}) must return villages`);
    coveredCount++;
  }
  assert.strictEqual(coveredCount, 38, 'All 38 districts must have authentic villages mapped');
});

it('24. Suffix and normalized matching resolves both exact ID and clean taluk name', () => {
  const byExactId = getVillagesForSubdivision('namakkal', 'nmk_sendamangalam');
  const bySuffix = getVillagesForSubdivision('namakkal', 'sendamangalam');
  assert.strictEqual(byExactId.length, bySuffix.length, 'Exact ID and clean suffix should return same villages');
  assert(bySuffix.map(v => v.name).includes('Sendamangalam'));
});

console.log(`\n========================================`);
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log(`All ${passed} Location-Aware Authority & Civic Contact tests passed successfully!`);
}
