import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function run() {
  console.log('Testing select from profiles with SUPABASE_ANON_KEY...');
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .limit(5);

  if (error) {
    console.error('Error fetching profiles with anon key:', error);
  } else {
    console.log('Success! Profiles:', data);
  }
}

run();
