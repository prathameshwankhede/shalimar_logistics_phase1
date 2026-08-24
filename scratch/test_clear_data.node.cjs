const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uqqdxjprkjxgddmsoxia.supabase.co';
const supabaseKey = 'sb_publishable_qrkTb1shX49w5Z6WJMat7g_VpBfbOq2';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const CLOUD_ROW_ID = 'transflow-live-prod-v3';

async function testReset() {
  const { data } = await supabase.from('app_database').select('data').eq('id', CLOUD_ROW_ID).maybeSingle();
  const currentDb = data?.data || {};

  console.log('Before Reset - Indents count:', (currentDb.rate_requests || []).length);

  const cleanDb = {
    ...currentDb,
    _updatedAt: Date.now() + 100000,
    _isResetOperation: true,
    rate_requests: [],
    rate_submissions: [],
    allocations: [],
    contracts: [],
    truck_dispatches: [],
    whatsapp_notifications: []
  };

  const { error } = await supabase
    .from('app_database')
    .upsert({ id: CLOUD_ROW_ID, data: cleanDb, updated_at: new Date().toISOString() });

  if (error) {
    console.error('Reset error:', error);
  } else {
    console.log('✅ Supabase Cloud DB successfully reset to 0 indents and 0 bids!');
  }
}

testReset();
