// scratch/verify_requirements_crud_live.mjs
// Verifies live transport_requirements MySQL table & CRUD API on Hostinger Production

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function testRequirementsCRUD() {
  console.log('==================================================');
  console.log('🧪 LIVE HOSTINGER TRANSPORT REQUIREMENTS CRUD TEST');
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

    // 2. GET /api/requirements
    console.log('\n📥 Step 1: GET /api/requirements...');
    const getRes1 = await fetch(`${BASE_URL}/api/requirements`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const getData1 = await getRes1.json();
    console.log(`  • Status: ${getRes1.status}`);
    console.log(`  • Initial Requirements Count: ${getData1.count || 0}`);

    // 3. POST /api/requirements (Bulk Create 3 Test Requirements)
    console.log('\n➕ Step 2: POST /api/requirements (Bulk 3 Test Requirements)...');
    const bulkPayload = [
      { pickup_origin: 'indor', drop_location: 'pune', product_name: 'Refined Soybean Oil', quantity_mt: 100, target_date: '2026-08-30' },
      { pickup_origin: 'nagpur', drop_location: 'mumbai', product_name: 'Soybean Meal (De-Oiled Cake)', quantity_mt: 250, target_date: '2026-09-05' },
      { pickup_origin: 'indor', drop_location: 'solapur', product_name: 'Crude Palm Oil', quantity_mt: 80, target_date: '2026-09-10' }
    ];

    const postRes = await fetch(`${BASE_URL}/api/requirements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(bulkPayload)
    });

    const postData = await postRes.json();
    console.log(`  • Status: ${postRes.status}`);
    console.log(`  • Response Message: ${postData.message}`);
    const createdList = postData.data || postData.requirements || [];
    console.log(`  • Created ${createdList.length} Requirement(s)`);

    if (!postRes.ok || createdList.length < 3) throw new Error('Bulk requirement creation failed');

    createdList.forEach((r, idx) => {
      console.log(`    Item #${idx + 1}: ID=${r.id}, REQ_NO=${r.req_no}, Route=${r.pickup_origin} ➔ ${r.drop_location}, Qty=${r.quantity_mt} MT`);
    });

    const item1 = createdList[0];
    const item3 = createdList[2];

    // 4. PUT /api/requirements/:id (Edit Item #1 Quantity to 150 MT)
    console.log(`\n✏️ Step 3: PUT /api/requirements/${item1.id} (Edit Quantity to 150 MT)...`);
    const editPayload = {
      pickup_origin: item1.pickup_origin,
      drop_location: item1.drop_location,
      product_name: item1.product_name,
      quantity_mt: 150,
      target_date: item1.target_date,
      status: 'Active'
    };

    const putRes = await fetch(`${BASE_URL}/api/requirements/${item1.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(editPayload)
    });

    const putData = await putRes.json();
    console.log(`  • Status: ${putRes.status}`);
    console.log(`  • Response Message: ${putData.message}`);
    console.log(`  • Updated Quantity MT: ${putData.data?.quantity_mt}`);

    if (Number(putData.data?.quantity_mt) !== 150) throw new Error('Requirement edit quantity failed');

    // 5. DELETE /api/requirements/:id (Delete Item #3)
    console.log(`\n🗑️ Step 4: DELETE /api/requirements/${item3.id} (Delete Item #3)...`);
    const delRes = await fetch(`${BASE_URL}/api/requirements/${item3.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const delData = await delRes.json();
    console.log(`  • Status: ${delRes.status}`);
    console.log(`  • Response Message: ${delData.message}`);

    // 6. GET /api/requirements (Verify Deletion & Update Persistence)
    console.log('\n🔄 Step 5: GET /api/requirements (Verify Refresh Persistence)...');
    const getRes2 = await fetch(`${BASE_URL}/api/requirements`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const getData2 = await getRes2.json();
    const requirements2 = getData2.data || [];

    const foundItem1 = requirements2.find(r => r.id === item1.id);
    const foundItem3 = requirements2.find(r => r.id === item3.id);

    console.log(`  • Item #1 found in database: ${Boolean(foundItem1)} (Expected true)`);
    console.log(`  • Item #1 persisted quantity: ${foundItem1?.quantity_mt} MT (Expected 150)`);
    console.log(`  • Item #3 found in database: ${Boolean(foundItem3)} (Expected false)`);

    if (!foundItem1 || Number(foundItem1.quantity_mt) !== 150 || foundItem3) {
      throw new Error('Refresh persistence failed! Data discrepancy detected.');
    }

    // 7. Cleanup remaining test items
    console.log('\n🧹 Step 6: Cleaning up remaining test items...');
    for (const item of createdList) {
      if (item.id !== item3.id) {
        await fetch(`${BASE_URL}/api/requirements/${item.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
      }
    }
    console.log('  • Test cleanup completed.');

    console.log('\n==================================================');
    console.log('🎉 100% VERIFIED: TRANSPORT REQUIREMENTS DATABASE TABLE & CRUD FULLY FUNCTIONAL ON HOSTINGER!');
    console.log('==================================================');

  } catch (err) {
    console.error('❌ Requirements CRUD Test Error:', err.message);
    process.exit(1);
  }
}

testRequirementsCRUD();
