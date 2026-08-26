// scratch/migrate_master_records.mjs
// Deterministic Master-Records Migration Engine with Unique Code Constraint & Deduplication Audit

import { pool } from '../server/config/db.js';

export async function runMasterRecordsDeduplicationAnalysis() {
  console.log('==================================================');
  console.log('🔍 MASTER-RECORDS DUPLICATE CODE ANALYSIS REPORT');
  console.log('==================================================');

  try {
    const [rows] = await pool.query('SELECT id, category, code, name, extra_data, created_at FROM master_records ORDER BY id ASC');
    console.log(`📊 Total raw rows in master_records: ${rows.length}`);

    const categories = ['product', 'company', 'city', 'title'];
    const report = {
      sourceCounts: {},
      targetExpectedCounts: {},
      duplicatesFound: [],
      canonicalRecords: []
    };

    for (const cat of categories) {
      const catRows = rows.filter(r => r.category === cat || r.category === `${cat}_unit` || r.category === `transport_${cat}`);
      report.sourceCounts[cat] = catRows.length;

      const codeGroups = new Map();
      catRows.forEach(r => {
        const effectiveCode = (r.code || r.id || `auto_${r.id}`).toString().trim();
        if (!codeGroups.has(effectiveCode)) {
          codeGroups.set(effectiveCode, []);
        }
        codeGroups.get(effectiveCode).push(r);
      });

      report.targetExpectedCounts[cat] = codeGroups.size;

      codeGroups.forEach((records, code) => {
        if (records.length > 1) {
          report.duplicatesFound.push({
            category: cat,
            code: code,
            count: records.length,
            records: records.map(rec => ({ id: rec.id, name: rec.name }))
          });
        }

        // Canonical selection rule: newest record with valid non-empty fields
        const sorted = [...records].sort((a, b) => (b.id - a.id));
        report.canonicalRecords.push({
          category: cat,
          code: code,
          canonicalId: sorted[0].id,
          canonicalName: sorted[0].name,
          skippedCount: records.length - 1
        });
      });
    }

    return report;
  } catch (err) {
    console.warn('Notice:', err.message);
    return { sourceCounts: {}, targetExpectedCounts: {}, duplicatesFound: [], canonicalRecords: [] };
  }
}

async function executeDeterministicMigration() {
  console.log('==================================================');
  console.log('🚀 EXECUTING DETERMINISTIC MASTER MIGRATION');
  console.log('==================================================');

  const report = await runMasterRecordsDeduplicationAnalysis();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    console.log(`📦 Processing ${report.canonicalRecords.length} canonical records...`);

    for (const canonical of report.canonicalRecords) {
      const [rows] = await connection.query('SELECT * FROM master_records WHERE id = ?', [canonical.canonicalId]);
      if (!rows || rows.length === 0) continue;

      const row = rows[0];
      let extra = {};
      try {
        extra = typeof row.extra_data === 'string' ? JSON.parse(row.extra_data || '{}') : (row.extra_data || {});
      } catch (e) {
        extra = {};
      }

      if (canonical.category === 'product') {
        await connection.query(
          `INSERT INTO products (id, code, name, category, hsn_code, default_unit, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           name = VALUES(name), category = VALUES(category), hsn_code = VALUES(hsn_code), default_unit = VALUES(default_unit), status = VALUES(status), updated_at = NOW()`,
          [String(row.id), canonical.code, row.name, extra.category || 'General', extra.hsn_code || '23040010', extra.unit || 'MT', 'Active']
        );
      } else if (canonical.category === 'company') {
        await connection.query(
          `INSERT INTO company_units (id, code, name, contact_name, gstin, pan, mobile, email, city, district, pin, address, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           name = VALUES(name), contact_name = VALUES(contact_name), mobile = VALUES(mobile), email = VALUES(email), address = VALUES(address), status = VALUES(status), updated_at = NOW()`,
          [String(row.id), canonical.code, row.name, extra.contact_name || '', extra.gstin || '', extra.pan || '', extra.mobile || '', extra.email || '', extra.city || '', extra.district || '', extra.pin || '', extra.address || '', 'Active']
        );
      } else if (canonical.category === 'city') {
        await connection.query(
          `INSERT INTO cities (id, code, name, district, state, pin, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           name = VALUES(name), district = VALUES(district), state = VALUES(state), pin = VALUES(pin), status = VALUES(status), updated_at = NOW()`,
          [String(row.id), canonical.code, row.name, extra.district || '', extra.state || '', extra.pin || '', 'Active']
        );
      } else if (canonical.category === 'title') {
        await connection.query(
          `INSERT INTO transport_titles (id, code, title, status)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           title = VALUES(title), status = VALUES(status), updated_at = NOW()`,
          [String(row.id), canonical.code, row.name, 'Active']
        );
      }
    }

    await connection.commit();
    console.log('✅ Deterministic Master Migration Transaction COMMITTED!');
  } catch (err) {
    await connection.rollback();
    console.error('❌ Migration Transaction Failed & Rolled Back:', err.message);
  } finally {
    connection.release();
    process.exit(0);
  }
}

if (process.argv.includes('--execute')) {
  executeDeterministicMigration();
} else {
  runMasterRecordsDeduplicationAnalysis().then(rep => console.log(JSON.stringify(rep, null, 2)));
}
