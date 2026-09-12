import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DISTRICTS_DATA, TALUKS_DATA, BLOCKS_DATA, LOCATIONS_DATA, LOCAL_BODIES_DATA } from '../data/locationHierarchyData.js';
import { supabaseAdmin, supabase } from '../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runStep3Backup() {
  console.log('--- Creating Step 3 Pre-Architecture Backup ---');

  const client = supabaseAdmin || supabase;
  let remoteIssues = [];
  if (client) {
    try {
      const { data, error } = await client.from('issues').select('*');
      if (!error && data) {
        remoteIssues = data;
        console.log(`[OK] Fetched ${remoteIssues.length} existing complaints from Supabase`);
      }
    } catch (e) {
      console.warn('Warning: Could not fetch remote issues for snapshot:', e.message);
    }
  }

  const backupPayload = {
    timestamp: new Date().toISOString(),
    description: 'CrowdCity Step 3 Pre-Architecture Location & Complaints Snapshot',
    summary: {
      districts_count: DISTRICTS_DATA.length,
      taluks_count: TALUKS_DATA.length,
      blocks_count: (BLOCKS_DATA || []).length,
      local_bodies_count: LOCAL_BODIES_DATA.length,
      locations_count: LOCATIONS_DATA.length,
      synthetic_locations_count: LOCATIONS_DATA.filter(l => l.is_synthetic).length,
      quarantined_locations_count: LOCATIONS_DATA.filter(l => l.is_quarantined).length,
      active_locations_count: LOCATIONS_DATA.filter(l => !l.is_quarantined).length,
      complaints_count: remoteIssues.length,
      complaint_ids: remoteIssues.map(i => ({ id: i.id, complaint_id: i.complaint_id, address: i.address }))
    },
    districts: DISTRICTS_DATA,
    taluks: TALUKS_DATA,
    blocks: BLOCKS_DATA || [],
    local_bodies: LOCAL_BODIES_DATA,
    locations: LOCATIONS_DATA,
    issues_snapshot: remoteIssues
  };

  const backupFilePath = path.resolve(__dirname, '../data/step3_backup_locations_pre_architecture.json');
  fs.writeFileSync(backupFilePath, JSON.stringify(backupPayload, null, 2), 'utf-8');

  console.log(`[OK] Backup saved successfully to: ${backupFilePath}`);
  console.log(`  - File Size: ${(fs.statSync(backupFilePath).size / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`  - Preserved Complaints: ${remoteIssues.length}`);
}

runStep3Backup().catch(err => {
  console.error('Step 3 backup failed:', err);
  process.exit(1);
});
