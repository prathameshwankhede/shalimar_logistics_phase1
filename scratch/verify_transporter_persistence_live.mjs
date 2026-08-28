// scratch/verify_transporter_persistence_live.mjs
// Verifies live transporter creation, persistence in MySQL, and refresh state loading on Hostinger

const HOSTINGER_LOGIN_URL = 'https://lightslategray-gazelle-919724.hostingersite.com/api/auth/login';
const HOSTINGER_CREATE_TRANS_URL = 'https://lightslategray-gazelle-919724.hostingersite.com/api/transporters';
const HOSTINGER_GET_STATE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com/api/state';

async function testPersistenceLive() {
  console.log('==================================================');
  console.log('🧪 LIVE HOSTINGER TRANSPORTER PERSISTENCE TEST');
  console.log('==================================================');

  try {
    // 1. Authenticate with Production API
    console.log('🔐 Authenticating Admin Session...');
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
    console.log('✅ Admin Session Authenticated.');

    // 2. Execute POST /api/transporters
    const testCode = `TEST_${Date.now().toString().slice(-4)}`;
    const testPayload = {
      company_name: 'TEST PERSISTENCE LOGISTICS',
      code: testCode,
      contact_person: 'Rajesh Test',
      mobile: '9876543210',
      email: 'test@persistence.com',
      gstin: '23ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      address: 'Plot 100, Test Logistics Park, Indore',
      username: testCode.toLowerCase(),
      password: 'TestPassword123',
      status: 'Active'
    };

    console.log(`\n🚀 Sending POST /api/transporters (Code: ${testCode})...`);
    const postRes = await fetch(HOSTINGER_CREATE_TRANS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(testPayload)
    });

    const postData = await postRes.json();
    console.log('📊 POST Response:', JSON.stringify(postData, null, 2));

    if (!postRes.ok || !postData.success) {
      console.error('❌ POST /api/transporters failed!');
      process.exit(1);
    }

    // 3. Verify GET /api/transporters
    console.log('\n🔍 Querying GET /api/transporters (Dedicated Route)...');
    const getTransRes = await fetch('https://lightslategray-gazelle-919724.hostingersite.com/api/transporters', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const getTransData = await getTransRes.json();
    console.log('📊 GET /api/transporters Response:', JSON.stringify(getTransData, null, 2));

    // 4. Verify GET /api/state Reads Transporter From MySQL
    console.log('\n🔍 Querying GET /api/state (Simulating Browser Refresh)...');
    const getRes = await fetch(HOSTINGER_GET_STATE_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const getData = await getRes.json();
    const transportersList = getData?.data?.transporters || [];
    console.log('📊 GET /api/state Transporters Array:', JSON.stringify(transportersList, null, 2));

    console.log(`📌 Total Transporters in MySQL: ${transportersList.length}`);
    const found = transportersList.find(t => t.code === testCode);

    if (found) {
      console.log('\n🎉 SUCCESS: TRANSPORTER FOUND IN MYSQL STATE AFTER REFRESH!');
      console.log(JSON.stringify(found, null, 2));
    } else {
      console.error(`\n❌ FAIL: Transporter '${testCode}' not found in state after refresh.`);
    }

  } catch (err) {
    console.error('❌ Test Error:', err.message);
  } finally {
    process.exit(0);
  }
}

testPersistenceLive();
