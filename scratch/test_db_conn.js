import { supabaseAdmin } from '../server/config/supabase.js';

async function check() {
  try {
    const { data, error } = await supabaseAdmin.from('issues').select('id, category').limit(5);
    console.log('Issues categories:', data, 'Error:', error);
  } catch (e) {
    console.error('Error connecting:', e);
  }
}
check();
