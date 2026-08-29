const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function measureLatency() {
  console.log('==================================================');
  console.log('⚡ TESTING LIVE PRODUCTION API REFRESH LATENCY');
  console.log('==================================================');

  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/requirements?_t=${start}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    const elapsed = Date.now() - start;
    const json = await res.json();

    console.log(`HTTP Status: ${res.status}`);
    console.log(`Cache-Control Header: ${res.headers.get('cache-control')}`);
    console.log(`Requirements Count: ${(json.data || json.requirements || []).length}`);
    console.log(`⏱️ Latency (MYSQL_TO_UI_REFRESH): ${elapsed} ms`);

    if (elapsed < 2000) {
      console.log('✅ PASS: Latency is under 2000 ms (< 2 seconds)!');
    } else {
      console.error('❌ FAIL: Latency exceeded 2000 ms!');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error measuring latency:', err.message);
    process.exit(1);
  }
}

measureLatency();
