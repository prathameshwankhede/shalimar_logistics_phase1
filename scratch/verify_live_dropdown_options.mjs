// scratch/verify_live_dropdown_options.mjs
// Verification Script for Master Pickup Origin, Drop Location & Product Name Dropdowns

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function verifyDropdownOptions() {
  console.log('==================================================');
  console.log('🧪 LIVE DROPDOWN OPTIONS VERIFICATION');
  console.log('==================================================');

  // 1. Admin Auth
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;
  console.log('✅ Admin Authenticated via JWT Token.');

  // 2. Fetch Master Directories from Live APIs
  const unitsRes = await fetch(`${BASE_URL}/api/company-units`, { headers: { 'Authorization': `Bearer ${token}` } });
  const companyUnits = (await unitsRes.json()).data || [];

  const prodsRes = await fetch(`${BASE_URL}/api/products`, { headers: { 'Authorization': `Bearer ${token}` } });
  const products = (await prodsRes.json()).data || [];

  const reqsRes = await fetch(`${BASE_URL}/api/rate-requests`, { headers: { 'Authorization': `Bearer ${token}` } });
  const reqs = (await reqsRes.json()).rate_requests || [];

  // Calculate Pickup Options
  const pickupOptions = Array.from(
    new Set([
      ...companyUnits.flatMap((c) => [c.pickup_origin, c.pickup_location_name, c.company_name, c.name, c.city]).filter(Boolean),
      ...reqs.flatMap((r) => [r.pickup_origin, r.origin_city]).filter(Boolean)
    ].map((val) => String(val).trim()).filter((val) => val.length > 0))
  );

  // Calculate Drop Options
  const dropOptions = Array.from(
    new Set([
      ...companyUnits.flatMap((c) => [c.drop_location, c.drop_location_name, c.city, c.district]).filter(Boolean),
      ...reqs.flatMap((r) => [r.drop_location, r.dest_city]).filter(Boolean)
    ].map((val) => String(val).trim()).filter((val) => val.length > 0))
  );

  // Calculate Product Options
  const productOptions = Array.from(
    new Set([
      ...products.map((p) => p.name).filter(Boolean),
      ...reqs.flatMap((r) => [r.product_name, r.material_type]).filter(Boolean)
    ].map((val) => String(val).trim()).filter((val) => val.length > 0))
  );

  console.log('\n📍 Master Pickup Origin Dropdown Options Count:', pickupOptions.length);
  console.log('   Options:', pickupOptions);

  console.log('\n🎯 Drop Location Dropdown Options Count:', dropOptions.length);
  console.log('   Options:', dropOptions);

  console.log('\n📦 Product Name Dropdown Options Count:', productOptions.length);
  console.log('   Options:', productOptions);

  const pickupPassed = pickupOptions.includes('SHALIMAR SOLVENT PLANT NAGPUR') && pickupOptions.includes('Nagpur');
  const dropPassed = dropOptions.includes('Mumbai') || dropOptions.includes('Mumbai Port') || dropOptions.includes('Nagpur');
  const prodPassed = productOptions.includes('TOTAL GOLD SOYA DOC');

  console.log('\n==================================================');
  if (pickupPassed && dropPassed && prodPassed) {
    console.log('🎉 LIVE MASTER DROPDOWNS 100% POPULATED AND VERIFIED!');
  } else {
    console.log('❌ DROPDOWN POPULATION FAILED!');
    process.exit(1);
  }
  console.log('==================================================');
}

verifyDropdownOptions().catch(err => {
  console.error('❌ Dropdown Verification Error:', err);
  process.exit(1);
});
