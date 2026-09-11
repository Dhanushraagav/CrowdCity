import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DISTRICTS_DATA, TALUKS_DATA, LOCATIONS_DATA, LOCAL_BODIES_DATA } from '../data/locationHierarchyData.js';
import { supabaseAdmin, supabase } from '../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runBackup() {
  console.log('--- Creating Step 2 Pre-Ingestion Backup ---');

  const client = supabaseAdmin || supabase;
  let remoteIssues = [];
  if (client) {
    try {
      const { data, error } = await client.from('issues').select('*');
      if (!error && data) {
        remoteIssues = data;
        console.log(`✓ Fetched ${remoteIssues.length} existing complaints from Supabase`);
      }
    } catch (e) {
      console.warn('Warning: Could not fetch remote issues for snapshot:', e.message);
    }
  }

  const backupPayload = {
    timestamp: new Date().toISOString(),
    description: 'CrowdCity Step 2 Pre-Ingestion Authoritative Location Backup',
    summary: {
      districts_count: DISTRICTS_DATA.length,
      taluks_count: TALUKS_DATA.length,
      local_bodies_count: LOCAL_BODIES_DATA.length,
      locations_count: LOCATIONS_DATA.length,
      synthetic_locations_count: LOCATIONS_DATA.filter(l => l.is_synthetic).length,
      genuine_locations_count: LOCATIONS_DATA.filter(l => !l.is_synthetic).length,
      complaints_count: remoteIssues.length
    },
    districts: DISTRICTS_DATA,
    taluks: TALUKS_DATA,
    local_bodies: LOCAL_BODIES_DATA,
    locations: LOCATIONS_DATA,
    issues_snapshot: remoteIssues
  };

  const backupFilePath = path.resolve(__dirname, '../data/step2_backup_locations_pre_ingestion.json');
  fs.writeFileSync(backupFilePath, JSON.stringify(backupPayload, null, 2), 'utf-8');

  console.log(`✓ Backup saved successfully to: ${backupFilePath}`);
  console.log(`  - File Size: ${(fs.statSync(backupFilePath).size / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`  - Total Locations: ${DISTRICTS_DATA.length} districts, ${TALUKS_DATA.length} taluks, ${LOCATIONS_DATA.length} locations`);
  console.log(`  - Preserved Complaints: ${remoteIssues.length}`);
}

runBackup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
