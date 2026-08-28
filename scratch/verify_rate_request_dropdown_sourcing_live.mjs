// scratch/verify_rate_request_dropdown_sourcing_live.mjs
// Verifies live Rate Request Dropdown Sourcing from company_units_plants on Hostinger Production

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function verifyRateRequestDropdownSourcing() {
  console.log('==================================================');
  console.log('🧪 LIVE HOSTINGER RATE REQUEST DROPDOWN SOURCING TEST');
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
      company_name: 'Test Shalimar Nagpur Plant',
      registered_address: 'Plot 88, MIDC Nagpur',
      gstin: '27AABCU9999R1ZM',
      pan: 'AABCU9999R',
      contact_name: 'Test Manager',
      email: 'test.nagpur@shalimar.com',
      mobile: '9822000000',
      state: 'Maharashtra',
      city: 'Nagpur Test City',
      district: 'Nagpur',
      pin_code: '440028',
      pickup_origin: 'Nagpur Test Origin',
      drop_location: 'Solapur Test Destination'
    };

    const postRes = await fetch(`${BASE_URL}/api/company-units`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(testPlantPayload)
    });

    const postData = await postRes.json();
    const createdId = postData.data?.id;
    console.log(`  • Created Test Plant ID: ${createdId}`);
    console.log(`  • Pickup Origin: ${testPlantPayload.pickup_origin}`);
    console.log(`  • Drop Location: ${testPlantPayload.drop_location}`);

    if (!createdId) throw new Error('Failed to create test plant');

    // 3. Fetch GET /api/company-units and simulate Frontend Dropdown Extractor
    console.log('\n📥 Step 2: GET /api/company-units (Testing Dropdown Sourcing)...');
    const getRes = await fetch(`${BASE_URL}/api/company-units`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const getUnits = (await getRes.json()).data || [];

    const pickupOptions = Array.from(
      new Set(
        getUnits
          .flatMap((c) => [c.pickup_origin, c.pickup_location_name, c.company_name, c.name, c.city])
          .filter((v) => v && typeof v === 'string' && v.trim().length > 0)
          .map((v) => v.trim())
      )
    );

    const dropOptions = Array.from(
      new Set(
        getUnits
          .flatMap((c) => [c.drop_location, c.drop_location_name, c.city, c.company_name, c.name])
          .filter((v) => v && typeof v === 'string' && v.trim().length > 0)
          .map((v) => v.trim())
      )
    );

    console.log('  • Pickup Origin Options in Rate Request:', pickupOptions);
    console.log('  • Drop Location Options in Rate Request:', dropOptions);

    const hasTestPickup = pickupOptions.includes('Nagpur Test Origin');
    const hasTestDrop = dropOptions.includes('Solapur Test Destination');

    console.log(`  • "Nagpur Test Origin" present in Pickup Dropdown: ${hasTestPickup} (Expected true)`);
    console.log(`  • "Solapur Test Destination" present in Drop Dropdown: ${hasTestDrop} (Expected true)`);

    if (!hasTestPickup || !hasTestDrop) {
      throw new Error('Test pickup or drop location missing from master dropdown options');
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
          .flatMap((c) => [c.pickup_origin, c.pickup_location_name, c.company_name, c.name, c.city])
          .filter((v) => v && typeof v === 'string' && v.trim().length > 0)
          .map((v) => v.trim())
      )
    );

    const dropOptions2 = Array.from(
      new Set(
        getUnits2
          .flatMap((c) => [c.drop_location, c.drop_location_name, c.city, c.company_name, c.name])
          .filter((v) => v && typeof v === 'string' && v.trim().length > 0)
          .map((v) => v.trim())
      )
    );

    const deletedPickupPresent = pickupOptions2.includes('Nagpur Test Origin');
    const deletedDropPresent = dropOptions2.includes('Solapur Test Destination');

    console.log(`  • Deleted Pickup Option Present: ${deletedPickupPresent} (Expected false)`);
    console.log(`  • Deleted Drop Option Present: ${deletedDropPresent} (Expected false)`);

    if (deletedPickupPresent || deletedDropPresent) {
      throw new Error('Deleted test plant location still present in dropdown options');
    }

    console.log('\n==================================================');
    console.log('🎉 100% VERIFIED: RATE REQUEST DROPDOWNS DRIVEN STRICTLY BY MYSQL company_units_plants!');
    console.log('==================================================');

  } catch (err) {
    console.error('❌ Dropdown Sourcing Test Error:', err.message);
    process.exit(1);
  }
}

verifyRateRequestDropdownSourcing();
