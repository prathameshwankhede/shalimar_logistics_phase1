// scratch/read_only_inspect_all_p001.mjs
// Inspect all columns for P001 in transporters and users tables on Hostinger Production

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function inspectP001Record() {
  console.log('==================================================');
  console.log('🔍 READ-ONLY INSPECTION OF P001 RECORDS IN PRODUCTION DB');
  console.log('==================================================');

  // Login Admin
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;

  // Fetch Transporters
  const transRes = await fetch(`${BASE_URL}/api/transporters`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const transData = await transRes.json();
  const transporters = transData.transporters || [];

  console.log('\n--- ALL TRANSPORTERS IN MYSQL ---');
  transporters.forEach(t => {
    console.log(`ID: ${t.id} | Code: ${t.code} | Username: ${t.username} | Name: ${t.company_name} | Status: ${t.status}`);
  });

  const p001 = transporters.find(t => t.code === 'P001' || t.username === 'P001' || t.id === 'P001');
  console.log('\n--- MATCHED P001 RECORD ---', p001);

  // Fetch State to check legacy users array
  const stateRes = await fetch(`${BASE_URL}/api/state`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const stateData = await stateRes.json();
  const users = stateData?.data?.users || [];
  console.log('\n--- LEGACY USERS ARRAY IN STATE ---');
  users.forEach(u => {
    console.log(`ID: ${u.id} | Username: ${u.username} | Role: ${u.role} | TransporterID: ${u.transporter_id}`);
  });
}

inspectP001Record();
