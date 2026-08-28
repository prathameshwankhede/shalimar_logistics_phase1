// scratch/read_only_master_dropdown_audit.mjs
// READ-ONLY Diagnostic Script for Requirement Form Master Dropdown Data Source

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function runReadOnlyMasterAudit() {
  console.log('==================================================');
  console.log('🔍 READ-ONLY DIAGNOSTIC AUDIT: MASTER DROPDOWN DATA SOURCE');
  console.log('==================================================');

  // 1. Admin Authentication
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;

  // 2. GET /api/company-units
  const unitsRes = await fetch(`${BASE_URL}/api/company-units`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const unitsJson = await unitsRes.json();
  const companyUnits = unitsJson.data || [];

  console.log('\nSTEP 1 & 2: SELECT id, company_name, pickup_origin, drop_location FROM company_units_plants via GET /api/company-units:');
  console.log(JSON.stringify(companyUnits.map(u => ({
    id: u.id,
    company_name: u.company_name,
    pickup_origin: u.pickup_origin,
    drop_location: u.drop_location
  })), null, 2));

  // 3. Pickup Dropdown Options (Exact Logic from AdminDashboard / CreateRequirementModal)
  const pickupOptions = Array.from(
    new Set(
      companyUnits
        .map(c => (c.pickup_origin || c.pickup_location_name || '').trim())
        .filter(val => val.length > 0)
    )
  );

  // 4. Drop Dropdown Options (Exact Logic from AdminDashboard / CreateRequirementModal)
  const dropOptions = Array.from(
    new Set(
      companyUnits
        .map(c => (c.drop_location || c.drop_location_name || '').trim())
        .filter(val => val.length > 0)
    )
  );

  // 5. GET /api/products
  const prodsRes = await fetch(`${BASE_URL}/api/products`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const prodsJson = await prodsRes.json();
  const rawProducts = prodsJson.data || prodsJson || [];
  const productOptions = Array.from(
    new Set(
      (Array.isArray(rawProducts) ? rawProducts : [])
        .map(p => (typeof p === 'string' ? p : p.name || p.product_name || '').trim())
        .filter(val => val.length > 0)
    )
  );

  console.log('\nSTEP 3: Exact Final Pickup Dropdown Array:');
  console.log(JSON.stringify(pickupOptions));

  console.log('\nSTEP 4: Exact Final Drop Dropdown Array:');
  console.log(JSON.stringify(dropOptions));

  console.log('\nSTEP 5: Exact Final Product Dropdown Array:');
  console.log(JSON.stringify(productOptions));

  console.log('\n==================================================');
  const passCheck = 
    JSON.stringify(pickupOptions) === JSON.stringify(["yenva", "katol"]) &&
    JSON.stringify(dropOptions) === JSON.stringify(["yerla", "nagpur"]);

  if (passCheck) {
    console.log('✅ DIAGNOSTIC VERIFICATION PASSED: DROPDOWNS RESOLVE 100% FROM MYSQL MASTER!');
  } else {
    console.log('⚠️ DROPDOWN VALUES DIFFER FROM EXPECTED ["yenva", "katol"] / ["yerla", "nagpur"]');
  }
  console.log('==================================================');
}

runReadOnlyMasterAudit().catch(err => {
  console.error('❌ Audit Error:', err);
  process.exit(1);
});
