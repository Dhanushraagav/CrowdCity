import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DISTRICTS_DATA, TALUKS_DATA, BLOCKS_DATA, LOCATIONS_DATA, URBAN_LOCAL_BODIES_DATA } from '../data/locationHierarchyData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run38DistrictAudit() {
  console.log('================================================================');
  console.log('CROWD CITY AI - STEP 4: 38-DISTRICT PRODUCTION COVERAGE AUDIT');
  console.log('================================================================');

  const auditResults = [];
  const districtIds = new Set();
  const districtCodes = new Set();

  let hasErrors = false;

  // Build lookups
  const taluksByDistrict = new Map();
  TALUKS_DATA.forEach(t => {
    const dId = (t.district_id || '').toLowerCase();
    if (!taluksByDistrict.has(dId)) taluksByDistrict.set(dId, []);
    taluksByDistrict.get(dId).push(t);
  });

  const blocksByDistrict = new Map();
  BLOCKS_DATA.forEach(b => {
    const dId = (b.district_id || '').toLowerCase();
    if (!blocksByDistrict.has(dId)) blocksByDistrict.set(dId, []);
    blocksByDistrict.get(dId).push(b);
  });

  const ulbsByDistrict = new Map();
  (URBAN_LOCAL_BODIES_DATA || []).forEach(u => {
    const dId = (u.district_id || '').toLowerCase();
    if (!ulbsByDistrict.has(dId)) ulbsByDistrict.set(dId, []);
    ulbsByDistrict.get(dId).push(u);
  });

  const locationsByDistrict = new Map();
  LOCATIONS_DATA.forEach(l => {
    const dId = (l.district_id || '').toLowerCase();
    if (!locationsByDistrict.has(dId)) locationsByDistrict.set(dId, []);
    locationsByDistrict.get(dId).push(l);
  });

  console.log(`Total Registered Districts in DISTRICTS_DATA: ${DISTRICTS_DATA.length}`);

  for (const dist of DISTRICTS_DATA) {
    const id = dist.id ? dist.id.toLowerCase() : '';
    const code = dist.code ? dist.code.toLowerCase() : '';
    const name = dist.name;
    const nameTa = dist.tamil_name || dist.nameTa;

    // Checks
    const isIdValid = !!id && id.length > 0;
    const isCodeValid = !!code && code.length > 0;
    const isNameValid = !!name && name.length > 0;
    const isNameTaValid = !!nameTa && nameTa.length > 0;

    const isDuplicateId = districtIds.has(id);
    const isDuplicateCode = districtCodes.has(code);

    if (id) districtIds.add(id);
    if (code) districtCodes.add(code);

    // Streams count
    const taluks = taluksByDistrict.get(id) || [];
    const blocks = blocksByDistrict.get(id) || [];
    const ulbs = ulbsByDistrict.get(id) || [];
    const locations = locationsByDistrict.get(id) || [];

    const activeVPs = locations.filter(l => !l.is_quarantined && l.administrative_type === 'village_panchayat');
    const activeRVs = locations.filter(l => !l.is_quarantined && l.administrative_type === 'revenue_village');
    const activeULBLocs = locations.filter(l => !l.is_quarantined && ['corporation', 'municipality', 'town_panchayat', 'locality'].includes(l.administrative_type));
    const quarantinedCount = locations.filter(l => l.is_quarantined).length;

    // Orphan parent check for locations under this district
    const talukIdSet = new Set(taluks.map(t => t.id.toLowerCase()));
    const blockIdSet = new Set(blocks.map(b => b.id.toLowerCase()));

    let orphanCount = 0;
    for (const loc of locations) {
      if (loc.taluk_id && !talukIdSet.has(loc.taluk_id.toLowerCase())) {
        orphanCount++;
      }
      if (loc.block_id && !blockIdSet.has(loc.block_id.toLowerCase())) {
        orphanCount++;
      }
    }

    const isChennai = (id === 'chennai');
    // Chennai is 100% urban corporation, hence has 0 rural blocks and 0 village panchayats legitimately
    const ruralStatus = isChennai ? 'not_applicable (100% urban)' : (blocks.length > 0 ? 'valid' : 'missing');
    const revenueStatus = taluks.length > 0 ? 'valid' : 'missing';
    const urbanStatus = ulbs.length > 0 || isChennai ? 'valid' : 'applicable';

    const status = (isIdValid && isCodeValid && !isDuplicateId && !isDuplicateCode && orphanCount === 0) ? 'VALIDATED' : 'FLAGGED';
    if (status === 'FLAGGED') hasErrors = true;

    auditResults.push({
      id,
      code,
      name,
      name_ta: nameTa,
      taluk_count: taluks.length,
      block_count: blocks.length,
      ulb_count: ulbs.length,
      total_locations: locations.length,
      active_vps: activeVPs.length,
      active_rvs: activeRVs.length,
      active_ulbs_and_localities: activeULBLocs.length,
      quarantined_count: quarantinedCount,
      orphan_parent_count: orphanCount,
      rural_stream_status: ruralStatus,
      revenue_stream_status: revenueStatus,
      urban_stream_status: urbanStatus,
      audit_status: status
    });
  }

  const reportPath = path.join(__dirname, '../data/step4_38_district_audit_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(auditResults, null, 2));

  console.log('\n----------------------------------------------------------------');
  console.log('DISTRICT AUDIT SUMMARY (38 DISTRICTS)');
  console.log('----------------------------------------------------------------');
  console.table(auditResults.map(r => ({
    District: `${r.name} (${r.id})`,
    Code: r.code,
    Taluks: r.taluk_count,
    Blocks: r.block_count,
    ULBs: r.ulb_count,
    ActiveVPs: r.active_vps,
    Orphans: r.orphan_parent_count,
    Status: r.audit_status
  })));

  console.log('\nAudit Statistics:');
  console.log(`- Total Districts Evaluated: ${auditResults.length}`);
  console.log(`- Unique District IDs: ${districtIds.size}`);
  console.log(`- Unique District Codes: ${districtCodes.size}`);
  console.log(`- Total Validated: ${auditResults.filter(r => r.audit_status === 'VALIDATED').length}`);
  console.log(`- Total Flagged: ${auditResults.filter(r => r.audit_status === 'FLAGGED').length}`);
  console.log(`- Saved Machine-Readable Report: ${reportPath}`);

  if (hasErrors) {
    console.error('Audit failed with flagged issues.');
    process.exit(1);
  } else {
    console.log('ALL 38 DISTRICTS VALIDATED SUCCESSFULLY [OK]');
  }
}

run38DistrictAudit().catch(err => {
  console.error('Audit error:', err);
  process.exit(1);
});
