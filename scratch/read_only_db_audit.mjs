// scratch/read_only_db_audit.mjs
// Audit live transport_requirements and transport_requirement_items

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function auditLiveDb() {
  console.log('==================================================');
  console.log('🔍 LIVE MYSQL TRANSPORT REQUIREMENTS AUDIT');
  console.log('==================================================');

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;

  const res = await fetch(`${BASE_URL}/api/requirements`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const json = await res.json();
  console.log(`Total requirements in DB: ${json.data ? json.data.length : 0}\n`);

  (json.data || []).forEach((req, idx) => {
    console.log(`[#${idx + 1}] ID: ${req.id} | REQ_NO: ${req.req_no} | Route: ${req.pickup_origin} ➔ ${req.drop_location}`);
    console.log(`    Items (${req.items ? req.items.length : 0}):`);
    (req.items || []).forEach((item, itemIdx) => {
      console.log(`      Line #${itemIdx + 1}: ${item.product_name} — ${item.quantity_mt} ${item.unit}`);
    });
    console.log(`    Total Tonnage: ${req.total_quantity_mt} MT\n`);
  });
}

auditLiveDb();
