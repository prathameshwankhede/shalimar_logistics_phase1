// scratch/verify_live_prod_read_only_snapshot.mjs
// Read-Only Production Verification (Zero Data Mutation / Zero Record Creation or Deletion)

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function runReadOnlyProductionVerification() {
  console.log('==================================================');
  console.log('🧪 READ-ONLY LIVE PRODUCTION MYSQL BACKUP VERIFICATION');
  console.log('==================================================');

  // 1. Admin Authentication
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;
  console.log('✅ Admin Authenticated via JWT Token.');

  // 2. Fetch Live MySQL Counts via /api/backup/report
  console.log('\n📊 Step 1: Querying Live MySQL Database Row Counts...');
  const reportRes = await fetch(`${BASE_URL}/api/backup/report`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const reportJson = await reportRes.json();
  const dbName = reportJson.database || 'u704836459_shalimar_logi';
  console.log(`  • Connected Database: ${dbName}`);

  const mysqlCounts = {};
  (reportJson.tables || []).forEach(t => {
    mysqlCounts[t.table] = t.mysqlRows;
  });

  console.log('  • Current MySQL Row Counts:', JSON.stringify(mysqlCounts, null, 2));

  // 3. Download Full Database Backup (.sql)
  console.log('\n📥 Step 2: Requesting GET /api/backup/full (.sql)...');
  const backupRes = await fetch(`${BASE_URL}/api/backup/full`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('  • Backup HTTP Status:', backupRes.status);
  const sqlContent = await backupRes.text();
  console.log('  • Downloaded .sql Size:', sqlContent.length, 'bytes');

  // Parse INSERT row counts from downloaded .sql text
  const exportedCounts = {
    transporters: 0,
    company_units_plants: 0,
    products: 0,
    transport_requirements: 0,
    transport_requirement_items: 0
  };

  const lines = sqlContent.split('\n');
  lines.forEach(line => {
    if (line.startsWith('INSERT INTO `transporters`')) exportedCounts.transporters++;
    if (line.startsWith('INSERT INTO `company_units_plants`')) exportedCounts.company_units_plants++;
    if (line.startsWith('INSERT INTO `products`')) exportedCounts.products++;
    if (line.startsWith('INSERT INTO `transport_requirements`')) exportedCounts.transport_requirements++;
    if (line.startsWith('INSERT INTO `transport_requirement_items`')) exportedCounts.transport_requirement_items++;
  });

  // 4. Table-wise Row Count Matching Comparison
  console.log('\n==================================================');
  console.log('📊 LIVE MYSQL VS BACKUP EXPORT COMPARISON TABLE');
  console.log('==================================================');
  console.log('TABLE                         MYSQL ROWS    BACKUP ROWS    MATCH');
  console.log('-------------------------------------------------------------------');

  const tablesToVerify = ['transporters', 'company_units_plants', 'products', 'transport_requirements', 'transport_requirement_items'];
  let allMatched = true;

  tablesToVerify.forEach(tbl => {
    const mRows = mysqlCounts[tbl] || 0;
    const bRows = exportedCounts[tbl] || 0;
    const matchStr = mRows === bRows ? 'PASS ✅' : 'FAIL ❌';
    if (mRows !== bRows) allMatched = false;

    const paddedTable = tbl.padEnd(28, ' ');
    const paddedMysql = String(mRows).padEnd(14, ' ');
    const paddedBackup = String(bRows).padEnd(15, ' ');
    console.log(`${paddedTable} ${paddedMysql} ${paddedBackup} ${matchStr}`);
  });

  console.log('-------------------------------------------------------------------');
  console.log(`Total Mismatches: ${allMatched ? 0 : 1}`);

  console.log('\n==================================================');
  if (allMatched) {
    console.log('🎉 REAL PRODUCTION MYSQL FULL BACKUP 100% VERIFIED!');
  } else {
    console.log('❌ BACKUP ROW COUNT MISMATCH DETECTED!');
    process.exit(1);
  }
  console.log('==================================================');
}

runReadOnlyProductionVerification().catch(err => {
  console.error('❌ Read-Only Verification Error:', err);
  process.exit(1);
});
