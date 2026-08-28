// scratch/audit_orphan_data.mjs
// Read-Only Orphan Data Audit for MySQL rate_submissions & Foreign Key Inspection

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function auditOrphanData() {
  console.log('==================================================');
  console.log('🔍 READ-ONLY MYSQL ORPHAN DATA & SCHEMA AUDIT');
  console.log('==================================================');

  // Authenticate Admin Token
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;

  // Execute Audit Query via API Diagnostic
  const auditRes = await fetch(`${BASE_URL}/api/audit-orphan-data`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!auditRes.ok) {
    console.error(`Audit API Endpoint HTTP ${auditRes.status}`);
    const text = await auditRes.text();
    console.error(text);
    return;
  }

  const auditData = await auditRes.json();
  console.log(JSON.stringify(auditData, null, 2));
}

auditOrphanData().catch(err => {
  console.error('Audit Script Error:', err);
});
