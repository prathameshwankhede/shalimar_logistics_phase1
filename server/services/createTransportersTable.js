// server/services/createTransportersTable.js
// Approved Isolated Execution Service for Table: transporters

import { pool } from '../config/db.js';

export async function executeCreateTransportersTable() {
  console.log('==================================================');
  console.log('🏗️ EXECUTING APPROVED ISOLATED DDL: transporters TABLE');
  console.log('==================================================');

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

  console.log('✅ DDL CREATE TABLE transporters executed successfully.');

  // 2. Read-Only Verification
  const [showTables] = await pool.query("SHOW TABLES LIKE 'transporters'");
  const tableExists = showTables.length > 0;

  const [createTableResult] = await pool.query("SHOW CREATE TABLE transporters");
  const createSql = createTableResult[0] ? createTableResult[0]['Create Table'] : null;

  const [countResult] = await pool.query("SELECT COUNT(*) AS total FROM transporters");
  const totalRows = countResult[0].total;

  const report = {
    success: true,
    database: activeDb,
    tableName: 'transporters',
    tableExists,
    createTableSql: createSql,
    totalRows,
    timestamp: new Date().toISOString()
  };

  console.log('📊 VERIFICATION REPORT:');
  console.log(JSON.stringify(report, null, 2));

  return report;
}
