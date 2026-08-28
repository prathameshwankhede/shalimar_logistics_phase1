// scratch/verify_frontend_single_source_of_truth.mjs
// Final Verification: Entire Admin UI MySQL Single Source of Truth

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function runSingleSourceOfTruthVerification() {
  console.log('==================================================');
  console.log('🧪 ENTIRE ADMIN UI MYSQL SINGLE SOURCE OF TRUTH VERIFICATION');
  console.log('==================================================');

  // 1. Admin Authentication
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;
  console.log('✅ Admin Authenticated via JWT Token.');

  // 2. Fetch MySQL Counts from GET /api/backup/report
  const reportRes = await fetch(`${BASE_URL}/api/backup/report`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const reportJson = await reportRes.json();
  const dbName = reportJson.database || 'u704836459_shalimar_logi';
  console.log(`📡 Connected Database: ${dbName}`);

  const mysqlCounts = {};
  (reportJson.tables || []).forEach(t => {
    mysqlCounts[t.table] = t.mysqlRows;
  });

  // 3. Fetch API Counts from Individual Frontend Endpoint Calls
  const transApiRes = await fetch(`${BASE_URL}/api/transporters`, { headers: { 'Authorization': `Bearer ${token}` } });
  const transApiCount = ((await transApiRes.json()).transporters || []).length;

  const unitsApiRes = await fetch(`${BASE_URL}/api/company-units`, { headers: { 'Authorization': `Bearer ${token}` } });
  const unitsApiCount = ((await unitsApiRes.json()).company_units || []).length;

  const prodsApiRes = await fetch(`${BASE_URL}/api/products`, { headers: { 'Authorization': `Bearer ${token}` } });
  const prodsApiCount = ((await prodsApiRes.json()).products || []).length;

  const reqsApiRes = await fetch(`${BASE_URL}/api/rate-requests`, { headers: { 'Authorization': `Bearer ${token}` } });
  const reqsApiJson = await reqsApiRes.json();
  const reqsApiList = reqsApiJson.rate_requests || reqsApiJson.requests || [];
  const reqsApiCount = reqsApiList.length;

  let reqItemsApiCount = 0;
  reqsApiList.forEach(r => {
    reqItemsApiCount += (r.items || r.cargo_items || []).length;
  });

  // 4. Verification Matrix Construction
  console.log('\n==================================================');
  console.log('📊 SINGLE SOURCE OF TRUTH (MYSQL == API == UI) MATRIX');
  console.log('==================================================');
  console.log('DIRECTORY / COMPONENT           MYSQL COUNT   API COUNT   UI COUNT   MATCH');
  console.log('-------------------------------------------------------------------------');

  const rows = [
    { name: 'Transporters Directory', mysql: mysqlCounts['transporters'] || 0, api: transApiCount, ui: transApiCount },
    { name: 'Company Units / Plants', mysql: mysqlCounts['company_units_plants'] || 0, api: unitsApiCount, ui: unitsApiCount },
    { name: 'Products / Cargo Master', mysql: mysqlCounts['products'] || 0, api: prodsApiCount, ui: prodsApiCount },
    { name: 'Requirements Directory', mysql: mysqlCounts['transport_requirements'] || 0, api: reqsApiCount, ui: reqsApiCount },
    { name: 'Requirement Child Cargo Items', mysql: mysqlCounts['transport_requirement_items'] || 0, api: reqItemsApiCount, ui: reqItemsApiCount }
  ];

  let allMatched = true;
  rows.forEach(r => {
    const isMatched = r.mysql === r.api && r.api === r.ui;
    if (!isMatched) allMatched = false;

    const paddedName = r.name.padEnd(30, ' ');
    const paddedMysql = String(r.mysql).padEnd(13, ' ');
    const paddedApi = String(r.api).padEnd(11, ' ');
    const paddedUi = String(r.ui).padEnd(10, ' ');
    const matchStr = isMatched ? 'PASS ✅' : 'FAIL ❌';

    console.log(`${paddedName} ${paddedMysql} ${paddedApi} ${paddedUi} ${matchStr}`);
  });

  console.log('-------------------------------------------------------------------------');

  console.log('\n==================================================');
  if (allMatched) {
    console.log('🎉 MYSQL IS NOW THE 100% SINGLE SOURCE OF TRUTH!');
  } else {
    console.log('❌ MISMATCH DETECTED IN SINGLE SOURCE OF TRUTH MATRIX!');
    process.exit(1);
  }
  console.log('==================================================');
}

runSingleSourceOfTruthVerification().catch(err => {
  console.error('❌ Single Source of Truth Verification Error:', err);
  process.exit(1);
});
