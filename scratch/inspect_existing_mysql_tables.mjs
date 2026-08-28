// scratch/inspect_existing_mysql_tables.mjs
// Inspects existing MySQL tables in u704836459_shalimar_logi database via Hostinger server

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function inspectTables() {
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;

  console.log('--- GET /api/state ---');
  const stateRes = await fetch(`${BASE_URL}/api/state`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const stateData = await stateRes.json();
  const db = stateData.data || {};
  console.log('Rate Requests count in state:', (db.rate_requests || []).length);
  if (db.rate_requests && db.rate_requests.length > 0) {
    console.log('Sample Rate Request:', JSON.stringify(db.rate_requests[0], null, 2));
  }
}

inspectTables();
