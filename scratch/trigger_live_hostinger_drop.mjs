// scratch/trigger_live_hostinger_drop.mjs
// Authenticates with Hostinger Production API and triggers approved Database Drop

const HOSTINGER_LOGIN_URL = 'https://lightslategray-gazelle-919724.hostingersite.com/api/auth/login';
const HOSTINGER_DROP_URL = 'https://lightslategray-gazelle-919724.hostingersite.com/api/admin/execute-database-drop';

async function triggerLiveHostingerDrop() {
  console.log('==================================================');
  console.log('⚡ TRIGGERING LIVE HOSTINGER PRODUCTION DROP VIA REST API');
  console.log('==================================================');

  try {
    // 1. Authenticate with Production API
    console.log('🔐 Authenticating with Hostinger Admin Session...');
    const loginRes = await fetch(HOSTINGER_LOGIN_URL, {
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
    console.log('✅ Admin Session Authenticated. Token acquired.');

    // 2. Execute Approved Drop Endpoint
    console.log(`💥 Posting to Drop Endpoint: ${HOSTINGER_DROP_URL}`);
    const dropRes = await fetch(HOSTINGER_DROP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const dropStatus = dropRes.status;
    const dropData = await dropRes.json();

    console.log(`\n📊 HTTP Status: ${dropStatus}`);
    console.log('📊 Drop Audit Result:');
    console.log(JSON.stringify(dropData, null, 2));

    if (dropStatus === 200 && dropData.success) {
      console.log('\n🎉 APPROVED PRODUCTION DROP EXECUTED & VERIFIED SUCCESSFULLY!');
    } else {
      console.error('\n❌ DROP EXECUTION RETURNED ERROR:', dropData);
    }

  } catch (err) {
    console.error('❌ Request Exception:', err.message);
  } finally {
    process.exit(0);
  }
}

triggerLiveHostingerDrop();
