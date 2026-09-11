import { supabaseAdmin, supabase } from '../config/supabase.js';
import { DISTRICTS_DATA, TALUKS_DATA, BLOCKS_DATA, LOCATIONS_DATA, LOCAL_BODIES_DATA } from '../data/locationHierarchyData.js';

async function seedLocationHierarchy() {
  const client = supabaseAdmin || supabase;
  console.log('--- Starting Tamil Nadu Location Hierarchy Database Seed (Step 2) ---');

  if (!client) {
    console.warn('[Seed] Supabase client unavailable. Seed cannot proceed against remote DB.');
    return;
  }

  try {
    // 1. Check if tables exist
    const { error: distCheckErr } = await client.from('districts').select('id').limit(1);
    if (distCheckErr && distCheckErr.code === 'PGRST205') {
      console.log('ℹ Notice: Database tables (districts, taluks, blocks, locations, local_bodies) have not yet been migrated in Supabase.');
      console.log('ℹ To execute the migration, run `supabase/v9_authoritative_location_ingestion.sql` in the Supabase SQL Editor.');
      console.log('ℹ In the meantime, CrowdCity backend uses the normalized high-performance locationHierarchyData engine with zero downtime.');
      return;
    }

    // 2. Seed Districts
    console.log(`Seeding ${DISTRICTS_DATA.length} districts...`);
    const { error: distErr } = await client.from('districts').upsert(DISTRICTS_DATA, { onConflict: 'id' });
    if (distErr) {
      console.error('Error seeding districts:', distErr.message);
    } else {
      console.log('✓ Successfully seeded districts');
    }

    // 3. Seed Taluks
    console.log(`Seeding ${TALUKS_DATA.length} taluks...`);
    const { error: talukErr } = await client.from('taluks').upsert(TALUKS_DATA, { onConflict: 'id' });
    if (talukErr) {
      console.error('Error seeding taluks:', talukErr.message);
    } else {
      console.log('✓ Successfully seeded taluks');
    }

    // 4. Seed Blocks
    if (Array.isArray(BLOCKS_DATA) && BLOCKS_DATA.length > 0) {
      console.log(`Seeding ${BLOCKS_DATA.length} rural blocks...`);
      const { error: blockErr } = await client.from('blocks').upsert(BLOCKS_DATA, { onConflict: 'id' });
      if (blockErr) {
        console.warn('Notice: Blocks table may require v9 migration in Supabase SQL editor:', blockErr.message);
      } else {
        console.log('✓ Successfully seeded blocks');
      }
    }

    // 5. Seed Local Bodies
    console.log(`Seeding ${LOCAL_BODIES_DATA.length} local bodies...`);
    const { error: lbErr } = await client.from('local_bodies').upsert(LOCAL_BODIES_DATA, { onConflict: 'id' });
    if (lbErr) {
      console.error('Error seeding local bodies:', lbErr.message);
    } else {
      console.log('✓ Successfully seeded local bodies');
    }

    // 6. Seed Locations in batches of 500
    console.log(`Seeding ${LOCATIONS_DATA.length} locations in batches of 500...`);
    const batchSize = 500;
    let successCount = 0;
    for (let i = 0; i < LOCATIONS_DATA.length; i += batchSize) {
      const batch = LOCATIONS_DATA.slice(i, i + batchSize);
      const { error: locErr } = await client.from('locations').upsert(batch, { onConflict: 'id' });
      if (locErr) {
        console.warn(`Notice on seeding locations batch ${i} - ${i + batch.length}:`, locErr.message);
        console.log('ℹ Run supabase/v9_authoritative_location_ingestion.sql in the Supabase SQL Editor to apply column additions.');
        break;
      } else {
        successCount += batch.length;
      }
    }
    if (successCount > 0) {
      console.log(`✓ Successfully seeded ${successCount} locations to Supabase`);
    }

    console.log('--- Location Hierarchy Seed Complete! ---');
  } catch (err) {
    console.error('Unexpected error during seed:', err);
  }
}

seedLocationHierarchy();
