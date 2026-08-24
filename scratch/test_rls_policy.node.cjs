// scratch/test_rls_policy.node.cjs
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uqqdxjprkjxgddmsoxia.supabase.co';
const supabaseKey = 'sb_publishable_qrkTb1shX49w5Z6WJMat7g_VpBfbOq2';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

async function checkRLS() {
  console.log('Testing SELECT...');
  const { data: selData, error: selErr } = await supabase.from('app_database').select('*').eq('id', 'transflow-live-prod-v3');
  console.log('Select Result:', selErr ? selErr : `Found ${selData?.length} rows`);

  console.log('\nTesting UPSERT/UPDATE (Write)...');
  const dummyData = selData && selData[0] ? selData[0].data : { ping: 1 };
  dummyData._rlsTestTime = Date.now();

  const { data: upData, error: upErr } = await supabase
    .from('app_database')
    .upsert({ id: 'transflow-live-prod-v3', data: dummyData, updated_at: new Date().toISOString() })
    .select();

  if (upErr) {
    console.error('❌ WRITE FAILED WITH ERROR:', upErr);
  } else {
    console.log('✅ WRITE SUCCEEDED! Returned:', Boolean(upData));
  }
}

checkRLS();
