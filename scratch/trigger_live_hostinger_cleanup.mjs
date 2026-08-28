// scratch/trigger_live_hostinger_cleanup.mjs
// Cleans up test requirement records from live Hostinger production

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function cleanupTestRecords() {
  console.log('==================================================');
  console.log('🧹 CLEANING UP TEST REQUIREMENTS FROM HOSTINGER');
  console.log('==================================================');

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;

  const res = await fetch(`${BASE_URL}/api/requirements`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const json = await res.json();
  const reqs = json.data || [];
  console.log(`Found ${reqs.length} total requirements to clean up.\n`);

  for (const r of reqs) {
    console.log(`Deleting test record ${r.id} (${r.req_no})...`);
    const delRes = await fetch(`${BASE_URL}/api/requirements/${r.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`  • Status: ${delRes.status}`);
  }

  console.log('\n✅ Test cleanup completed.');
}

cleanupTestRecords();
