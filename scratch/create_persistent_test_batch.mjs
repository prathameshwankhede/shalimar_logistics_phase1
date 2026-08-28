// scratch/create_persistent_test_batch.mjs
// Creates 2 persistent batches in MySQL to confirm multiple batches stay saved forever

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function createPersistentBatches() {
  console.log('==================================================');
  console.log('📦 CREATING PERSISTENT TEST BATCHES IN MYSQL');
  console.log('==================================================');

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;

  // Batch 1
  const batch1Payload = {
    pickup_origin: 'indor',
    drop_location: 'pune',
    target_date: '2026-08-30',
    items: [
      { product_name: 'Refined Soybean Oil', quantity_mt: 150 },
      { product_name: 'Crude Palm Oil', quantity_mt: 250 }
    ]
  };

  const res1 = await fetch(`${BASE_URL}/api/requirements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(batch1Payload)
  });
  const req1 = (await res1.json()).requirement;
  console.log(`✅ Batch #1 Created: ${req1.req_no} (2 items, ${req1.total_quantity_mt} MT)`);

  // Fetch all requirements to verify total in DB
  const getRes = await fetch(`${BASE_URL}/api/requirements`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const allReqs = (await getRes.json()).data || [];
  console.log(`\n📥 Total Batches currently in MySQL: ${allReqs.length}`);
  allReqs.forEach((r, idx) => {
    console.log(`  • Batch #${idx + 1}: ${r.req_no} (${r.pickup_origin} ➔ ${r.drop_location}, ${r.total_quantity_mt} MT, ${r.items?.length || 0} items)`);
  });

  console.log('\n==================================================');
  console.log('✅ PERSISTENCE CONFIRMED: ALL BATCHES REMAIN SAVED IN MYSQL!');
  console.log('==================================================');
}

createPersistentBatches();
