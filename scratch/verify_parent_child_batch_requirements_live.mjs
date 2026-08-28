// scratch/verify_parent_child_batch_requirements_live.mjs
// Verifies live Parent-Child Batch Requirement architecture on Hostinger Production

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function testParentChildBatchRequirements() {
  console.log('==================================================');
  console.log('🧪 LIVE HOSTINGER PARENT-CHILD BATCH REQUIREMENT TEST');
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

    // 2. POST /api/requirements (1 Batch Broadcast with 3 Cargo Rows)
    console.log('\n➕ Step 1: POST /api/requirements (Creating 1 Batch with 3 Cargo Lines)...');
    const batchPayload = {
      pickup_origin: 'indor',
      drop_location: 'pune',
      target_date: '2026-08-30',
      items: [
        { product_name: 'Product A (Soybean Oil)', quantity_mt: 100 },
        { product_name: 'Product B (Crude Palm Oil)', quantity_mt: 220 },
        { product_name: 'Product C (De-Oiled Cake)', quantity_mt: 300 }
      ]
    };

    const postRes = await fetch(`${BASE_URL}/api/requirements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(batchPayload)
    });

    const postData = await postRes.json();
    console.log(`  • Status: ${postRes.status}`);
    console.log(`  • Response Message: ${postData.message}`);

    const createdReq = postData.data || postData.requirement;
    console.log(`  • Generated Parent REQ_NO: ${createdReq?.req_no}`);
    console.log(`  • Total Child Items Count: ${createdReq?.items?.length} (Expected 3)`);
    console.log(`  • Calculated Total Quantity: ${createdReq?.total_quantity_mt} MT (Expected 620)`);

    if (!postRes.ok || createdReq?.items?.length !== 3 || Number(createdReq?.total_quantity_mt) !== 620) {
      throw new Error('Batch requirement creation failed! Parent-child structure invalid.');
    }

    // 3. GET /api/requirements (Verify Directory Row Count & Item Persistence)
    console.log('\n📥 Step 2: GET /api/requirements (Verifying 1 Directory Parent Row)...');
    const getRes = await fetch(`${BASE_URL}/api/requirements`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const getData = await getRes.json();
    const allRequirements = getData.data || [];
    const foundParent = allRequirements.find(r => r.id === createdReq.id);

    console.log(`  • Parent REQ found in database: ${Boolean(foundParent)} (Expected true)`);
    console.log(`  • Child Cargo Items count: ${foundParent?.items?.length} (Expected 3)`);
    console.log(`  • Total Tonnage: ${foundParent?.total_quantity_mt} MT (Expected 620)`);

    if (!foundParent || foundParent.items.length !== 3 || Number(foundParent.total_quantity_mt) !== 620) {
      throw new Error('GET /api/requirements parent-child verification failed!');
    }

    // 4. PUT /api/requirements/:id (Edit Product B Quantity: 220 -> 250 MT)
    console.log(`\n✏️ Step 3: PUT /api/requirements/${createdReq.id} (Update Product B Quantity: 220 -> 250 MT)...`);
    const updatedItems = createdReq.items.map(item => {
      if (item.product_name.includes('Product B')) {
        return { ...item, quantity_mt: 250 };
      }
      return item;
    });

    const putPayload = {
      ...createdReq,
      items: updatedItems
    };

    const putRes = await fetch(`${BASE_URL}/api/requirements/${createdReq.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(putPayload)
    });

    const putData = await putRes.json();
    const updatedReq = putData.data;
    console.log(`  • Status: ${putRes.status}`);
    console.log(`  • Updated Total Quantity MT: ${updatedReq?.total_quantity_mt} MT (Expected 650)`);

    if (!putRes.ok || Number(updatedReq?.total_quantity_mt) !== 650) {
      throw new Error('Requirement edit failed! Updated tonnage incorrect.');
    }

    // 5. DELETE /api/requirements/:id (Delete Parent & All Child Items)
    console.log(`\n🗑️ Step 4: DELETE /api/requirements/${createdReq.id} (Delete Batch REQ)...`);
    const delRes = await fetch(`${BASE_URL}/api/requirements/${createdReq.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const delData = await delRes.json();
    console.log(`  • Status: ${delRes.status}`);
    console.log(`  • Response Message: ${delData.message}`);

    if (!delRes.ok) throw new Error('Requirement deletion failed');

    // 6. GET /api/requirements (Confirm Disappearance)
    console.log('\n🔄 Step 5: Re-fetching GET /api/requirements (Confirm Total Removal)...');
    const getRes2 = await fetch(`${BASE_URL}/api/requirements`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const getData2 = await getRes2.json();
    const exists = (getData2.data || []).some(r => r.id === createdReq.id);
    console.log(`  • Parent REQ exists in database: ${exists} (Expected false)`);

    if (exists) throw new Error('Deleted parent requirement still exists in database!');

    console.log('\n==================================================');
    console.log('🎉 100% VERIFIED: ONE BATCH BROADCAST = ONE REQ NUMBER WITH MULTIPLE CARGO LINES!');
    console.log('==================================================');

  } catch (err) {
    console.error('❌ Parent-Child Batch Test Error:', err.message);
    process.exit(1);
  }
}

testParentChildBatchRequirements();
