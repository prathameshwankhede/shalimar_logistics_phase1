// scratch/test_supabase_publishable.node.cjs
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uqqdxjprkjxgddmsoxia.supabase.co';
const supabaseKey = 'sb_publishable_qrkTb1shX49w5Z6WJMat7g_VpBfbOq2';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

async function test() {
  console.log('Testing Supabase query...');
  const { data, error } = await supabase
    .from('app_database')
    .select('data')
    .eq('id', 'transflow-live-prod-v3')
    .maybeSingle();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success! Data fetched:', Boolean(data?.data));
    if (data?.data) {
      console.log('Requests:', (data.data.rate_requests || []).length);
      console.log('Submissions:', (data.data.rate_submissions || []).length);
    }
  }
}

test();
