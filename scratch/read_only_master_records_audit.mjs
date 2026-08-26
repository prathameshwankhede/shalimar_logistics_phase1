// scratch/read_only_master_records_audit.mjs
// Strictly READ-ONLY Master Records Inspection Script (SELECT ONLY)

import { pool } from '../server/config/db.js';

async function performReadOnlyProductionAudit() {
  console.log('==================================================');
  console.log('🔍 PRODUCTION READ-ONLY MASTER-RECORDS AUDIT');
  console.log('==================================================');

  try {
    // 1. Query master_records
    const [rows] = await pool.query('SELECT id, category, code, name, extra_data, created_at FROM master_records ORDER BY id ASC');
    console.log(`📊 Total raw rows in master_records: ${rows.length}`);

    const categoriesMap = {
      product: rows.filter(r => r.category === 'product'),
      company: rows.filter(r => r.category === 'company' || r.category === 'company_unit'),
      city: rows.filter(r => r.category === 'city'),
      title: rows.filter(r => r.category === 'title' || r.category === 'transport_title')
    };

    const catReport = {};

    for (const [catName, catRows] of Object.entries(categoriesMap)) {
      const codeMap = new Map();
      catRows.forEach(r => {
        const codeKey = (r.code || r.id || `auto_${r.id}`).toString().trim();
        if (!codeMap.has(codeKey)) {
          codeMap.set(codeKey, []);
        }
        codeMap.get(codeKey).push(r);
      });

      const duplicates = [];
      let duplicateRowCount = 0;

      codeMap.forEach((group, codeKey) => {
        if (group.length > 1) {
          duplicateRowCount += (group.length - 1);

          // Canonical ranking: created_at DESC, id DESC
          const sorted = [...group].sort((a, b) => {
            const tA = a.created_at ? new Date(a.created_at).getTime() : a.id;
            const tB = b.created_at ? new Date(b.created_at).getTime() : b.id;
            return tB !== tA ? tB - tA : b.id - a.id;
          });

          const canonical = sorted[0];
          const skipped = sorted.slice(1);

          duplicates.push({
            code: codeKey,
            totalRows: group.length,
            records: group.map(g => ({
              id: g.id,
              name: g.name,
              created_at: g.created_at || 'N/A',
              is_canonical: g.id === canonical.id ? 'YES' : 'NO'
            })),
            canonicalId: canonical.id,
            skippedIds: skipped.map(s => s.id)
          });
        }
      });

      catReport[catName] = {
        totalSourceRows: catRows.length,
        uniqueCodeCount: codeMap.size,
        duplicateCodeCount: duplicates.length,
        duplicateRowCount: duplicateRowCount,
        duplicates: duplicates
      };
    }

    // 2. Query target tables row counts and schema constraints
    const targetTables = ['products', 'company_units', 'cities', 'transport_titles'];
    const targetCounts = {};

    for (const tbl of targetTables) {
      try {
        const [res] = await pool.query(`SELECT COUNT(*) AS count FROM ${tbl}`);
        targetCounts[tbl] = res[0].count;
      } catch (err) {
        targetCounts[tbl] = 'Table not initialized or empty';
      }
    }

    console.log('\n==================================================');
    console.log('📊 AUDIT SUMMARY PAYLOAD:');
    console.log('==================================================');
    console.log(JSON.stringify({ categoryReport: catReport, targetCounts }, null, 2));

  } catch (err) {
    console.error('❌ Read-Only Audit Warning:', err.message);
  } finally {
    process.exit(0);
  }
}

performReadOnlyProductionAudit();
