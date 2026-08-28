// scratch/test_health.mjs
async function checkHealth() {
  const res = await fetch('https://lightslategray-gazelle-919724.hostingersite.com/api/health');
  console.log('Health Status:', res.status);
  const data = await res.json();
  console.log('Health Data:', data);
}
checkHealth();
