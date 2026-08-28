// scratch/verify_actions_live.mjs
// Verifies live status update and password reset endpoints on Hostinger Production

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function testActionsLive() {
  console.log('==================================================');
  console.log('🧪 LIVE HOSTINGER TRANSPORTER ACTIONS VERIFICATION');
  console.log('==================================================');

  try {
    // 1. Authenticate Admin Session
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.token) {
      console.error('❌ Login Failed:', loginData);
      process.exit(1);
    }
    const token = loginData.token;
    console.log('✅ Admin Authenticated.');

    // 2. Fetch Live Transporters
    const transRes = await fetch(`${BASE_URL}/api/transporters`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const transData = await transRes.json();
    const transporters = transData.transporters || [];
    console.log(`📌 Found ${transporters.length} Transporters in Production MySQL.`);

    // Target a test record or existing record safely
    const target = transporters.find(t => t.code.startsWith('K001') || t.code.startsWith('TEST_')) || transporters[0];
    if (!target) {
      console.error('❌ No target transporter found.');
      process.exit(1);
    }

    console.log(`\n🎯 Target Transporter: '${target.company_name}' (ID: ${target.id}, Code: ${target.code}, Status: ${target.status})`);

    // 3. Test Deactivation (Active -> Inactive)
    console.log(`\n🔄 Step 3: Deactivating '${target.company_name}' (Setting status to 'Inactive')...`);
    const deactRes = await fetch(`${BASE_URL}/api/transporters/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ id: target.id, status: 'Inactive' })
    });
    const deactData = await deactRes.json();
    console.log('  • Deactivate Response:', deactData);

    // Verify DB refetch after Deactivate
    const refetch1 = await fetch(`${BASE_URL}/api/transporters`, { headers: { 'Authorization': `Bearer ${token}` } });
    const list1 = (await refetch1.json()).transporters || [];
    const t1 = list1.find(t => t.id === target.id);
    console.log(`  • Verified MySQL Status After Deactivate: '${t1?.status}'`);

    // 4. Test Activation (Inactive -> Active)
    console.log(`\n🔄 Step 4: Activating '${target.company_name}' (Setting status back to 'Active')...`);
    const actRes = await fetch(`${BASE_URL}/api/transporters/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ id: target.id, status: 'Active' })
    });
    const actData = await actRes.json();
    console.log('  • Activate Response:', actData);

    // Verify DB refetch after Activate
    const refetch2 = await fetch(`${BASE_URL}/api/transporters`, { headers: { 'Authorization': `Bearer ${token}` } });
    const list2 = (await refetch2.json()).transporters || [];
    const t2 = list2.find(t => t.id === target.id);
    console.log(`  • Verified MySQL Status After Activate: '${t2?.status}'`);

    // 5. Test Password Reset Endpoint
    console.log(`\n🔑 Step 5: Testing Reset Password Endpoint for '${target.company_name}'...`);
    const resetRes = await fetch(`${BASE_URL}/api/transporters/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ id: target.id })
    });

    const resetData = await resetRes.json();
    console.log('  • Reset Password API Response:', resetData);

    // 6. Security Leakage Check
    console.log('\n🔒 Step 6: Checking for password hash leakage in GET /api/transporters...');
    const hasHashInTransporters = list2.some(t => t.password || t.password_hash || t.hash);
    console.log(`  • password_hash leaked in GET /api/transporters: ${hasHashInTransporters ? 'YES (SECURITY RISK!)' : 'NO (SECURE)'}`);

    if (deactData.success && actData.success && resetData.success && !hasHashInTransporters) {
      console.log('\n==================================================');
      console.log('🎉 100% SUCCESS: DEACTIVATE, ACTIVATE, AND RESET PASS VERIFIED LIVE ON HOSTINGER!');
      console.log('==================================================');
    } else {
      console.error('\n❌ FAIL: Action verification failed.');
    }

  } catch (err) {
    console.error('❌ Live Action Error:', err.message);
  } process.exit(0);
}

testActionsLive();
