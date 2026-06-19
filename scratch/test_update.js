import { supabaseAdmin } from '../server/config/supabase.js';

async function runTest() {
  const { data, error } = await supabaseAdmin.from('issues').select('id, category').limit(1);
  if (error || !data.length) {
    console.error('Error fetching issue:', error);
    return;
  }
  const targetId = data[0].id;
  const originalCat = data[0].category;
  console.log(`Original category for issue ${targetId}: ${originalCat}`);

  const updateRes = await supabaseAdmin.from('issues').update({ category: 'roads' }).eq('id', targetId).select();
  console.log('Update result (to roads):', updateRes);

  // Revert it back
  const revertRes = await supabaseAdmin.from('issues').update({ category: originalCat }).eq('id', targetId).select();
  console.log('Revert result:', revertRes);
}

runTest();
