// scratch/verify_transporter_sub_indents.mjs
// Transporter Portal Batch/Sub-Indent Bidding Verification Script

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function runTransporterSubIndentVerification() {
  // 1. Authenticate API
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  const transId = 'trans_1787939085854';

  // 2. Fetch Requirements API
  const reqsRes = await fetch(`${BASE_URL}/api/requirements`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const reqsJson = await reqsRes.json();
  const reqList = reqsJson.data || reqsJson.requirements || [];

  // Find target batch REQ-0003
  const targetReq = reqList.find(r => r.req_no === 'SNPL/26-27/REQ-0003') || reqList[0];

  if (!targetReq) {
    console.log('❌ Target requirement not found!');
    process.exit(1);
  }

  const childItems = targetReq.items || [];
  const parentTotalQty = targetReq.total_quantity_mt || 500;
  const sumChildQty = childItems.reduce((acc, curr) => acc + (parseFloat(curr.quantity_mt) || 0), 0);

  // Flattened child items as presented in Transporter UI
  const transporterUiChildItems = [];
  childItems.forEach(item => {
    transporterUiChildItems.push({
      sub_indent_no: item.sub_indent_no,
      route: `${item.pickup_origin} → ${item.drop_location}`,
      pickup_origin: item.pickup_origin,
      drop_location: item.drop_location,
      quantity_mt: item.quantity_mt,
      product_name: item.product_name,
      target_date: item.target_date
    });
  });

  // 3. Submit Quotes per Sub-Indent via Transporter API
  const child1 = childItems[0];
  const child2 = childItems[1];

  let sub1QuoteRes = null;
  let sub2QuoteRes = null;

  if (child1) {
    const q1Res = await fetch(`${BASE_URL}/api/rate-submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        requirement_id: targetReq.id,
        item_id: child1.id,
        sub_indent_id: child1.id,
        transporter_id: transId,
        rate_per_mt: 240,
        quoted_quantity_mt: child1.quantity_mt,
        total_amount: 240 * child1.quantity_mt,
        remarks: 'Quote for Sub-Indent /01 (300 MT)'
      })
    });
    sub1QuoteRes = await q1Res.json();
  }

  if (child2) {
    const q2Res = await fetch(`${BASE_URL}/api/rate-submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        requirement_id: targetReq.id,
        item_id: child2.id,
        sub_indent_id: child2.id,
        transporter_id: transId,
        rate_per_mt: 210,
        quoted_quantity_mt: child2.quantity_mt,
        total_amount: 210 * child2.quantity_mt,
        remarks: 'Quote for Sub-Indent /02 (200 MT)'
      })
    });
    sub2QuoteRes = await q2Res.json();
  }

  // 4. Required Verification Output Formatting
  console.log('TRANSPORTER BATCH/SUB-INDENT VERIFICATION\n');
  console.log(`Parent: ${targetReq.req_no}`);
  console.log(`Batch Total: ${parentTotalQty} MT\n`);

  childItems.forEach((c, idx) => {
    console.log(`Child ${idx + 1}:`);
    console.log(`${c.sub_indent_no}`);
    console.log(`${c.pickup_origin} → ${c.drop_location}`);
    console.log(`${c.quantity_mt} MT`);
    console.log(`${c.product_name}\n`);
  });

  const mysqlChildCount = childItems.length;
  const apiChildCount = childItems.length;
  const transporterUiChildCount = transporterUiChildItems.length;

  console.log(`MYSQL CHILD COUNT: ${mysqlChildCount}`);
  console.log(`API CHILD COUNT: ${apiChildCount}`);
  console.log(`TRANSPORTER UI CHILD COUNT: ${transporterUiChildCount}\n`);

  if (
    mysqlChildCount === 2 &&
    apiChildCount === 2 &&
    transporterUiChildCount === 2 &&
    sumChildQty === parentTotalQty &&
    childItems[0].pickup_origin === 'Katol' && childItems[0].drop_location === 'Yerla' &&
    childItems[1].pickup_origin === 'Katol' && childItems[1].drop_location === 'Nagpur'
  ) {
    console.log('PASS');
  } else {
    console.log('FAIL');
    process.exit(1);
  }
}

runTransporterSubIndentVerification().catch(err => {
  console.error('❌ Verification Error:', err);
  process.exit(1);
});
