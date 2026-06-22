import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || supabaseUrl.includes('placeholder') || supabaseUrl.trim() === '') {
  throw new Error('FATAL CONFIG ERROR: SUPABASE_URL is missing, empty, or configured as a placeholder. Production Supabase is required.');
}
if (!supabaseAnonKey || supabaseAnonKey.includes('placeholder') || supabaseAnonKey.trim() === '') {
  throw new Error('FATAL CONFIG ERROR: SUPABASE_ANON_KEY is missing, empty, or configured as a placeholder. Production Supabase is required.');
}

console.log(`\n===================================================`);
console.log(`✓ Environment variables loaded`);
console.log(`✓ Supabase URL detected`);
console.log(`✓ Publishable key detected`);
console.log(`✓ Connected to Supabase`);
console.log(`✓ Mock Mode: OFF`);
console.log(`===================================================\n`);

// Client for general operations (respects Row Level Security)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client for admin operations (bypasses Row Level Security)
export const supabaseAdmin = supabaseServiceRoleKey && !supabaseServiceRoleKey.includes('placeholder') && supabaseServiceRoleKey.trim() !== ''
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

// Helper to get request-scoped supabase client
export const getSupabaseClient = (req) => {
  if (req && req.headers && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        return createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          },
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        });
      }
    }
  }
  return supabase;
};
