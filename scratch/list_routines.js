import { supabaseAdmin } from '../server/config/supabase.js';

async function listRoutines() {
  const { data, error } = await supabaseAdmin
    .from('pg_proc')
    .select('proname')
    .ilike('proname', '%sql%');
  console.log('SQL functions:', data, error);

  // Let's also query all user defined functions in public schema
  const { data: routines, error: rError } = await supabaseAdmin
    .rpc('get_routines'); // might not exist, but let's see
  console.log('Routines rpc:', routines, rError);
}
listRoutines();
