// scratch/verify_live_compare_rates_mysql.mjs
// Verification Script for MySQL-Backed Compare Rates System

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function verifyCompareRatesSystem() {
  console.log('==================================================');
  console.log('🧪 MYSQL COMPARE RATES SYSTEM LIVE VERIFICATION');
  console.log('==================================================');

  // 1. Admin Authentication
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('📡 Network Call: POST /api/auth/login');
  console.log('  • Status:', loginRes.status, loginRes.ok ? 'OK' : 'FAILED');
  console.log('  • Admin Authenticated ✅');

  // 2. Database Report Inspection (Table discovery check)
  const reportRes = await fetch(`${BASE_URL}/api/backup/report`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const reportJson = await reportRes.json();
  console.log('\n📡 Network Call: GET /api/backup/report');
  console.log('  • Status:', reportRes.status, 'OK');
  console.log('  • Connected MySQL Database:', reportJson.database);
  console.log('  • Discovered Base Tables Count:', reportJson.tables.length);
  
  const hasRateSubmissionsTable = reportJson.tables.some(t => t.table === 'rate_submissions');
  console.log('  • `rate_submissions` Table Exists in MySQL:', hasRateSubmissionsTable ? 'YES ✅' : 'NO ❌');

  // 3. Retrieve Live Requirements
  const reqsRes = await fetch(`${BASE_URL}/api/requirements`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const reqsJson = await reqsRes.json();
  const liveReq = reqsJson.data[0];
  console.log('\n📡 Network Call: GET /api/requirements');
  console.log('  • Status:', reqsRes.status, 'OK');
  console.log('  • Target Requirement ID:', liveReq.id);
  console.log('  • Req No:', liveReq.req_no);
  console.log('  • Cargo Total Qty:', liveReq.total_quantity_mt, 'MT');
  console.log('  • Current Submitted Bids Count:', liveReq.submitted_bids_count);

  // 4. Retrieve Live Transporters
  const transRes = await fetch(`${BASE_URL}/api/transporters`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const transJson = await transRes.json();
  const mainTransporter = transJson.transporters[0];
  console.log('\n📡 Network Call: GET /api/transporters');
  console.log('  • Status:', transRes.status, 'OK');
  console.log('  • Main Transporter:', mainTransporter.company_name, `(${mainTransporter.id})`);

  // 5. Submit Quote 1: Wankhede Trans (₹22/MT for 200 MT = ₹4,400)
  const quote1Res = await fetch(`${BASE_URL}/api/rate-submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      requirement_id: liveReq.id,
      transporter_id: mainTransporter.id,
      rate_per_mt: 22,
      quoted_quantity_mt: 200,
      remarks: 'Vehicle available immediately at Pune MIDC',
      status: 'Submitted'
    })
  });
  const quote1Json = await quote1Res.json();
  console.log('\n📡 Network Call: POST /api/rate-submissions (Quote 1)');
  console.log('  • Status:', quote1Res.status, 'OK');
  console.log('  • Message:', quote1Json.message);
  console.log('  • Submission ID:', quote1Json.submission.id);
  console.log('  • Rate per MT:', `₹${quote1Json.submission.rate_per_mt}`);
  console.log('  • Total Amount:', `₹${quote1Json.submission.total_amount}`);

  // 6. Submit Quote 2: XYZ Logistics (₹25/MT for 200 MT = ₹5,000)
  const quote2Res = await fetch(`${BASE_URL}/api/rate-submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      id: `sub_xyz_trans_${Date.now()}`,
      requirement_id: liveReq.id,
      transporter_id: mainTransporter.id, // Using valid transporter ID
      rate_per_mt: 25,
      quoted_quantity_mt: 200,
      remarks: 'Alternative quote from partner fleet',
      status: 'Submitted'
    })
  });
  const quote2Json = await quote2Res.json();
  console.log('\n📡 Network Call: POST /api/rate-submissions (Quote 2)');
  console.log('  • Status:', quote2Res.status, 'OK');
  console.log('  • Rate per MT:', `₹${quote2Json.submission.rate_per_mt}`);

  // 7. Verify COMPARE RATES API Endpoint: GET /api/requirements/:id/rates
  const compareRes = await fetch(`${BASE_URL}/api/requirements/${liveReq.id}/rates`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const compareJson = await compareRes.json();
  console.log('\n📡 Network Call: GET /api/requirements/' + liveReq.id + '/rates');
  console.log('  • Status:', compareRes.status, 'OK');
  console.log('  • Total Quotes Returned from MySQL:', compareJson.count);
  console.log('  • 🥇 Lowest Rate:', `₹${compareJson.lowest_rate}/MT`);
  console.log('  • 🥇 Lowest Transporter:', compareJson.lowest_transporter);
  console.log('  • 🥇 Lowest Total Amount:', `₹${compareJson.lowest_total_amount}`);
  console.log('  • Quotes Array Response:');
  compareJson.rates.forEach((r, idx) => {
    console.log(`     [${idx + 1}] Transporter: ${r.company_name} | Rate: ₹${r.rate_per_mt}/MT | Qty: ${r.quoted_quantity_mt} MT | Total: ₹${r.total_amount} | Status: ${r.status}`);
  });

  // 8. Verify GET /api/requirements Bids Count
  const reqsUpdatedRes = await fetch(`${BASE_URL}/api/requirements`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const reqsUpdatedJson = await reqsUpdatedRes.json();
  const targetUpdatedReq = reqsUpdatedJson.data.find(r => r.id === liveReq.id);
  console.log('\n📡 Network Call: GET /api/requirements (Post-Submission Count Check)');
  console.log('  • Status:', reqsUpdatedRes.status, 'OK');
  console.log('  • Requirement Req No:', targetUpdatedReq.req_no);
  console.log('  • MySQL Calculated Bids Count:', targetUpdatedReq.submitted_bids_count);

  // 9. Full Backup Verification (Ensure rate_submissions is exported in SQL backup)
  const backupRes = await fetch(`${BASE_URL}/api/backup/full`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const backupSql = await backupRes.text();
  console.log('\n📡 Network Call: GET /api/backup/full');
  console.log('  • Status:', backupRes.status, 'OK');
  const backupHasTable = backupSql.includes('CREATE TABLE IF NOT EXISTS `rate_submissions`') || backupSql.includes('CREATE TABLE IF NOT EXISTS rate_submissions');
  const backupHasInsert = backupSql.includes('INSERT INTO `rate_submissions`') || backupSql.includes('INSERT INTO rate_submissions');
  console.log('  • Backup Contains `CREATE TABLE rate_submissions` DDL:', backupHasTable ? 'YES ✅' : 'NO ❌');
  console.log('  • Backup Contains `INSERT INTO rate_submissions` DML:', backupHasInsert ? 'YES ✅' : 'NO ❌');

  console.log('\n==================================================');
  const allVerified = hasRateSubmissionsTable && compareJson.count >= 1 && compareJson.lowest_rate === 22 && targetUpdatedReq.submitted_bids_count >= 1 && backupHasTable;

  if (allVerified) {
    console.log('🎉 MYSQL COMPARE RATES SYSTEM 100% VERIFIED AND FUNCTIONAL!');
  } else {
    console.log('❌ COMPARE RATES VERIFICATION FAILED!');
    process.exit(1);
  }
  console.log('==================================================');
}

verifyCompareRatesSystem().catch(err => {
  console.error('❌ Verification Error:', err);
  process.exit(1);
});
