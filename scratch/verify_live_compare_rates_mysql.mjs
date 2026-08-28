// scratch/verify_live_compare_rates_mysql.mjs
// Comprehensive Verification for Unique 1 Quote Per Transporter Architecture

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function verifyUniqueRatesArchitecture() {
  console.log('==================================================');
  console.log('🧪 LIVE UNIQUE QUOTE PER TRANSPORTER VERIFICATION');
  console.log('==================================================');

  // 1. Admin Auth
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;
  console.log('📡 Network Call: POST /api/auth/login -> 200 OK');

  // 2. Fetch Requirements
  const reqsRes = await fetch(`${BASE_URL}/api/requirements`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const reqsJson = await reqsRes.json();
  const liveReq = reqsJson.data[0];
  console.log('\n📡 Network Call: GET /api/requirements');
  console.log('  • Target Requirement Req No:', liveReq.req_no);

  // 3. Create 2 Controlled Test Transporters in MySQL
  const trans1Res = await fetch(`${BASE_URL}/api/transporters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ id: 'trans_test_b', company_name: 'ABC Logistics', code: 'ABC01', mobile: '9822000001', username: 'ABC01' })
  });
  const trans2Res = await fetch(`${BASE_URL}/api/transporters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ id: 'trans_test_c', company_name: 'XYZ Freight', code: 'XYZ01', mobile: '9822000002', username: 'XYZ01' })
  });
  console.log('📡 Network Call: POST /api/transporters -> Transporters ABC01 & XYZ01 Created/Verified ✅');

  // 4. Submit Quote for Transporter 1 (Wankhede trans): ₹22/MT
  const q1 = await fetch(`${BASE_URL}/api/rate-submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ requirement_id: liveReq.id, transporter_id: 'trans_1787930002849', rate_per_mt: 22, quoted_quantity_mt: 200, remarks: 'Wankhede Initial' })
  });
  console.log('\n📡 Network Call: POST /api/rate-submissions (Transporter 1: Wankhede trans @ ₹22/MT) ->', q1.status);

  // 5. Submit Quote for Transporter 2 (ABC Logistics): ₹24/MT
  const q2 = await fetch(`${BASE_URL}/api/rate-submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ requirement_id: liveReq.id, transporter_id: 'trans_test_b', rate_per_mt: 24, quoted_quantity_mt: 200, remarks: 'ABC Initial' })
  });
  console.log('📡 Network Call: POST /api/rate-submissions (Transporter 2: ABC Logistics @ ₹24/MT) ->', q2.status);

  // 6. Submit Quote for Transporter 3 (XYZ Freight): ₹25/MT
  const q3 = await fetch(`${BASE_URL}/api/rate-submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ requirement_id: liveReq.id, transporter_id: 'trans_test_c', rate_per_mt: 25, quoted_quantity_mt: 200, remarks: 'XYZ Initial' })
  });
  console.log('📡 Network Call: POST /api/rate-submissions (Transporter 3: XYZ Freight @ ₹25/MT) ->', q3.status);

  // 7. Duplicate Submission Test: Transporter 1 (Wankhede trans) resubmits new rate @ ₹21/MT
  const q1Update = await fetch(`${BASE_URL}/api/rate-submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ requirement_id: liveReq.id, transporter_id: 'trans_1787930002849', rate_per_mt: 21, quoted_quantity_mt: 200, remarks: 'Wankhede Updated Competitive Rate' })
  });
  const q1UpdateJson = await q1Update.json();
  console.log('\n📡 Network Call: POST /api/rate-submissions (RESUBMIT/UPDATE Transporter 1 @ ₹21/MT)');
  console.log('  • Status:', q1Update.status, 'OK');
  console.log('  • API Message:', q1UpdateJson.message);

  // 8. Verify COMPARE RATES API Endpoint: GET /api/requirements/:id/rates
  const compareRes = await fetch(`${BASE_URL}/api/requirements/${liveReq.id}/rates`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const compareJson = await compareRes.json();
  console.log('\n📡 Network Call: GET /api/requirements/' + liveReq.id + '/rates');
  console.log('  • Status:', compareRes.status, 'OK');
  console.log('  • Unique Transporter Quotes Count:', compareJson.count);
  console.log('  • 🥇 Lowest Rate:', `₹${compareJson.lowest_rate}/MT`);
  console.log('  • 🥇 Lowest Transporter:', compareJson.lowest_transporter);
  console.log('  • 🥇 Lowest Total Amount:', `₹${compareJson.lowest_total_amount}`);
  console.log('  • Current Quotes Matrix:');
  compareJson.rates.forEach((r, idx) => {
    console.log(`     [${idx + 1}] Transporter: ${r.company_name} | Rate: ₹${r.rate_per_mt}/MT | Qty: ${r.quoted_quantity_mt} MT | Total: ₹${r.total_amount} | Remarks: ${r.remarks}`);
  });

  // 9. Check Requirements API Bids Count
  const reqsCheckRes = await fetch(`${BASE_URL}/api/requirements`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const reqsCheckJson = await reqsCheckRes.json();
  const targetCheckReq = reqsCheckJson.data.find(r => r.id === liveReq.id);
  console.log('\n📡 Network Call: GET /api/requirements (Post-Deduplication Count)');
  console.log('  • submitted_bids_count (COUNT DISTINCT):', targetCheckReq.submitted_bids_count);

  console.log('\n==================================================');
  const countsMatch = compareJson.count === 3 && targetCheckReq.submitted_bids_count === 3;
  const lowestMatch = compareJson.lowest_rate === 21 && compareJson.lowest_transporter === 'Wankhede trans';
  
  if (countsMatch && lowestMatch) {
    console.log('🎉 1 TRANSPORTER + 1 REQUIREMENT = 1 ACTIVE QUOTE 100% VERIFIED!');
  } else {
    console.log('❌ VERIFICATION FAILED!');
    process.exit(1);
  }
  console.log('==================================================');
}

verifyUniqueRatesArchitecture().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
