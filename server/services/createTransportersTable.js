// server/services/createTransportersTable.js
// Approved Isolated Execution Service for Table: transporters ONLY

import { pool } from '../config/db.js';

export async function executeCreateTransportersTable() {
  console.log('==================================================');
  console.log('🚀 ISOLATED DDL SERVICE: TRANSPORTERS TABLE CREATION');
  console.log('==================================================');

  const [dbNameRow] = await pool.query('SELECT DATABASE() AS current_db');
  const activeDb = dbNameRow[0].current_db;
  console.log(`📌 Active Database Connection: ${activeDb}`);

  // 1. Verify table does not already exist
  const [existingTables] = await pool.query("SHOW TABLES LIKE 'transporters'");
  if (existingTables.length > 0) {
    console.log("ℹ️ Table 'transporters' already exists.");
  } else {
    // 2. Execute Approved DDL SQL for Table 1: transporters ONLY
    const ddlSql = `
      CREATE TABLE transporters (
          id VARCHAR(64) NOT NULL,
          company_name VARCHAR(255) NOT NULL,
          code VARCHAR(50) NOT NULL,
          contact_person VARCHAR(150) DEFAULT NULL,
          mobile VARCHAR(30) DEFAULT NULL,
          email VARCHAR(150) DEFAULT NULL,
          gstin VARCHAR(50) DEFAULT NULL,
          pan VARCHAR(50) DEFAULT NULL,
          address TEXT DEFAULT NULL,
          username VARCHAR(100) DEFAULT NULL,
          password_hash VARCHAR(255) DEFAULT NULL,
          status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
              ON UPDATE CURRENT_TIMESTAMP,

          PRIMARY KEY (id),
          UNIQUE KEY uq_transporters_code (code),
          UNIQUE KEY uq_transporters_username (username),
          KEY idx_transporters_status (status)
      )
      ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci;
    `;

    await pool.query(ddlSql);
    console.log("✅ Table 'transporters' created successfully!");
  }

  // 3. Read-Only Verification Queries
  const [showTables] = await pool.query("SHOW TABLES LIKE 'transporters'");
  const [showCreate] = await pool.query("SHOW CREATE TABLE transporters");
  const [countRes] = await pool.query("SELECT COUNT(*) AS total FROM transporters");
  const [describeRes] = await pool.query("DESCRIBE transporters");

  const report = {
    database: activeDb,
    tableExists: showTables.length > 0,
    table: 'transporters',
    createSql: showCreate[0] ? showCreate[0]['Create Table'] : null,
    totalRows: countRes[0].total,
    columns: describeRes.map(col => ({
      field: col.Field,
      type: col.Type,
      null: col.Null,
      key: col.Key,
      default: col.Default,
      extra: col.Extra
    }))
  };

  console.log('📊 TRANSPORTERS VERIFICATION REPORT:');
  console.log(JSON.stringify(report, null, 2));
  return report;
}
