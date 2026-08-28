// scratch/verify_products_crud_live.mjs
// Verifies live Products / Cargo Master CRUD operations on Hostinger Production

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function testProductsCRUD() {
  console.log('==================================================');
  console.log('🧪 LIVE HOSTINGER PRODUCTS / CARGO MASTER CRUD TEST');
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

    // 2. GET /api/products
    console.log('\n📥 Step 1: GET /api/products...');
    const getRes1 = await fetch(`${BASE_URL}/api/products`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const getData1 = await getRes1.json();
    console.log(`  • Status: ${getRes1.status}`);
    console.log(`  • Initial Products Count: ${getData1.count || 0}`);

    // 3. POST /api/products (Create Test Product)
    console.log('\n➕ Step 2: POST /api/products (Create Test Product)...');
    const newProductPayload = {
      name: 'Test Refined Soybean Oil (Edible)',
      category: 'Liquid Edible Bulk',
      hsn_code: '15071000',
      unit: 'MT'
    };

    const postRes = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(newProductPayload)
    });

    const postData = await postRes.json();
    console.log(`  • Status: ${postRes.status}`);
    console.log(`  • Response Message: ${postData.message}`);
    const createdProd = postData.data;
    console.log(`  • Created Product ID: ${createdProd?.id}`);
    console.log(`  • Created Name: ${createdProd?.name}`);
    console.log(`  • Category: ${createdProd?.category}`);
    console.log(`  • HSN Code: ${createdProd?.hsn_code}`);

    if (!postRes.ok || !createdProd?.id) throw new Error('Product creation failed');

    // 4. PUT /api/products/:id (Update Test Product)
    console.log(`\n✏️ Step 3: PUT /api/products/${createdProd.id} (Update Test Product)...`);
    const updatePayload = {
      ...newProductPayload,
      category: 'Edible Oils (Refined Bulk)',
      hsn_code: '15079010'
    };

    const putRes = await fetch(`${BASE_URL}/api/products/${createdProd.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(updatePayload)
    });

    const putData = await putRes.json();
    console.log(`  • Status: ${putRes.status}`);
    console.log(`  • Response Message: ${putData.message}`);
    const updatedProd = putData.data;
    console.log(`  • Updated Category: ${updatedProd?.category}`);
    console.log(`  • Updated HSN Code: ${updatedProd?.hsn_code}`);

    if (!putRes.ok) throw new Error('Product update failed');

    // 5. DELETE /api/products/:id (Delete Test Product)
    console.log(`\n🗑️ Step 4: DELETE /api/products/${createdProd.id} (Delete Test Product)...`);
    const delRes = await fetch(`${BASE_URL}/api/products/${createdProd.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const delData = await delRes.json();
    console.log(`  • Status: ${delRes.status}`);
    console.log(`  • Response Message: ${delData.message}`);

    if (!delRes.ok) throw new Error('Product deletion failed');

    // 6. GET /api/products (Confirm Deletion Persistence)
    console.log('\n🔄 Step 5: Re-fetching GET /api/products (Confirm Deletion)...');
    const getRes2 = await fetch(`${BASE_URL}/api/products`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const getData2 = await getRes2.json();
    const exists = (getData2.data || []).some(p => p.id === createdProd.id);
    console.log(`  • Deleted Product Exists in Database: ${exists} (Expected false)`);

    if (exists) throw new Error('Deleted product still present in database');

    console.log('\n==================================================');
    console.log('🎉 100% VERIFIED: PRODUCTS & CARGO MASTER CRUD FULLY FUNCTIONAL ON HOSTINGER!');
    console.log('==================================================');

  } catch (err) {
    console.error('❌ Products CRUD Test Error:', err.message);
    process.exit(1);
  }
}

testProductsCRUD();
