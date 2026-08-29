// scratch/audit_quote_duplicates.mjs
// Read-Only Audit to Investigate Duplicate / Old Quotes in MySQL & API

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function runQuoteAudit() {
  console.log('==================================================');
  console.log('🔍 READ-ONLY AUDIT: DUPLICATE QUOTES & INDEX INSPECTION');
  console.log('==================================================');

  // Authenticate Admin
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;

  // Query Audit Endpoint
  const res = await fetch(`${BASE_URL}/api/audit-quote-details`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  console.log(`HTTP STATUS: ${res.status}`);
  const text = await res.text();
  console.log('RAW RESPONSE:');
  console.log(text.substring(0, 500));

  if (res.ok) {
    const data = JSON.parse(text);
    console.log('\n--- ALL SUBMISSIONS IN MYSQL ---');
    console.log(JSON.stringify(data.all_submissions, null, 2));

    console.log('\n--- DUPLICATES (COUNT > 1 FOR req_id + item_id + trans_id) ---');
    console.log(JSON.stringify(data.duplicates, null, 2));

    console.log('\n--- INDEXES ON rate_submissions ---');
    console.log(JSON.stringify(data.indexes, null, 2));
  }
}

runQuoteAudit().catch(err => console.error('Audit Script Error:', err));
