// scratch/inspect_all_transporters.mjs
const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function inspect() {
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;

  const res = await fetch(`${BASE_URL}/api/transporters`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const json = await res.json();
  console.log('Current Transporters in MySQL:', JSON.stringify(json.transporters || json.data, null, 2));
}

inspect();
