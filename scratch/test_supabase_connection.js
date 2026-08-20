import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uqqdxjprkjxgddmsoxia.supabase.co';
const supabaseKey = 'sb_publishable_qrkTb1shX49w5Z6WJMat7g_VpBfbOq2';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('--- TESTING SUPABASE CONNECTION ---');
  console.log('URL:', supabaseUrl);
  
  // 1. Test SELECT
  console.log('\n1. Testing SELECT from app_database...');
  const { data: selectData, error: selectErr } = await supabase
    .from('app_database')
    .select('data')
    .eq('id', 'transflow-main')
    .maybeSingle();

  if (selectErr) {
    console.error('SELECT Error:', selectErr);
  } else {
    console.log('SELECT Success! Data:', selectData ? 'Found row' : 'No row found');
  }

  // 2. Test UPSERT with test payload
  console.log('\n2. Testing UPSERT to app_database...');
  const testPayload = {
    test_key: 'SYNC_TEST_LAPTOP_123',
    _updatedAt: Date.now()
  };

  const { data: upsertData, error: upsertErr } = await supabase
    .from('app_database')
    .upsert({
      id: 'transflow-main',
      data: testPayload,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' })
    .select();

  if (upsertErr) {
    console.error('UPSERT Error:', upsertErr);
  } else {
    console.log('UPSERT Success! Result:', JSON.stringify(upsertData));
  }
}

testConnection();
