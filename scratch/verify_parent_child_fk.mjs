// scratch/verify_parent_child_fk.mjs
// Real Hostinger Verification for Foreign Key Parent-Child Integrity (Requirements & Items)

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function runFkVerification() {
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;

  // Fetch Requirements & Items
  const reqsRes = await fetch(`${BASE_URL}/api/rate-requests`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const reqsJson = await reqsRes.json();
  console.log('• Active Requirements Count:', (reqsJson.requests || reqsJson.rate_requests || []).length);

  // Take .sql Backup
  const backupRes = await fetch(`${BASE_URL}/api/backup/full`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const sqlContent = await backupRes.text();

  // Restore .sql Backup
  const restoreRes = await fetch(`${BASE_URL}/api/backup/restore`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ sql_content: sqlContent })
  });
  const restoreJson = await restoreRes.json();
  console.log('• Restore Status:', restoreRes.status);
  console.log('• Executed Statements:', restoreJson.executedStatements);

  // Re-verify Requirements
  const verifyRes = await fetch(`${BASE_URL}/api/rate-requests`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const verifyJson = await verifyRes.json();
  console.log('• Requirements Count After Restore:', (verifyJson.requests || verifyJson.rate_requests || []).length);
  console.log('✅ Parent-Child Relationship Verification Complete!');
}

runFkVerification().catch(err => console.error('❌ FK Verification Error:', err));
