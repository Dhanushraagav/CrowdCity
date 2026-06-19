import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const client = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await client.from('profiles').select('*').limit(1);
  if (error) {
    console.error("Error fetching profile:", error);
  } else {
    console.log("Profile keys:", data && data.length > 0 ? Object.keys(data[0]) : "No profiles found");
    if (data && data.length > 0) {
      console.log("First profile keys and values:", data[0]);
    }
  }
}

run();
