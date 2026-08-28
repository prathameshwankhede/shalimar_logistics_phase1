// scratch/debug_requirements_endpoint.mjs
const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function debugRequirements() {
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });

  console.log('Login Status:', loginRes.status);
  console.log('Login Content-Type:', loginRes.headers.get('content-type'));
  const loginText = await loginRes.text();
  console.log('Login Snippet:', loginText.substring(0, 500));
}

debugRequirements();
