// scratch/verify_id_and_data_level_backup.mjs
// Strict ID-Level and Data-Level Comparison Verification Suite (Read-Only)

const BASE_URL = 'https://lightslategray-gazelle-919724.hostingersite.com';

async function runIdAndDataLevelVerification() {
  console.log('==================================================');
  console.log('🧪 STRICT ID-LEVEL & DATA-LEVEL MYSQL BACKUP VERIFICATION');
  console.log('==================================================');

  // 1. Authenticate Admin
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const token = (await loginRes.json()).token;
  console.log('✅ Admin Authenticated via JWT Token.');

  // 2. Fetch Live MySQL Database State via API report
  console.log('\n📡 Step 1: Fetching Actual Live MySQL Table Records...');
  const reportRes = await fetch(`${BASE_URL}/api/backup/report`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const reportJson = await reportRes.json();
  const dbName = reportJson.database || 'u704836459_shalimar_logi';
  console.log(`  • Connected Database: ${dbName}`);

  const mysqlData = reportJson.data || {};
  
  // 3. Download Full Database Backup (.sql)
  console.log('\n📥 Step 2: Downloading GET /api/backup/full (.sql)...');
  const backupRes = await fetch(`${BASE_URL}/api/backup/full`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('  • Backup HTTP Status:', backupRes.status);
  const sqlText = await backupRes.text();
  console.log('  • Downloaded .sql Size:', sqlText.length, 'bytes');

  // 4. Parse INSERT Statements from SQL text into JS objects per table
  const backupData = {
    transporters: [],
    company_units_plants: [],
    products: [],
    transport_requirements: [],
    transport_requirement_items: []
  };

  const lines = sqlText.split('\n');
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('INSERT INTO')) return;

    // Match INSERT INTO `table_name` (`col1`, `col2`, ...) VALUES (val1, val2, ...);
    const tableMatch = trimmed.match(/INSERT INTO `([^`]+)` \(([^)]+)\) VALUES \((.+)\);/);
    if (!tableMatch) return;

    const tableName = tableMatch[1];
    const cols = tableMatch[2].split(',').map(c => c.trim().replace(/`/g, ''));
    const rawValsStr = tableMatch[3];

    // Naive split by comma (respecting quoted strings)
    const vals = [];
    let currentVal = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < rawValsStr.length; i++) {
      const char = rawValsStr[i];
      if (inQuotes) {
        if (char === quoteChar && rawValsStr[i - 1] !== '\\') {
          inQuotes = false;
        }
        currentVal += char;
      } else {
        if (char === "'" || char === '"') {
          inQuotes = true;
          quoteChar = char;
          currentVal += char;
        } else if (char === ',') {
          vals.push(currentVal.trim());
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
    }
    if (currentVal) vals.push(currentVal.trim());

    // Clean value strings
    const cleanVals = vals.map(v => {
      if (v === 'NULL') return null;
      if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
      if (!isNaN(Number(v))) return Number(v);
      return v;
    });

    const rowObj = {};
    cols.forEach((col, idx) => {
      rowObj[col] = cleanVals[idx];
    });

    if (backupData[tableName]) {
      backupData[tableName].push(rowObj);
    }
  });

  // 5. Detailed ID & Field Comparison
  console.log('\n==================================================');
  console.log('📊 ID-LEVEL & DATA-LEVEL COMPARISON RESULTS');
  console.log('==================================================');

  const comparisonTable = [];
  const targetTables = ['transporters', 'company_units_plants', 'products', 'transport_requirements', 'transport_requirement_items'];
  let overallSuccess = true;

  targetTables.forEach(tbl => {
    const liveRows = mysqlData[tbl] || [];
    const exportedRows = backupData[tbl] || [];

    const liveIds = new Set(liveRows.map(r => String(r.id)));
    const exportedIds = new Set(exportedRows.map(r => String(r.id)));

    let missingCount = 0;
    let extraCount = 0;
    let fieldMismatch = false;

    // Check missing
    liveRows.forEach(lRow => {
      const lid = String(lRow.id);
      if (!exportedIds.has(lid)) {
        missingCount++;
        console.error(`  ❌ Table \`${tbl}\`: Record ID ${lid} MISSING from .sql backup!`);
      } else {
        // Field comparison
        const eRow = exportedRows.find(e => String(e.id) === lid);
        if (tbl === 'transport_requirements') {
          if (lRow.req_no && String(lRow.req_no) !== String(eRow.req_no)) fieldMismatch = true;
          if (lRow.pickup_origin && String(lRow.pickup_origin) !== String(eRow.pickup_origin)) fieldMismatch = true;
          if (lRow.drop_location && String(lRow.drop_location) !== String(eRow.drop_location)) fieldMismatch = true;
        } else if (tbl === 'transport_requirement_items') {
          if (lRow.requirement_id && String(lRow.requirement_id) !== String(eRow.requirement_id)) fieldMismatch = true;
          if (lRow.product_name && String(lRow.product_name) !== String(eRow.product_name)) fieldMismatch = true;
          if (lRow.quantity_mt && Number(lRow.quantity_mt) !== Number(eRow.quantity_mt)) fieldMismatch = true;
        } else if (tbl === 'products') {
          if (lRow.name && String(lRow.name) !== String(eRow.name)) fieldMismatch = true;
        } else if (tbl === 'transporters') {
          if (lRow.company_name && String(lRow.company_name) !== String(eRow.company_name)) fieldMismatch = true;
        } else if (tbl === 'company_units_plants') {
          if (lRow.company_name && String(lRow.company_name) !== String(eRow.company_name)) fieldMismatch = true;
        }
      }
    });

    // Check extra
    exportedRows.forEach(eRow => {
      const eid = String(eRow.id);
      if (!liveIds.has(eid)) {
        extraCount++;
        console.error(`  ❌ Table \`${tbl}\`: Record ID ${eid} EXTRA in .sql backup!`);
      }
    });

    const isMatched = liveRows.length === exportedRows.length && missingCount === 0 && extraCount === 0 && !fieldMismatch;
    if (!isMatched) overallSuccess = false;

    comparisonTable.push({
      table: tbl,
      mysqlRows: liveRows.length,
      backupRows: exportedRows.length,
      missingFromBackup: missingCount,
      extraInBackup: extraCount,
      dataMatch: isMatched ? 'PASS' : 'FAIL'
    });
  });

  console.table(comparisonTable);

  console.log('\n==================================================');
  if (overallSuccess) {
    console.log('🎉 ID-LEVEL & DATA-LEVEL VERIFICATION 100% PASSED!');
  } else {
    console.log('❌ ID-LEVEL VERIFICATION FAILED!');
    process.exit(1);
  }
  console.log('==================================================');
}

runIdAndDataLevelVerification().catch(err => {
  console.error('❌ ID-Level Verification Error:', err);
  process.exit(1);
});
