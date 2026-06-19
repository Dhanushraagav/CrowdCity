import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { performance } from 'perf_hooks';

dotenv.config({ path: 'c:/Users/dhanu/OneDrive/Desktop/CrowdCity AI/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

async function run() {
  console.log("--------------------------------------------------");
  console.log("Measuring load times for dashboard queries...");
  console.log("--------------------------------------------------");
  
  // 1. getSession()
  const t0 = performance.now();
  await supabase.auth.getSession();
  const t1 = performance.now();
  console.log(`1. getSession() took: ${(t1 - t0).toFixed(2)} ms`);

  // Get a valid user ID for testing profile fetch
  const { data: profilesList } = await supabase.from('profiles').select('id').limit(1);
  const userId = profilesList && profilesList[0] ? profilesList[0].id : null;
  
  if (userId) {
    // 2. profile fetch
    const t2 = performance.now();
    await supabase.from('profiles').select('*').eq('id', userId);
    const t3 = performance.now();
    console.log(`2. profile fetch (select *) took: ${(t3 - t2).toFixed(2)} ms`);
  } else {
    console.log("2. profile fetch: No profiles in DB to query");
  }

  // 3. reports fetch (getAllIssues query)
  const t4 = performance.now();
  const { data: issues } = await supabase
    .from('issues')
    .select('*, reporter:profiles!issues_reporter_id_fkey(full_name, avatar_url)')
    .order('created_at', { ascending: false });
  const t5 = performance.now();
  console.log(`3. reports fetch (select *, no limit, count: ${issues ? issues.length : 0}) took: ${(t5 - t4).toFixed(2)} ms`);

  // 4. leaderboard fetch (getLeaderboard: profiles list + badges list - sequential)
  const t6 = performance.now();
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, avatar_url, role, points')
    .order('points', { ascending: false });
  const { data: badges } = await supabaseAdmin
    .from('user_badges')
    .select('user_id');
  const t7 = performance.now();
  console.log(`4. leaderboard fetch (sequential profiles: ${profiles ? profiles.length : 0}, badges: ${badges ? badges.length : 0}) took: ${(t7 - t6).toFixed(2)} ms`);

  // 4b. leaderboard fetch (Promise.all)
  const t6b = performance.now();
  await Promise.all([
    supabaseAdmin.from('profiles').select('id, full_name, avatar_url, role, points').order('points', { ascending: false }),
    supabaseAdmin.from('user_badges').select('user_id')
  ]);
  const t7b = performance.now();
  console.log(`4b. leaderboard fetch (Promise.all) took: ${(t7b - t6b).toFixed(2)} ms`);

  // 5. statistics fetch (using general query)
  const t8 = performance.now();
  const { data: statsData } = await supabase.from('issues').select('status');
  const t9 = performance.now();
  console.log(`5. statistics fetch (select status) took: ${(t9 - t8).toFixed(2)} ms`);
  console.log("--------------------------------------------------");
}

run().catch(console.error);
