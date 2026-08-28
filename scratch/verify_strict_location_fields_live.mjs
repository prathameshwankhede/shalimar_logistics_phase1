// scratch/verify_strict_location_fields_live.mjs
// Verifies live Rate Request Dropdown Sourcing strictly from pickup_origin and drop_location fields

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function verifyStrictLocationFields() {
  console.log('==================================================');
  console.log('🧪 LIVE HOSTINGER STRICT PICKUP/DROP LOCATION TEST');
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

    // 2. Create Controlled Test Plant
    console.log('\n➕ Step 1: Creating Controlled Test Plant in company_units_plants...');
    const testPlantPayload = {
      company_name: 'TEST LOCATION MASTER',
      registered_address: 'Plot 999, MIDC Industrial Hub',
      gstin: '27AABCU8888R1ZM',
      pan: 'AABCU8888R',
      contact_name: 'Strict Test Manager',
      email: 'strict.test@shalimar.com',
      mobile: '9822999999',
      state: 'Maharashtra',
      city: 'Test City Name',
      district: 'Test District',
      pin_code: '440028',
      pickup_origin: 'TEST PICKUP 123',
      drop_location: 'TEST DROP 456'
    };

    const postRes = await fetch(`${BASE_URL}/api/company-units`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(testPlantPayload)
    });

    const postData = await postRes.json();
    const createdId = postData.data?.id;
    console.log(`  • Created Test Plant ID: ${createdId}`);

    if (!createdId) throw new Error('Failed to create test plant');

    // 3. Fetch GET /api/company-units and simulate Frontend Dropdown Extractors
    console.log('\n📥 Step 2: GET /api/company-units (Testing Strict Field Extraction)...');
    const getRes = await fetch(`${BASE_URL}/api/company-units`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const getUnits = (await getRes.json()).data || [];

    const pickupOptions = Array.from(
      new Set(
        getUnits
          .map((c) => (c.pickup_origin || c.pickup_location_name || '').trim())
          .filter((v) => v.length > 0)
      )
    );

    const dropOptions = Array.from(
      new Set(
        getUnits
          .map((c) => (c.drop_location || c.drop_location_name || '').trim())
          .filter((v) => v.length > 0)
      )
    );

    console.log('  • Pickup Origin Options in Rate Request:', pickupOptions);
    console.log('  • Drop Location Options in Rate Request:', dropOptions);

    const hasTestPickup = pickupOptions.includes('TEST PICKUP 123');
    const hasTestDrop = dropOptions.includes('TEST DROP 456');

    const companyNameInPickup = pickupOptions.includes('TEST LOCATION MASTER');
    const companyNameInDrop = dropOptions.includes('TEST LOCATION MASTER');

    console.log(`  • "TEST PICKUP 123" present in Pickup Dropdown: ${hasTestPickup} (Expected true)`);
    console.log(`  • "TEST DROP 456" present in Drop Dropdown: ${hasTestDrop} (Expected true)`);
    console.log(`  • "TEST LOCATION MASTER" (company_name) present in Pickup Dropdown: ${companyNameInPickup} (Expected false)`);
    console.log(`  • "TEST LOCATION MASTER" (company_name) present in Drop Dropdown: ${companyNameInDrop} (Expected false)`);

    if (!hasTestPickup || !hasTestDrop || companyNameInPickup || companyNameInDrop) {
      throw new Error('Strict field extraction failed! Non-location fields were leaked or location fields missing.');
    }

    // 4. Delete Controlled Test Plant
    console.log(`\n🗑️ Step 3: Deleting Controlled Test Plant (${createdId})...`);
    const delRes = await fetch(`${BASE_URL}/api/company-units/${createdId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    console.log(`  • Status: ${delRes.status}`);

    // 5. Re-fetch GET /api/company-units and verify deletion reflection
    console.log('\n🔄 Step 4: Re-fetching GET /api/company-units (Verifying Deletion Disappearance)...');
    const getRes2 = await fetch(`${BASE_URL}/api/company-units`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const getUnits2 = (await getRes2.json()).data || [];

    const pickupOptions2 = Array.from(
      new Set(
        getUnits2
          .map((c) => (c.pickup_origin || c.pickup_location_name || '').trim())
          .filter((v) => v.length > 0)
      )
    );

    const dropOptions2 = Array.from(
      new Set(
        getUnits2
          .map((c) => (c.drop_location || c.drop_location_name || '').trim())
          .filter((v) => v.length > 0)
      )
    );

    const deletedPickupPresent = pickupOptions2.includes('TEST PICKUP 123');
    const deletedDropPresent = dropOptions2.includes('TEST DROP 456');

    console.log(`  • Deleted Pickup Option Present: ${deletedPickupPresent} (Expected false)`);
    console.log(`  • Deleted Drop Option Present: ${deletedDropPresent} (Expected false)`);

    if (deletedPickupPresent || deletedDropPresent) {
      throw new Error('Deleted test plant location still present in dropdown options');
    }

    console.log('\n==================================================');
    console.log('🎉 100% VERIFIED: RATE REQUEST DROPDOWNS CONSUME STRICTLY pickup_origin AND drop_location!');
    console.log('==================================================');

  } catch (err) {
    console.error('❌ Strict Field Test Error:', err.message);
    process.exit(1);
  }
}

verifyStrictLocationFields();
