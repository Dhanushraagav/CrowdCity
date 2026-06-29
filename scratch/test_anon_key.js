import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function run() {
  console.log('Testing connection with SUPABASE_ANON_KEY...');
  const { data, error } = await supabase
    .from('issues')
    .select('id, title')
    .limit(1);

  if (error) {
    console.error('Error fetching with anon key:', error);
  } else {
    console.log('Success!', data);
  }
}

run();
