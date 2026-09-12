/**
 * CrowdCity AI - Step 4 Pre-Validation Snapshot
 * Backs up location dataset metrics and Supabase issues before real-world validation
 * 
 * Strict rule: ZERO EMOJIS
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import {
  DISTRICTS_DATA,
  TALUKS_DATA,
  BLOCKS_DATA,
  LOCAL_BODIES_DATA,
  URBAN_LOCAL_BODIES_DATA,
  LOCATIONS_DATA
} from '../data/locationHierarchyData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runStep4Backup() {
  console.log('--- Step 4 Pre-Validation Backup Initiated ---');

  const client = supabaseAdmin || supabase;
  let remoteIssues = [];

  if (client) {
    try {
      const { data, error } = await client.from('issues').select('*');
      if (!error && data) {
        remoteIssues = data;
        console.log(`[OK] Fetched ${remoteIssues.length} existing complaints from Supabase`);
      } else {
        console.warn('Warning: Could not fetch remote issues:', error?.message);
      }
    } catch (e) {
      console.warn('Warning: Supabase exception during backup:', e.message);
    }
  }

  const backupPayload = {
    timestamp: new Date().toISOString(),
    step: 'Step 4 Pre-Validation Snapshot',
    head_commit: '6a9d443',
    summary: {
      districts_count: DISTRICTS_DATA.length,
      taluks_count: TALUKS_DATA.length,
      blocks_count: (BLOCKS_DATA || []).length,
      urban_local_bodies_count: (URBAN_LOCAL_BODIES_DATA || []).length,
      local_bodies_count: LOCAL_BODIES_DATA.length,
      total_locations_count: LOCATIONS_DATA.length,
      active_locations_count: LOCATIONS_DATA.filter(l => !l.is_quarantined).length,
      quarantined_locations_count: LOCATIONS_DATA.filter(l => l.is_quarantined).length,
      complaints_count: remoteIssues.length,
      complaint_ids: remoteIssues.map(i => ({
        id: i.id,
        complaint_id: i.complaint_id,
        title: i.title,
        address: i.address,
        created_at: i.created_at
      }))
    },
    districts: DISTRICTS_DATA,
    taluks: TALUKS_DATA,
    blocks: BLOCKS_DATA || [],
    urban_local_bodies: URBAN_LOCAL_BODIES_DATA || [],
    local_bodies: LOCAL_BODIES_DATA,
    issues_snapshot: remoteIssues
  };

  const backupFilePath = path.resolve(__dirname, '../data/step4_backup_pre_validation_fixes.json');
  fs.writeFileSync(backupFilePath, JSON.stringify(backupPayload, null, 2), 'utf-8');

  console.log(`[OK] Step 4 backup saved to: ${backupFilePath}`);
  console.log(`  - Active Locations: ${backupPayload.summary.active_locations_count}`);
  console.log(`  - Quarantined Locations: ${backupPayload.summary.quarantined_locations_count}`);
  console.log(`  - Preserved Complaints: ${remoteIssues.length}`);
}

runStep4Backup().catch(err => {
  console.error('Step 4 backup failed:', err);
  process.exit(1);
});
