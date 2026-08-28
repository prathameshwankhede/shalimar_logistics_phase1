// scratch/inspect_bundle_strings.mjs
const JS_URL = 'https://lightslategray-gazelle-919724.hostingersite.com/assets/index-BRr15DuM.js';

async function inspectBundle() {
  console.log('==================================================');
  console.log('🔍 SEARCHING LIVE FRONTEND BUNDLE FOR ACTION ENDPOINTS');
  console.log('==================================================');

  const res = await fetch(JS_URL);
  const code = await res.text();

  console.log(`Bundle Size: ${code.length} bytes`);
  console.log(`Includes '/api/transporters/status': ${code.includes('/api/transporters/status')}`);
  console.log(`Includes '/api/transporters/reset-password': ${code.includes('/api/transporters/reset-password')}`);
  console.log(`Includes 'updateTransporterStatus': ${code.includes('updateTransporterStatus')}`);
  console.log(`Includes 'resetTransporterPassword': ${code.includes('resetTransporterPassword')}`);
  console.log(`Includes 'TOGGLE_TRANSPORTER_STATUS': ${code.includes('TOGGLE_TRANSPORTER_STATUS')}`);
  console.log(`Includes 'handleToggleTransporterStatus': ${code.includes('handleToggleTransporterStatus')}`);
}

inspectBundle();
