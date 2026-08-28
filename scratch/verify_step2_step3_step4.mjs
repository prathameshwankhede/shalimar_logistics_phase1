// scratch/verify_step2_step3_step4.mjs
// Read-only verification of GET /api/transporters, GET /api/state, and production frontend bundle

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function runReadOnlyVerification() {
  console.log('==================================================');
  console.log('🔍 READ-ONLY PRODUCTION VERIFICATION (STEPS 2, 3, 4)');
  console.log('==================================================');

  try {
    // Authenticate Admin Session
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;

    // STEP 2: Verify GET /api/transporters
    console.log('\n--- STEP 2: GET /api/transporters ---');
    const transRes = await fetch(`${BASE_URL}/api/transporters`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`HTTP Status: ${transRes.status}`);
    const transData = await transRes.json();
    const transList = transData.transporters || [];
    console.log(`Transporter Count: ${transList.length}`);
    console.log('Sample Records:');
    transList.slice(0, 5).forEach(t => {
      console.log(`  - Code: ${t.code} | Name: ${t.company_name} | User: ${t.username}`);
    });

    const w001 = transList.find(t => t.code === 'W001' || t.username === 'wankhede' || (t.company_name || '').toLowerCase().includes('wankhede'));
    const s001 = transList.find(t => t.code === 'S001' || t.username === 'sarvesh' || (t.company_name || '').toLowerCase().includes('sarvesh'));
    console.log(`  • W001 / Wankhede Found: ${w001 ? 'YES (' + w001.company_name + ')' : 'NO'}`);
    console.log(`  • S001 / Sarvesh Found: ${s001 ? 'YES (' + s001.company_name + ')' : 'NO'}`);

    // STEP 3: Verify GET /api/state
    console.log('\n--- STEP 3: GET /api/state ---');
    const stateRes = await fetch(`${BASE_URL}/api/state`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`HTTP Status: ${stateRes.status}`);
    const stateData = await stateRes.json();
    const stateTransList = stateData?.data?.transporters || [];
    console.log(`State Transporters Count: ${stateTransList.length}`);
    console.log(`Comparison: GET /api/transporters (${transList.length}) vs GET /api/state (${stateTransList.length})`);

    // STEP 4: Verify Production Frontend Bundle
    console.log('\n--- STEP 4: Production Frontend Bundle Verification ---');
    const htmlRes = await fetch(BASE_URL);
    const htmlText = await htmlRes.text();
    const jsMatch = htmlText.match(/src="(\/assets\/index-[^"]+\.js)"/);
    if (jsMatch) {
      const jsUrl = `${BASE_URL}${jsMatch[1]}`;
      console.log(`Frontend JS Bundle URL: ${jsUrl}`);
      const jsRes = await fetch(jsUrl);
      const jsText = await jsRes.text();
      
      const containsApiTransporters = jsText.includes('/api/transporters');
      const containsLoadDBFromSupabase = jsText.includes('loadDBFromSupabase');
      console.log(`  • Bundle contains '/api/transporters': ${containsApiTransporters}`);
      console.log(`  • Bundle contains 'loadDBFromSupabase': ${containsLoadDBFromSupabase}`);
    } else {
      console.log('Could not parse JS bundle URL from HTML.');
    }

  } catch (err) {
    console.error('❌ Verification Error:', err.message);
  } finally {
    process.exit(0);
  }
}

runReadOnlyVerification();
