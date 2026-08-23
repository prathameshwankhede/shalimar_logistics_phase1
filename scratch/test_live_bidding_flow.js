import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uqqdxjprkjxgddmsoxia.supabase.co';
const supabaseKey = 'sb_publishable_qrkTb1shX49w5Z6WJMat7g_VpBfbOq2';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLiveBiddingFlow() {
  console.log('🧪 TESTING LIVE CROSS-DEVICE BIDDING FLOW IN SUPABASE...');

  // 1. Fetch current DB from Supabase
  const { data: selectRes, error: selectErr } = await supabase
    .from('app_database')
    .select('data')
    .eq('id', 'transflow-live-prod-v3')
    .maybeSingle();

  if (selectErr || !selectRes) {
    console.error('Failed to fetch DB:', selectErr);
    return;
  }

  const currentDb = selectRes.data;

  // 2. Create 1 Test Indent & 3 Test Transporters
  const testTransporters = [
    { id: 'trans_abc001', company_name: 'ABC Transport Pvt Ltd', code: 'ABC001', contact_person: 'Ramesh Kumar', mobile: '+91 9820011223', email: 'contact@abc001.com', address: 'Mumbai', gst_pan: '27AAAAA0000A1Z5', username: 'ABC001', status: 'Active', created_at: new Date().toISOString() },
    { id: 'trans_xyz001', company_name: 'XYZ Logistics & Freight', code: 'XYZ001', contact_person: 'Vikram Sharma', mobile: '+91 9820022334', email: 'contact@xyz001.com', address: 'Pune', gst_pan: '27BBBBA1111B1Z2', username: 'XYZ001', status: 'Active', created_at: new Date().toISOString() },
    { id: 'trans_trp001', company_name: 'VRL Logistics India', code: 'TRP001', contact_person: 'Vijay Sankeshwar', mobile: '+91 9820033445', email: 'contact@trp001.com', address: 'Nagpur', gst_pan: '27VRLAA1001A1Z1', username: 'TRP001', status: 'Active', created_at: new Date().toISOString() }
  ];

  const testUsers = [
    { id: 'usr_admin', username: 'admin', password: 'admin123', name: 'Shalimar Admin', role: 'admin', transporter_id: null, created_at: new Date().toISOString() },
    ...testTransporters.map(t => ({
      id: `usr_${t.code.toLowerCase()}`,
      username: t.code,
      password: 'password123',
      name: `${t.company_name} Admin`,
      role: 'transporter',
      transporter_id: t.id,
      created_at: new Date().toISOString()
    }))
  ];

  const testIndent = {
    id: `ind_demo_${Date.now()}`,
    indent_no: 'IND-TEST-101',
    title: 'Shalimar Nutrients - Nagpur Plant Bulk Soya DOC Delivery',
    material: 'Soybean Meal De-Oiled Cake (DOC)',
    quantity: 50,
    unit: 'MT',
    pickup_location: 'Nagpur (Shalimar Plant MIDC)',
    delivery_location: 'Solapur (Shalimar Refinery)',
    target_rate: 2200,
    cargo_type: '32ft Multi-Axle Closed Container',
    status: 'Open',
    created_at: new Date().toISOString()
  };

  // 3. Simulate Mobile Transporter Submitting a Bid
  const testBid = {
    id: `bid_demo_${Date.now()}`,
    indent_id: testIndent.id,
    transporter_id: 'trans_abc001',
    transporter_name: 'ABC Transport Pvt Ltd',
    rate_per_unit: 2150,
    vehicle_type: '32ft Multi-Axle Closed Container',
    status: 'Submitted',
    created_at: new Date().toISOString()
  };

  const updatedDb = {
    ...currentDb,
    _updatedAt: Date.now(),
    transporters: testTransporters,
    users: testUsers,
    rate_requests: [testIndent],
    rate_submissions: [testBid]
  };

  // 4. Save to Supabase Cloud
  const { data: upsertRes, error: upsertErr } = await supabase
    .from('app_database')
    .upsert({
      id: 'transflow-live-prod-v3',
      data: updatedDb,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' })
    .select();

  if (upsertErr) {
    console.error('❌ Failed to push test bid to Supabase:', upsertErr);
  } else {
    console.log('✅ TEST BID SUCCESSFULLY PUSHED TO SUPABASE CLOUD!');
    console.log(` 📋 Indent Created : ${testIndent.indent_no} (${testIndent.title})`);
    console.log(` 💰 Bid Submitted  : ₹${testBid.rate_per_unit} by ${testBid.transporter_name}`);
    console.log(` 📡 Supabase Sync  : 100% SUCCESSFUL!`);
  }
}

testLiveBiddingFlow();
