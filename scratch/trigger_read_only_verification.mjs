// scratch/trigger_read_only_verification.mjs
// Authenticates with Hostinger Production API and triggers Read-Only Database Verification

const HOSTINGER_LOGIN_URL = 'https://lightslategray-gazelle-919724.hostingersite.com/api/auth/login';
const HOSTINGER_VERIFY_URL = 'https://lightslategray-gazelle-919724.hostingersite.com/api/admin/verify-no-auto-recreation';

async function triggerReadOnlyVerification() {
  console.log('==================================================');
  console.log('🔍 READ-ONLY VERIFICATION AUDIT ON HOSTINGER PRODUCTION');
  console.log('==================================================');

  try {
    console.log(`🔍 Querying Endpoint: ${HOSTINGER_VERIFY_URL}`);
    const verifyRes = await fetch(HOSTINGER_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const verifyStatus = verifyRes.status;
    const verifyData = await verifyRes.json();

    console.log(`\n📊 HTTP Status: ${verifyStatus}`);
    console.log('📊 Verification Audit Report:');
    console.log(JSON.stringify(verifyData, null, 2));

    if (verifyStatus === 200 && verifyData.success) {
      console.log('\n🎉 READ-ONLY AUDIT VERIFIED SUCCESSFULLY!');
    } else {
      console.error('\n❌ VERIFICATION AUDIT FAILED:', verifyData);
    }

  } catch (err) {
    console.error('❌ Network / HTTP Request Error:', err.message);
  } finally {
    process.exit(0);
  }
}

triggerReadOnlyVerification();
