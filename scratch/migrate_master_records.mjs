// scratch/migrate_master_records.mjs
// Migration Script: Map master_records into dedicated relational tables (products, company_units, cities, transport_titles)

import { pool } from '../server/config/db.js';

async function migrateMasterRecords() {
  console.log('==================================================');
  console.log('🔄 MASTER-RECORDS RELATIONAL TABLE MIGRATION ENGINE');
  console.log('==================================================');

  try {
    const [rows] = await pool.query('SELECT id, category, code, name, extra_data FROM master_records');
    console.log(`📊 Found ${rows.length} records in legacy master_records table.`);

    const products = rows.filter(r => r.category === 'product');
    const companyUnits = rows.filter(r => r.category === 'company' || r.category === 'company_unit');
    const cities = rows.filter(r => r.category === 'city');
    const titles = rows.filter(r => r.category === 'title' || r.category === 'transport_title');

    console.log(`  • Category 'product': ${products.length} records`);
    console.log(`  • Category 'company': ${companyUnits.length} records`);
    console.log(`  • Category 'city': ${cities.length} records`);
    console.log(`  • Category 'title': ${titles.length} records`);

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Migrate Products
      for (const p of products) {
        const extra = typeof p.extra_data === 'string' ? JSON.parse(p.extra_data || '{}') : (p.extra_data || {});
        const pId = String(p.id);
        const pCode = p.code || pId;
        await connection.query(
          `INSERT INTO products (id, code, name, category, hsn_code, default_unit, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), category = VALUES(category), status = VALUES(status)`,
          [pId, pCode, p.name, extra.category || 'General', extra.hsn_code || '23040010', extra.unit || 'MT', 'Active']
        );
      }

      // 2. Migrate Company Units
      for (const c of companyUnits) {
        const extra = typeof c.extra_data === 'string' ? JSON.parse(c.extra_data || '{}') : (c.extra_data || {});
        const cId = String(c.id);
        const cCode = c.code || cId;
        await connection.query(
          `INSERT INTO company_units (id, code, name, contact_name, gstin, pan, mobile, email, city, district, pin, address, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), status = VALUES(status)`,
          [cId, cCode, c.name, extra.contact_name || '', extra.gstin || '', extra.pan || '', extra.mobile || '', extra.email || '', extra.city || '', extra.district || '', extra.pin || '', extra.address || '', 'Active']
        );
      }

      // 3. Migrate Cities
      for (const ci of cities) {
        const extra = typeof ci.extra_data === 'string' ? JSON.parse(ci.extra_data || '{}') : (ci.extra_data || {});
        const ciId = String(ci.id);
        const ciCode = ci.code || ciId;
        await connection.query(
          `INSERT INTO cities (id, code, name, district, state, pin, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), status = VALUES(status)`,
          [ciId, ciCode, ci.name, extra.district || '', extra.state || '', extra.pin || '', 'Active']
        );
      }

      // 4. Migrate Titles
      for (const t of titles) {
        const tId = String(t.id);
        const tCode = t.code || tId;
        await connection.query(
          `INSERT INTO transport_titles (id, code, title, status)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE title = VALUES(title), status = VALUES(status)`,
          [tId, tCode, t.name, 'Active']
        );
      }

      await connection.commit();
      console.log('\n✅ Master-records migration COMMITTED successfully!');

      // Validation
      const [prodRows] = await pool.query('SELECT COUNT(*) AS count FROM products');
      const [unitRows] = await pool.query('SELECT COUNT(*) AS count FROM company_units');
      const [cityRows] = await pool.query('SELECT COUNT(*) AS count FROM cities');
      const [titleRows] = await pool.query('SELECT COUNT(*) AS count FROM transport_titles');

      console.log('\n📊 ROW-COUNT VALIDATION RESULTS:');
      console.log(`  • products: Target = ${prodRows[0].count} rows`);
      console.log(`  • company_units: Target = ${unitRows[0].count} rows`);
      console.log(`  • cities: Target = ${cityRows[0].count} rows`);
      console.log(`  • transport_titles: Target = ${titleRows[0].count} rows`);

    } catch (err) {
      await connection.rollback();
      console.error('❌ Migration Transaction Failed & Rolled Back:', err.message);
    } finally {
      connection.release();
    }
  } catch (err) {
    console.warn('Notice:', err.message);
  } finally {
    process.exit(0);
  }
}

migrateMasterRecords();
