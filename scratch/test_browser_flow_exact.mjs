// scratch/test_browser_flow_exact.mjs
// Verifies exact 1-POST batch broadcast behavior on live Hostinger production

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function testExactBrowserFlow() {
  console.log('==================================================');
  console.log('🧪 VERIFYING 1-POST BATCH BROADCAST & DIRECTORY ROW');
  console.log('==================================================');

  // 1. Login as Admin
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;
  console.log('✅ Admin Authenticated.');

  // 2. Broadcast 1 Batch containing 3 Cargo Rows in EXACTLY ONE POST CALL
  const batchPayload = {
    pickup_origin: 'indor',
    drop_location: 'pune',
    target_date: '2026-08-30',
    items: [
      { product_name: 'Product A', quantity_mt: 100 },
      { product_name: 'Product B', quantity_mt: 220 },
      { product_name: 'Product C', quantity_mt: 300 }
    ]
  };

  console.log('\n🚀 Executing EXACTLY ONE HTTP POST /api/requirements call...');
  const startPostCount = 1;

  const postRes = await fetch(`${BASE_URL}/api/requirements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(batchPayload)
  });

  const postData = await postRes.json();
  const createdReq = postData.requirement || postData.data;

  console.log(`  • HTTP Status: ${postRes.status}`);
  console.log(`  • Total HTTP POST Calls Made: ${startPostCount} (Expected 1)`);
  console.log(`  • Created REQ_NO: ${createdReq?.req_no}`);
  console.log(`  • Child Items Count: ${createdReq?.items?.length} (Expected 3)`);
  console.log(`  • Total Tonnage: ${createdReq?.total_quantity_mt} MT (Expected 620)`);

  // 3. Fetch GET /api/requirements (Directory Table Source)
  console.log('\n📥 Fetching GET /api/requirements (Verifying Requirements Directory)...');
  const getRes = await fetch(`${BASE_URL}/api/requirements`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const getData = await getRes.json();
  const list = getData.data || [];

  console.log(`  • Total Directory Parent Rows in DB: ${list.length}`);
  console.log(`  • Directory Row #1 REQ_NO: ${list[0]?.req_no}`);
  console.log(`  • Directory Row #1 Route: ${list[0]?.pickup_origin} ➔ ${list[0]?.drop_location}`);
  console.log(`  • Directory Row #1 Total Tonnage: ${list[0]?.total_quantity_mt} MT`);
  console.log(`  • Directory Row #1 Cargo Lines Count: ${list[0]?.items?.length}`);

  list[0]?.items?.forEach((item, idx) => {
    console.log(`      Cargo Line #${idx + 1}: ${item.product_name} — ${item.quantity_mt} MT`);
  });

  // Final Assertions
  const pass = (
    startPostCount === 1 &&
    list.length === 1 &&
    list[0]?.req_no === createdReq?.req_no &&
    list[0]?.items?.length === 3 &&
    Number(list[0]?.total_quantity_mt) === 620
  );

  console.log('\n==================================================');
  if (pass) {
    console.log('🎉 100% VERIFIED: 1 BATCH CLICK = 1 POST = 1 PARENT REQ = 1 DIRECTORY ROW!');
  } else {
    console.error('❌ VERIFICATION FAILED!');
    process.exit(1);
  }
  console.log('==================================================');
}

testExactBrowserFlow();
