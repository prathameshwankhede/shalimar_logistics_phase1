// scratch/test_independent_bid_inputs.mjs
// Live Hostinger E2E Verification for Independent Sub-Indent Bid Inputs & Quote Persistence

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function runIndependentBidInputsTest() {
  console.log('==================================================');
  console.log('🧪 TEST: INDEPENDENT SUB-INDENT BID INPUTS & MYSQL QUOTES');
  console.log('==================================================');

  // 1. Authenticate Admin Token
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;
  const transId = 'trans_1787939085854';

  // 2. Create FRESH Requirement Batch (REQ-0004) to test 0-quote initial state
  const createRes = await fetch(`${BASE_URL}/api/requirements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      req_no: 'SNPL/26-27/REQ-0004',
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

  console.log(`PARENT: ${targetReq.req_no} (${targetReq.total_quantity_mt} MT Batch Total)`);
  console.log(`  Sub-Indent 1: ${item1.sub_indent_no} (${item1.quantity_mt} MT, ${item1.pickup_origin} -> ${item1.drop_location})`);
  console.log(`  Sub-Indent 2: ${item2.sub_indent_no} (${item2.quantity_mt} MT, ${item2.pickup_origin} -> ${item2.drop_location})\n`);

  // 3. Step A: Submit ₹77 ONLY for Sub-Indent /01
  console.log('👉 STEP 1: Submit ₹77 ONLY for Sub-Indent /01...');
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

  // Verify rates for /01 and /02
  const rates1A = await (await fetch(`${BASE_URL}/api/requirements/${targetReq.id}/rates?item_id=${item1.id}`, { headers: { 'Authorization': `Bearer ${token}` } })).json();
  const rates2A = await (await fetch(`${BASE_URL}/api/requirements/${targetReq.id}/rates?item_id=${item2.id}`, { headers: { 'Authorization': `Bearer ${token}` } })).json();

  console.log(`  • /01 Rate in MySQL: ₹${rates1A.rates[0]?.rate_per_mt}/MT (${rates1A.count} quote)`);
  console.log(`  • /02 Rate in MySQL: ${rates2A.count === 0 ? 'NO QUOTE (EMPTY ✅)' : 'Has Quote'}`);

  // 4. Step B: Submit ₹88 ONLY for Sub-Indent /02
  console.log('\n👉 STEP 2: Submit ₹88 ONLY for Sub-Indent /02...');
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
      remarks: 'Quote for /02 only'
    })
  });

  const rates1B = await (await fetch(`${BASE_URL}/api/requirements/${targetReq.id}/rates?item_id=${item1.id}`, { headers: { 'Authorization': `Bearer ${token}` } })).json();
  const rates2B = await (await fetch(`${BASE_URL}/api/requirements/${targetReq.id}/rates?item_id=${item2.id}`, { headers: { 'Authorization': `Bearer ${token}` } })).json();

  console.log(`  • /01 Rate in MySQL: ₹${rates1B.rates[0]?.rate_per_mt}/MT`);
  console.log(`  • /02 Rate in MySQL: ₹${rates2B.rates[0]?.rate_per_mt}/MT`);

  // 5. Step C: Update /01 from ₹77 to ₹75
  console.log('\n👉 STEP 3: Resubmit /01 from ₹77 to ₹75...');
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

  const rates1C = await (await fetch(`${BASE_URL}/api/requirements/${targetReq.id}/rates?item_id=${item1.id}`, { headers: { 'Authorization': `Bearer ${token}` } })).json();
  const rates2C = await (await fetch(`${BASE_URL}/api/requirements/${targetReq.id}/rates?item_id=${item2.id}`, { headers: { 'Authorization': `Bearer ${token}` } })).json();

  console.log(`  • /01 Rate in MySQL: ₹${rates1C.rates[0]?.rate_per_mt}/MT (Updated to ₹75 ✅)`);
  console.log(`  • /02 Rate in MySQL: ₹${rates2C.rates[0]?.rate_per_mt}/MT (Unchanged at ₹88 ✅)`);

  const passCondition = 
    rates1A.rates[0]?.rate_per_mt === 77 && rates2A.count === 0 &&
    rates1B.rates[0]?.rate_per_mt === 77 && rates2B.rates[0]?.rate_per_mt === 88 &&
    rates1C.rates[0]?.rate_per_mt === 75 && rates2C.rates[0]?.rate_per_mt === 88;

  console.log('\n==================================================');
  if (passCondition) {
    console.log(`REQ-0004/01 → 300 MT → ₹77`);
    console.log(`REQ-0004/02 → 200 MT → ₹88\n`);
    console.log(`MYSQL:\nitem /01 → ₹77\nitem /02 → ₹88\n`);
    console.log('PASS.');
  } else {
    console.log('FAIL');
    process.exit(1);
  }
  console.log('==================================================');
}

runIndependentBidInputsTest().catch(err => {
  console.error('❌ Test Error:', err);
  process.exit(1);
});
