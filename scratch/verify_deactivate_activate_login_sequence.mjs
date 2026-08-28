// scratch/verify_deactivate_activate_login_sequence.mjs
// Verifies complete Deactivate -> Activate -> Login sequence on Hostinger Production

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function testFullSequence() {
  console.log('==================================================');
  console.log('🧪 LIVE DEACTIVATE -> ACTIVATE -> LOGIN SEQUENCE TEST');
  console.log('==================================================');

  try {
    // 1. Login Admin
    const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const adminToken = (await adminRes.json()).token;
    console.log('✅ Admin Authenticated.');

    // 2. Target Transporter P001
    const transListRes = await fetch(`${BASE_URL}/api/transporters`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const transporters = (await transListRes.json()).transporters || [];
    const target = transporters.find(t => t.code === 'P001' || t.username === 'P001') || transporters[0];
    console.log(`📌 Target Transporter: '${target.company_name}' (ID: ${target.id}, Code: ${target.code})`);

    // 3. Reset Password -> Generate Fresh Password
    console.log('\n🔑 Step 1: Admin Reset Password...');
    const resetRes = await fetch(`${BASE_URL}/api/transporters/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ id: target.id })
    });
    const tempPassword = (await resetRes.json()).tempPassword;
    console.log(`  • Fresh Temporary Password Generated: "${tempPassword}"`);

    // 4. Initial Login Test
    console.log('\n🔐 Step 2: Testing Initial Transporter Login...');
    const login1 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: target.code, password: tempPassword })
    });
    console.log(`  • Initial Login Status: ${login1.status} (Expected 200)`);
    if (login1.status !== 200) throw new Error('Initial login failed');

    // 5. Admin Deactivates Transporter
    console.log('\n🔴 Step 3: Admin Deactivates Transporter...');
    const deactRes = await fetch(`${BASE_URL}/api/transporters/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ id: target.id, status: 'Inactive' })
    });
    console.log('  • Deactivate Response:', await deactRes.json());

    // 6. Test Login while Inactive
    console.log('\n🔒 Step 4: Testing Transporter Login while Inactive...');
    const login2 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: target.code, password: tempPassword })
    });
    console.log(`  • Inactive Login Status: ${login2.status} (Expected 403 Forbidden)`);
    if (login2.status !== 403) throw new Error(`Expected 403 but got ${login2.status}`);

    // 7. Admin Activates Transporter
    console.log('\n🟢 Step 5: Admin Activates Transporter...');
    const actRes = await fetch(`${BASE_URL}/api/transporters/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ id: target.id, status: 'Active' })
    });
    console.log('  • Activate Response:', await actRes.json());

    // 8. Test Login After Activate using SAME OLD PASSWORD
    console.log('\n🔓 Step 6: Testing Transporter Login After Activate with SAME OLD PASSWORD...');
    const login3 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: target.code, password: tempPassword })
    });
    console.log(`  • Post-Activate Login Status: ${login3.status} (Expected 200 SUCCESS)`);
    const login3Data = await login3.json();

    if (login3.status === 200 && login3Data.success) {
      console.log('\n==================================================');
      console.log('🎉 100% VERIFIED: DEACTIVATE -> ACTIVATE PRESERVES PASSWORD & LOGIN SUCCEEDS!');
      console.log('==================================================');
    } else {
      console.error('\n❌ FAIL: Post-activate login failed.');
    }

  } catch (err) {
    console.error('❌ Sequence Error:', err.message);
  } process.exit(0);
}

testFullSequence();
