import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

async function run() {
  const email = process.env.TEST_LOGIN_EMAIL || 'test-login@example.com';
  const password = 'TempPassword123!';

  console.log("Initializing Supabase Client...");
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  console.log("1. First Login...");
  const { data: data1, error: err1 } = await client.auth.signInWithPassword({ email, password });
  if (err1) {
    console.error("First login failed:", err1);
    return;
  }
  const token1 = data1.session.access_token;
  console.log("First Token prefix:", token1.substring(0, 15));

  console.log("2. Logging out...");
  await client.auth.signOut();

  console.log("3. Second Login...");
  const { data: data2, error: err2 } = await client.auth.signInWithPassword({ email, password });
  if (err2) {
    console.error("Second login failed:", err2);
    return;
  }
  const token2 = data2.session.access_token;
  console.log("Second Token prefix:", token2.substring(0, 15));

  console.log("Are they identical?", token1 === token2);
}

run();
