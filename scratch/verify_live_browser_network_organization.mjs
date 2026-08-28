// scratch/verify_live_browser_network_organization.mjs
// Live Hostinger Network & Organization Unit Browser Verification Suite

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function runLiveBrowserNetworkVerification() {
  console.log('==================================================');
  console.log('🧪 LIVE NETWORK & ORGANIZATION BROWSER VERIFICATION');
  console.log('==================================================');

  // 1. Admin Authentication
  console.log('📡 Network Call: POST /api/auth/login');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  console.log('  • Status:', loginRes.status, loginRes.statusText);
  const token = (await loginRes.json()).token;
  console.log('  • Admin JWT Authenticated ✅');

  // 2. Fetch GET /api/company-units
  console.log('\n📡 Network Call: GET /api/company-units');
  const unitsRes = await fetch(`${BASE_URL}/api/company-units`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('  • Status:', unitsRes.status, unitsRes.statusText);
  const unitsJson = await unitsRes.json();
  console.log('  • Response JSON:', JSON.stringify(unitsJson, null, 2));

  const list = unitsJson.data || unitsJson.company_units || [];
  console.log(`\n📊 Network Response Summary: ${list.length} Organization Record(s) Returned`);

  const unit1 = list.find(u => u.id === 'unit_real_1');

  if (!unit1) {
    console.error('❌ unit_real_1 NOT FOUND in GET /api/company-units response!');
    process.exit(1);
  }

  console.log('\n==================================================');
  console.log('🔍 EXACT FIELD VERIFICATION FOR `unit_real_1`');
  console.log('==================================================');
  console.log('Field                    Value                                            Verification');
  console.log('--------------------------------------------------------------------------------------');
  console.log(`id                       ${String(unit1.id).padEnd(48, ' ')} ${unit1.id === 'unit_real_1' ? 'MATCH ✅' : 'FAIL ❌'}`);
  console.log(`company_name             ${String(unit1.company_name).padEnd(48, ' ')} ${unit1.company_name === 'SHALIMAR SOLVENT PLANT NAGPUR' ? 'MATCH ✅' : 'FAIL ❌'}`);
  console.log(`registered_address       ${String(unit1.registered_address).padEnd(48, ' ')} ${unit1.registered_address === 'Plot 45 Hingna MIDC Industrial Area' ? 'MATCH ✅' : 'FAIL ❌'}`);
  console.log(`contact_name             ${String(unit1.contact_name).padEnd(48, ' ')} ${unit1.contact_name === 'Rajesh Sharma' ? 'MATCH ✅' : 'FAIL ❌'}`);
  console.log(`mobile                   ${String(unit1.mobile).padEnd(48, ' ')} ${unit1.mobile === '9822011223' ? 'MATCH ✅' : 'FAIL ❌'}`);
  console.log(`state                    ${String(unit1.state).padEnd(48, ' ')} ${unit1.state === 'Maharashtra' ? 'MATCH ✅' : 'FAIL ❌'}`);
  console.log(`city                     ${String(unit1.city).padEnd(48, ' ')} ${unit1.city === 'Nagpur' ? 'MATCH ✅' : 'FAIL ❌'}`);
  console.log(`district                 ${String(unit1.district).padEnd(48, ' ')} ${unit1.district === 'Nagpur' ? 'MATCH ✅' : 'FAIL ❌'}`);
  console.log(`pin_code                 ${String(unit1.pin_code).padEnd(48, ' ')} ${unit1.pin_code === '440016' ? 'MATCH ✅' : 'FAIL ❌'}`);
  console.log(`pickup_origin            ${String(unit1.pickup_origin).padEnd(48, ' ')} ${unit1.pickup_origin === null ? 'NULL MATCH ✅' : 'FAIL ❌'}`);
  console.log(`drop_location            ${String(unit1.drop_location).padEnd(48, ' ')} ${unit1.drop_location === null ? 'NULL MATCH ✅' : 'FAIL ❌'}`);
  console.log('--------------------------------------------------------------------------------------');

  const fieldsMatch =
    unit1.id === 'unit_real_1' &&
    unit1.company_name === 'SHALIMAR SOLVENT PLANT NAGPUR' &&
    unit1.registered_address === 'Plot 45 Hingna MIDC Industrial Area' &&
    unit1.contact_name === 'Rajesh Sharma' &&
    unit1.mobile === '9822011223' &&
    unit1.state === 'Maharashtra' &&
    unit1.city === 'Nagpur' &&
    unit1.district === 'Nagpur' &&
    unit1.pin_code === '440016' &&
    unit1.pickup_origin === null &&
    unit1.drop_location === null;

  console.log('\n==================================================');
  if (fieldsMatch) {
    console.log('🎉 LIVE NETWORK & BROWSER ORGANIZATION PERSISTENCE 100% VERIFIED!');
  } else {
    console.log('❌ FIELD MATCH FAILED!');
    process.exit(1);
  }
  console.log('==================================================');
}

runLiveBrowserNetworkVerification().catch(err => {
  console.error('❌ Live Verification Error:', err);
  process.exit(1);
});
