// scratch/test_status_endpoint_debug.mjs
const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function testDebug() {
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  console.log('Login Token:', token ? 'OK' : 'FAIL');

  const res = await fetch(`${BASE_URL}/api/transporters/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ id: 'trans_1787907390130' })
  });

  console.log('Reset Password HTTP Status:', res.status);
  const text = await res.text();
  console.log('Reset Password Raw Response:', text);
}

testDebug();
