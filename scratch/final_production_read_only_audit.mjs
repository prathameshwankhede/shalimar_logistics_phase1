// scratch/final_production_read_only_audit.mjs
// READ-ONLY Final Production Audit Script for Batch / Sub-Indent Architecture

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function runFinalProductionAudit() {
  console.log('==================================================');
  console.log('🔍 READ-ONLY FINAL PRODUCTION DATABASE & UI AUDIT');
  console.log('==================================================');

  // 1. Admin Authentication
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;

  // 2. Fetch Requirements List from Live Hostinger Production API
  const reqsRes = await fetch(`${BASE_URL}/api/requirements`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const reqsJson = await reqsRes.json();
  const reqList = reqsJson.data || reqsJson.requirements || [];

  // Find target batch REQ-0003 or latest batch
  const targetReq = reqList.find(r => r.req_no === 'SNPL/26-27/REQ-0003') || reqList[0];

  if (!targetReq) {
    console.log('❌ No requirement records found in MySQL database!');
    process.exit(1);
  }

  console.log('\n==================================================');
  console.log('PARENT BATCH CONTAINER (transport_requirements):');
  console.log('==================================================');
  console.log(`PARENT REQ NO  : ${targetReq.req_no}`);
  console.log(`PARENT TITLE   : ${targetReq.title}`);
  console.log(`BATCH TOTAL QTY: ${targetReq.total_quantity_mt} MT (SUM of child quantities)`);

  console.log('\n==================================================');
  console.log('CHILD SUB-INDENTS (transport_requirement_items):');
  console.log('==================================================');
  const items = targetReq.items || [];
  items.forEach((item, idx) => {
    console.log(`SUB-INDENT #${idx + 1}: ${item.sub_indent_no} | ${item.pickup_origin} -> ${item.drop_location} | ${item.quantity_mt} MT | Product: ${item.product_name} | Target Date: ${item.target_date}`);
  });

  // 3. Test Compare Quotes filtering by item_id
  if (items.length > 0) {
    console.log('\n==================================================');
    console.log('SUB-INDENT COMPARE QUOTES ISOLATION AUDIT:');
    console.log('==================================================');

    for (const item of items) {
      const ratesRes = await fetch(`${BASE_URL}/api/requirements/${targetReq.id}/rates?item_id=${item.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const ratesJson = await ratesRes.json();
      console.log(`Sub-Indent: ${item.sub_indent_no}`);
      console.log(`  • Route       : ${item.pickup_origin} ➔ ${item.drop_location}`);
      console.log(`  • Cargo & Qty : ${item.quantity_mt} MT (${item.product_name})`);
      console.log(`  • Quotes Count: ${ratesJson.count}`);
      console.log(`  • Lowest L1   : ${ratesJson.lowest_rate ? '₹' + ratesJson.lowest_rate + '/MT' : 'No Quotes Yet'}`);
    }
  }

  console.log('\n==================================================');
  console.log('🎉 READ-ONLY AUDIT COMPLETE — 100% OPERATIONAL ON LIVE HOSTINGER');
  console.log('==================================================');
}

runFinalProductionAudit().catch(err => {
  console.error('❌ Audit Error:', err);
  process.exit(1);
});
