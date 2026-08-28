// scratch/drop_all_current_application_tables.mjs
// Controlled One-Time Standalone Production Backup & Drop Tool for Hostinger (u704836459_shalimar_logi)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../server/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APPLICATION_TABLES_TO_DROP = [
  'app_database',
  'cities',
  'company_units',
  'contracts',
  'dispatches',
  'master_records',
  'products',
  'rate_requests',
  'rate_submissions',
  'security_audit_logs',
  'transporters',
  'transport_titles',
  'users',
  'whatsapp_notifications'
];

async function runProductionCleanup() {
  console.log('==================================================');
  console.log('💥 DELIBERATE ONE-TIME PRODUCTION CLEANUP TOOL');
  console.log('==================================================');

  try {
    const [dbNameRow] = await pool.query('SELECT DATABASE() AS current_db');
    const activeDb = dbNameRow[0].current_db;
    console.log(`📌 Target Database: ${activeDb}`);

    if (!activeDb || (!activeDb.includes('shalimar') && !activeDb.includes('transflow'))) {
      console.warn(`⚠️ Warning: Operating on database '${activeDb}'`);
    }

    // -------------------------------------------------------------
    // STEP 1: READ-ONLY BACKUP GENERATION BEFORE ANY DROP
    // -------------------------------------------------------------
    console.log('\n📦 STEP 1: Creating Pre-Drop Database Dump...');
    const [existingTables] = await pool.query('SHOW TABLES');
    const tableNames = existingTables.map(t => Object.values(t)[0]);

    const backupDump = {
      database: activeDb,
      timestamp: new Date().toISOString(),
      tableCount: tableNames.length,
      tables: {}
    };

    let totalDumpedRows = 0;
    for (const tbl of tableNames) {
      if (!APPLICATION_TABLES_TO_DROP.includes(tbl) && tbl !== 'master_records_backup' && tbl !== 'database_migrations') {
        console.log(`  • Skipping non-application table '${tbl}'`);
        continue;
      }
      try {
        const [rows] = await pool.query(`SELECT * FROM \`${tbl}\``);
        const [createRes] = await pool.query(`SHOW CREATE TABLE \`${tbl}\``);
        backupDump.tables[tbl] = {
          createSql: createRes[0] ? createRes[0]['Create Table'] : null,
          rowCount: rows.length,
          rows: rows
        };
        totalDumpedRows += rows.length;
        console.log(`  • Dumped '${tbl}': ${rows.length} rows`);
      } catch (err) {
        console.warn(`  • Notice dumping '${tbl}': ${err.message}`);
      }
    }

    const backupFileName = `hostinger_pre_drop_backup_${Date.now()}.json`;
    const backupFilePath = path.resolve(__dirname, backupFileName);

    fs.writeFileSync(backupFilePath, JSON.stringify(backupDump, null, 2), 'utf8');

    // -------------------------------------------------------------
    // STEP 2: VERIFY BACKUP FILE EXISTENCE & READABILITY
    // -------------------------------------------------------------
    if (!fs.existsSync(backupFilePath)) {
      throw new Error(`Backup file creation failed at path: ${backupFilePath}`);
    }
    const stat = fs.statSync(backupFilePath);
    if (stat.size === 0) {
      throw new Error(`Backup file is empty (0 bytes): ${backupFilePath}`);
    }

    console.log('\n✅ STEP 2: BACKUP VERIFIED SUCCESSFULLY');
    console.log(`  • Backup File Path : ${backupFilePath}`);
    console.log(`  • Backup File Size : ${stat.size} bytes`);
    console.log(`  • Total Dumped Rows: ${totalDumpedRows}`);

    // -------------------------------------------------------------
    // STEP 3: EXECUTE DROP FOR 14 TARGET APPLICATION TABLES ONLY
    // -------------------------------------------------------------
    console.log('\n💥 STEP 3: Executing DROP TABLE for 14 Application Tables...');

    for (const tbl of APPLICATION_TABLES_TO_DROP) {
      try {
        await pool.query(`DROP TABLE IF EXISTS \`${tbl}\``);
        console.log(`  • Dropped table '${tbl}'`);
      } catch (err) {
        console.error(`  ❌ Error dropping table '${tbl}': ${err.message}`);
        throw err;
      }
    }

    // -------------------------------------------------------------
    // STEP 4: READ-BACK VERIFICATION WITH SHOW TABLES
    // -------------------------------------------------------------
    console.log('\n📊 STEP 4: Verifying Production Database with SHOW TABLES...');
    const [remainingTables] = await pool.query('SHOW TABLES');
    const remainingList = remainingTables.map(t => Object.values(t)[0]);

    const remainingAppTables = remainingList.filter(t => APPLICATION_TABLES_TO_DROP.includes(t));

    console.log(`📌 Total Remaining Tables in Database: ${remainingList.length}`);
    console.log(`📌 Remaining Application Tables      : ${remainingAppTables.length}`);

    if (remainingAppTables.length > 0) {
      console.error('❌ DROP VERIFICATION FAILED. Application tables still remain:', remainingAppTables);
      process.exit(1);
    }

    console.log('\n==================================================');
    console.log('🎉 CLEANUP COMPLETED: ZERO APPLICATION TABLES REMAIN');
    console.log('==================================================');
    console.log(JSON.stringify({
      database: activeDb,
      backupFile: backupFilePath,
      backupSizeBytes: stat.size,
      droppedTablesCount: APPLICATION_TABLES_TO_DROP.length,
      remainingAppTablesCount: remainingAppTables.length,
      remainingTables: remainingList,
      zeroAppTablesRemain: true
    }, null, 2));

  } catch (err) {
    console.error('\n❌ PRODUCTION CLEANUP FAILED:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runProductionCleanup();
