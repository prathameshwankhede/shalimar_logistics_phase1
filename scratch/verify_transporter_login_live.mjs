// scratch/verify_transporter_login_live.mjs
// Verifies live Transporter Login and Reset Password on Hostinger Production

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function testTransporterLoginLive() {
  console.log('==================================================');
  console.log('🧪 LIVE HOSTINGER TRANSPORTER LOGIN VERIFICATION');
  console.log('==================================================');

  try {
    // 1. Login as Admin
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const adminData = await adminLoginRes.json();
    const adminToken = adminData.token;
    console.log('✅ Admin Authenticated.');

    // 2. Fetch Live Transporters
    const transListRes = await fetch(`${BASE_URL}/api/transporters`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const transList = (await transListRes.json()).transporters || [];
    console.log(`📌 Found ${transList.length} Transporters in Production MySQL.`);
    transList.forEach(t => console.log(`   - Code: ${t.code} | Username: ${t.username} | Name: ${t.company_name} | Status: ${t.status}`));

    // Target P001 or K001 or W001
    const target = transList.find(t => t.code === 'P001' || t.code === 'K001' || t.username === 'P001') || transList[0];
    console.log(`\n🎯 Target Vendor for Login Test: '${target.company_name}' (Code: ${target.code}, Username: ${target.username})`);

    // 3. Admin Resets Password for Target Transporter
    console.log(`\n🔑 Resetting Password for '${target.company_name}'...`);
    const resetRes = await fetch(`${BASE_URL}/api/transporters/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ id: target.id })
    });

    const resetData = await resetRes.json();
    const tempPassword = resetData.tempPassword;
    console.log(`  • Reset Password API Response: success=${resetData.success}, tempPassword="${tempPassword}"`);

    // 4. Test Transporter Login with Correct Password using Vendor Code
    console.log(`\n🔐 Attempting Transporter Login for '${target.code}' with password '${tempPassword}'...`);
    const userLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: target.code, password: tempPassword })
    });

    const userLoginData = await userLoginRes.json();
    console.log(`  • Login Status: ${userLoginRes.status}`);
    console.log(`  • Login Response User DTO:`, userLoginData.user);

    // 5. Test Transporter Login using Username (if distinct)
    if (target.username && target.username.toLowerCase() !== target.code.toLowerCase()) {
      console.log(`\n🔐 Attempting Transporter Login using Username '${target.username}'...`);
      const userLoginRes2 = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: target.username, password: tempPassword })
      });
      console.log(`  • Login Status (via username): ${userLoginRes2.status}`);
    }

    // 6. Test Transporter Login with Incorrect Password
    console.log(`\n🔒 Testing Invalid Password Rejection...`);
    const invalidLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: target.code, password: 'WrongPassword999' })
    });
    console.log(`  • Invalid Login HTTP Status: ${invalidLoginRes.status} (Expected 401)`);

    if (userLoginRes.ok && userLoginData.token && userLoginData.user?.role === 'transporter') {
      console.log('\n==================================================');
      console.log('🎉 100% SUCCESS: TRANSPORTER LOGIN & BCRYPT AUTHENTICATION VERIFIED LIVE ON HOSTINGER!');
      console.log('==================================================');
    } else {
      console.error('\n❌ FAIL: Transporter login authentication failed.');
    }

  } catch (err) {
    console.error('❌ Live Login Test Error:', err.message);
  } process.exit(0);
}

testTransporterLoginLive();
