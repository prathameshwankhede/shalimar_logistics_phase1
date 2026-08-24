// scratch/test_live_supabase.node.cjs
// Test live connection to Supabase Cloud DB and save a test bid row!

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uqqdxjprkjxgddmsoxia.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxcWR4anBya2p4Z2RkbXNveGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzODU0NDAsImV4cCI6MjA1NTk2MTQ0MH0.z8bM7p1P-XnJ9xV2wZ3j7k_0Q-yN5m1lK4o9p-r1s';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const CLOUD_ROW_ID = 'transflow-live-prod-v3';

async function runTest() {
  console.log('📡 Fetching current Cloud DB row from Supabase...');
  const { data, error } = await supabase
    .from('app_database')
    .select('data')
    .eq('id', CLOUD_ROW_ID)
    .maybeSingle();

  if (error) {
    console.error('❌ Supabase fetch error:', error);
    process.exit(1);
  }

  console.log('✅ Current Cloud DB row fetched successfully!');
  const dbData = data ? data.data : {};
  console.log('Rate Requests count:', (dbData.rate_requests || []).length);
  console.log('Rate Submissions count:', (dbData.rate_submissions || []).length);

  // Test inserting a test bid submission
  const testSub = {
    id: `sub_test_${Date.now()}`,
    rate_request_id: 'test_req_1',
    transporter_id: 'S001',
    rate_per_unit: 2500,
    total_estimated_amount: 25000,
    transit_days: 2,
    notes: 'Test bid persistence',
    status: 'Submitted',
    submitted_at: new Date().toISOString()
  };

  const updatedSubmissions = [testSub, ...(dbData.rate_submissions || [])];
  const updatedDbData = {
    ...dbData,
    rate_submissions: updatedSubmissions,
    _updatedAt: Date.now()
  };

  console.log('\n📡 Saving updated DB with new test bid to Supabase...');
  const { data: resData, error: saveError } = await supabase
    .from('app_database')
    .upsert(
      {
        id: CLOUD_ROW_ID,
        data: updatedDbData,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'id' }
    )
    .select();

  if (saveError) {
    console.error('❌ Supabase SAVE ERROR:', saveError);
    process.exit(1);
  }

  console.log('✅ Save succeeded! Returned row:', resData ? 'YES' : 'NO');

  // Verify fetch back
  console.log('\n📡 Verifying fetch back from Supabase Cloud...');
  const { data: verifyData } = await supabase
    .from('app_database')
    .select('data')
    .eq('id', CLOUD_ROW_ID)
    .maybeSingle();

  const verifySubs = verifyData?.data?.rate_submissions || [];
  const found = verifySubs.some(s => s.id === testSub.id);

  if (found) {
    console.log('🎉 VERIFICATION SUCCESS: Test bid persisted in Supabase Cloud DB!');
    
    // Clean up test bid so database remains clean
    const cleanedSubs = verifySubs.filter(s => s.id !== testSub.id);
    await supabase.from('app_database').upsert({
      id: CLOUD_ROW_ID,
      data: { ...verifyData.data, rate_submissions: cleanedSubs },
      updated_at: new Date().toISOString()
    });
    console.log('🧹 Test bid cleaned up cleanly.');
  } else {
    console.error('❌ VERIFICATION FAILED: Test bid NOT found after save!');
    process.exit(1);
  }
}

runTest();
