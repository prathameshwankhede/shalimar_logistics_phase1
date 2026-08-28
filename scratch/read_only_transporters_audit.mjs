// scratch/read_only_transporters_audit.mjs
// Performs a READ-ONLY inspection of transporters table on Hostinger Production DB

const HOSTINGER_GET_TRANS_URL = 'https://lightslategray-gazelle-919724.hostingersite.com/api/transporters';
const HOSTINGER_LOGIN_URL = 'https://lightslategray-gazelle-919724.hostingersite.com/api/auth/login';

async function auditTransportersReadOnly() {
  console.log('==================================================');
  console.log('🔍 READ-ONLY PRODUCTION TRANSPORTERS AUDIT');
  console.log('==================================================');

  try {
    // 1. Authenticate Admin Session
    const loginRes = await fetch(HOSTINGER_LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });

    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.token) {
      console.error('❌ Login Failed:', loginData);
      process.exit(1);
    }
    const token = loginData.token;

    // 2. Fetch All Transporters
    const getRes = await fetch(HOSTINGER_GET_TRANS_URL, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await getRes.json();
    const transporters = data.transporters || [];

    console.log(`\n📌 Total Transporter Rows in Production: ${transporters.length}`);

    // Identify suspected test records (containing TEST, DEMO, SAMPLE, etc.)
    const testRecords = transporters.filter(t => {
      const cName = (t.company_name || '').toUpperCase();
      const code = (t.code || '').toUpperCase();
      const uName = (t.username || '').toUpperCase();
      return cName.includes('TEST') || code.includes('TEST') || uName.includes('TEST') ||
             cName.includes('DEMO') || code.includes('DEMO') || uName.includes('DEMO') ||
             cName.includes('SAMPLE') || code.includes('SAMPLE') || uName.includes('SAMPLE');
    });

    console.log(`📌 Total Suspected Test Rows: ${testRecords.length}`);
    console.log('\n📋 Suspected Test Records Details:');
    console.table(testRecords.map(t => ({
      id: t.id,
      company_name: t.company_name,
      code: t.code,
      username: t.username
    })));

  } catch (err) {
    console.error('❌ Audit Error:', err.message);
  } finally {
    process.exit(0);
  }
}

auditTransportersReadOnly();
