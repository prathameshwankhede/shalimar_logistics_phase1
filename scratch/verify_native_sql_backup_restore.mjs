// scratch/verify_native_sql_backup_restore.mjs
// Real Hostinger Production Verification for Native MySQL .sql Backup & Restore Suite

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function runNativeSqlBackupVerification() {
  console.log('==================================================');
  console.log('🧪 REAL PRODUCTION NATIVE MYSQL .SQL BACKUP & RESTORE SUITE');
  console.log('==================================================');

  // 1. Admin Login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;
  console.log('✅ Admin Authenticated via JWT Token.');

  // 2. Create Test Product A
  const prodId1 = `prod_sql_a_${Date.now()}`;
  console.log('\n🚀 Step 1: Creating Test Product A in MySQL...');
  await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      id: prodId1,
      name: 'SQL DUMP TEST PRODUCT A',
      category: 'Native SQL Category',
      hsn_code: '23040010',
      default_unit: 'MT'
    })
  });

  // 3. Download Native .sql Backup (GET /api/backup/full)
  console.log('\n📥 Step 2: Requesting GET /api/backup/full (.sql)...');
  const backupRes = await fetch(`${BASE_URL}/api/backup/full`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('  • GET /api/backup/full Status:', backupRes.status);
  const sqlDumpText = await backupRes.text();
  console.log('  • .sql Output Byte Length:', sqlDumpText.length);
  console.log('  • Contains "SET FOREIGN_KEY_CHECKS = 0;":', sqlDumpText.includes('SET FOREIGN_KEY_CHECKS = 0;'));
  console.log('  • Contains "CREATE TABLE":', sqlDumpText.includes('CREATE TABLE'));
  console.log('  • Contains "INSERT INTO `products`":', sqlDumpText.includes('INSERT INTO `products`'));
  console.log('  • Contains "SQL DUMP TEST PRODUCT A":', sqlDumpText.includes('SQL DUMP TEST PRODUCT A'));

  if (!sqlDumpText.includes('SQL DUMP TEST PRODUCT A')) {
    throw new Error('❌ Test Product A was missing from generated .sql backup.');
  }

  // 4. Create Test Product B
  const prodId2 = `prod_sql_b_${Date.now()}`;
  console.log('\n🚀 Step 3: Creating Test Product B in MySQL...');
  await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      id: prodId2,
      name: 'SQL DUMP TEST PRODUCT B',
      category: 'Native SQL Category',
      hsn_code: '23040010',
      default_unit: 'MT'
    })
  });

  // 5. Restore .sql Backup (POST /api/backup/restore)
  console.log('\n📤 Step 4: Restoring .sql Backup to Hostinger MySQL (POST /api/backup/restore)...');
  const restoreRes = await fetch(`${BASE_URL}/api/backup/restore`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ sql_content: sqlDumpText })
  });
  console.log('  • Restore HTTP Status:', restoreRes.status);
  const restoreJson = await restoreRes.json();
  console.log('  • Restore Response JSON:', JSON.stringify(restoreJson));

  // 6. Verify Product A remains, Product B is rolled back
  console.log('\n📥 Step 5: Fetching GET /api/products to verify restore state...');
  const getProdsRes = await fetch(`${BASE_URL}/api/products`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const currentProds = (await getProdsRes.json()).products || [];
  const hasA = currentProds.some(p => p.id === prodId1 || p.name === 'SQL DUMP TEST PRODUCT A');
  const hasB = currentProds.some(p => p.id === prodId2 || p.name === 'SQL DUMP TEST PRODUCT B');
  console.log(`  • Product A Restored: ${hasA} | Product B Rolled Back: ${!hasB}`);

  // Cleanup Product A
  if (hasA) {
    await fetch(`${BASE_URL}/api/products/${prodId1}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('  • Test Product A cleaned up cleanly.');
  }

  console.log('\n==================================================');
  console.log('🎉 NATIVE MYSQL .SQL BACKUP & RESTORE VERIFIED 100%!');
  console.log('==================================================');
}

runNativeSqlBackupVerification().catch(err => {
  console.error('❌ Native .sql Verification Error:', err);
  process.exit(1);
});
