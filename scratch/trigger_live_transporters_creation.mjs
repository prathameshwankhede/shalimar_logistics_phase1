// scratch/trigger_live_transporters_creation.mjs
// Triggers isolated DDL execution for Table: transporters ONLY on Hostinger Production

const HOSTINGER_TRANSPORTERS_URL = 'https://lightslategray-gazelle-919724.hostingersite.com/api/admin/create-transporters-table';

async function triggerLiveTransportersCreation() {
  console.log('==================================================');
  console.log('🚀 EXECUTING TRANSPORTERS DDL CREATION ON HOSTINGER PRODUCTION');
  console.log('==================================================');

  try {
    console.log(`💥 Posting to Endpoint: ${HOSTINGER_TRANSPORTERS_URL}`);
    const creationRes = await fetch(HOSTINGER_TRANSPORTERS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const status = creationRes.status;
    const data = await creationRes.json();

    console.log(`\n📊 HTTP Status: ${status}`);
    console.log('📊 Verification Report:');
    console.log(JSON.stringify(data, null, 2));

    if (status === 200 && data.success) {
      console.log('\n🎉 PRODUCTION TRANSPORTERS TABLE CREATION COMPLETED SUCCESSFULLY!');
    } else {
      console.error('\n❌ TRANSPORTERS TABLE CREATION RETURNED ERROR:', data);
    }

  } catch (err) {
    console.error('❌ Network / HTTP Request Error:', err.message);
  } finally {
    process.exit(0);
  }
}

triggerLiveTransportersCreation();
