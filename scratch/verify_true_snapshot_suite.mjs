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

  // STEP 1: Create Known Backup State Records
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
  await fetch(`${BASE_URL}/api/company-units`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ id: 'unit_snap_a', name: 'COMPANY UNIT SNAP A', code: 'UNITSAPA', city: 'Nagpur', state: 'Maharashtra' })
  });

  // Requirement Parent A with Child A1 & Child A2
  await fetch(`${BASE_URL}/api/rate-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      id: 'req_snap_parent_a',
      request_no: 'REQ-SNAP-001',
      batch_code: 'BATCH-SNAP-001',
      title: 'Requirement Parent A',
      pickup_origin: 'Nagpur',
      drop_location: 'Mumbai',
      target_date: '2026-09-01',
      status: 'Published',
      items: [
        { id: 'item_snap_a1', product_name: 'SNAPSHOT PROD A', quantity_mt: 100, unit: 'MT' },
        { id: 'item_snap_a2', product_name: 'SNAPSHOT PROD B', quantity_mt: 220, unit: 'MT' }
      ]
    })
  });

  console.log('  • Initial Known State Records Successfully Created.');

  // STEP 2: Capture Snapshot Backup
  console.log('\n📥 STEP 2: Requesting GET /api/backup/full (.sql)...');
  const backupRes = await fetch(`${BASE_URL}/api/backup/full`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('  • HTTP Status:', backupRes.status);
  const sqlDumpText = await backupRes.text();
  console.log('  • Backup .sql Length:', sqlDumpText.length, 'bytes');

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
  await fetch(`${BASE_URL}/api/company-units`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ id: 'unit_snap_b', name: 'COMPANY UNIT SNAP B', code: 'UNITSAPB', city: 'Pune', state: 'Maharashtra' })
  });

  // Requirement Parent B with Child B1
  await fetch(`${BASE_URL}/api/rate-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      id: 'req_snap_parent_b',
      request_no: 'REQ-SNAP-002',
      batch_code: 'BATCH-SNAP-002',
      title: 'Requirement Parent B',
      pickup_origin: 'Pune',
      drop_location: 'Thane',
      target_date: '2026-09-05',
      status: 'Published',
      items: [
        { id: 'item_snap_b1', product_name: 'SNAPSHOT PROD C', quantity_mt: 150, unit: 'MT' }
      ]
    })
  });

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

  // STEP 5: Verify Exact Snapshot State
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
  const units = unitsJson.units || unitsJson.company_units_plants || [];
  const hasUnitA = units.some(u => u.id === 'unit_snap_a');
  const hasUnitB = units.some(u => u.id === 'unit_snap_b');

  console.log(`  • Company Unit A (Initial): ${hasUnitA ? 'EXISTS ✅' : 'MISSING ❌'}`);
  console.log(`  • Company Unit B (Extra): ${!hasUnitB ? 'DOES NOT EXIST ✅' : 'EXISTS ❌'}`);

  // Requirements Verification
  const reqsRes = await fetch(`${BASE_URL}/api/rate-requests`, { headers: { 'Authorization': `Bearer ${token}` } });
  const reqsJson = await reqsRes.json();
  const reqs = reqsJson.requests || reqsJson.rate_requests || [];
  const hasReqA = reqs.some(r => r.id === 'req_snap_parent_a');
  const hasReqB = reqs.some(r => r.id === 'req_snap_parent_b');

  console.log(`  • Requirement Parent A (Initial): ${hasReqA ? 'EXISTS ✅' : 'MISSING ❌'}`);
  console.log(`  • Requirement Parent B (Extra): ${!hasReqB ? 'DOES NOT EXIST ✅' : 'EXISTS ❌'}`);

  // CLEANUP Initial Test Records
  console.log('\n🧹 STEP 6: Cleaning up Initial Test Records from MySQL...');
  await fetch(`${BASE_URL}/api/products/prod_snap_a`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }).catch(()=>{});
  await fetch(`${BASE_URL}/api/products/prod_snap_b`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }).catch(()=>{});
  await fetch(`${BASE_URL}/api/transporters/trans_snap_a`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }).catch(()=>{});
  await fetch(`${BASE_URL}/api/company-units/unit_snap_a`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }).catch(()=>{});
  await fetch(`${BASE_URL}/api/rate-requests/req_snap_parent_a`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }).catch(()=>{});

  const snapshotSuccess = hasProdA && hasProdB && !hasProdC && !hasProdD && hasTransA && !hasTransB && hasUnitA && !hasUnitB && hasReqA && !hasReqB;

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
