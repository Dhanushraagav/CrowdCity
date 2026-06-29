import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: issues, error } = await supabase
    .from('issues')
    .select('id, title, status, reporter_id, assigned_to');
  
  if (error) {
    console.error('Error fetching issues:', error);
    return;
  }
  
  console.log('Issues in DB:');
  console.log(JSON.stringify(issues, null, 2));

  const { data: profiles, error: profError } = await supabase
    .from('profiles')
    .select('id, full_name, role');
    
  if (profError) {
    console.error('Error fetching profiles:', profError);
    return;
  }
  
  console.log('Profiles in DB:');
  console.log(JSON.stringify(profiles, null, 2));
}

run();
