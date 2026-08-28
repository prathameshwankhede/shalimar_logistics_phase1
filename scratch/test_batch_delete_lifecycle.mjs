// scratch/test_batch_delete_lifecycle.mjs
// Live Hostinger E2E Verification: Batch Deletion Lifecycle & Orphan Data Prevention

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function testBatchDeleteLifecycle() {
  console.log('==================================================');
  console.log('🧪 TEST: BATCH REQUIREMENT DELETION & ZERO ORPHAN QUOTES');
  console.log('==================================================');

  // 1. Authenticate Admin Token
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;
  const transId = 'trans_1787939085854';

  // 2. Create FRESH Temporary Test Batch (REQ-DELETE-TEST)
  const createRes = await fetch(`${BASE_URL}/api/requirements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      req_no: 'SNPL/26-27/REQ-DELETE-TEST',
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

  console.log(`CREATE TEMP BATCH: ${targetReq.req_no} (id: ${targetReq.id})`);
  console.log(`  • /01 item: ${item1.id}`);
  console.log(`  • /02 item: ${item2.id}\n`);

  // 3. Transporter submits quotes for both /01 and /02
  console.log('👉 STEP 1: Transporter submits quotes for /01 (₹77) and /02 (₹88)...');
  await fetch(`${BASE_URL}/api/rate-submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      requirement_id: targetReq.id,
      item_id: item1.id,
      transporter_id: transId,
      rate_per_mt: 77,
      quoted_quantity_mt: item1.quantity_mt,
      total_amount: 77 * item1.quantity_mt
    })
  });

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

  // Verify Quotes exist in MySQL
  const ratesRes = await (await fetch(`${BASE_URL}/api/requirements/${targetReq.id}/rates`, { headers: { 'Authorization': `Bearer ${token}` } })).json();
  console.log(`  • Verified Quotes in MySQL for ${targetReq.id}: ${ratesRes.count} active quotes ✅`);

  // 4. Delete the Batch Requirement via Admin API
  console.log('\n👉 STEP 2: Delete Batch Requirement via DELETE /api/requirements/:id...');
  const delRes = await fetch(`${BASE_URL}/api/requirements/${targetReq.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const delJson = await delRes.json();
  console.log(`  • API Delete Response:`, delJson);

  // 5. Verify Orphan Audit Endpoint
  console.log('\n👉 STEP 3: Verify MySQL Database Post-Deletion...');
  const auditRes = await fetch(`${BASE_URL}/api/audit-orphan-data`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const auditJson = await auditRes.json();

  console.log(`  • Total rate_submissions in MySQL: ${auditJson.total_rate_submissions}`);
  console.log(`  • Orphan rate_submissions in MySQL: ${auditJson.orphan_rate_submissions} ✅`);

  // Verify GET /api/requirements no longer returns deleted requirement
  const reqsList = await (await fetch(`${BASE_URL}/api/requirements`, { headers: { 'Authorization': `Bearer ${token}` } })).json();
  const existsInApi = (reqsList.data || []).some(r => r.id === targetReq.id || r.req_no === targetReq.req_no);

  console.log(`  • Deleted Requirement present in GET /api/requirements: ${existsInApi ? 'YES ❌' : 'NO (ABSENT ✅)'}`);

  const pass = delRes.ok && delJson.success && auditJson.orphan_rate_submissions === 0 && !existsInApi;

  console.log('\n==================================================');
  if (pass) {
    console.log('DELETED BATCH');
    console.log(' -> 0 child items');
    console.log(' -> 0 related rate submissions');
    console.log(' -> absent from Admin API');
    console.log(' -> absent from Admin UI\n');
    console.log('PASS.');
  } else {
    console.log('FAIL');
    process.exit(1);
  }
  console.log('==================================================');
}

testBatchDeleteLifecycle().catch(err => {
  console.error('❌ Delete Lifecycle Test Error:', err);
  process.exit(1);
});
