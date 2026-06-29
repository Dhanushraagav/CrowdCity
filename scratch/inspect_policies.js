import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Fetching policies for public.profiles...');
  const { data, error } = await supabase.rpc('get_policies_for_table', { table_name: 'profiles' });
  if (error) {
    // If the helper function doesn't exist, we can try running an arbitrary SQL query via a custom RPC,
    // or query the postgres catalog if possible. Since we might not have a generic SQL RPC, let's try a direct RPC
    // query or inspect system tables if exposed, or let's try reading the profiles table schema.
    console.error('Error fetching policies via RPC:', error);
    
    // Let's try running a direct query on pg_policies using supabase.rpc('exec_sql') if it exists,
    // or just fetch from pg_policies if it's exposed.
    console.log('Trying to execute custom SQL via rpc if possible...');
  }
  
  // Let's try to query information_schema or just run a query using raw postgres.
  // Wait, does the project have a direct postgres connection?
  // Let's look at .env. No, only SUPABASE_URL and Keys are present.
  
  // Let's test standard SELECT on profiles table with admin client:
  const { data: profiles, error: profError } = await supabase
    .from('profiles')
    .select('*')
    .limit(5);
  console.log('Profiles fetched with admin client:', profiles, profError);
}

run();
