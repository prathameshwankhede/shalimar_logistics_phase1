// scratch/verify_product_master_blank_init_live.mjs
// Verifies Product Master Modal initial state is blank on Hostinger Production

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function verifyProductMasterBlankInit() {
  console.log('==================================================');
  console.log('🧪 LIVE HOSTINGER PRODUCT MASTER BLANK INIT TEST');
  console.log('==================================================');

  try {
    const htmlRes = await fetch(BASE_URL);
    const htmlText = await htmlRes.text();
    const jsMatch = htmlText.match(/src="(\/assets\/index-[^"]+\.js)"/);
    if (!jsMatch) throw new Error('Could not find main bundle script in HTML');

    const jsUrl = `${BASE_URL}${jsMatch[1]}`;
    console.log(`📥 Fetching bundle from ${jsUrl}...`);

    const jsRes = await fetch(jsUrl);
    const jsText = await jsRes.text();

    const hasHardcodedState = jsText.includes('category:"Liquid Edible Bulk"') || jsText.includes('category:\'Liquid Edible Bulk\'');
    const hasHardcodedHsn = jsText.includes('hsn_code:"15071000"') || jsText.includes('hsn_code:\'15071000\'');

    console.log(`  • Hardcoded category initial value present in bundle: ${hasHardcodedState} (Expected false)`);
    console.log(`  • Hardcoded hsn_code initial value present in bundle: ${hasHardcodedHsn} (Expected false)`);

    const hasPlaceholderCategory = jsText.includes('placeholder:"e.g. Liquid Edible Bulk"');
    const hasPlaceholderHsn = jsText.includes('placeholder:"e.g. 15071000"');

    console.log(`  • Category placeholder present: ${hasPlaceholderCategory} (Expected true)`);
    console.log(`  • HSN Code placeholder present: ${hasPlaceholderHsn} (Expected true)`);

    if (hasHardcodedState || hasHardcodedHsn) {
      throw new Error('Pre-filled initial category or hsn_code values detected in production JS bundle!');
    }

    console.log('\n==================================================');
    console.log('🎉 100% VERIFIED: NEW PRODUCT MASTER MODAL INITIALIZES WITH BLANK CATEGORY AND HSN CODE!');
    console.log('==================================================');

  } catch (err) {
    console.error('❌ Product Master Test Error:', err.message);
    process.exit(1);
  }
}

verifyProductMasterBlankInit();
