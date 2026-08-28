// scratch/debug_p001_db.mjs
const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function checkP001() {
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  console.log('--- ADMIN RESET FOR P001 ---');
  const resetRes = await fetch(`${BASE_URL}/api/transporters/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ id: 'P001' })
  });
  const resetData = await resetRes.json();
  console.log('Reset Data:', resetData);
}

checkP001();
