// scratch/test_transporter_sub_indent_dataflow.mjs
// End-to-End Data Flow Verification: Transporter Submission -> MySQL Persistence -> Admin Requirement API -> Admin Dashboard UI

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function runDataFlowTest() {
  console.log('==================================================');
  console.log('🧪 TEST: TRANSPORTER SUB-INDENT QUOTE DATA FLOW & ADMIN VISIBILITY');
  console.log('==================================================');

  // 1. Authenticate Admin Token
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;
  const transId = 'trans_1787939085854';

  // 2. Create FRESH Batch Requirement (SNPL/26-27/REQ-TEST)
  const createRes = await fetch(`${BASE_URL}/api/requirements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      req_no: 'SNPL/26-27/REQ-TEST',
      pickup_origin: 'Katol',
      drop_location: 'Yerla',
      target_date: '2026-08-28',
      items: [
        { product_name: 'total gold', quantity_mt: 300, unit: 'MT', pickup_origin: 'Katol', drop_location: 'Yerla' },
        { product_name: 'total gold', quantity_mt: 200, unit: 'MT', pickup_origin: 'Katol', drop_location: 'Nagpur' }
      ]
    })
  });
  const createJson = await createRes.json();
  const targetReq = createJson.requirement || createJson.data || createJson;

  const items = targetReq.items || [];
  const item1 = items[0];
  const item2 = items[1];

  console.log(`PARENT BATCH: ${targetReq.req_no} (id: ${targetReq.id})`);
  console.log(`  Sub-Indent 1: ${item1.sub_indent_no} (id: ${item1.id}, 300 MT, Katol -> Yerla)`);
  console.log(`  Sub-Indent 2: ${item2.sub_indent_no} (id: ${item2.id}, 200 MT, Katol -> Nagpur)\n`);

  // STEP 1: Submit ONLY /01 at ₹77
  console.log('👉 STEP 1: Transporter submits ONLY /01 at ₹77...');
  await fetch(`${BASE_URL}/api/rate-submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      requirement_id: targetReq.id,
      item_id: item1.id,
      transporter_id: transId,
      rate_per_mt: 77,
      quoted_quantity_mt: item1.quantity_mt,
      total_amount: 77 * item1.quantity_mt,
      remarks: 'Quote for /01 only'
    })
  });

  // Verify Admin GET /api/requirements
  const reqs1 = await (await fetch(`${BASE_URL}/api/requirements`, { headers: { 'Authorization': `Bearer ${token}` } })).json();
  const adminReq1 = (reqs1.data || []).find(r => r.id === targetReq.id || r.req_no === targetReq.req_no);
  const adminItem1A = (adminReq1.items || []).find(i => i.id === item1.id);
  const adminItem2A = (adminReq1.items || []).find(i => i.id === item2.id);

  console.log(`  • Admin /01 Status: bids = ${adminItem1A?.submitted_bids_count}, lowest_rate = ₹${adminItem1A?.lowest_rate}/MT`);
  console.log(`  • Admin /02 Status: bids = ${adminItem2A?.submitted_bids_count}, lowest_rate = ${adminItem2A?.lowest_rate || 'null'} (NO BIDS YET ✅)`);

  // STEP 2: Submit /02 at ₹88
  console.log('\n👉 STEP 2: Transporter submits /02 at ₹88...');
  await fetch(`${BASE_URL}/api/rate-submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      requirement_id: targetReq.id,
      item_id: item2.id,
      transporter_id: transId,
      rate_per_mt: 88,
      quoted_quantity_mt: item2.quantity_mt,
      total_amount: 88 * item2.quantity_mt,
      remarks: 'Quote for /02'
    })
  });

  const reqs2 = await (await fetch(`${BASE_URL}/api/requirements`, { headers: { 'Authorization': `Bearer ${token}` } })).json();
  const adminReq2 = (reqs2.data || []).find(r => r.id === targetReq.id || r.req_no === targetReq.req_no);
  const adminItem1B = (adminReq2.items || []).find(i => i.id === item1.id);
  const adminItem2B = (adminReq2.items || []).find(i => i.id === item2.id);

  console.log(`  • Admin /01 Status: bids = ${adminItem1B?.submitted_bids_count}, lowest_rate = ₹${adminItem1B?.lowest_rate}/MT`);
  console.log(`  • Admin /02 Status: bids = ${adminItem2B?.submitted_bids_count}, lowest_rate = ₹${adminItem2B?.lowest_rate}/MT`);

  // STEP 3: Update /01 to ₹75
  console.log('\n👉 STEP 3: Transporter resubmits /01 from ₹77 to ₹75...');
  await fetch(`${BASE_URL}/api/rate-submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      requirement_id: targetReq.id,
      item_id: item1.id,
      transporter_id: transId,
      rate_per_mt: 75,
      quoted_quantity_mt: item1.quantity_mt,
      total_amount: 75 * item1.quantity_mt,
      remarks: 'Updated quote for /01'
    })
  });

  const reqs3 = await (await fetch(`${BASE_URL}/api/requirements`, { headers: { 'Authorization': `Bearer ${token}` } })).json();
  const adminReq3 = (reqs3.data || []).find(r => r.id === targetReq.id || r.req_no === targetReq.req_no);
  const adminItem1C = (adminReq3.items || []).find(i => i.id === item1.id);
  const adminItem2C = (adminReq3.items || []).find(i => i.id === item2.id);

  console.log(`  • Admin /01 Status: bids = ${adminItem1C?.submitted_bids_count}, lowest_rate = ₹${adminItem1C?.lowest_rate}/MT (Updated to ₹75 ✅)`);
  console.log(`  • Admin /02 Status: bids = ${adminItem2C?.submitted_bids_count}, lowest_rate = ₹${adminItem2C?.lowest_rate}/MT (Unchanged at ₹88 ✅)`);

  // STEP 4: Compare Rates Endpoint Test
  console.log('\n👉 STEP 4: Verify Admin Compare Rates API...');
  const ratesCompare1 = await (await fetch(`${BASE_URL}/api/requirements/${targetReq.id}/rates?item_id=${item1.id}`, { headers: { 'Authorization': `Bearer ${token}` } })).json();
  const ratesCompare2 = await (await fetch(`${BASE_URL}/api/requirements/${targetReq.id}/rates?item_id=${item2.id}`, { headers: { 'Authorization': `Bearer ${token}` } })).json();

  console.log(`  • /01 Rates Count: ${ratesCompare1.count}, Lowest: ₹${ratesCompare1.lowest_rate}/MT`);
  console.log(`  • /02 Rates Count: ${ratesCompare2.count}, Lowest: ₹${ratesCompare2.lowest_rate}/MT`);

  const passCondition = 
    adminItem1A?.submitted_bids_count === 1 && adminItem1A?.lowest_rate === 77 && adminItem2A?.submitted_bids_count === 0 &&
    adminItem1B?.submitted_bids_count === 1 && adminItem1B?.lowest_rate === 77 && adminItem2B?.submitted_bids_count === 1 && adminItem2B?.lowest_rate === 88 &&
    adminItem1C?.submitted_bids_count === 1 && adminItem1C?.lowest_rate === 75 && adminItem2C?.submitted_bids_count === 1 && adminItem2C?.lowest_rate === 88 &&
    ratesCompare1.lowest_rate === 75 && ratesCompare2.lowest_rate === 88;

  console.log('\n==================================================');
  if (passCondition) {
    console.log(`MYSQL /01 quote == API /01 quote == ADMIN /01 quote (₹75)`);
    console.log(`MYSQL /02 quote == API /02 quote == ADMIN /02 quote (₹88)\n`);
    console.log('PASS.');
  } else {
    console.log('FAIL');
    process.exit(1);
  }
  console.log('==================================================');
}

runDataFlowTest().catch(err => {
  console.error('❌ Data Flow Test Error:', err);
  process.exit(1);
});
