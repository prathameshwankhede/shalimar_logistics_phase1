import { INITIAL_SEED_DATA, saveDB, loadDBFromSupabase } from '../src/store/dbStore.js';

async function testFullCrudSync() {
  console.log('--- STARTING FULL CRUD SYNC DIAGNOSTIC TEST ---');
  
  // 1. Prepare data with SYNC_TEST_LAPTOP_123
  const testDb = {
    ...INITIAL_SEED_DATA,
    transporters: [
      {
        id: 'trans_sync_test',
        company_name: 'SYNC_TEST_LAPTOP_123',
        code: 'SYNC123',
        contact_person: 'Laptop Sync Test Admin',
        mobile: '+91 99999 88888',
        email: 'synctest@transflow.com',
        address: 'Cloud Sync Test Terminal',
        gst_pan: '27SYNC1234A1Z0',
        username: 'SYNC123',
        status: 'Active'
      },
      ...INITIAL_SEED_DATA.transporters
    ]
  };

  console.log('\nStep 1: Calling saveDB() with SYNC_TEST_LAPTOP_123...');
  const savedResult = await saveDB(testDb);

  console.log('\nStep 2: Calling loadDBFromSupabase() to verify cloud retrieval...');
  const loadedResult = await loadDBFromSupabase();

  if (loadedResult && loadedResult.transporters) {
    const foundTransporter = loadedResult.transporters.find(
      (t) => t.company_name === 'SYNC_TEST_LAPTOP_123'
    );

    if (foundTransporter) {
      console.log('\n✅ VERIFICATION SUCCESSFUL!');
      console.log('Found Transporter in Supabase row transflow-main:', foundTransporter);
    } else {
      console.error('\n❌ VERIFICATION FAILED: SYNC_TEST_LAPTOP_123 not found in loaded transporters:', loadedResult.transporters);
    }
  } else {
    console.error('\n❌ VERIFICATION FAILED: loadDBFromSupabase returned null or empty result:', loadedResult);
  }
}

testFullCrudSync();
