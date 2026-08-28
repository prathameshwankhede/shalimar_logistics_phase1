// scratch/execute_create_transporters_table.mjs
// Isolated Execution Script for Table: transporters

import { pool } from '../server/config/db.js';

async function runTransportersTableCreation() {
  console.log('==================================================');
  console.log('🏗️ EXECUTING ISOLATED DDL FOR transporters TABLE');
  console.log('==================================================');

  try {
    const [dbNameRow] = await pool.query('SELECT DATABASE() AS current_db');
    const activeDb = dbNameRow[0].current_db;
    console.log(`📌 Active Database Connection: ${activeDb}`);

    // 1. Execute Approved CREATE TABLE SQL
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transporters (
        id VARCHAR(64) PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        code VARCHAR(50) NOT NULL,
        contact_name VARCHAR(150) DEFAULT NULL,
        mobile VARCHAR(30) DEFAULT NULL,
        email VARCHAR(150) DEFAULT NULL,
        gstin VARCHAR(50) DEFAULT NULL,
        pan VARCHAR(50) DEFAULT NULL,
        address TEXT DEFAULT NULL,
        username VARCHAR(100) DEFAULT NULL,
        password_hash VARCHAR(255) DEFAULT NULL,
        status VARCHAR(50) DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_transporters_code (code),
        KEY idx_transporters_status (status),
        KEY idx_transporters_username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ DDL CREATE TABLE transporters EXECUTED SUCCESSFULLY.');

    // 2. Read-Back Verification Queries
    console.log('\n🔍 RUNNING READ-ONLY VERIFICATION QUERIES:');

    // Query 1: SHOW TABLES LIKE 'transporters'
    const [showTables] = await pool.query("SHOW TABLES LIKE 'transporters'");
    console.log(`\n📌 1. SHOW TABLES LIKE 'transporters':`);
    console.log(JSON.stringify(showTables, null, 2));

    // Query 2: SHOW CREATE TABLE transporters
    const [createTableResult] = await pool.query("SHOW CREATE TABLE transporters");
    console.log(`\n📌 2. SHOW CREATE TABLE transporters:`);
    console.log(createTableResult[0]['Create Table']);

    // Query 3: SELECT COUNT(*) AS total FROM transporters
    const [countResult] = await pool.query("SELECT COUNT(*) AS total FROM transporters");
    console.log(`\n📌 3. SELECT COUNT(*) AS total FROM transporters:`);
    console.log(`   • Total Rows: ${countResult[0].total}`);

    console.log('\n==================================================');
    console.log('🎉 VERIFICATION COMPLETED: TABLE transporters IS LIVE & READY');
    console.log('==================================================');

  } catch (err) {
    console.error('\n❌ EXECUTION FAILED:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runTransportersTableCreation();
