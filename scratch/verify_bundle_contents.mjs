// scratch/verify_bundle_contents.mjs
import fs from 'fs';
import path from 'path';

const distAssetsPath = path.resolve(process.cwd(), 'dist/assets');
const files = fs.readdirSync(distAssetsPath);
const jsFile = files.find(f => f.startsWith('index-') && f.endsWith('.js'));

console.log('==================================================');
console.log('📦 LOCAL DIST PRODUCTION BUNDLE VERIFICATION');
console.log('==================================================');
console.log(`Target Bundle File: dist/assets/${jsFile}`);

const jsContent = fs.readFileSync(path.join(distAssetsPath, jsFile), 'utf-8');

const hasTransportersApi = jsContent.includes('/api/transporters');
const hasStateApi = jsContent.includes('/api/state');
const hasLoadDbFromSupabase = jsContent.includes('loadDBFromSupabase');
const hasOldReturnLoadDb = jsContent.includes('return loadDB()') || jsContent.includes('return loadDB();');

console.log(`  • Includes '/api/transporters': ${hasTransportersApi}`);
console.log(`  • Includes '/api/state': ${hasStateApi}`);
console.log(`  • Includes 'loadDBFromSupabase': ${hasLoadDbFromSupabase}`);
console.log(`  • Contains legacy 'return loadDB()': ${hasOldReturnLoadDb}`);

if (hasTransportersApi && hasStateApi && hasLoadDbFromSupabase && !hasOldReturnLoadDb) {
  console.log('\n🎉 VERIFIED: Generated bundle contains live state & transporters hydration!');
} else {
  console.error('\n❌ FAIL: Generated bundle is missing hydration requirements.');
}
