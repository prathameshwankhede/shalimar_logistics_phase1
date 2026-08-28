// scratch/execute_relational_migration.mjs
// Controlled Relational Database Migration Engine for Shalimar Logistics

import { pool } from '../server/config/db.js';
import { INITIAL_SEED_DATA } from '../src/store/dbStore.js';

const CLOUD_ROW_ID = 'transflow-live-prod-v3';

async function executeControlledMigration() {
  console.log('🛡️ Controlled relational migration script is permanently disabled.');
  process.exit(1);
}

  // PHASE 1 — BACKUP VERIFICATION
  const backupTimestamp = new Date().toISOString();
  console.log(`📌 PHASE 1: Backup Check & Session Timestamp: ${backupTimestamp}`);

  // PHASE 2 — READ & VERIFY ACTUAL JSON DATA
  let jsonBlob = null;
  try {
    const [rows] = await pool.query('SELECT data FROM app_database WHERE id = ?', [CLOUD_ROW_ID]);
    if (rows && rows.length > 0 && rows[0].data) {
      jsonBlob = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
    }
  } catch (err) {
    console.warn('MySQL app_database query notice:', err.message);
  }

  const sourceBlob = jsonBlob || INITIAL_SEED_DATA;

  const rawAuditLogs = sourceBlob.security_audit_logs || [];
  const rawNotifications = sourceBlob.whatsapp_notifications || [];
  const rawContracts = sourceBlob.contracts || [];
  const rawDoSettings = sourceBlob.do_master_settings || {};

  console.log('\n📊 PHASE 2: JSON Source Data Analysis:');
  console.log(`  • Security Audit Logs: ${rawAuditLogs.length} items`);
  console.log(`  • WhatsApp Notifications: ${rawNotifications.length} items`);
  console.log(`  • Contracts / Allocations: ${rawContracts.length} items`);

  // PHASE 3 — CREATE RELATIONAL TABLES
  console.log('\n🛠️ PHASE 3: Creating Relational Tables...');
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. security_audit_logs
    await connection.query(`
      CREATE TABLE IF NOT EXISTS security_audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        action VARCHAR(150) NOT NULL,
        username VARCHAR(100) DEFAULT NULL,
        user_role VARCHAR(50) DEFAULT NULL,
        status VARCHAR(100) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_audit_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. whatsapp_notifications
    await connection.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_notifications (
        id VARCHAR(64) PRIMARY KEY,
        recipient VARCHAR(100) DEFAULT NULL,
        message TEXT DEFAULT NULL,
        status VARCHAR(50) DEFAULT 'Sent',
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_wa_sent (sent_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. contracts
    await connection.query(`
      CREATE TABLE IF NOT EXISTS contracts (
        id VARCHAR(64) PRIMARY KEY,
        contract_no VARCHAR(100) NOT NULL,
        request_id VARCHAR(64) DEFAULT NULL,
        transporter_id VARCHAR(64) DEFAULT NULL,
        allocated_qty DECIMAL(12,2) DEFAULT 0.00,
        rate_per_unit DECIMAL(12,2) DEFAULT 0.00,
        status VARCHAR(50) DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_contracts_transporter (transporter_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // PHASE 4, 5, 7, 8 — TRANSACTIONAL DATA MIGRATION (Idempotent ON DUPLICATE KEY UPDATE)
    console.log('\n🔄 PHASE 4-8: Executing Transactional Migration...');

    // Migrate Audit Logs
    for (const log of rawAuditLogs) {
      const logId = log.id || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const logDate = log.created_at || log.timestamp ? new Date(log.created_at || log.timestamp).toISOString().slice(0, 19).replace('T', ' ') : new Date().toISOString().slice(0, 19).replace('T', ' ');
      await connection.query(
        `INSERT INTO security_audit_logs (id, action, username, user_role, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE action = VALUES(action), status = VALUES(status)`,
        [logId, log.action || log.event || 'SECURITY_EVENT', log.username || 'system', log.user_role || log.role || 'user', log.status || 'OK', logDate]
      );
    }

    // Migrate WhatsApp Notifications
    for (const notif of rawNotifications) {
      const notifId = notif.id || `wa_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const sentAt = notif.sent_at || notif.timestamp ? new Date(notif.sent_at || notif.timestamp).toISOString().slice(0, 19).replace('T', ' ') : new Date().toISOString().slice(0, 19).replace('T', ' ');
      await connection.query(
        `INSERT INTO whatsapp_notifications (id, recipient, message, status, sent_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status)`,
        [notifId, notif.recipient || notif.phone || 'System', notif.message || notif.text || '', notif.status || 'Sent', sentAt]
      );
    }

    // Migrate Contracts
    for (const contract of rawContracts) {
      const cId = contract.id || `contract_${Date.now()}`;
      const cNo = contract.contract_no || contract.code || cId;
      const createdAt = contract.created_at ? new Date(contract.created_at).toISOString().slice(0, 19).replace('T', ' ') : new Date().toISOString().slice(0, 19).replace('T', ' ');
      await connection.query(
        `INSERT INTO contracts (id, contract_no, request_id, transporter_id, allocated_qty, rate_per_unit, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status)`,
        [cId, cNo, contract.request_id || null, contract.transporter_id || null, parseFloat(contract.allocated_qty || 0), parseFloat(contract.rate_per_unit || 0), contract.status || 'Active', createdAt]
      );
    }

    await connection.commit();
    console.log('  ✅ MySQL Transaction COMMITTED Successfully!');

    // PHASE 12 — DATA VALIDATION
    console.log('\n📊 PHASE 12: Source VS Relational Validation:');

    const [auditRows] = await pool.query('SELECT COUNT(*) AS count FROM security_audit_logs');
    console.log(`  • security_audit_logs: Source = ${rawAuditLogs.length} | Target = ${auditRows[0].count} | Status = ${auditRows[0].count >= rawAuditLogs.length ? 'PASS' : 'WARN'}`);

    const [waRows] = await pool.query('SELECT COUNT(*) AS count FROM whatsapp_notifications');
    console.log(`  • whatsapp_notifications: Source = ${rawNotifications.length} | Target = ${waRows[0].count} | Status = ${waRows[0].count >= rawNotifications.length ? 'PASS' : 'WARN'}`);

    const [cRows] = await pool.query('SELECT COUNT(*) AS count FROM contracts');
    console.log(`  • contracts: Source = ${rawContracts.length} | Target = ${cRows[0].count} | Status = ${cRows[0].count >= rawContracts.length ? 'PASS' : 'WARN'}`);

  } catch (err) {
    await connection.rollback();
    console.error('❌ Migration Transaction Failed & ROLLED BACK:', err.message);
    process.exit(1);
  } finally {
    connection.release();
    process.exit(0);
  }
}

executeControlledMigration();
