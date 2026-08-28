// scratch/inspect_live_state_masters.mjs
// Inspects live production state and company-units endpoints

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function inspectLiveState() {
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;

  console.log('--- GET /api/company-units ---');
  const cuRes = await fetch(`${BASE_URL}/api/company-units`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const cuData = await cuRes.json();
  console.log('Company Units Count:', cuData.count);
  console.log('Company Units Data:', JSON.stringify(cuData.data, null, 2));

  console.log('\n--- GET /api/state ---');
  const stateRes = await fetch(`${BASE_URL}/api/state`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const stateData = await stateRes.json();
  const db = stateData.data || {};
  console.log('City Masters:', JSON.stringify(db.city_masters, null, 2));
  console.log('Company Masters:', JSON.stringify(db.company_masters, null, 2));
  console.log('Title Masters:', JSON.stringify(db.title_masters, null, 2));
}

inspectLiveState();
