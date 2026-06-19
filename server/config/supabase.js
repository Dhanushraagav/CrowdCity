import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let mockMode = false;
let validationError = null;

if (!url) {
  validationError = 'SUPABASE_URL is missing from environment variables.';
  mockMode = true;
} else if (url.trim() === '') {
  validationError = 'SUPABASE_URL is empty.';
  mockMode = true;
} else if (!url.startsWith('http://') && !url.startsWith('https://')) {
  validationError = `SUPABASE_URL is invalid (must start with http:// or https://, got "${url}").`;
  mockMode = true;
} else if (url.includes('placeholder')) {
  validationError = 'SUPABASE_URL contains placeholder value.';
  mockMode = true;
}

if (!mockMode) {
  if (!anonKey) {
    validationError = 'SUPABASE_ANON_KEY is missing from environment variables.';
    mockMode = true;
  } else if (anonKey.trim() === '') {
    validationError = 'SUPABASE_ANON_KEY is empty.';
    mockMode = true;
  } else if (anonKey.includes('placeholder')) {
    validationError = 'SUPABASE_ANON_KEY contains placeholder value.';
    mockMode = true;
  } else if (!anonKey.startsWith('eyJ') && !anonKey.startsWith('sb_publishable_')) {
    validationError = 'SUPABASE_ANON_KEY format is invalid (must start with "eyJ" or "sb_publishable_").';
    mockMode = true;
  }
}

if (!mockMode && serviceKey) {
  if (serviceKey.includes('placeholder')) {
    validationError = 'SUPABASE_SERVICE_ROLE_KEY contains placeholder value.';
    mockMode = true;
  } else if (!serviceKey.startsWith('eyJ') && !serviceKey.startsWith('sb_secret_')) {
    validationError = 'SUPABASE_SERVICE_ROLE_KEY format is invalid (must start with "eyJ" or "sb_secret_").';
    mockMode = true;
  }
}

if (mockMode) {
  console.warn(`\n===================================================`);
  console.warn(`⚠️  SUPABASE CONFIGURATION ERROR: ${validationError}`);
  console.warn(`   Forcing mock emulation mode on server.`);
  console.warn(`===================================================\n`);
  
  process.env.SUPABASE_URL = 'https://placeholder.supabase.co';
} else {
  console.log(`\n===================================================`);
  console.log(`✓ Environment variables loaded`);
  console.log(`✓ Supabase URL detected`);
  console.log(`✓ Publishable key detected`);
  console.log(`✓ Connected to Supabase`);
  console.log(`✓ Mock Mode: OFF`);
  console.log(`===================================================\n`);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Client for general operations (respects Row Level Security)
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');

// Client for admin operations (bypasses Row Level Security - use with caution!)
export const supabaseAdmin = supabaseServiceRoleKey && !mockMode
  ? createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseServiceRoleKey)
  : null;

// Helper to get request-scoped supabase client
export const getSupabaseClient = (req) => {
  if (req && req.headers && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token && !token.startsWith('mock-jwt-token')) {
        return createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder', {
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

