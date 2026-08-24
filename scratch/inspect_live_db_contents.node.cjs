const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uqqdxjprkjxgddmsoxia.supabase.co';
const supabaseKey = 'sb_publishable_qrkTb1shX49w5Z6WJMat7g_VpBfbOq2';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

async function inspect() {
  const { data, error } = await supabase
    .from('app_database')
    .select('*')
    .eq('id', 'transflow-live-prod-v3')
    .maybeSingle();

  if (error) {
    console.error('Error fetching:', error);
    return;
  }

  const dbData = data?.data || {};
  console.log('--- LIVE SUPABASE ROW DETAILS ---');
  console.log('Last Updated At in Cloud:', data?.updated_at);
  console.log('Rate Requests count:', (dbData.rate_requests || []).length);
  (dbData.rate_requests || []).forEach((r, i) => {
    console.log(`  [${i+1}] ID: ${r.id} | Request No: ${r.request_no} | Material: ${r.material_type} | Qty: ${r.required_qty} MT`);
  });

  console.log('\nRate Submissions count:', (dbData.rate_submissions || []).length);
  (dbData.rate_submissions || []).forEach((s, i) => {
    console.log(`  [${i+1}] ID: ${s.id} | Req: ${s.rate_request_id} | Transporter: ${s.transporter_id} | Rate: ₹${s.rate_per_unit}/MT`);
  });
}

inspect();
