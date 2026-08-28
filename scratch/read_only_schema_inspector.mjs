// scratch/read_only_schema_inspector.mjs
// Inspect existing database tables and schema in Hostinger Production MySQL

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function inspectTables() {
  console.log('==================================================');
  console.log('🔍 READ-ONLY DATABASE TABLE SCHEMA AUDIT');
  console.log('==================================================');

  // Admin login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;

  // Query company-units
  const unitsRes = await fetch(`${BASE_URL}/api/company-units`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('GET /api/company-units status:', unitsRes.status);
  if (unitsRes.ok) {
    const data = await unitsRes.json();
    console.log('GET /api/company-units data:', data);
  }
}

inspectTables();
