// scratch/verify_true_snapshot_suite.mjs
// Real Production Verification Suite for TRUE FULL DATABASE SNAPSHOT RESTORE

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function runTrueSnapshotVerification() {
  console.log('==================================================');
  console.log('🧪 REAL PRODUCTION TRUE SNAPSHOT RESTORE VERIFICATION');
  console.log('==================================================');

  // 1. Admin Login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;
  console.log('✅ Admin Authenticated via JWT.');

  // STEP 1: Create Known Initial State Records in MySQL
  console.log('\n🚀 STEP 1: Creating Known Initial State Records in MySQL...');
  
  // Product A & B
  await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ id: 'prod_snap_a', name: 'SNAPSHOT PROD A', category: 'Testing', hsn_code: '23040010', default_unit: 'MT' })
  });
  await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ id: 'prod_snap_b', name: 'SNAPSHOT PROD B', category: 'Testing', hsn_code: '23040010', default_unit: 'MT' })
  });

  // Transporter A
  await fetch(`${BASE_URL}/api/transporters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ id: 'trans_snap_a', company_name: 'TRANSPORTER SNAP A', code: 'TRSNAPA', contact_person: 'Alex', mobile: '9998887771', email: 'snapA@test.com' })
  });

  // Company Unit A
  const unitARes = await fetch(`${BASE_URL}/api/company-units`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      company_name: 'COMPANY UNIT SNAP A',
      name: 'COMPANY UNIT SNAP A',
      registered_address: '123 Industrial Park',
      contact_name: 'John Doe',
      mobile: '9876543210',
      state: 'Maharashtra',
      city: 'Nagpur',
      district: 'Nagpur',
      pin_code: '440001'
    })
  });
  const unitAJson = await unitARes.json();
  const unitAId = unitAJson.data?.id || unitAJson.unit?.id;

  // Requirement Parent A with Child A1 & Child A2
  const reqARes = await fetch(`${BASE_URL}/api/rate-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      pickup_origin: 'Nagpur',
      drop_location: 'Mumbai',
      target_date: '2026-09-01',
      items: [
        { product_name: 'SNAPSHOT PROD A', quantity_mt: 100, unit: 'MT', pickup_origin: 'Nagpur', drop_location: 'Mumbai' },
        { product_name: 'SNAPSHOT PROD B', quantity_mt: 220, unit: 'MT', pickup_origin: 'Nagpur', drop_location: 'Mumbai' }
      ]
    })
  });
  const reqAJson = await reqARes.json();
  const reqAId = reqAJson.data?.id || reqAJson.requirement?.id;
  const reqANo = reqAJson.data?.req_no || reqAJson.requirement?.req_no;

  console.log('  • Initial Known State Records Successfully Created.');
  console.log(`  • Requirement A Created (Req No: ${reqANo}, ID: ${reqAId})`);

  // STEP 2: Capture Snapshot Backup & Measure Before Row Counts
  console.log('\n📥 STEP 2: Requesting GET /api/backup/full (.sql)...');
  const backupRes = await fetch(`${BASE_URL}/api/backup/full`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('  • Backup HTTP Status:', backupRes.status);
  const sqlDumpText = await backupRes.text();
  console.log('  • Backup .sql Length:', sqlDumpText.length, 'bytes');

  // Fetch Table Counts BEFORE restore
  const prodsBefore = ((await (await fetch(`${BASE_URL}/api/products`, { headers: { 'Authorization': `Bearer ${token}` } })).json()).products || []).length;
  const transBefore = ((await (await fetch(`${BASE_URL}/api/transporters`, { headers: { 'Authorization': `Bearer ${token}` } })).json()).transporters || []).length;
  const reqsJsonBefore = await (await fetch(`${BASE_URL}/api/rate-requests`, { headers: { 'Authorization': `Bearer ${token}` } })).json();
  const reqsBefore = (reqsJsonBefore.rate_requests || reqsJsonBefore.requests || []).length;

  console.log('  • Backup .sql Header Lines:\n', sqlDumpText.split('\n').slice(0, 25).join('\n'));

  // STEP 3: Create Extra Post-Backup Records
  console.log('\n🚀 STEP 3: Creating Post-Backup Extra Records in MySQL (Products C & D, Requirement B, Transporter B, Unit B)...');
  
  // Product C & D
  await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ id: 'prod_snap_c', name: 'SNAPSHOT PROD C', category: 'Extra', hsn_code: '23040010', default_unit: 'MT' })
  });
  await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ id: 'prod_snap_d', name: 'SNAPSHOT PROD D', category: 'Extra', hsn_code: '23040010', default_unit: 'MT' })
  });

  // Transporter B
  await fetch(`${BASE_URL}/api/transporters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ id: 'trans_snap_b', company_name: 'TRANSPORTER SNAP B', code: 'TRSNAPB', contact_person: 'Bob', mobile: '9998887772', email: 'snapB@test.com' })
  });

  // Company Unit B
  const unitBRes = await fetch(`${BASE_URL}/api/company-units`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      company_name: 'COMPANY UNIT SNAP B',
      name: 'COMPANY UNIT SNAP B',
      registered_address: '456 Tech Park',
      contact_name: 'Jane Smith',
      mobile: '9876543211',
      state: 'Maharashtra',
      city: 'Pune',
      district: 'Pune',
      pin_code: '411001'
    })
  });
  const unitBJson = await unitBRes.json();
  const unitBId = unitBJson.data?.id || unitBJson.unit?.id;

  // Requirement Parent B with Child B1
  const reqBRes = await fetch(`${BASE_URL}/api/rate-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      pickup_origin: 'Pune',
      drop_location: 'Thane',
      target_date: '2026-09-05',
      items: [
        { product_name: 'SNAPSHOT PROD C', quantity_mt: 150, unit: 'MT', pickup_origin: 'Pune', drop_location: 'Thane' }
      ]
    })
  });
  const reqBJson = await reqBRes.json();
  const reqBId = reqBJson.data?.id || reqBJson.requirement?.id;

  console.log('  • Post-Backup Extra Records Successfully Created.');

  // STEP 4: Restore Backup .sql Snapshot
  console.log('\n📤 STEP 4: Restoring .sql Backup to Hostinger MySQL (POST /api/backup/restore)...');
  const restoreRes = await fetch(`${BASE_URL}/api/backup/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ sql_content: sqlDumpText })
  });
  console.log('  • Restore HTTP Status:', restoreRes.status);
  const restoreJson = await restoreRes.json();
  console.log('  • Restore Response:', JSON.stringify(restoreJson));

  // STEP 5: Verify Exact Snapshot State & Row Counts
  console.log('\n🔍 STEP 5: Verifying Database Returned EXACTLY to Backup Snapshot State...');

  // Products Verification
  const prodsRes = await fetch(`${BASE_URL}/api/products`, { headers: { 'Authorization': `Bearer ${token}` } });
  const prods = (await prodsRes.json()).products || [];
  const hasProdA = prods.some(p => p.id === 'prod_snap_a');
  const hasProdB = prods.some(p => p.id === 'prod_snap_b');
  const hasProdC = prods.some(p => p.id === 'prod_snap_c');
  const hasProdD = prods.some(p => p.id === 'prod_snap_d');

  console.log(`  • Product A (Initial): ${hasProdA ? 'EXISTS ✅' : 'MISSING ❌'}`);
  console.log(`  • Product B (Initial): ${hasProdB ? 'EXISTS ✅' : 'MISSING ❌'}`);
  console.log(`  • Product C (Extra): ${!hasProdC ? 'DOES NOT EXIST ✅' : 'EXISTS ❌'}`);
  console.log(`  • Product D (Extra): ${!hasProdD ? 'DOES NOT EXIST ✅' : 'EXISTS ❌'}`);

  // Transporters Verification
  const transRes = await fetch(`${BASE_URL}/api/transporters`, { headers: { 'Authorization': `Bearer ${token}` } });
  const trans = (await transRes.json()).transporters || [];
  const hasTransA = trans.some(t => t.id === 'trans_snap_a');
  const hasTransB = trans.some(t => t.id === 'trans_snap_b');

  console.log(`  • Transporter A (Initial): ${hasTransA ? 'EXISTS ✅' : 'MISSING ❌'}`);
  console.log(`  • Transporter B (Extra): ${!hasTransB ? 'DOES NOT EXIST ✅' : 'EXISTS ❌'}`);

  // Company Units Verification
  const unitsRes = await fetch(`${BASE_URL}/api/company-units`, { headers: { 'Authorization': `Bearer ${token}` } });
  const unitsJson = await unitsRes.json();
  const units = unitsJson.units || unitsJson.company_units_plants || unitsJson.data || [];
  const hasUnitA = units.some(u => u.id === unitAId || u.name === 'COMPANY UNIT SNAP A' || u.company_name === 'COMPANY UNIT SNAP A');
  const hasUnitB = units.some(u => u.id === unitBId || u.name === 'COMPANY UNIT SNAP B' || u.company_name === 'COMPANY UNIT SNAP B');

  console.log(`  • Company Unit A (Initial): ${hasUnitA ? 'EXISTS ✅' : 'MISSING ❌'}`);
  console.log(`  • Company Unit B (Extra): ${!hasUnitB ? 'DOES NOT EXIST ✅' : 'EXISTS ❌'}`);

  // Requirements Verification
  const reqsRes = await fetch(`${BASE_URL}/api/rate-requests`, { headers: { 'Authorization': `Bearer ${token}` } });
  const reqsJson = await reqsRes.json();
  const reqs = reqsJson.requests || reqsJson.rate_requests || [];
  const restoredReqA = reqs.find(r => r.id === reqAId || r.req_no === reqANo);
  const hasReqB = reqs.some(r => r.id === reqBId);

  console.log(`  • Requirement Parent A (Initial): ${restoredReqA ? 'EXISTS ✅' : 'MISSING ❌'}`);
  console.log(`  • Requirement Parent B (Extra): ${!hasReqB ? 'DOES NOT EXIST ✅' : 'EXISTS ❌'}`);

  if (restoredReqA) {
    const childCountA = (restoredReqA.items || restoredReqA.cargo_items || []).length;
    console.log(`  • Requirement A Child Items Count: ${childCountA} (Expected: 2) ${childCountA === 2 ? '✅' : '❌'}`);
  }

  // Row Count Verification Table
  const prodsAfter = prods.length;
  const transAfter = trans.length;
  const reqsAfter = reqs.length;

  console.log('\n==================================================');
  console.log('📊 ROW COUNT VERIFICATION RESULTS TABLE');
  console.log('==================================================');
  console.log('TABLE                   BEFORE BACKUP   AFTER RESTORE   MATCH');
  console.log('---------------------------------------------------');
  console.log(`products                ${prodsBefore}               ${prodsAfter}               ${prodsBefore === prodsAfter ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`transporters            ${transBefore}               ${transAfter}               ${transBefore === transAfter ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`transport_requirements  ${reqsBefore}               ${reqsAfter}               ${reqsBefore === reqsAfter ? 'PASS ✅' : 'FAIL ❌'}`);

  // CLEANUP Initial Test Records
  console.log('\n🧹 STEP 6: Cleaning up Initial Test Records from MySQL...');
  await fetch(`${BASE_URL}/api/products/prod_snap_a`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }).catch(()=>{});
  await fetch(`${BASE_URL}/api/products/prod_snap_b`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }).catch(()=>{});
  await fetch(`${BASE_URL}/api/transporters/trans_snap_a`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }).catch(()=>{});
  if (unitAId) await fetch(`${BASE_URL}/api/company-units/${unitAId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }).catch(()=>{});
  if (reqAId) await fetch(`${BASE_URL}/api/rate-requests/${reqAId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }).catch(()=>{});

  const snapshotSuccess = hasProdA && hasProdB && !hasProdC && !hasProdD && hasTransA && !hasTransB && hasUnitA && !hasUnitB && Boolean(restoredReqA) && !hasReqB && (prodsBefore === prodsAfter) && (transBefore === transAfter) && (reqsBefore === reqsAfter);

  console.log('\n==================================================');
  if (snapshotSuccess) {
    console.log('🎉 TRUE FULL DATABASE SNAPSHOT RESTORE 100% VERIFIED!');
  } else {
    console.log('❌ SNAPSHOT RESTORE VERIFICATION FAILED!');
    process.exit(1);
  }
  console.log('==================================================');
}

runTrueSnapshotVerification().catch(err => {
  console.error('❌ True Snapshot Verification Error:', err);
  process.exit(1);
});
