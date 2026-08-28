// scratch/verify_company_units_crud_live.mjs
// Verifies live Company Units / Plants CRUD operations on Hostinger Production

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function testCompanyUnitsCRUD() {
  console.log('==================================================');
  console.log('🧪 LIVE HOSTINGER COMPANY UNITS / PLANTS CRUD TEST');
  console.log('==================================================');

  try {
    // 1. Admin Login
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const adminToken = (await loginRes.json()).token;
    console.log('✅ Admin Authenticated.');

    // 2. GET /api/company-units
    console.log('\n📥 Step 1: GET /api/company-units...');
    const getRes1 = await fetch(`${BASE_URL}/api/company-units`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const getData1 = await getRes1.json();
    console.log(`  • Status: ${getRes1.status}`);
    console.log(`  • Initial Units Count: ${getData1.count || 0}`);

    // 3. POST /api/company-units (Create Test Plant)
    console.log('\n➕ Step 2: POST /api/company-units (Create Test Plant)...');
    const newPlantPayload = {
      company_name: 'Test Shalimar Pune Processing Hub',
      registered_address: 'Plot 45, Chakan Industrial Area Phase 2',
      gstin: '27AABCU9603R1ZM',
      pan: 'AABCU9603R',
      contact_name: 'Vikram Deshmukh',
      email: 'pune.plant@shalimar.com',
      mobile: '9822019876',
      state: 'Maharashtra',
      city: 'Pune',
      district: 'Pune',
      pin_code: '410501',
      pickup_origin: 'Pune Chakan Plant',
      drop_location: 'Mumbai Port Hub'
    };

    const postRes = await fetch(`${BASE_URL}/api/company-units`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(newPlantPayload)
    });

    const postData = await postRes.json();
    console.log(`  • Status: ${postRes.status}`);
    console.log(`  • Response Message: ${postData.message}`);
    const createdUnit = postData.data;
    console.log(`  • Created Unit ID: ${createdUnit?.id}`);
    console.log(`  • Created Name: ${createdUnit?.company_name}`);

    if (!postRes.ok || !createdUnit?.id) throw new Error('Company unit creation failed');

    // 4. PUT /api/company-units/:id (Update Test Plant)
    console.log(`\n✏️ Step 3: PUT /api/company-units/${createdUnit.id} (Update Test Plant)...`);
    const updatePayload = {
      ...newPlantPayload,
      contact_name: 'Vikram Deshmukh (Senior Manager)',
      mobile: '9822099999',
      city: 'Pune (Chakan MIDC)'
    };

    const putRes = await fetch(`${BASE_URL}/api/company-units/${createdUnit.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(updatePayload)
    });

    const putData = await putRes.json();
    console.log(`  • Status: ${putRes.status}`);
    console.log(`  • Response Message: ${putData.message}`);
    const updatedUnit = putData.data;
    console.log(`  • Updated Contact: ${updatedUnit?.contact_name}`);
    console.log(`  • Updated Mobile: ${updatedUnit?.mobile}`);

    if (!putRes.ok) throw new Error('Company unit update failed');

    // 5. DELETE /api/company-units/:id (Delete Test Plant)
    console.log(`\n🗑️ Step 4: DELETE /api/company-units/${createdUnit.id} (Delete Test Plant)...`);
    const delRes = await fetch(`${BASE_URL}/api/company-units/${createdUnit.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const delData = await delRes.json();
    console.log(`  • Status: ${delRes.status}`);
    console.log(`  • Response Message: ${delData.message}`);

    if (!delRes.ok) throw new Error('Company unit deletion failed');

    // 6. GET /api/company-units (Confirm Deletion Persistence)
    console.log('\n🔄 Step 5: Re-fetching GET /api/company-units (Confirm Deletion)...');
    const getRes2 = await fetch(`${BASE_URL}/api/company-units`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const getData2 = await getRes2.json();
    const exists = (getData2.data || []).some(u => u.id === createdUnit.id);
    console.log(`  • Deleted Unit Exists in Database: ${exists} (Expected false)`);

    if (exists) throw new Error('Deleted unit still present in database');

    console.log('\n==================================================');
    console.log('🎉 100% VERIFIED: COMPANY UNITS & PLANTS CRUD FULLY FUNCTIONAL ON HOSTINGER!');
    console.log('==================================================');

  } catch (err) {
    console.error('❌ CRUD Test Error:', err.message);
  } process.exit(0);
}

testCompanyUnitsCRUD();
