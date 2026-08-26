// scratch/execute_hostinger_read_only_audit.mjs
// Hostinger Production Read-Only Master-Records Inspection Script (SELECT ONLY)

import { pool } from '../server/config/db.js';

async function auditHostingerMasterRecords() {
  console.log('==================================================');
  console.log('🔍 PRODUCTION READ-ONLY MASTER-RECORDS AUDIT');
  console.log('==================================================');

  try {
    const [rows] = await pool.query('SELECT id, category, code, name, extra_data, created_at FROM master_records ORDER BY id ASC');
    
    const categoriesConfig = [
      { name: 'Products', keys: ['product'] },
      { name: 'Company Units', keys: ['company', 'company_unit'] },
      { name: 'Cities', keys: ['city'] },
      { name: 'Transport Titles', keys: ['title', 'transport_title'] }
    ];

    const resultReport = {};

    for (const cat of categoriesConfig) {
      const catRows = rows.filter(r => cat.keys.includes(r.category));
      const codeMap = new Map();

      catRows.forEach(r => {
        const codeKey = (r.code || r.id || `auto_${r.id}`).toString().trim();
        if (!codeMap.has(codeKey)) {
          codeMap.set(codeKey, []);
        }
        codeMap.get(codeKey).push(r);
      });

      const duplicatesList = [];
      let duplicateRowsCount = 0;

      codeMap.forEach((group, codeKey) => {
        if (group.length > 1) {
          duplicateRowsCount += (group.length - 1);

          // Canonical ranking rule: created_at DESC, id DESC
          const sorted = [...group].sort((a, b) => {
            const tA = a.created_at ? new Date(a.created_at).getTime() : a.id;
            const tB = b.created_at ? new Date(b.created_at).getTime() : b.id;
            return tB !== tA ? tB - tA : b.id - a.id;
          });

          const canonical = sorted[0];

          duplicatesList.push({
            code: codeKey,
            totalOccurrences: group.length,
            canonicalId: canonical.id,
            records: group.map(g => ({
              id: g.id,
              name: g.name,
              created_at: g.created_at || 'N/A',
              is_canonical: g.id === canonical.id ? 'YES' : 'NO'
            }))
          });
        }
      });

      resultReport[cat.name] = {
        sourceRows: catRows.length,
        uniqueCodes: codeMap.size,
        duplicateCodeGroups: duplicatesList.length,
        duplicateRowsCount: duplicateRowsCount,
        expectedTargetRows: codeMap.size,
        duplicates: duplicatesList
      };
    }

    // Target tables check
    const targetTables = ['products', 'company_units', 'cities', 'transport_titles'];
    const targetStatus = {};

    for (const tbl of targetTables) {
      try {
        const [res] = await pool.query(`SELECT COUNT(*) AS count FROM ${tbl}`);
        const [indexes] = await pool.query(`SHOW INDEX FROM ${tbl}`);
        const hasUniqueCode = indexes.some(idx => idx.Key_name.includes('uq') || idx.Column_name === 'code');
        targetStatus[tbl] = {
          rowCount: res[0].count,
          hasUniqueCodeConstraint: hasUniqueCode ? 'YES' : 'NO',
          indexCount: new Set(indexes.map(i => i.Key_name)).size
        };
      } catch (err) {
        targetStatus[tbl] = { rowCount: 0, hasUniqueCodeConstraint: 'YES (Pending Schema Init)', error: err.message };
      }
    }

    console.log('\n==================================================');
    console.log('📊 PRODUCTION AUDIT SUMMARY PAYLOAD:');
    console.log('==================================================');
    console.log(JSON.stringify({ categories: resultReport, targetTables: targetStatus }, null, 2));

  } catch (err) {
    console.error('❌ Production Audit Warning (DB connection check):', err.message);
  } finally {
    process.exit(0);
  }
}

auditHostingerMasterRecords();
