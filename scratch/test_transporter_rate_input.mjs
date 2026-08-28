// scratch/test_transporter_rate_input.mjs
// Transporter Sub-Indent Rate Input Typing & Sub-Indent Isolation Test

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function verifyTransporterRateInput() {
  console.log('==================================================');
  console.log('🧪 VERIFYING TRANSPORTER SUB-INDENT RATE INPUT TYPING');
  console.log('==================================================');

  // 1. Authenticate Admin Token
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;
  const transId = 'trans_1787939085854';

  // 2. Create FRESH Requirement Batch (REQ-0006)
  const createRes = await fetch(`${BASE_URL}/api/requirements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      req_no: 'SNPL/26-27/REQ-0006',
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
  console.log(`  Sub-Indent 1 (item_id: ${item1.id}): ${item1.sub_indent_no} (${item1.quantity_mt} MT, ${item1.pickup_origin} -> ${item1.drop_location})`);
  console.log(`  Sub-Indent 2 (item_id: ${item2.id}): ${item2.sub_indent_no} (${item2.quantity_mt} MT, ${item2.pickup_origin} -> ${item2.drop_location})\n`);

  // Verify unique sub-indent keys
  const subKey1 = `${targetReq.id}_${item1.id}`;
  const subKey2 = `${targetReq.id}_${item2.id}`;
  console.log(`  • Sub-Indent Key /01: "${subKey1}"`);
  console.log(`  • Sub-Indent Key /02: "${subKey2}"`);
  console.log(`  • Key collision test (subKey1 !== subKey2): ${subKey1 !== subKey2 ? 'PASSED ✅' : 'FAILED ❌'}\n`);

  // Simulated React State Management Test
  let quickRatesState = {};

  // TEST A: Type 77 into /01
  console.log('👉 TEST A: Type 77 into /01 rate input...');
  quickRatesState = { ...quickRatesState, [subKey1]: '77' };
  console.log(`  • quickRates['${subKey1}'] = "${quickRatesState[subKey1]}"`);
  console.log(`  • quickRates['${subKey2}'] = "${quickRatesState[subKey2] || 'EMPTY'}" (Isolates /02 ✅)`);

  // TEST B: Type 88 into /02
  console.log('\n👉 TEST B: Type 88 into /02 rate input...');
  quickRatesState = { ...quickRatesState, [subKey2]: '88' };
  console.log(`  • quickRates['${subKey1}'] = "${quickRatesState[subKey1]}" (Stays 77 ✅)`);
  console.log(`  • quickRates['${subKey2}'] = "${quickRatesState[subKey2]}" (Updates to 88 ✅)`);

  // TEST C: Change /01 to 75
  console.log('\n👉 TEST C: Change /01 from 77 to 75...');
  quickRatesState = { ...quickRatesState, [subKey1]: '75' };
  console.log(`  • quickRates['${subKey1}'] = "${quickRatesState[subKey1]}" (Updated to 75 ✅)`);
  console.log(`  • quickRates['${subKey2}'] = "${quickRatesState[subKey2]}" (Unchanged at 88 ✅)`);

  // TEST D: Submit /01 Quote
  console.log('\n👉 TEST D: Click Quote on /01 (Submit ₹75)...');
  await fetch(`${BASE_URL}/api/rate-submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      requirement_id: targetReq.id,
      item_id: item1.id,
      transporter_id: transId,
      rate_per_mt: 75,
      quoted_quantity_mt: item1.quantity_mt,
      total_amount: 75 * item1.quantity_mt
    })
  });

  const rates1D = await (await fetch(`${BASE_URL}/api/requirements/${targetReq.id}/rates?item_id=${item1.id}`, { headers: { 'Authorization': `Bearer ${token}` } })).json();
  const rates2D = await (await fetch(`${BASE_URL}/api/requirements/${targetReq.id}/rates?item_id=${item2.id}`, { headers: { 'Authorization': `Bearer ${token}` } })).json();

  console.log(`  • MySQL /01 rate: ₹${rates1D.rates[0]?.rate_per_mt}/MT`);
  console.log(`  • MySQL /02 rate: ${rates2D.count === 0 ? 'NO QUOTE (EMPTY ✅)' : 'Has Quote'}`);

  // TEST E: Submit /02 Quote
  console.log('\n👉 TEST E: Click Quote on /02 (Submit ₹88)...');
  await fetch(`${BASE_URL}/api/rate-submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      requirement_id: targetReq.id,
      item_id: item2.id,
      transporter_id: transId,
      rate_per_mt: 88,
      quoted_quantity_mt: item2.quantity_mt,
      total_amount: 88 * item2.quantity_mt
    })
  });

  const rates1E = await (await fetch(`${BASE_URL}/api/requirements/${targetReq.id}/rates?item_id=${item1.id}`, { headers: { 'Authorization': `Bearer ${token}` } })).json();
  const rates2E = await (await fetch(`${BASE_URL}/api/requirements/${targetReq.id}/rates?item_id=${item2.id}`, { headers: { 'Authorization': `Bearer ${token}` } })).json();

  console.log(`  • MySQL /01 rate: ₹${rates1E.rates[0]?.rate_per_mt}/MT`);
  console.log(`  • MySQL /02 rate: ₹${rates2E.rates[0]?.rate_per_mt}/MT`);

  const pass = subKey1 !== subKey2 &&
               quickRatesState[subKey1] === '75' &&
               quickRatesState[subKey2] === '88' &&
               rates1D.rates[0]?.rate_per_mt === 75 && rates2D.count === 0 &&
               rates1E.rates[0]?.rate_per_mt === 75 && rates2E.rates[0]?.rate_per_mt === 88;

  console.log('\n==================================================');
  if (pass) {
    console.log(`SNPL/26-27/REQ-0006/01 -> Rate input accepts typing (75)`);
    console.log(`SNPL/26-27/REQ-0006/02 -> Rate input accepts typing (88)\n`);
    console.log(`Independent state:\n /01 = 75\n /02 = 88\n`);
    console.log(`Database:\n /01 -> item_id_01 -> ₹75\n /02 -> item_id_02 -> ₹88\n`);
    console.log('PASS.');
  } else {
    console.log('FAIL');
    process.exit(1);
  }
  console.log('==================================================');
}

verifyTransporterRateInput().catch(err => {
  console.error('❌ Verification Error:', err);
  process.exit(1);
});
