// scratch/test_bid_save_flow.node.cjs
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uqqdxjprkjxgddmsoxia.supabase.co';
const supabaseKey = 'sb_publishable_qrkTb1shX49w5Z6WJMat7g_VpBfbOq2';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

async function runAudit() {
  console.log('📡 Reading Cloud DB...');
  const { data } = await supabase
    .from('app_database')
    .select('data')
    .eq('id', 'transflow-live-prod-v3')
    .maybeSingle();

  const cloudDb = data?.data || {};
  const currentTransporter = { role: 'transporter', username: 'S001', code: 'S001' };
  const transId = currentTransporter?.id || currentTransporter?.code || currentTransporter?.username || 'transporter';

  console.log('Transporter ID computed:', transId);

  const newSub = {
    id: `sub_s001_${Date.now()}`,
    rate_request_id: (cloudDb.rate_requests || [])[0]?.id || 'req_1',
    transporter_id: transId,
    rate_per_unit: 2450,
    total_estimated_amount: 24500,
    transit_days: 2,
    notes: 'Fast 1-line quote submitted.',
    status: 'Submitted',
    submitted_at: new Date().toISOString()
  };

  const updatedSubmissions = [newSub, ...(cloudDb.rate_submissions || [])];
  const updatedDb = { ...cloudDb, rate_submissions: updatedSubmissions, _updatedAt: Date.now() };

  console.log('📡 Saving bid to Supabase Cloud DB...');
  const { error } = await supabase
    .from('app_database')
    .upsert({ id: 'transflow-live-prod-v3', data: updatedDb, updated_at: new Date().toISOString() });

  if (error) {
    console.error('❌ Error saving:', error);
    process.exit(1);
  }
  console.log('✅ Bid saved successfully to Cloud DB!');

  console.log('\n📡 Verifying fetch back...');
  const { data: verify } = await supabase
    .from('app_database')
    .select('data')
    .eq('id', 'transflow-live-prod-v3')
    .maybeSingle();

  const savedSubs = verify?.data?.rate_submissions || [];
  console.log('Total Submissions in Cloud DB:', savedSubs.length);

  const matched = savedSubs.filter(s =>
    String(s.transporter_id) === String(currentTransporter?.id) ||
    String(s.transporter_id) === String(currentTransporter?.code) ||
    String(s.transporter_id) === String(currentTransporter?.username)
  );

  console.log(`Matched Bids for Transporter ${transId}:`, matched.length);

  if (matched.length > 0) {
    console.log('🎉 AUDIT PASSED: Bid saved, fetched, and matched for Transporter S001!');
  } else {
    console.error('❌ AUDIT FAILED: Bid saved but failed to match Transporter S001!');
    process.exit(1);
  }
}

runAudit();
