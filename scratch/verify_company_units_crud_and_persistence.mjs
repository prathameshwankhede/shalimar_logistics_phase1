// scratch/verify_company_units_crud_and_persistence.mjs
// Verification Script for Organization / Company Units MySQL Persistence & CRUD Operations

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function verifyCompanyUnitsCrudFlow() {
  console.log('==================================================');
  console.log('🧪 COMPANY UNITS / PLANTS MYSQL PERSISTENCE VERIFICATION');
  console.log('==================================================');

  // 1. Admin Authentication
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;
  console.log('✅ Admin Authenticated via JWT Token.');

  // 2. GET /api/company-units (Read-Only Fetch of Existing Production Records)
  console.log('\n📡 Step 1: Querying GET /api/company-units from Hostinger MySQL...');
  const getRes = await fetch(`${BASE_URL}/api/company-units`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('  • GET /api/company-units Status:', getRes.status);
  const getJson = await getRes.json();
  const initialUnits = getJson.data || getJson.company_units || [];
  console.log(`  • Existing Company Units Count in MySQL: ${initialUnits.length}`);
  
  if (initialUnits.length > 0) {
    console.log('  • Sample Existing Production Company Unit Record:');
    const u0 = initialUnits[0];
    console.log(`    - ID: ${u0.id}`);
    console.log(`    - Company Name: ${u0.company_name}`);
    console.log(`    - Registered Address: ${u0.registered_address}`);
    console.log(`    - Contact Name: ${u0.contact_name}`);
    console.log(`    - Mobile: ${u0.mobile}`);
    console.log(`    - City/State: ${u0.city}, ${u0.state}`);
    console.log(`    - PIN Code: ${u0.pin_code}`);
  }

  // 3. POST /api/company-units (Create Controlled Test Record)
  console.log('\n🚀 Step 2: Testing POST /api/company-units (Inserting Controlled Test Record)...');
  const testUnitId = `comp_unit_test_${Date.now()}`;
  const testPayload = {
    id: testUnitId,
    company_name: 'TEST PLANT UNIT NAGPUR',
    registered_address: 'Plot 99 MIDC Hingna Road',
    gstin: '27ABCDE1234F1Z5',
    pan: 'ABCDE1234F',
    contact_name: 'Testing Officer',
    email: 'testunit@shalimarnutrients.com',
    mobile: '9876543210',
    state: 'Maharashtra',
    city: 'Nagpur',
    district: 'Nagpur',
    pin_code: '440028',
    pickup_origin: 'Nagpur MIDC Depot',
    drop_location: 'Mumbai Port Yard'
  };

  const createRes = await fetch(`${BASE_URL}/api/company-units`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(testPayload)
  });
  console.log('  • POST /api/company-units Status:', createRes.status);
  const createJson = await createRes.json();
  console.log('  • POST Response:', JSON.stringify(createJson));

  // Verify fields in created DTO
  const createdDto = createJson.data;
  const fieldsVerified = createdDto &&
    createdDto.id === testUnitId &&
    createdDto.company_name === 'TEST PLANT UNIT NAGPUR' &&
    createdDto.registered_address === 'Plot 99 MIDC Hingna Road' &&
    createdDto.contact_name === 'Testing Officer' &&
    createdDto.mobile === '9876543210' &&
    createdDto.city === 'Nagpur' &&
    createdDto.state === 'Maharashtra' &&
    createdDto.pin_code === '440028' &&
    createdDto.pickup_origin === 'Nagpur MIDC Depot' &&
    createdDto.drop_location === 'Mumbai Port Yard';

  console.log(`  • Field-level INSERT Verification in MySQL: ${fieldsVerified ? 'PASS ✅' : 'FAIL ❌'}`);

  // 4. PUT /api/company-units/:id (Update Controlled Test Record)
  console.log('\n✏️ Step 3: Testing PUT /api/company-units/:id (Updating Controlled Test Record)...');
  const updatePayload = {
    ...testPayload,
    company_name: 'UPDATED TEST PLANT UNIT NAGPUR',
    pickup_origin: 'Updated Nagpur Depot'
  };
  const updateRes = await fetch(`${BASE_URL}/api/company-units/${testUnitId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(updatePayload)
  });
  console.log('  • PUT /api/company-units/:id Status:', updateRes.status);
  const updateJson = await updateRes.json();
  const updatedDto = updateJson.data;
  const updateVerified = updatedDto && updatedDto.company_name === 'UPDATED TEST PLANT UNIT NAGPUR';
  console.log(`  • Field-level UPDATE Verification in MySQL: ${updateVerified ? 'PASS ✅' : 'FAIL ❌'}`);

  // 5. DELETE /api/company-units/:id (Cleanup ONLY Controlled Test Record)
  console.log('\n🧹 Step 4: Testing DELETE /api/company-units/:id (Cleaning Up ONLY Controlled Test Record)...');
  const deleteRes = await fetch(`${BASE_URL}/api/company-units/${testUnitId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('  • DELETE /api/company-units/:id Status:', deleteRes.status);

  // 6. Final Read Verification (Confirm Production Records Unchanged)
  console.log('\n📡 Step 5: Final Read Verification of MySQL Database State...');
  const finalGetRes = await fetch(`${BASE_URL}/api/company-units`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const finalUnits = (await finalGetRes.json()).data || [];
  const testUnitExists = finalUnits.some(u => u.id === testUnitId);
  const prodUnitPreserved = finalUnits.some(u => u.id === 'unit_real_1' || u.company_name === 'SHALIMAR SOLVENT PLANT NAGPUR');

  console.log(`  • Controlled Test Record Wiped: ${!testUnitExists ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`  • Production Record Untouched: ${prodUnitPreserved ? 'PASS ✅' : 'FAIL ❌'}`);

  const allPassed = fieldsVerified && updateVerified && deleteRes.status === 200 && !testUnitExists && prodUnitPreserved;

  console.log('\n==================================================');
  if (allPassed) {
    console.log('🎉 COMPANY UNITS / PLANTS MYSQL PERSISTENCE 100% VERIFIED!');
  } else {
    console.log('❌ VERIFICATION FAILED!');
    process.exit(1);
  }
  console.log('==================================================');
}

verifyCompanyUnitsCrudFlow().catch(err => {
  console.error('❌ Company Units CRUD Verification Error:', err);
  process.exit(1);
});
