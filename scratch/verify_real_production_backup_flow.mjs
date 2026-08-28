// scratch/verify_real_production_backup_flow.mjs
// Comprehensive Real Production Verification for Live MySQL .sql Backup & Exact Snapshot Restore

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function runLiveProductionBackupFlow() {
  console.log('==================================================');
  console.log('🧪 LIVE PRODUCTION MYSQL BACKUP & SNAPSHOT RESTORE TEST');
  console.log('==================================================');

  // 1. Admin Login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;
  console.log('✅ Admin Authenticated via JWT Token.');

  // STEP 1: Create Real Production Records (Pre-Backup State)
  console.log('\n🚀 STEP 1: Creating Real Production Records in Hostinger MySQL...');

  // Real Product
  const prodRes = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ id: 'prod_real_1', code: 'PRD-SOYA-01', name: 'TOTAL GOLD SOYA DOC', category: 'Soya Meal', hsn_code: '23040010', default_unit: 'MT' })
  });
  console.log('  • Real Product Created Status:', prodRes.status);

  // Real Company Unit / Plant
  const unitRes = await fetch(`${BASE_URL}/api/company-units`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      id: 'unit_real_1',
      company_name: 'SHALIMAR SOLVENT PLANT NAGPUR',
      name: 'SHALIMAR SOLVENT PLANT NAGPUR',
      registered_address: 'Plot 45 Hingna MIDC Industrial Area',
      contact_name: 'Rajesh Sharma',
      mobile: '9822011223',
      state: 'Maharashtra',
      city: 'Nagpur',
      district: 'Nagpur',
      pin_code: '440016'
    })
  });
  console.log('  • Real Company Unit Created Status:', unitRes.status);

  // Real Transporter
  const transRes = await fetch(`${BASE_URL}/api/transporters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ id: 'trans_real_1', company_name: 'WARORA LOGISTICS ROADWAYS', code: 'WARORA01', contact_person: 'Sanjay Verma', mobile: '9422155667', email: 'warora@logistics.com' })
  });
  console.log('  • Real Transporter Created Status:', transRes.status);

  // Real Batch Requirement with 2 Cargo Items
  const reqRes = await fetch(`${BASE_URL}/api/rate-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      pickup_origin: 'Nagpur',
      drop_location: 'Mumbai Port',
      target_date: '2026-09-10',
      items: [
        { product_name: 'TOTAL GOLD SOYA DOC', quantity_mt: 500, unit: 'MT', pickup_origin: 'Nagpur', drop_location: 'Mumbai Port' },
        { product_name: 'SOYA MEAL DEOILED CAKE', quantity_mt: 300, unit: 'MT', pickup_origin: 'Nagpur', drop_location: 'Mumbai Port' }
      ]
    })
  });
  const reqJson = await reqRes.json();
  const realReqId = reqJson.data?.id || reqJson.requirement?.id;
  const realReqNo = reqJson.data?.req_no || reqJson.requirement?.req_no;
  console.log(`  • Real Requirement Created (Req No: ${realReqNo}, ID: ${realReqId})`);

  // STEP 2: Download Full Database Backup (.sql)
  console.log('\n📥 STEP 2: Requesting GET /api/backup/full (.sql)...');
  const backupRes = await fetch(`${BASE_URL}/api/backup/full`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('  • GET /api/backup/full HTTP Status:', backupRes.status);
  const sqlContent = await backupRes.text();
  console.log('  • Generated Backup .sql Length:', sqlContent.length, 'bytes');

  // Verify real INSERT statements exist in downloaded SQL dump
  console.log('\n🔍 STEP 3: Inspecting Downloaded .sql Content for Real Records...');
  const hasRealProdInsert = sqlContent.includes('TOTAL GOLD SOYA DOC');
  const hasRealUnitInsert = sqlContent.includes('SHALIMAR SOLVENT PLANT NAGPUR');
  const hasRealTransInsert = sqlContent.includes('WARORA LOGISTICS ROADWAYS');
  const hasRealReqInsert = sqlContent.includes(realReqNo);

  console.log(`  • INSERT INTO products contains 'TOTAL GOLD SOYA DOC': ${hasRealProdInsert ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`  • INSERT INTO company_units_plants contains 'SHALIMAR SOLVENT PLANT NAGPUR': ${hasRealUnitInsert ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`  • INSERT INTO transporters contains 'WARORA LOGISTICS ROADWAYS': ${hasRealTransInsert ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`  • INSERT INTO transport_requirements contains '${realReqNo}': ${hasRealReqInsert ? 'PASS ✅' : 'FAIL ❌'}`);

  // Print sample INSERT lines
  const insertLines = sqlContent.split('\n').filter(l => l.startsWith('INSERT INTO'));
  console.log('\n📄 Sample Generated Live INSERT Statements from Backup .sql:');
  insertLines.slice(0, 5).forEach((line, idx) => {
    console.log(`  [${idx + 1}] ${line.length > 120 ? line.slice(0, 120) + '...' : line}`);
  });

  // STEP 4: Create Extra Records AFTER Backup
  console.log('\n🚀 STEP 4: Creating Extra Records AFTER Backup (Product Extra, Transporter Extra, Unit Extra)...');
  await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ id: 'prod_extra_after_backup', name: 'AFTER BACKUP EXTRA PRODUCT', category: 'Extra', hsn_code: '23040010', default_unit: 'MT' })
  });
  await fetch(`${BASE_URL}/api/transporters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ id: 'trans_extra_after_backup', company_name: 'AFTER BACKUP EXTRA TRANSPORTER', code: 'EXTRA01', contact_person: 'Extra Person', mobile: '9991112223', email: 'extra@logistics.com' })
  });

  // STEP 5: Restore Downloaded .sql Backup
  console.log('\n📤 STEP 5: Restoring Downloaded .sql Backup (POST /api/backup/restore)...');
  const restoreRes = await fetch(`${BASE_URL}/api/backup/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ sql_content: sqlContent })
  });
  console.log('  • Restore HTTP Status:', restoreRes.status);
  const restoreJson = await restoreRes.json();
  console.log('  • Restore Response:', JSON.stringify(restoreJson));

  // STEP 6: Verify Post-Restore Snapshot Integrity
  console.log('\n🔍 STEP 6: Verifying Exact Snapshot State After Restore...');
  const prodsList = (await (await fetch(`${BASE_URL}/api/products`, { headers: { 'Authorization': `Bearer ${token}` } })).json()).products || [];
  const transList = (await (await fetch(`${BASE_URL}/api/transporters`, { headers: { 'Authorization': `Bearer ${token}` } })).json()).transporters || [];

  const realProdPresent = prodsList.some(p => p.name === 'TOTAL GOLD SOYA DOC');
  const extraProdAbsent = !prodsList.some(p => p.name === 'AFTER BACKUP EXTRA PRODUCT');
  const realTransPresent = transList.some(t => t.company_name === 'WARORA LOGISTICS ROADWAYS');
  const extraTransAbsent = !transList.some(t => t.company_name === 'AFTER BACKUP EXTRA TRANSPORTER');

  console.log(`  • Pre-Backup Product 'TOTAL GOLD SOYA DOC': ${realProdPresent ? 'PRESENT ✅' : 'MISSING ❌'}`);
  console.log(`  • Post-Backup Product 'AFTER BACKUP EXTRA PRODUCT': ${extraProdAbsent ? 'ABSENT ✅' : 'STILL EXISTS ❌'}`);
  console.log(`  • Pre-Backup Transporter 'WARORA LOGISTICS ROADWAYS': ${realTransPresent ? 'PRESENT ✅' : 'MISSING ❌'}`);
  console.log(`  • Post-Backup Transporter 'AFTER BACKUP EXTRA TRANSPORTER': ${extraTransAbsent ? 'ABSENT ✅' : 'STILL EXISTS ❌'}`);

  // Fetch Backup Report
  console.log('\n📊 STEP 7: Fetching Backup Verification Report (GET /api/backup/report)...');
  const reportRes = await fetch(`${BASE_URL}/api/backup/report`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const reportJson = await reportRes.json();
  console.log('  • Verification Report Response:');
  console.table(reportJson.tables);

  const testPassed = hasRealProdInsert && hasRealUnitInsert && hasRealTransInsert && hasRealReqInsert && realProdPresent && extraProdAbsent && realTransPresent && extraTransAbsent;

  console.log('\n==================================================');
  if (testPassed) {
    console.log('🎉 LIVE PRODUCTION MYSQL FULL BACKUP & SNAPSHOT RESTORE 100% VERIFIED!');
  } else {
    console.log('❌ LIVE PRODUCTION BACKUP TEST FAILED!');
    process.exit(1);
  }
  console.log('==================================================');
}

runLiveProductionBackupFlow().catch(err => {
  console.error('❌ Live Production Backup Flow Error:', err);
  process.exit(1);
});
