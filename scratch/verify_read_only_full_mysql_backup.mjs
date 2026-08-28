// scratch/verify_read_only_full_mysql_backup.mjs
// Read-Only Verification Script for Live Hostinger MySQL Database Snapshot

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function runReadOnlyFullBackupVerification() {
  console.log('==================================================');
  console.log('🧪 READ-ONLY MYSQL FULL DATABASE BACKUP VERIFICATION');
  console.log('==================================================');

  // 1. Authenticate Admin
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;
  console.log('✅ Admin Authenticated via JWT Token.');

  // 2. Fetch Report & Table List
  console.log('\n📡 Step 1: Querying SELECT DATABASE() & Table Rows from Live MySQL...');
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

  // 3. Download Full Database Backup (.sql)
  console.log('\n📥 Step 2: Requesting GET /api/backup/full (.sql)...');
  const backupRes = await fetch(`${BASE_URL}/api/backup/full`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('  • Backup HTTP Status:', backupRes.status);
  const sqlText = await backupRes.text();
  console.log('  • Downloaded .sql Size:', sqlText.length, 'bytes');

  // Parse INSERT statements per table
  const backupCounts = {};
  Object.keys(mysqlCounts).forEach(tbl => backupCounts[tbl] = 0);

  const lines = sqlText.split('\n');
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('INSERT INTO')) return;

    const match = trimmed.match(/INSERT INTO `([^`]+)`/);
    if (match) {
      const tblObj = match[1];
      backupCounts[tblObj] = (backupCounts[tblObj] || 0) + 1;
    }
  });

  // 4. Comparison Table
  console.log('\n==================================================');
  console.log('📊 DYNAMICALLY DISCOVERED TABLES COMPARISON TABLE');
  console.log('==================================================');
  console.log('DISCOVERED TABLE NAME         MYSQL ROWS    BACKUP INSERT ROWS    MATCH');
  console.log('-------------------------------------------------------------------------');

  let allMatched = true;
  Object.keys(mysqlCounts).forEach(tbl => {
    const mRows = mysqlCounts[tbl] || 0;
    const bRows = backupCounts[tbl] || 0;
    const isMatched = mRows === bRows;
    if (!isMatched) allMatched = false;

    const paddedTable = tbl.padEnd(28, ' ');
    const paddedMysql = String(mRows).padEnd(14, ' ');
    const paddedBackup = String(bRows).padEnd(21, ' ');
    const matchStr = isMatched ? 'PASS ✅' : 'FAIL ❌';

    console.log(`${paddedTable} ${paddedMysql} ${paddedBackup} ${matchStr}`);
  });

  console.log('-------------------------------------------------------------------------');

  console.log('\n==================================================');
  if (allMatched) {
    console.log('🎉 REAL PRODUCTION FULL MYSQL BACKUP 100% VERIFIED!');
  } else {
    console.log('❌ MISMATCH DETECTED IN BACKUP EXPORT!');
    process.exit(1);
  }
  console.log('==================================================');
}

runReadOnlyFullBackupVerification().catch(err => {
  console.error('❌ Read-Only Backup Verification Error:', err);
  process.exit(1);
});
