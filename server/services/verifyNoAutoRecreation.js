// server/services/verifyNoAutoRecreation.js
// Read-Only Verification Service to Confirm Zero Auto-Recreation on Startup

import { pool } from '../config/db.js';

export async function verifyNoAutoRecreation() {
  console.log('==================================================');
  console.log('🔍 READ-ONLY VERIFICATION: NO AUTO-RECREATION AUDIT');
  console.log('==================================================');

  const [dbNameRow] = await pool.query('SELECT DATABASE() AS current_db');
  const activeDb = dbNameRow[0].current_db;

  // 1. Query SHOW TABLES
  const [tablesResult] = await pool.query('SHOW TABLES');
  const tableNames = tablesResult.map(t => Object.values(t)[0]);

  // 2. Query SHOW CREATE TABLE transporters
  let createTransportersSql = null;
  let transportersExist = false;
  if (tableNames.includes('transporters')) {
    transportersExist = true;
    const [createRes] = await pool.query('SHOW CREATE TABLE transporters');
    createTransportersSql = createRes[0] ? createRes[0]['Create Table'] : null;
  }

  // 3. Query SELECT COUNT(*) FROM transporters
  let totalTransporterRows = 0;
  if (transportersExist) {
    const [countRes] = await pool.query('SELECT COUNT(*) AS total FROM transporters');
    totalTransporterRows = countRes[0].total;
  }

  // List of tables that should NOT be recreated
  const DISALLOWED_RECREATED_TABLES = [
    'app_database',
    'cities',
    'company_units',
    'contracts',
    'database_migrations',
    'dispatches',
    'master_records',
    'master_records_backup',
    'products',
    'rate_requests',
    'rate_submissions',
    'security_audit_logs',
    'users',
    'whatsapp_notifications'
  ];

  const recreatedTablesFound = tableNames.filter(t => DISALLOWED_RECREATED_TABLES.includes(t));
  const autoRecreationDisabled = recreatedTablesFound.length === 0;

  const report = {
    database: activeDb,
    totalTablesInDatabase: tableNames.length,
    allTables: tableNames,
    transportersExist,
    transportersCreateSql: createTransportersSql,
    transportersRowCount: totalTransporterRows,
    disallowedTablesRecreatedCount: recreatedTablesFound.length,
    recreatedTablesFound,
    autoRecreationPermanentlyDisabled: autoRecreationDisabled,
    timestamp: new Date().toISOString()
  };

  console.log('📊 VERIFICATION REPORT:');
  console.log(JSON.stringify(report, null, 2));

  return report;
}
