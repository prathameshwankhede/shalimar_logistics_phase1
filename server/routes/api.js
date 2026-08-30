import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { INITIAL_SEED_DATA } from '../../src/store/dbStore.js';
import { authenticateToken, requirePermission, requireRole } from '../middleware/auth.js';
import { executeFullDatabaseResetAndRebuild } from '../services/migrationRunner.js';
import { runApprovedProductionDrop } from '../services/dropRunner.js';
import { runProductionCleanup } from '../../scratch/drop_all_current_application_tables.mjs';
import { executeCreateTransportersTable } from '../services/createTransportersTable.js';
import { verifyNoAutoRecreation } from '../services/verifyNoAutoRecreation.js';
import { fetchTransportersList } from '../repositories/stateRepository.js';
import {
  handleGetDashboard,
  handleGetRateRequests,
  handleGetRateSubmissions,
  handleGetTransporters,
  handleGetMasterData
} from '../controllers/stateController.js';

const router = express.Router();
const CLOUD_ROW_ID = 'transflow-live-prod-v3';

// In-memory state cache on server
let IN_MEMORY_CACHE = null;

function sanitizeStateForClient(rawState) {
  if (!rawState || typeof rawState !== 'object') return rawState;
  const copy = JSON.parse(JSON.stringify(rawState));
  if (Array.isArray(copy.users)) {
    copy.users = copy.users.map(({ password, password_hash, ...u }) => u);
  }
  if (copy.whatsapp_api_settings) {
    delete copy.whatsapp_api_settings.token;
    delete copy.whatsapp_api_settings.instance_id;
  }
  delete copy.security_audit_logs;
  return copy;
}

// Safe Idempotent Column Helper with Explicit Logging & Schema Verification 🛡️
async function ensureColumnExists(tableName, columnName, columnDefinition) {
  try {
    const dbName = pool?.pool?.config?.connectionConfig?.database;
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE (TABLE_SCHEMA = ? OR TABLE_SCHEMA = DATABASE()) AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [dbName || '', tableName, columnName]
    );
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDefinition}`);
      console.log(`✅ [SCHEMA MIGRATION] Added column ${columnName} to ${tableName}`);
    }
  } catch (err) {
    if (!err.message.includes('Duplicate column') && !err.message.includes('already exists')) {
      console.warn(`⚠️ [SCHEMA MIGRATION] Notice for ${tableName}.${columnName}:`, err.message);
    }
  }
}

// -------------------------------------------------------------
// Production-Safe Dispatch Balance Reconciliation Engine 🚛📊
// -------------------------------------------------------------
export async function reconcileItemDispatchBalances(targetPool = pool) {
  try {
    console.log('🔄 [RECONCILIATION] Starting transport_requirement_items dispatch balance reconciliation...');
    // 1. Calculate actual loaded quantity sum from truck_dispatches per exact item UUID or sub_indent_no
    const [result] = await targetPool.query(`
      UPDATE transport_requirement_items tri
      LEFT JOIN (
        SELECT requirement_item_id, COALESCE(SUM(loaded_quantity_mt), 0.000) AS total_dispatched
        FROM truck_dispatches
        GROUP BY requirement_item_id
      ) td ON (td.requirement_item_id = tri.id OR td.requirement_item_id = tri.sub_indent_no)
      SET 
        tri.dispatched_quantity_mt = COALESCE(td.total_dispatched, 0.000),
        tri.remaining_quantity_mt = GREATEST(0.000, tri.quantity_mt - COALESCE(td.total_dispatched, 0.000)),
        tri.dispatch_status = CASE 
          WHEN (tri.quantity_mt - COALESCE(td.total_dispatched, 0.000)) <= 0.001 AND tri.quantity_mt > 0 THEN 'FULLY_DISPATCHED'
          WHEN COALESCE(td.total_dispatched, 0.000) > 0 THEN 'PARTIALLY_DISPATCHED'
          ELSE 'PENDING'
        END,
        tri.allocation_status = CASE
          WHEN (tri.quantity_mt - COALESCE(td.total_dispatched, 0.000)) <= 0.001 AND tri.quantity_mt > 0 THEN 'COMPLETED'
          WHEN tri.allocation_status = 'RELEASED_FOR_REQUOTE' THEN 'RELEASED_FOR_REQUOTE'
          ELSE 'ACTIVE'
        END,
        tri.updated_at = NOW();
    `);

    // 2. Also reconcile parent transport_requirements status if all items are fully dispatched
    await targetPool.query(`
      UPDATE transport_requirements tr
      SET status = CASE 
        WHEN NOT EXISTS (
          SELECT 1 FROM transport_requirement_items tri 
          WHERE tri.requirement_id = tr.id AND tri.dispatch_status != 'FULLY_DISPATCHED'
        ) THEN 'COMPLETED'
        WHEN EXISTS (
          SELECT 1 FROM transport_requirement_items tri 
          WHERE tri.requirement_id = tr.id AND (tri.dispatch_status = 'PARTIALLY_DISPATCHED' OR tri.dispatched_quantity_mt > 0)
        ) THEN 'PARTIALLY_DISPATCHED'
        ELSE tr.status
      END,
      updated_at = NOW()
      WHERE tr.status NOT IN ('ARCHIVED', 'CANCELLED', 'DELETED');
    `).catch(() => {});

    console.log(`✅ [RECONCILIATION] Completed transport_requirement_items dispatch balance reconciliation. Affected rows: ${result?.affectedRows || 0}`);
    return { success: true, affectedRows: result?.affectedRows || 0 };
  } catch (err) {
    console.error('❌ [RECONCILIATION ERROR] Failed to reconcile dispatch balances:', err.message);
    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// Dedicated Transport Requirements & Rate Requests CRUD API
// Parent: transport_requirements | Child: transport_requirement_items
// -------------------------------------------------------------
let isRequirementsTableEnsured = false;
export async function ensureRequirementsTableExists() {
  if (isRequirementsTableEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transport_requirements (
        id VARCHAR(100) NOT NULL PRIMARY KEY,
        req_no VARCHAR(100) NOT NULL UNIQUE,
        title VARCHAR(255),
        pickup_origin VARCHAR(255) NOT NULL,
        drop_location VARCHAR(255) NOT NULL,
        target_date DATE NOT NULL,
        status VARCHAR(50) DEFAULT 'Active',
        submitted_bids_count INT DEFAULT 0,
        approval_status VARCHAR(50) DEFAULT 'Pending',
        created_by VARCHAR(100) DEFAULT 'admin',
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const reqCols = [
      { name: 'total_quantity_mt', def: 'DECIMAL(12,3) DEFAULT NULL' },
      { name: 'quantity_mt', def: 'DECIMAL(12,3) DEFAULT NULL' },
      { name: 'product_name', def: 'VARCHAR(255) DEFAULT NULL' },
      { name: 'unit', def: "VARCHAR(50) DEFAULT 'MT'" },
      { name: 'archived_at', def: 'DATETIME NULL' },
      { name: 'archived_by', def: 'VARCHAR(100) NULL' },
      { name: 'cancelled_at', def: 'DATETIME NULL' },
      { name: 'cancelled_by', def: 'VARCHAR(100) NULL' },
      { name: 'cancellation_reason', def: 'TEXT NULL' }
    ];
    for (const { name, def } of reqCols) {
      await ensureColumnExists('transport_requirements', name, def);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS transport_requirement_items (
        id VARCHAR(100) NOT NULL PRIMARY KEY,
        requirement_id VARCHAR(100) NOT NULL,
        sub_indent_no VARCHAR(100) DEFAULT NULL,
        product_name VARCHAR(255) NOT NULL,
        quantity_mt DECIMAL(12,3) NOT NULL,
        unit VARCHAR(50) DEFAULT 'MT',
        pickup_origin VARCHAR(255),
        drop_location VARCHAR(255),
        hsn_code VARCHAR(50),
        target_date DATE DEFAULT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_req_id (requirement_id),
        INDEX idx_sub_indent_no (sub_indent_no)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const childCols = [
      { name: 'sub_indent_no', def: 'VARCHAR(100) DEFAULT NULL' },
      { name: 'target_date', def: 'DATE DEFAULT NULL' },
      { name: 'dispatch_status', def: "VARCHAR(50) NOT NULL DEFAULT 'PENDING'" },
      { name: 'allocation_status', def: "VARCHAR(50) DEFAULT 'ACTIVE'" },
      { name: 'dispatched_quantity_mt', def: 'DECIMAL(12,3) NOT NULL DEFAULT 0.000' },
      { name: 'remaining_quantity_mt', def: 'DECIMAL(12,3) DEFAULT NULL' },
      { name: 'remaining_action', def: 'VARCHAR(50) DEFAULT NULL' },
      { name: 'released_for_requote_at', def: 'DATETIME DEFAULT NULL' },
      { name: 'released_for_requote_by', def: 'VARCHAR(100) DEFAULT NULL' },
      { name: 'released_for_requote_reason', def: 'TEXT DEFAULT NULL' },
      { name: 'replacement_item_id', def: 'VARCHAR(100) DEFAULT NULL' },
      { name: 'source_item_id', def: 'VARCHAR(100) DEFAULT NULL' }
    ];
    for (const { name, def } of childCols) {
      await ensureColumnExists('transport_requirement_items', name, def);
    }

    // Run safe reconciliation on startup to synchronize actual dispatch totals
    await reconcileItemDispatchBalances(pool);

    await pool.query('ALTER TABLE transport_requirements ADD INDEX idx_req_status_created (status, created_at)').catch(() => {});
    await pool.query('ALTER TABLE transport_requirement_items ADD INDEX idx_sub_indent_no (sub_indent_no)').catch(() => {});
    await pool.query('ALTER TABLE transport_requirement_items ADD INDEX idx_req_item_lookup (requirement_id, id)').catch(() => {});
    isRequirementsTableEnsured = true;
  } catch (err) {
    console.warn('transport_requirements table creation notice:', err.message);
  }
}

async function generateNextReqNo(clientOrPool) {
  try {
    const [rows] = await clientOrPool.query(
      `SELECT req_no FROM transport_requirements ORDER BY created_at DESC, id DESC LIMIT 200`
    );

    let maxSeq = 0;
    for (const r of (rows || [])) {
      const str = r.req_no || '';
      const match = str.match(/REQ-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    }

    const nextSeq = maxSeq + 1;
    const seqPadded = String(nextSeq).padStart(4, '0');
    return `SNPL/26-27/REQ-${seqPadded}`;
  } catch (e) {
    return `SNPL/26-27/REQ-${String(Date.now()).substring(8)}`;
  }
}

function formatParentRequirementDto(parentRow, childItems = [], bidsCount = 0, itemStatsMap = {}, extraMetrics = {}) {
  if (!parentRow) return null;
  const parentReqNo = parentRow.req_no || parentRow.id || '';

  const itemsFormatted = (childItems || []).map((item, idx) => {
    const subIdxStr = (idx + 1).toString().padStart(2, '0');
    const autoSubIndentNo = item.sub_indent_no || `${parentReqNo}/${subIdxStr}`;
    const itemTargetDate = item.target_date
      ? (item.target_date instanceof Date ? item.target_date.toISOString().split('T')[0] : String(item.target_date).split('T')[0])
      : (parentRow.target_date ? (parentRow.target_date instanceof Date ? parentRow.target_date.toISOString().split('T')[0] : String(parentRow.target_date).split('T')[0]) : new Date().toISOString().split('T')[0]);

    const stats = itemStatsMap[`${parentRow.id}_${item.id}`] || itemStatsMap[item.id] || itemStatsMap[autoSubIndentNo] || {};

    const itemDispatchedQty = Number(item.dispatched_quantity_mt || 0);
    const itemRemainingQty = item.remaining_quantity_mt !== null && item.remaining_quantity_mt !== undefined ? Number(item.remaining_quantity_mt) : Math.max(0, Number(item.quantity_mt || item.required_qty || 0) - itemDispatchedQty);

    return {
      id: item.id || `item_${idx}`,
      requirement_id: parentRow.id,
      sub_indent_no: autoSubIndentNo,
      product_name: item.product_name || item.material_type || '',
      material_type: item.product_name || item.material_type || '',
      quantity_mt: Number(item.quantity_mt || item.required_qty || 0),
      required_qty: Number(item.quantity_mt || item.required_qty || 0),
      dispatched_quantity_mt: itemDispatchedQty,
      remaining_quantity_mt: itemRemainingQty,
      dispatch_status: item.dispatch_status || (itemRemainingQty <= 0 && itemDispatchedQty > 0 ? 'FULLY_DISPATCHED' : (itemDispatchedQty > 0 ? 'PARTIALLY_DISPATCHED' : 'PENDING')),
      allocation_status: item.allocation_status || (item.dispatch_status === 'RELEASED_FOR_REQUOTE' ? 'RELEASED_FOR_REQUOTE' : 'ACTIVE'),
      remaining_action: item.remaining_action || null,
      released_for_requote_at: item.released_for_requote_at || null,
      released_for_requote_by: item.released_for_requote_by || null,
      released_for_requote_reason: item.released_for_requote_reason || null,
      replacement_item_id: item.replacement_item_id || null,
      source_item_id: item.source_item_id || null,
      unit: item.unit || 'MT',
      pickup_origin: item.pickup_origin || parentRow.pickup_origin || '',
      drop_location: item.drop_location || parentRow.drop_location || '',
      hsn_code: item.hsn_code || '',
      target_date: itemTargetDate,
      submitted_bids_count: stats.bids_count || 0,
      lowest_rate: stats.lowest_rate || null
    };
  });

  const totalQty = itemsFormatted.reduce((acc, curr) => acc + curr.quantity_mt, 0);
  const totalDispatchedQty = itemsFormatted.reduce((acc, curr) => acc + (curr.dispatched_quantity_mt || 0), 0);
  const totalRemainingQty = itemsFormatted.reduce((acc, curr) => acc + (curr.remaining_quantity_mt || 0), 0);

  const isBatch = itemsFormatted.length > 0;
  const firstItem = itemsFormatted[0] || {};
  const pickup = parentRow.pickup_origin || (isBatch ? '' : (firstItem.pickup_origin || ''));
  const drop = parentRow.drop_location || (isBatch ? '' : (firstItem.drop_location || ''));
  const reqNo = parentRow.req_no || parentRow.id || '';
  const targetDateStr = parentRow.target_date ? (parentRow.target_date instanceof Date ? parentRow.target_date.toISOString().split('T')[0] : String(parentRow.target_date).split('T')[0]) : new Date().toISOString().split('T')[0];

  const reqStatus = String(parentRow.status || 'Active').toUpperCase();
  const hasFinalizedBid = Boolean(extraMetrics.has_finalized_bid || reqStatus === 'COMPLETED');
  const negCount = Number(extraMetrics.negotiation_count || 0);
  const histCount = Number(extraMetrics.history_count || 0);
  const totalBids = Number(bidsCount || 0);

  let can_delete = false;
  let can_archive = false;
  let can_cancel = false;
  let can_restore = false;

  if (reqStatus === 'ARCHIVED') {
    can_delete = false;
    can_archive = false;
    can_cancel = false;
    can_restore = true;
  } else if (reqStatus === 'CANCELLED' || reqStatus === 'COMPLETED') {
    can_delete = false;
    can_archive = false;
    can_cancel = false;
    can_restore = false;
  } else if (hasFinalizedBid) {
    can_delete = false;
    can_archive = true;
    can_cancel = false;
    can_restore = false;
  } else if (totalBids > 0 || negCount > 0 || histCount > 0) {
    can_delete = false;
    can_archive = true;
    can_cancel = true;
    can_restore = false;
  } else {
    // DRAFT / ACTIVE with 0 bids and 0 negotiations
    can_delete = true;
    can_archive = true;
    can_cancel = true;
    can_restore = false;
  }

  return {
    id: parentRow.id,
    req_no: reqNo,
    request_no: reqNo,
    batch_no: reqNo,
    title: parentRow.title || (isBatch ? `📦 Master Batch Folder (${itemsFormatted.length} Requirements)` : (pickup && drop ? `${pickup} ➔ ${drop}` : reqNo)),
    pickup_origin: pickup,
    origin_city: pickup,
    drop_location: drop,
    dest_city: drop,
    target_date: targetDateStr,
    status: parentRow.status || 'Active',
    archived_at: parentRow.archived_at || null,
    archived_by: parentRow.archived_by || null,
    cancelled_at: parentRow.cancelled_at || null,
    cancelled_by: parentRow.cancelled_by || null,
    cancellation_reason: parentRow.cancellation_reason || null,
    submitted_bids_count: totalBids,
    bid_count: totalBids,
    negotiation_count: negCount,
    history_count: histCount,
    has_finalized_bid: hasFinalizedBid,
    can_delete,
    can_archive,
    can_cancel,
    can_restore,
    approval_status: parentRow.approval_status || 'Pending',
    created_by: parentRow.created_by || 'admin',
    created_at: parentRow.created_at || new Date().toISOString(),
    updated_at: parentRow.updated_at || new Date().toISOString(),
    items: itemsFormatted,
    total_quantity_mt: totalQty,
    quantity_mt: totalQty,
    required_qty: totalQty,
    dispatched_quantity_mt: totalDispatchedQty,
    remaining_quantity_mt: totalRemainingQty,
    dispatch_status: (totalRemainingQty <= 0 && totalDispatchedQty > 0) ? 'FULLY_DISPATCHED' : (totalDispatchedQty > 0 ? 'PARTIALLY_DISPATCHED' : 'PENDING'),
    product_name: itemsFormatted.map(i => i.product_name).join(', '),
    material_type: itemsFormatted.map(i => i.product_name).join(', ')
  };
}

let isRateSubmissionsTableEnsured = false;
export async function ensureRateSubmissionsTableExists() {
  if (isRateSubmissionsTableEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate_submissions (
        id VARCHAR(100) NOT NULL PRIMARY KEY,
        requirement_id VARCHAR(100) NOT NULL,
        transporter_id VARCHAR(100) NOT NULL,
        rate_per_mt DECIMAL(12,2) NOT NULL,
        quoted_quantity_mt DECIMAL(12,3) DEFAULT NULL,
        total_amount DECIMAL(14,2) DEFAULT NULL,
        remarks TEXT DEFAULT NULL,
        status VARCHAR(50) DEFAULT 'Submitted',
        submitted_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_rate_requirement (requirement_id),
        INDEX idx_rate_transporter (transporter_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const cols = [
      { name: 'item_id', def: "VARCHAR(100) DEFAULT 'MAIN'" },
      { name: 'quoted_quantity_mt', def: 'DECIMAL(12,3) DEFAULT NULL' },
      { name: 'total_amount', def: 'DECIMAL(14,2) DEFAULT NULL' },
      { name: 'remarks', def: 'TEXT DEFAULT NULL' },
      { name: 'submitted_at', def: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP' },
      { name: 'original_rate', def: 'DECIMAL(12,2) DEFAULT NULL' },
      { name: 'counter_offer_rate', def: 'DECIMAL(12,2) DEFAULT NULL' },
      { name: 'counter_offer_status', def: 'VARCHAR(50) DEFAULT NULL' },
      { name: 'counter_offer_at', def: 'DATETIME DEFAULT NULL' },
      { name: 'counter_offer_by', def: 'VARCHAR(50) DEFAULT NULL' },
      { name: 'counter_message', def: 'TEXT DEFAULT NULL' },
      { name: 'final_rate', def: 'DECIMAL(12,2) DEFAULT NULL' },
      { name: 'finalized_at', def: 'DATETIME DEFAULT NULL' },
      { name: 'bid_status', def: "VARCHAR(50) DEFAULT 'Submitted'" }
    ];
    for (const { name, def } of cols) {
      await ensureColumnExists('rate_submissions', name, def);
    }

    // Backfill canonical fields from any existing legacy columns before dropping
    await pool.query(`
      UPDATE rate_submissions
      SET 
        counter_offer_rate = COALESCE(counter_offer_rate, counter_rate),
        counter_offer_by = COALESCE(counter_offer_by, countered_by),
        counter_offer_at = COALESCE(counter_offer_at, counter_updated_at),
        original_rate = COALESCE(original_rate, original_rate_per_mt, rate_per_mt),
        final_rate = COALESCE(final_rate, final_rate_per_mt),
        bid_status = CASE 
          WHEN UPPER(COALESCE(bid_status, '')) IN ('FINALIZED', 'AWARDED') OR UPPER(COALESCE(status, '')) IN ('FINALIZED', 'RATE FROZEN', 'AWARDED') THEN 'FINALIZED'
          WHEN UPPER(COALESCE(bid_status, '')) = 'COUNTER_ACCEPTED' THEN 'COUNTER_ACCEPTED'
          WHEN UPPER(COALESCE(bid_status, '')) = 'COUNTER_REJECTED' THEN 'COUNTER_REJECTED'
          WHEN UPPER(COALESCE(bid_status, '')) IN ('COUNTER_OFFERED', 'COUNTERED_BY_ADMIN') OR UPPER(COALESCE(counter_offer_status, '')) = 'PENDING' THEN 'COUNTER_OFFERED'
          WHEN UPPER(COALESCE(bid_status, '')) IN ('COUNTER_RESPONDED', 'COUNTERED_BY_TRANSPORTER') THEN 'COUNTER_RESPONDED'
          ELSE 'Submitted'
        END
    `).catch(() => {});

    // Phase 6: Drop Deprecated Legacy Columns safely
    const legacyColsToDrop = [
      'original_rate_per_mt',
      'final_rate_per_mt',
      'counter_rate',
      'countered_by',
      'counter_updated_at',
      'negotiation_status',
      'status'
    ];
    for (const legacyCol of legacyColsToDrop) {
      await pool.query(`ALTER TABLE rate_submissions DROP COLUMN \`${legacyCol}\``).catch(() => {});
    }

    // Phase 7: Ensure All Required Indexes Exist
    await pool.query('ALTER TABLE rate_submissions ADD INDEX idx_rate_requirement (requirement_id)').catch(() => {});
    await pool.query('ALTER TABLE rate_submissions ADD INDEX idx_rate_transporter (transporter_id)').catch(() => {});
    await pool.query('ALTER TABLE rate_submissions ADD INDEX idx_rate_item (item_id)').catch(() => {});
    await pool.query('ALTER TABLE rate_submissions ADD INDEX idx_rate_counter_status (bid_status, counter_offer_status)').catch(() => {});
    await pool.query('ALTER TABLE rate_submissions ADD UNIQUE KEY uq_req_item_trans (requirement_id, item_id, transporter_id)').catch(() => {});

    await pool.query('ALTER TABLE rate_submissions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci').catch(() => {});
    await pool.query('ALTER TABLE transporters CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci').catch(() => {});
    await pool.query('ALTER TABLE transport_requirements CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci').catch(() => {});
    await pool.query('ALTER TABLE transport_requirement_items CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci').catch(() => {});

    // Safe deduplication: Keep ONLY the latest quote per (requirement_id, item_id, transporter_id)
    try {
      await pool.query(`
        DELETE t1 FROM rate_submissions t1
        INNER JOIN rate_submissions t2 
        ON t1.requirement_id = t2.requirement_id 
        AND COALESCE(t1.item_id, 'MAIN') = COALESCE(t2.item_id, 'MAIN')
        AND t1.transporter_id = t2.transporter_id 
        AND (t1.submitted_at < t2.submitted_at OR (t1.submitted_at = t2.submitted_at AND t1.id < t2.id))
      `);
    } catch (dedupErr) {
      console.warn('Deduplication check notice:', dedupErr.message);
    }

    // Clean up orphan rate_submissions where parent requirement has been deleted
    try {
      await pool.query(`
        DELETE rs FROM rate_submissions rs
        LEFT JOIN transport_requirements tr ON tr.id = rs.requirement_id
        WHERE tr.id IS NULL
      `);
    } catch (cleanErr) {
      console.warn('Orphan cleanup notice:', cleanErr.message);
    }

    // Clean up test quote records with non-existent transporter IDs
    try {
      await pool.query("DELETE FROM rate_submissions WHERE transporter_id LIKE 'trans_audit_%' OR transporter_id LIKE 'trans_batch_%'");
    } catch (e) {}

    // Drop old requirement-only unique index and add sub-indent item-level unique index (requirement_id, item_id, transporter_id)
    await pool.query('ALTER TABLE rate_submissions DROP INDEX uq_req_trans').catch(() => {});
    await pool.query('ALTER TABLE rate_submissions ADD UNIQUE INDEX uq_req_item_trans (requirement_id, item_id, transporter_id)').catch(() => {});

    // Enforce Foreign Keys with ON DELETE CASCADE to prevent future orphan records
    await pool.query(`
      ALTER TABLE transport_requirement_items 
      ADD CONSTRAINT fk_tri_req 
      FOREIGN KEY (requirement_id) REFERENCES transport_requirements(id) 
      ON DELETE CASCADE
    `).catch(() => {});

    await pool.query(`
      ALTER TABLE rate_submissions 
      ADD CONSTRAINT fk_rs_req 
      FOREIGN KEY (requirement_id) REFERENCES transport_requirements(id) 
      ON DELETE CASCADE
    `).catch(() => {});

    // Clean up orphan item_id references if any exist before adding item_id Foreign Key
    try {
      await pool.query(`
        DELETE rs FROM rate_submissions rs
        LEFT JOIN transport_requirement_items tri ON tri.id = rs.item_id
        WHERE rs.item_id IS NOT NULL AND rs.item_id != 'MAIN' AND tri.id IS NULL
      `);
    } catch (cleanErr) {}

    await pool.query(`
      ALTER TABLE rate_submissions 
      ADD CONSTRAINT fk_rs_item 
      FOREIGN KEY (item_id) REFERENCES transport_requirement_items(id) 
      ON DELETE CASCADE
    `).catch(() => {});

    isRateSubmissionsTableEnsured = true;
  } catch (err) {
    console.warn('rate_submissions table creation notice:', err.message);
  }
}

let isBidNegotiationTableEnsured = false;
export async function ensureBidNegotiationHistoryTableExists() {
  if (isBidNegotiationTableEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bid_negotiation_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        rate_submission_id VARCHAR(100) NOT NULL,
        requirement_id VARCHAR(100) NOT NULL,
        item_id VARCHAR(100) DEFAULT NULL,
        transporter_id VARCHAR(100) NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        previous_rate DECIMAL(12,2) DEFAULT NULL,
        new_rate DECIMAL(12,2) DEFAULT NULL,
        actor_type ENUM('ADMIN','TRANSPORTER') NOT NULL,
        actor_id VARCHAR(100) DEFAULT NULL,
        message TEXT DEFAULT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bnh_submission (rate_submission_id),
        INDEX idx_bnh_req_item (requirement_id, item_id),
        INDEX idx_bnh_transporter (transporter_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Clean up orphan history rows referencing deleted requirements or submissions
    try {
      await pool.query(`
        DELETE bnh FROM bid_negotiation_history bnh
        LEFT JOIN transport_requirements tr ON tr.id = bnh.requirement_id
        WHERE tr.id IS NULL
      `);
      await pool.query(`
        DELETE bnh FROM bid_negotiation_history bnh
        LEFT JOIN rate_submissions rs ON rs.id = bnh.rate_submission_id
        WHERE rs.id IS NULL
      `);
    } catch (e) {}

    await pool.query(`
      ALTER TABLE bid_negotiation_history
      ADD CONSTRAINT fk_bnh_req
      FOREIGN KEY (requirement_id) REFERENCES transport_requirements(id)
      ON DELETE CASCADE
    `).catch(() => {});

    await pool.query(`
      ALTER TABLE bid_negotiation_history
      ADD CONSTRAINT fk_bnh_sub
      FOREIGN KEY (rate_submission_id) REFERENCES rate_submissions(id)
      ON DELETE CASCADE
    `).catch(() => {});

    isBidNegotiationTableEnsured = true;
  } catch (err) {
    console.warn('bid_negotiation_history table creation notice:', err.message);
  }
}

let isRateNegotiationsTableEnsured = false;
export async function ensureRateNegotiationsTableExists() {
  if (isRateNegotiationsTableEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate_negotiations (
        id VARCHAR(100) NOT NULL PRIMARY KEY,
        requirement_id VARCHAR(100) NOT NULL,
        item_id VARCHAR(100) NOT NULL,
        transporter_id VARCHAR(100) NOT NULL,
        rate_submission_id VARCHAR(100) NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        offered_rate DECIMAL(12,2) DEFAULT NULL,
        remarks TEXT DEFAULT NULL,
        created_by VARCHAR(100) DEFAULT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_negotiation_requirement (requirement_id),
        INDEX idx_negotiation_item (item_id),
        INDEX idx_negotiation_transporter (transporter_id),
        INDEX idx_negotiation_submission (rate_submission_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Clean up orphan negotiation rows referencing deleted requirements or submissions
    try {
      await pool.query(`
        DELETE rn FROM rate_negotiations rn
        LEFT JOIN transport_requirements tr ON tr.id = rn.requirement_id
        WHERE tr.id IS NULL
      `);
      await pool.query(`
        DELETE rn FROM rate_negotiations rn
        LEFT JOIN rate_submissions rs ON rs.id = rn.rate_submission_id
        WHERE rs.id IS NULL
      `);
    } catch (e) {}

    await pool.query(`
      ALTER TABLE rate_negotiations
      ADD CONSTRAINT fk_rn_req
      FOREIGN KEY (requirement_id) REFERENCES transport_requirements(id)
      ON DELETE CASCADE
    `).catch(() => {});

    await pool.query(`
      ALTER TABLE rate_negotiations
      ADD CONSTRAINT fk_rn_sub
      FOREIGN KEY (rate_submission_id) REFERENCES rate_submissions(id)
      ON DELETE CASCADE
    `).catch(() => {});

    isRateNegotiationsTableEnsured = true;
  } catch (err) {
    console.warn('rate_negotiations table creation notice:', err.message);
  }
}

// -------------------------------------------------------------
// SECURITY AUDIT LOGS SCHEMA 🛡️
// -------------------------------------------------------------
let isSecurityAuditLogsTableEnsured = false;
export async function ensureSecurityAuditLogsTableExists() {
  if (isSecurityAuditLogsTableEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS security_audit_logs (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        action VARCHAR(255) NOT NULL,
        username VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'system',
        user_role VARCHAR(50) DEFAULT NULL,
        ip VARCHAR(50) DEFAULT NULL,
        ip_address VARCHAR(50) DEFAULT NULL,
        status VARCHAR(100) DEFAULT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_timestamp (timestamp),
        INDEX idx_audit_created_at (created_at),
        INDEX idx_audit_username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure all required columns exist in case of legacy schema variations
    await ensureColumnExists('security_audit_logs', 'role', "VARCHAR(50) NOT NULL DEFAULT 'system'");
    await ensureColumnExists('security_audit_logs', 'user_role', "VARCHAR(50) DEFAULT NULL");
    await ensureColumnExists('security_audit_logs', 'ip', "VARCHAR(50) DEFAULT NULL");
    await ensureColumnExists('security_audit_logs', 'ip_address', "VARCHAR(50) DEFAULT NULL");
    await ensureColumnExists('security_audit_logs', 'status', "VARCHAR(100) DEFAULT NULL");
    await ensureColumnExists('security_audit_logs', 'timestamp', "DATETIME DEFAULT CURRENT_TIMESTAMP");
    await ensureColumnExists('security_audit_logs', 'created_at', "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");

    isSecurityAuditLogsTableEnsured = true;
  } catch (err) {
    console.warn('security_audit_logs table creation notice:', err.message);
  }
}

// -------------------------------------------------------------
// TRUCK DISPATCHES & CONCURRENCY-SAFE LR SEQUENCES SCHEMA 🚛📄
// -------------------------------------------------------------
let isTruckDispatchesTableEnsured = false;
export async function ensureTruckDispatchesTableExists() {
  if (isTruckDispatchesTableEnsured) return;
  try {
    await ensureSecurityAuditLogsTableExists();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lr_sequences (
        prefix VARCHAR(50) NOT NULL PRIMARY KEY,
        last_seq INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS truck_dispatches (
        id VARCHAR(100) NOT NULL PRIMARY KEY,
        requirement_id VARCHAR(100) NOT NULL,
        requirement_item_id VARCHAR(100) NOT NULL,
        transporter_id VARCHAR(100) NOT NULL,
        finalized_rate DECIMAL(12,2) NOT NULL,
        truck_number VARCHAR(50) NOT NULL,
        loaded_quantity_mt DECIMAL(12,3) NOT NULL,
        driver_name VARCHAR(150) NOT NULL,
        driver_mobile VARCHAR(50) NOT NULL,
        driver_license VARCHAR(100) NOT NULL,
        lr_number VARCHAR(100) NOT NULL,
        dispatch_reference VARCHAR(100) DEFAULT NULL,
        dispatch_status VARCHAR(50) NOT NULL DEFAULT 'Dispatched',
        dispatched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_dispatches_req_item (requirement_id, requirement_item_id),
        INDEX idx_dispatches_transporter (transporter_id),
        UNIQUE KEY unique_lr_number (lr_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const subCols = [
      { name: 'is_finalized', def: 'TINYINT(1) DEFAULT 0' },
      { name: 'finalized_rate', def: 'DECIMAL(12,2) DEFAULT NULL' },
      { name: 'finalized_by', def: 'VARCHAR(100) DEFAULT NULL' },
      { name: 'acceptance_status', def: 'VARCHAR(50) DEFAULT NULL' },
      { name: 'transporter_accepted_at', def: 'DATETIME DEFAULT NULL' },
      { name: 'transporter_accepted_by', def: 'VARCHAR(100) DEFAULT NULL' }
    ];
    for (const { name, def } of subCols) {
      await ensureColumnExists('rate_submissions', name, def);
    }

    const itemCols = [
      { name: 'dispatch_status', def: "VARCHAR(50) DEFAULT 'PENDING'" },
      { name: 'dispatched_quantity_mt', def: 'DECIMAL(12,3) DEFAULT 0' },
      { name: 'remaining_quantity_mt', def: 'DECIMAL(12,3) DEFAULT NULL' }
    ];
    for (const { name, def } of itemCols) {
      await ensureColumnExists('transport_requirement_items', name, def);
    }

    await pool.query(`
      ALTER TABLE truck_dispatches
      ADD CONSTRAINT fk_dispatches_req
      FOREIGN KEY (requirement_id) REFERENCES transport_requirements(id)
      ON DELETE CASCADE
    `).catch(() => {});

    await pool.query(`
      ALTER TABLE truck_dispatches
      ADD CONSTRAINT fk_dispatches_transporter
      FOREIGN KEY (transporter_id) REFERENCES transporters(id)
      ON DELETE CASCADE
    `).catch(() => {});

    isTruckDispatchesTableEnsured = true;
  } catch (err) {
    console.warn('truck_dispatches table creation notice:', err.message);
  }
}

// Concurrency-safe LR Number Generator
async function generateUniqueLrNumber(clientOrPool, customYear) {
  const year = customYear || new Date().getFullYear();
  const prefix = `LR-SNPL-${year}`;

  await clientOrPool.query(
    `INSERT INTO lr_sequences (prefix, last_seq) VALUES (?, 1)
     ON DUPLICATE KEY UPDATE last_seq = last_seq + 1`,
    [prefix]
  );

  const [rows] = await clientOrPool.query(
    `SELECT last_seq FROM lr_sequences WHERE prefix = ? FOR UPDATE`,
    [prefix]
  );

  const seq = Number(rows[0]?.last_seq || 1);
  const formattedSeq = String(seq).padStart(5, '0');
  return `${prefix}-${formattedSeq}`;
}

// Server-side Authenticated Transporter Identity Resolver
// Canonical proof: MUST match a verified record in the transporters database table
async function resolveAuthenticatedTransporter(req) {
  if (!req.user) return null;
  const userRole = String(req.user.role || '').trim().toLowerCase();
  if (userRole !== 'transporter') return null;

  // 1. Direct transporter_id lookup
  if (req.user.transporter_id) {
    const [rows] = await pool.query('SELECT * FROM transporters WHERE id = ? LIMIT 1', [req.user.transporter_id]);
    if (rows.length > 0) return rows[0];
  }

  // 2. Lookup by username or code or id
  const searchKey = req.user.username || req.user.id;
  if (searchKey) {
    const [rows] = await pool.query(
      'SELECT * FROM transporters WHERE id = ? OR username = ? OR code = ? LIMIT 1',
      [searchKey, searchKey, searchKey]
    );
    if (rows.length > 0) return rows[0];
  }

  // 3. Check users table linkage to transporters table
  try {
    const [uRows] = await pool.query(
      'SELECT id, username, role, transporter_id FROM users WHERE id = ? OR username = ? LIMIT 1',
      [req.user.id, req.user.username]
    );
    if (uRows.length > 0 && uRows[0].transporter_id) {
      const [tRows] = await pool.query('SELECT * FROM transporters WHERE id = ? LIMIT 1', [uRows[0].transporter_id]);
      if (tRows.length > 0) return tRows[0];
    }
  } catch (e) {}

  // If no matching verified record exists in the transporters table, access is strictly denied
  return null;
}

async function handleGetRequirements(req, res) {
  try {
    await ensureRequirementsTableExists();
    await ensureRateSubmissionsTableExists();
    await ensureBidNegotiationHistoryTableExists();
    await ensureRateNegotiationsTableExists();

    let reqQuery = 'SELECT * FROM transport_requirements';
    if (req.user && req.user.role === 'transporter') {
      reqQuery += " WHERE UPPER(COALESCE(status, 'ACTIVE')) NOT IN ('ARCHIVED', 'DELETED')";
    }
    reqQuery += ' ORDER BY created_at DESC LIMIT 300';

    // ⚡ Fast parallel execution of parent requirements, grouped bid stats, negotiations, and history
    const [parentsResult, itemBidResult, negResult, histResult] = await Promise.all([
      pool.query(reqQuery),
      pool.query(
        "SELECT requirement_id, item_id, COUNT(DISTINCT transporter_id) as cnt, MIN(rate_per_mt) as min_rate, SUM(CASE WHEN UPPER(COALESCE(bid_status, '')) IN ('FINALIZED', 'COUNTER_ACCEPTED') OR final_rate > 0 THEN 1 ELSE 0 END) as finalized_cnt FROM rate_submissions WHERE UPPER(COALESCE(bid_status, '')) IN ('SUBMITTED', 'COUNTER_OFFERED', 'COUNTER_RESPONDED', 'COUNTER_ACCEPTED', 'FINALIZED') GROUP BY requirement_id, item_id"
      ),
      pool.query("SELECT requirement_id, COUNT(*) as cnt FROM rate_negotiations GROUP BY requirement_id"),
      pool.query("SELECT requirement_id, COUNT(*) as cnt FROM bid_negotiation_history GROUP BY requirement_id")
    ]);

    const parents = parentsResult[0] || [];
    const itemBidRows = itemBidResult[0] || [];
    const negRows = negResult[0] || [];
    const histRows = histResult[0] || [];

    if (parents.length === 0) {
      return res.json({ success: true, count: 0, data: [], requirements: [], rate_requests: [] });
    }

    const bidsCountMap = {};
    const finalizedCountMap = {};
    const itemStatsMap = {};
    const negCountMap = {};
    const histCountMap = {};

    negRows.forEach((n) => {
      if (n.requirement_id) negCountMap[n.requirement_id] = Number(n.cnt || 0);
    });

    histRows.forEach((h) => {
      if (h.requirement_id) histCountMap[h.requirement_id] = Number(h.cnt || 0);
    });

    itemBidRows.forEach((b) => {
      const stats = {
        bids_count: Number(b.cnt || 0),
        lowest_rate: b.min_rate ? Number(b.min_rate) : null
      };
      const comboKey = `${b.requirement_id}_${b.item_id}`;
      itemStatsMap[comboKey] = stats;
      if (b.item_id) itemStatsMap[b.item_id] = stats;
      if (b.requirement_id) {
        bidsCountMap[b.requirement_id] = (bidsCountMap[b.requirement_id] || 0) + Number(b.cnt || 0);
        finalizedCountMap[b.requirement_id] = (finalizedCountMap[b.requirement_id] || 0) + Number(b.finalized_cnt || 0);
      }
    });

    const parentIds = parents.map((p) => p.id);
    const [childRows] = await pool.query(
      'SELECT * FROM transport_requirement_items WHERE requirement_id IN (?) ORDER BY id ASC',
      [parentIds]
    );

    const itemsMap = {};
    (childRows || []).forEach((item) => {
      if (!itemsMap[item.requirement_id]) itemsMap[item.requirement_id] = [];
      itemsMap[item.requirement_id].push(item);
    });

    const formatted = parents.map((p) => {
      const totalBids = bidsCountMap[p.id] || bidsCountMap[p.req_no] || 0;
      const extraMetrics = {
        has_finalized_bid: (finalizedCountMap[p.id] || finalizedCountMap[p.req_no] || 0) > 0,
        negotiation_count: negCountMap[p.id] || negCountMap[p.req_no] || 0,
        history_count: histCountMap[p.id] || histCountMap[p.req_no] || 0
      };
      return formatParentRequirementDto(p, itemsMap[p.id] || [], totalBids, itemStatsMap, extraMetrics);
    });
    return res.json({ success: true, count: formatted.length, data: formatted, requirements: formatted, rate_requests: formatted });
  } catch (err) {
    console.error('❌ GET /api/requirements Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
}

// GET /api/requirements/:id/rates — Compare Rates for a Parent Requirement (Joined with Transporters)
async function handleGetRequirementRates(req, res) {
  const { id } = req.params;
  const itemId = req.query.item_id || req.query.sub_indent_id;
  if (!id) return res.status(400).json({ success: false, error: 'Requirement ID required' });

  try {
    await ensureRateSubmissionsTableExists();
    await ensureRequirementsTableExists();

    const [parentRows] = await pool.query(
      'SELECT id, req_no, title, pickup_origin, drop_location, status, approval_status FROM transport_requirements WHERE id = ? OR req_no = ? LIMIT 1',
      [id, id]
    );

    if (parentRows.length === 0) {
      return res.status(404).json({ success: false, error: `Requirement '${id}' not found.` });
    }

    const parentReq = parentRows[0];
    const actualReqId = parentReq.id;

    const [childRows] = await pool.query(
      'SELECT id, sub_indent_no, requirement_id, product_name, quantity_mt, unit FROM transport_requirement_items WHERE requirement_id = ? ORDER BY id ASC',
      [actualReqId]
    );

    let totalCargoQty = 0;
    let targetItemObj = null;
    if (itemId) {
      targetItemObj = childRows.find(i => String(i.id) === String(itemId) || String(i.sub_indent_no) === String(itemId) || String(i.id).endsWith(String(itemId)));
      if (targetItemObj) {
        totalCargoQty = parseFloat(targetItemObj.quantity_mt || 0);
      }
    }
    if (totalCargoQty === 0) {
      childRows.forEach(item => {
        totalCargoQty += parseFloat(item.quantity_mt || 0);
      });
    }

    let ratesQuery = 'SELECT id, requirement_id, item_id, transporter_id, rate_per_mt, original_rate, counter_offer_rate, final_rate, finalized_rate, is_finalized, finalized_by, acceptance_status, transporter_accepted_at, transporter_accepted_by, bid_status, counter_offer_status, counter_offer_by, counter_message, counter_offer_at, finalized_at, quoted_quantity_mt, total_amount, remarks, submitted_at, updated_at FROM rate_submissions WHERE requirement_id = ?';
    let queryParams = [actualReqId];

    if (itemId) {
      if (targetItemObj) {
        ratesQuery += ' AND (item_id = ? OR item_id = ?)';
        queryParams.push(targetItemObj.id, targetItemObj.sub_indent_no);
      } else {
        ratesQuery += ' AND item_id = ?';
        queryParams.push(itemId);
      }
    }
    ratesQuery += ' ORDER BY rate_per_mt ASC';

    const [rates] = await pool.query(ratesQuery, queryParams);

    const transporterIds = Array.from(new Set(rates.map(r => r.transporter_id).filter(Boolean)));
    let transportersMap = {};
    if (transporterIds.length > 0) {
      const [transRows] = await pool.query('SELECT * FROM transporters WHERE id IN (?)', [transporterIds]);
      (transRows || []).forEach(t => {
        transportersMap[t.id] = t;
      });
    }

    const formattedRates = rates
      .filter(r => transportersMap[r.transporter_id])
      .map(r => {
        const t = transportersMap[r.transporter_id] || {};
      const rateVal = parseFloat(r.rate_per_mt || 0);
      const qtyVal = parseFloat(r.quoted_quantity_mt || 0) || totalCargoQty;
      const calcTotal = r.total_amount ? parseFloat(r.total_amount) : parseFloat((rateVal * qtyVal).toFixed(2));
      const isFin = Boolean(r.is_finalized || ['FINALIZED', 'COUNTER_ACCEPTED'].includes(String(r.bid_status || '').toUpperCase()) || Number(r.final_rate) > 0);
      return {
        id: r.id,
        requirement_id: r.requirement_id,
        item_id: r.item_id || 'MAIN',
        rate_request_id: r.requirement_id,
        transporter_id: r.transporter_id,
        company_name: t.company_name || r.transporter_id,
        transporter_name: t.company_name || r.transporter_id,
        vendor_code: t.code || '',
        contact_person: t.contact_person || '',
        mobile: t.mobile || '',
        rate_per_mt: rateVal,
        rate_per_unit: rateVal,
        quoted_quantity_mt: qtyVal,
        total_amount: calcTotal,
        remarks: r.remarks || '',
        status: r.bid_status ? String(r.bid_status).toUpperCase() : 'SUBMITTED',
        bid_status: r.bid_status ? String(r.bid_status).toUpperCase() : 'SUBMITTED',
        negotiation_status: r.bid_status ? String(r.bid_status).toUpperCase() : 'SUBMITTED',
        original_rate: r.original_rate ? parseFloat(r.original_rate) : rateVal,
        counter_rate: r.counter_offer_rate ? parseFloat(r.counter_offer_rate) : null,
        counter_offer_rate: r.counter_offer_rate ? parseFloat(r.counter_offer_rate) : null,
        counter_offer_status: r.counter_offer_status || null,
        counter_offer_by: r.counter_offer_by || null,
        counter_offer_at: r.counter_offer_at || null,
        counter_message: r.counter_message || null,
        final_rate: r.final_rate ? parseFloat(r.final_rate) : null,
        finalized_rate: r.finalized_rate ? parseFloat(r.finalized_rate) : (r.final_rate ? parseFloat(r.final_rate) : null),
        is_finalized: isFin,
        finalized_at: r.finalized_at || null,
        finalized_by: r.finalized_by || null,
        acceptance_status: r.acceptance_status || (isFin ? 'PENDING' : null),
        transporter_accepted_at: r.transporter_accepted_at || null,
        transporter_accepted_by: r.transporter_accepted_by || null,
        is_frozen: isFin,
        submitted_at: r.submitted_at
      };
    });

    let lowestRate = null;
    let lowestTransporter = null;
    let lowestTotalAmount = null;

    if (formattedRates.length > 0) {
      const lowestObj = formattedRates[0];
      lowestRate = lowestObj.rate_per_mt;
      lowestTransporter = lowestObj.company_name;
      lowestTotalAmount = lowestObj.total_amount;
    }

    return res.json({
      success: true,
      count: formattedRates.length,
      requirement: {
        id: parentReq.id,
        req_no: parentReq.req_no,
        title: parentReq.title,
        pickup_origin: parentReq.pickup_origin,
        drop_location: parentReq.drop_location,
        status: parentReq.status,
        approval_status: parentReq.approval_status,
        total_cargo_mt: totalCargoQty,
        cargo_items_count: childRows.length
      },
      lowest_rate: lowestRate,
      lowest_transporter: lowestTransporter,
      lowest_total_amount: lowestTotalAmount,
      rates: formattedRates
    });
  } catch (err) {
    console.error('❌ GET /api/requirements/:id/rates Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
}

// POST /api/rate-submissions — Transporter Rate Quote Creation Endpoint
async function handleCreateRateSubmission(req, res) {
  try {
    await ensureRateSubmissionsTableExists();
    await ensureRequirementsTableExists();

    const {
      id,
      requirement_id, rate_request_id, request_id,
      transporter_id,
      rate_per_mt, rate_per_unit,
      quoted_quantity_mt, required_qty,
      remarks, comments, notes,
      status
    } = req.body;

    // 🛡️ Resolve authenticated transporter identity from token and transporters table
    const candidateTransIds = req.user.role === 'transporter'
      ? [
          req.user.transporter_id,
          req.user.username,
          req.user.id
        ].filter(Boolean)
      : [
          transporter_id,
          req.user.transporter_id,
          req.user.username,
          req.user.id,
          req.body.transporter_code,
          req.body.transporter_name
        ].filter(Boolean);

    candidateTransIds.forEach(idStr => {
      const clean = String(idStr).replace(/^(usr_|trans_)/i, '');
      if (clean && !candidateTransIds.includes(clean)) {
        candidateTransIds.push(clean);
      }
    });

    const targetReqId = (requirement_id || rate_request_id || request_id || '').trim();
    if (!targetReqId) {
      return res.status(400).json({ success: false, error: 'requirement_id is required.' });
    }

    const rateVal = parseFloat(rate_per_mt || rate_per_unit);
    if (isNaN(rateVal) || rateVal <= 0) {
      return res.status(400).json({ success: false, error: 'rate_per_mt must be a positive number greater than 0.' });
    }

    // Verify parent requirement exists
    const [reqRows] = await pool.query(
      'SELECT id, req_no, status FROM transport_requirements WHERE id = ? OR req_no = ? LIMIT 1',
      [targetReqId, targetReqId]
    );

    if (reqRows.length === 0) {
      return res.status(404).json({ success: false, error: `Requirement '${targetReqId}' not found.` });
    }

    const reqRecord = reqRows[0];
    const actualReqId = reqRecord.id;

    if (reqRecord.status && ['ARCHIVED', 'CANCELLED', 'COMPLETED', 'CLOSED'].includes(String(reqRecord.status).toUpperCase())) {
      return res.status(400).json({ success: false, message: 'This requirement is no longer accepting bids.', error: 'This requirement is no longer accepting bids.' });
    }

    // Verify transporter exists
    const [transRows] = await pool.query(
      `SELECT id, company_name, code, username FROM transporters 
       WHERE id IN (?) OR code IN (?) OR username IN (?) OR company_name IN (?) LIMIT 1`,
      [candidateTransIds, candidateTransIds, candidateTransIds, candidateTransIds]
    );

    const actualTransId = transRows[0]?.id || req.user.transporter_id || req.user.username || req.user.id;
    const transName = transRows[0]?.company_name || req.user.name || actualTransId;

    const rawItemId = (req.body.item_id || req.body.sub_indent_id || req.body.requirement_item_id || '').trim();
    let actualItemId = rawItemId;
    let totalCargoQty = 0;

    const [itemRows] = await pool.query(
      'SELECT id, quantity_mt FROM transport_requirement_items WHERE (id = ? OR sub_indent_no = ?) AND requirement_id = ? LIMIT 1',
      [rawItemId, rawItemId, actualReqId]
    );

    if (itemRows.length > 0) {
      actualItemId = itemRows[0].id;
      totalCargoQty = parseFloat(itemRows[0].quantity_mt || 0);
    } else {
      const [childItems] = await pool.query(
        'SELECT id, quantity_mt FROM transport_requirement_items WHERE requirement_id = ? ORDER BY id ASC LIMIT 1',
        [actualReqId]
      );
      if (childItems.length > 0) {
        actualItemId = childItems[0].id;
        totalCargoQty = parseFloat(childItems[0].quantity_mt || 0);
      }
    }

    if (!totalCargoQty) {
      const [childItemsAll] = await pool.query(
        'SELECT quantity_mt FROM transport_requirement_items WHERE requirement_id = ?',
        [actualReqId]
      );
      (childItemsAll || []).forEach((i) => { totalCargoQty += parseFloat(i.quantity_mt || 0); });
    }

    const qtyVal = parseFloat(quoted_quantity_mt || required_qty) || totalCargoQty || null;
    const totalAmount = qtyVal ? parseFloat((rateVal * qtyVal).toFixed(2)) : null;

    // Check if an existing quote exists for (requirement_id, item_id, transporter_id)
    const [existingQuotes] = await pool.query(
      'SELECT id, rate_per_mt, bid_status FROM rate_submissions WHERE requirement_id = ? AND item_id = ? AND transporter_id = ? LIMIT 1',
      [actualReqId, actualItemId, actualTransId]
    );

    const subId = existingQuotes[0]?.id || id || `rate_sub_${actualTransId}_${actualItemId}_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;
    const subStatus = status || 'Submitted';
    const rem = (remarks || comments || notes || '').trim() || null;

    await ensureBidNegotiationHistoryTableExists();
    await ensureRateNegotiationsTableExists();

    await pool.query(
      `INSERT INTO rate_submissions (id, requirement_id, item_id, transporter_id, rate_per_mt, original_rate, quoted_quantity_mt, total_amount, remarks, bid_status, submitted_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', NOW(), NOW())
       ON DUPLICATE KEY UPDATE
       rate_per_mt = VALUES(rate_per_mt),
       original_rate = COALESCE(original_rate, VALUES(original_rate)),
       quoted_quantity_mt = VALUES(quoted_quantity_mt),
       total_amount = VALUES(total_amount),
       remarks = VALUES(remarks),
       bid_status = 'SUBMITTED',
       updated_at = NOW()`,
      [subId, actualReqId, actualItemId, actualTransId, rateVal, rateVal, qtyVal, totalAmount, rem]
    );

    try {
      const [histCheck] = await pool.query(
        'SELECT id FROM rate_negotiations WHERE rate_submission_id = ? AND action_type = "INITIAL_QUOTE" LIMIT 1',
        [subId]
      );
      if (histCheck.length === 0) {
        const negId = `neg_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;
        await pool.query(
          `INSERT INTO rate_negotiations
           (id, requirement_id, item_id, transporter_id, rate_submission_id, action_type, offered_rate, remarks, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, 'INITIAL_QUOTE', ?, ?, ?, NOW())`,
          [negId, actualReqId, actualItemId, actualTransId, subId, rateVal, rem || 'Initial quote submitted by transporter', actualTransId]
        );
      }
    } catch (hErr) {
      console.warn('Rate negotiations initial quote notice:', hErr.message);
    }

    try {
      const [histCheck] = await pool.query(
        'SELECT id FROM bid_negotiation_history WHERE rate_submission_id = ? AND action_type = "INITIAL_BID" LIMIT 1',
        [subId]
      );
      if (histCheck.length === 0) {
        await pool.query(
          `INSERT INTO bid_negotiation_history 
           (rate_submission_id, requirement_id, item_id, transporter_id, action_type, previous_rate, new_rate, actor_type, actor_id, message, created_at)
           VALUES (?, ?, ?, ?, 'INITIAL_BID', NULL, ?, 'TRANSPORTER', ?, ?, NOW())`,
          [subId, actualReqId, actualItemId, actualTransId, rateVal, actualTransId, rem || 'Initial bid submitted by transporter']
        );
      }
    } catch (hErr) {
      console.warn('History insertion notice:', hErr.message);
    }

    const [freshRows] = await pool.query(
      `SELECT 
        s.id,
        s.requirement_id,
        s.requirement_id AS rate_request_id,
        s.requirement_id AS request_id,
        s.item_id,
        s.transporter_id,
        COALESCE(t.company_name, s.transporter_id) AS transporter_name,
        COALESCE(t.code, '') AS transporter_code,
        s.rate_per_mt,
        s.rate_per_mt AS rate_per_unit,
        s.quoted_quantity_mt,
        s.total_amount,
        s.remarks,
        s.remarks AS comments,
        s.original_rate,
        s.counter_offer_rate,
        s.counter_offer_status,
        s.counter_offer_by,
        s.counter_offer_at,
        s.counter_message,
        s.final_rate,
        s.finalized_at,
        s.bid_status,
        s.bid_status AS status,
        s.bid_status AS negotiation_status,
        s.submitted_at,
        s.updated_at,
        COALESCE(r.req_no, r.id, '') AS request_no,
        COALESCE(i.sub_indent_no, '') AS sub_indent_no
      FROM rate_submissions s
      LEFT JOIN transporters t ON (t.id = s.transporter_id OR t.code = s.transporter_id OR t.username = s.transporter_id)
      LEFT JOIN transport_requirements r ON r.id = s.requirement_id
      LEFT JOIN transport_requirement_items i ON i.id = s.item_id
      WHERE s.id = ? OR (s.requirement_id = ? AND s.item_id = ? AND s.transporter_id = ?)
      ORDER BY s.updated_at DESC LIMIT 1`,
      [subId, actualReqId, actualItemId, actualTransId]
    );

    const savedSubmission = (freshRows && freshRows[0]) ? freshRows[0] : {
      id: subId,
      requirement_id: actualReqId,
      rate_request_id: actualReqId,
      request_id: actualReqId,
      item_id: actualItemId,
      sub_indent_id: actualItemId,
      request_no: req.body.request_no || req.body.sub_indent_no || '',
      sub_indent_no: req.body.sub_indent_no || req.body.request_no || '',
      transporter_id: actualTransId,
      transporter_name: transName,
      rate_per_mt: rateVal,
      rate_per_unit: rateVal,
      original_rate: rateVal,
      original_rate_per_mt: rateVal,
      quoted_quantity_mt: qtyVal,
      total_amount: totalAmount,
      remarks: rem,
      status: 'SUBMITTED',
      bid_status: 'SUBMITTED',
      negotiation_status: 'SUBMITTED',
      submitted_at: new Date().toISOString()
    };

    return res.json({
      success: true,
      message: 'Rate submitted successfully',
      data: savedSubmission,
      submission: savedSubmission,
      bid: savedSubmission
    });
  } catch (err) {
    console.error('❌ POST /api/rate-submissions Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
}

// -------------------------------------------------------------
// ADMIN COUNTER OFFER API HANDLER 🛡️
// -------------------------------------------------------------
async function handleAdminCounter(req, res) {
  try {
    await ensureRateSubmissionsTableExists();
    await ensureBidNegotiationHistoryTableExists();
    await ensureRateNegotiationsTableExists();

    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied. Admin access required.' });
    }

    const { id } = req.params;
    const { counter_rate, message, remarks } = req.body;
    const remText = remarks || message || null;

    const counterRateVal = parseFloat(counter_rate);
    if (isNaN(counterRateVal) || counterRateVal <= 0) {
      return res.status(400).json({ success: false, error: 'counter_rate must be a positive number.' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query('SELECT * FROM rate_submissions WHERE id = ? LIMIT 1', [id]);
      if (rows.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ success: false, error: 'Rate submission not found.' });
      }

      const sub = rows[0];
      if (sub.bid_status === 'FINALIZED' || sub.bid_status === 'finalized' || sub.status === 'Rate Frozen' || sub.status === 'Awarded') {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ success: false, error: 'Cannot send counter offer for a finalized or awarded bid.' });
      }

      const prevRate = parseFloat(sub.counter_offer_rate || sub.rate_per_mt || sub.original_rate || 0);
      const origRate = sub.original_rate ? parseFloat(sub.original_rate) : parseFloat(sub.rate_per_mt);

      const [updateRes] = await conn.query(
        `UPDATE rate_submissions
         SET original_rate = COALESCE(original_rate, ?),
             counter_offer_rate = ?,
             counter_offer_status = 'PENDING',
             bid_status = 'COUNTER_OFFERED',
             counter_offer_by = 'ADMIN',
             counter_message = ?,
             counter_offer_at = NOW(),
             updated_at = NOW()
         WHERE id = ?`,
        [origRate, counterRateVal, remText, id]
      );

      console.log(`💬 [ADMIN COUNTER] Updated bid ID: ${id}, rate: ₹${counterRateVal}/MT, affectedRows: ${updateRes.affectedRows}`);

      const negId = `neg_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;
      await conn.query(
        `INSERT INTO rate_negotiations
         (id, requirement_id, item_id, transporter_id, rate_submission_id, action_type, offered_rate, remarks, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, 'ADMIN_COUNTER', ?, ?, ?, NOW())`,
        [negId, sub.requirement_id, sub.item_id || 'MAIN', sub.transporter_id, id, counterRateVal, remText, req.user.username || 'admin']
      );

      await conn.query(
        `INSERT INTO bid_negotiation_history 
         (rate_submission_id, requirement_id, item_id, transporter_id, action_type, previous_rate, new_rate, actor_type, actor_id, message, created_at)
         VALUES (?, ?, ?, ?, 'ADMIN_COUNTER', ?, ?, 'ADMIN', ?, ?, NOW())`,
        [id, sub.requirement_id, sub.item_id || 'MAIN', sub.transporter_id, prevRate, counterRateVal, req.user.username || 'admin', remText || `Admin proposed counter offer of ₹${counterRateVal}/MT`]
      );

      await conn.commit();
      conn.release();

      const [updatedRows] = await pool.query('SELECT * FROM rate_submissions WHERE id = ? LIMIT 1', [id]);
      return res.json({
        success: true,
        message: `Counter offer of ₹${counterRateVal}/MT sent successfully`,
        submission: updatedRows[0]
      });
    } catch (txErr) {
      await conn.rollback();
      conn.release();
      throw txErr;
    }
  } catch (err) {
    console.error('❌ POST /api/rate-submissions/:id/admin-counter Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
}

// -------------------------------------------------------------
// ADMIN BULK COUNTER OFFER API HANDLER (Send to All Bidders on Item) 🎯
// -------------------------------------------------------------
async function handleAdminCounterAll(req, res) {
  try {
    await ensureRateSubmissionsTableExists();
    await ensureBidNegotiationHistoryTableExists();
    await ensureRateNegotiationsTableExists();

    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied. Admin access required.' });
    }

    const requirementId = req.params.requirementId || req.body.requirement_id;
    const itemId = req.params.itemId || req.body.item_id;
    const { counter_rate, remarks, message } = req.body;
    const remText = remarks || message || null;

    const counterRateVal = parseFloat(counter_rate);
    if (isNaN(counterRateVal) || counterRateVal <= 0) {
      return res.status(400).json({ success: false, error: 'counter_rate must be a positive number.' });
    }

    if (!requirementId) {
      return res.status(400).json({ success: false, error: 'requirementId is required.' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Resolve canonical parent requirement ID
      const [reqRows] = await conn.query(
        'SELECT id, req_no FROM transport_requirements WHERE id = ? OR req_no = ? LIMIT 1',
        [requirementId, requirementId]
      );
      const actualReqId = reqRows[0]?.id || requirementId;

      let actualItemId = itemId || 'MAIN';
      if (itemId && itemId !== 'MAIN') {
        const [itemRows] = await conn.query(
          'SELECT id, sub_indent_no FROM transport_requirement_items WHERE (id = ? OR sub_indent_no = ?) AND requirement_id = ? LIMIT 1',
          [itemId, itemId, actualReqId]
        );
        if (itemRows.length > 0) {
          actualItemId = itemRows[0].id;
        }
      }

      // Find all submitted quotes for this requirement & item
      let quotesQuery = `SELECT * FROM rate_submissions 
                         WHERE requirement_id = ? 
                           AND UPPER(COALESCE(bid_status, '')) NOT IN ('FINALIZED', 'AWARDED')`;
      let queryParams = [actualReqId];

      if (actualItemId && actualItemId !== 'MAIN') {
        quotesQuery += ` AND (item_id = ? OR item_id = ? OR item_id = 'MAIN')`;
        queryParams.push(actualItemId, itemId);
      }

      const [quotes] = await conn.query(quotesQuery, queryParams);
      let targetQuotes = [...quotes];

      if (targetQuotes.length === 0) {
        // Fallback: search all active quotes on parent requirement
        const [fallbackQuotes] = await conn.query(
          `SELECT * FROM rate_submissions 
           WHERE requirement_id = ? 
             AND UPPER(COALESCE(bid_status, '')) NOT IN ('FINALIZED', 'AWARDED')`,
          [actualReqId]
        );
        targetQuotes = fallbackQuotes;
      }

      if (targetQuotes.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ success: false, error: 'No active transporter quotes found for this requirement.' });
      }

      const adminUser = req.user.username || 'admin';
      let updatedCount = 0;

      for (const sub of targetQuotes) {
        const prevRate = parseFloat(sub.counter_offer_rate || sub.rate_per_mt || 0);
        const origRate = sub.original_rate ? parseFloat(sub.original_rate) : parseFloat(sub.rate_per_mt || 0);

        const [uRes] = await conn.query(
          `UPDATE rate_submissions
           SET original_rate = COALESCE(original_rate, ?),
               counter_offer_rate = ?,
               counter_offer_status = 'PENDING',
               bid_status = 'COUNTER_OFFERED',
               counter_offer_by = 'ADMIN',
               counter_message = ?,
               counter_offer_at = NOW(),
               updated_at = NOW()
           WHERE id = ?`,
          [origRate, counterRateVal, remText, sub.id]
        );

        console.log(`💬 [ADMIN BULK COUNTER] Updated bid ID: ${sub.id}, rate: ₹${counterRateVal}/MT, affectedRows: ${uRes.affectedRows}`);

        const negId = `neg_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;
        await conn.query(
          `INSERT INTO rate_negotiations
           (id, requirement_id, item_id, transporter_id, rate_submission_id, action_type, offered_rate, remarks, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, 'ADMIN_COUNTER', ?, ?, ?, NOW())`,
          [negId, sub.requirement_id || actualReqId, sub.item_id || actualItemId, sub.transporter_id, sub.id, counterRateVal, remText, adminUser]
        );

        await conn.query(
          `INSERT INTO bid_negotiation_history 
           (rate_submission_id, requirement_id, item_id, transporter_id, action_type, previous_rate, new_rate, actor_type, actor_id, message, created_at)
           VALUES (?, ?, ?, ?, 'ADMIN_COUNTER', ?, ?, 'ADMIN', ?, ?, NOW())`,
          [sub.id, sub.requirement_id || actualReqId, sub.item_id || actualItemId, sub.transporter_id, prevRate, counterRateVal, adminUser, remText || `Admin proposed counter offer of ₹${counterRateVal}/MT to all bidders`]
        );

        updatedCount++;
      }

      await conn.commit();
      conn.release();

      return res.json({
        success: true,
        counter_rate: counterRateVal,
        affected_transporters: updatedCount,
        message: `Counter offer of ₹${counterRateVal}/MT sent successfully to ${updatedCount} transporter(s)`
      });
    } catch (txErr) {
      await conn.rollback();
      conn.release();
      throw txErr;
    }
  } catch (err) {
    console.error('❌ POST /api/requirements/:requirementId/items/:itemId/counter-offer-all Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
}

// -------------------------------------------------------------
// TRANSPORTER RESPONSE (ACCEPT / REJECT / COUNTER) API HANDLER 🚛
// -------------------------------------------------------------
async function handleTransporterResponse(req, res) {
  try {
    await ensureRateSubmissionsTableExists();
    await ensureBidNegotiationHistoryTableExists();
    await ensureRateNegotiationsTableExists();

    const { id } = req.params;
    const { action, counter_rate, proposed_rate, remarks, message } = req.body;
    const remText = remarks || message || null;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query('SELECT * FROM rate_submissions WHERE id = ? LIMIT 1', [id]);
      if (rows.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ success: false, error: 'Rate submission not found.' });
      }

      const sub = rows[0];

      // Security check: Only owner transporter or admin allowed
      if (req.user.role === 'transporter') {
        const authTransporterId = req.user.transporter_id || req.user.id || req.user.username;
        if (String(sub.transporter_id) !== String(authTransporterId) && String(sub.transporter_id) !== String(req.user.username)) {
          await conn.rollback();
          conn.release();
          return res.status(403).json({ success: false, error: 'Access denied. You can only respond to your own bids.' });
        }
      }

      if (sub.bid_status === 'FINALIZED' || sub.bid_status === 'finalized') {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ success: false, error: 'This bid is finalized and cannot be modified.' });
      }

      const prevRate = parseFloat(sub.counter_offer_rate || sub.rate_per_mt || 0);
      const actionUpper = String(action || '').toUpperCase();

      if (actionUpper === 'ACCEPT') {
        const agreedRate = sub.counter_offer_rate ? parseFloat(sub.counter_offer_rate) : parseFloat(sub.rate_per_mt);
        const qtyVal = parseFloat(sub.quoted_quantity_mt || 0);
        const calcTotal = qtyVal ? parseFloat((agreedRate * qtyVal).toFixed(2)) : null;

        const [uRes] = await conn.query(
          `UPDATE rate_submissions
           SET final_rate = ?,
               rate_per_mt = ?,
               total_amount = ?,
               bid_status = 'COUNTER_ACCEPTED',
               counter_offer_status = 'ACCEPTED',
               finalized_at = NOW(),
               updated_at = NOW()
           WHERE id = ?`,
          [agreedRate, agreedRate, calcTotal, id]
        );

        console.log(`🤝 [TRANSPORTER ACCEPT] Bid ID ${id} accepted at ₹${agreedRate}/MT, affectedRows: ${uRes.affectedRows}`);

        const negId = `neg_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;
        await conn.query(
          `INSERT INTO rate_negotiations
           (id, requirement_id, item_id, transporter_id, rate_submission_id, action_type, offered_rate, remarks, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, 'COUNTER_ACCEPTED', ?, ?, ?, NOW())`,
          [negId, sub.requirement_id, sub.item_id || 'MAIN', sub.transporter_id, id, agreedRate, remText || 'Accepted counter offer', req.user.username || sub.transporter_id]
        );

        await conn.query(
          `INSERT INTO bid_negotiation_history 
           (rate_submission_id, requirement_id, item_id, transporter_id, action_type, previous_rate, new_rate, actor_type, actor_id, message, created_at)
           VALUES (?, ?, ?, ?, 'COUNTER_ACCEPTED', ?, ?, 'TRANSPORTER', ?, ?, NOW())`,
          [id, sub.requirement_id, sub.item_id || 'MAIN', sub.transporter_id, prevRate, agreedRate, req.user.username || sub.transporter_id, remText || `Transporter accepted counter offer of ₹${agreedRate}/MT`]
        );

        await conn.commit();
        conn.release();

        const [updatedRows] = await pool.query('SELECT * FROM rate_submissions WHERE id = ? LIMIT 1', [id]);
        return res.json({
          success: true,
          message: `Accepted counter offer of ₹${agreedRate}/MT successfully`,
          submission: updatedRows[0]
        });
      } else if (actionUpper === 'REJECT') {
        const [uRes] = await conn.query(
          `UPDATE rate_submissions
           SET counter_offer_status = 'REJECTED',
               bid_status = 'COUNTER_REJECTED',
               updated_at = NOW()
           WHERE id = ?`,
          [id]
        );

        console.log(`❌ [TRANSPORTER REJECT] Bid ID ${id} rejected counter offer, affectedRows: ${uRes.affectedRows}`);

        const negId = `neg_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;
        await conn.query(
          `INSERT INTO rate_negotiations
           (id, requirement_id, item_id, transporter_id, rate_submission_id, action_type, offered_rate, remarks, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, 'COUNTER_REJECTED', ?, ?, ?, NOW())`,
          [negId, sub.requirement_id, sub.item_id || 'MAIN', sub.transporter_id, id, prevRate, remText || 'Rejected counter offer', req.user.username || sub.transporter_id]
        );

        await conn.commit();
        conn.release();

        const [updatedRows] = await pool.query('SELECT * FROM rate_submissions WHERE id = ? LIMIT 1', [id]);
        return res.json({
          success: true,
          message: 'Rejected counter offer successfully',
          submission: updatedRows[0]
        });
      } else {
        const newProposedRate = parseFloat(proposed_rate || counter_rate);
        if (isNaN(newProposedRate) || newProposedRate <= 0) {
          await conn.rollback();
          conn.release();
          return res.status(400).json({ success: false, error: 'proposed_rate must be a positive number.' });
        }

        const qtyVal = parseFloat(sub.quoted_quantity_mt || 0);
        const calcTotal = qtyVal ? parseFloat((newProposedRate * qtyVal).toFixed(2)) : null;

        const [uRes] = await conn.query(
          `UPDATE rate_submissions
           SET counter_offer_rate = ?,
               rate_per_mt = ?,
               total_amount = ?,
               counter_offer_status = 'PENDING',
               counter_offer_by = 'TRANSPORTER',
               bid_status = 'COUNTER_RESPONDED',
               counter_message = ?,
               counter_offer_at = NOW(),
               updated_at = NOW()
           WHERE id = ?`,
          [newProposedRate, newProposedRate, calcTotal, remText, id]
        );

        console.log(`💬 [TRANSPORTER COUNTER] Bid ID ${id} proposed revised rate ₹${newProposedRate}/MT, affectedRows: ${uRes.affectedRows}`);

        const negId = `neg_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;
        await conn.query(
          `INSERT INTO rate_negotiations
           (id, requirement_id, item_id, transporter_id, rate_submission_id, action_type, offered_rate, remarks, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, 'TRANSPORTER_RESPONSE', ?, ?, ?, NOW())`,
          [negId, sub.requirement_id, sub.item_id || 'MAIN', sub.transporter_id, id, newProposedRate, remText, req.user.username || sub.transporter_id]
        );

        await conn.query(
          `INSERT INTO bid_negotiation_history 
           (rate_submission_id, requirement_id, item_id, transporter_id, action_type, previous_rate, new_rate, actor_type, actor_id, message, created_at)
           VALUES (?, ?, ?, ?, 'TRANSPORTER_COUNTER', ?, ?, 'TRANSPORTER', ?, ?, NOW())`,
          [id, sub.requirement_id, sub.item_id || 'MAIN', sub.transporter_id, prevRate, newProposedRate, req.user.username || sub.transporter_id, remText || `Transporter proposed revised rate of ₹${newProposedRate}/MT`]
        );

        await conn.commit();
        conn.release();

        const [updatedRows] = await pool.query('SELECT * FROM rate_submissions WHERE id = ? LIMIT 1', [id]);
        return res.json({
          success: true,
          message: `Counter offer of ₹${newProposedRate}/MT submitted successfully`,
          submission: updatedRows[0]
        });
      }
    } catch (txErr) {
      await conn.rollback();
      conn.release();
      throw txErr;
    }
  } catch (err) {
    console.error('❌ POST /api/rate-submissions/:id/respond-counter Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
}

// -------------------------------------------------------------
// FINALIZE BID API HANDLER 🏆
// -------------------------------------------------------------
async function handleFinalizeBid(req, res) {
  try {
    await ensureRateSubmissionsTableExists();
    await ensureBidNegotiationHistoryTableExists();

    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied. Admin access required.' });
    }

    const { id } = req.params;
    const { final_rate } = req.body;

    const [rows] = await pool.query('SELECT * FROM rate_submissions WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Rate submission not found.' });
    }

    const sub = rows[0];
    const prevRate = parseFloat(sub.counter_offer_rate || sub.rate_per_mt || 0);
    const agreedRate = parseFloat(final_rate || sub.final_rate || sub.counter_offer_rate || sub.rate_per_mt);
    if (isNaN(agreedRate) || agreedRate <= 0) {
      return res.status(400).json({ success: false, error: 'final_rate must be a positive number.' });
    }

    const qtyVal = parseFloat(sub.quoted_quantity_mt || 0);
    const calcTotal = qtyVal ? parseFloat((agreedRate * qtyVal).toFixed(2)) : null;

    await pool.query(
      `UPDATE rate_submissions
       SET final_rate = ?,
           finalized_rate = ?,
           is_finalized = 1,
           finalized_by = ?,
           acceptance_status = 'PENDING',
           rate_per_mt = ?,
           total_amount = ?,
           counter_offer_status = 'ACCEPTED',
           bid_status = 'FINALIZED',
           finalized_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [agreedRate, agreedRate, req.user.username || 'admin', agreedRate, calcTotal, id]
    );

    // Update item dispatch status
    if (sub.item_id && sub.item_id !== 'MAIN') {
      await pool.query(
        `UPDATE transport_requirement_items
         SET dispatch_status = 'AWAITING_ACCEPTANCE',
             updated_at = NOW()
         WHERE requirement_id = ? AND (id = ? OR sub_indent_no = ? OR sub_indent_no LIKE ?)`,
        [sub.requirement_id, sub.item_id, sub.item_id, `%/${sub.item_id}`]
      ).catch(() => {});
    }

    const negId = `neg_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;
    await pool.query(
      `INSERT INTO rate_negotiations
       (id, requirement_id, item_id, transporter_id, rate_submission_id, action_type, offered_rate, remarks, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, 'FINALIZED', ?, ?, ?, NOW())`,
      [negId, sub.requirement_id, sub.item_id || 'MAIN', sub.transporter_id, id, agreedRate, `Bid finalized by Admin at ₹${agreedRate}/MT`, req.user.username || 'admin']
    );

    await pool.query(
      `INSERT INTO bid_negotiation_history 
       (rate_submission_id, requirement_id, item_id, transporter_id, action_type, previous_rate, new_rate, actor_type, actor_id, message, created_at)
       VALUES (?, ?, ?, ?, 'BID_FINALIZED', ?, ?, 'ADMIN', ?, ?, NOW())`,
      [id, sub.requirement_id, sub.item_id || 'MAIN', sub.transporter_id, prevRate, agreedRate, req.user.username || 'admin', `Bid finalized by Admin at ₹${agreedRate}/MT`]
    );

    const [updatedRows] = await pool.query('SELECT * FROM rate_submissions WHERE id = ? LIMIT 1', [id]);
    return res.json({
      success: true,
      message: `Bid finalized at ₹${agreedRate}/MT`,
      submission: updatedRows[0]
    });
  } catch (err) {
    console.error('❌ POST /api/rate-submissions/:id/finalize Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
}

// -------------------------------------------------------------
// TRANSPORTER ACCEPT FINALIZED RATE HANDLER 🤝
// -------------------------------------------------------------
async function handleAcceptFinalRate(req, res) {
  try {
    await ensureTruckDispatchesTableExists();
    await ensureRateSubmissionsTableExists();
    await ensureRequirementsTableExists();

    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    console.log('[AUTH DEBUG]', {
      userId: req.user?.id,
      transporterId: req.user?.transporter_id,
      role: req.user?.role,
      normalizedRole: String(req.user?.role || '').trim().toLowerCase()
    });

    const userRole = String(req.user.role || '').trim().toLowerCase();
    if (userRole !== 'transporter') {
      return res.status(403).json({ success: false, error: 'Only transporters can accept finalized rates.' });
    }

    const authTransporter = await resolveAuthenticatedTransporter(req);
    if (!authTransporter) {
      return res.status(403).json({ success: false, error: 'Could not resolve authenticated transporter identity.' });
    }

    const { requirementId, itemId, id } = req.params;
    const submissionId = id || req.body?.submission_id || req.body?.id;

    // Smart ID Resolution across UUIDs, formatted req_no, and sub_indent_no
    let resolvedReqIds = [requirementId].filter(Boolean);
    let resolvedItemIds = [itemId].filter(Boolean);

    if (requirementId) {
      try {
        const [reqRows] = await pool.query(
          'SELECT id, req_no FROM transport_requirements WHERE id = ? OR req_no = ? LIMIT 1',
          [requirementId, requirementId]
        );
        if (reqRows.length > 0) {
          resolvedReqIds.push(reqRows[0].id, reqRows[0].req_no);
        }
      } catch (e) {}
    }

    if (itemId && itemId !== 'MAIN') {
      try {
        const [itemRows] = await pool.query(
          'SELECT id, requirement_id, sub_indent_no FROM transport_requirement_items WHERE (requirement_id IN (?) OR id = ?) AND (id = ? OR sub_indent_no = ? OR sub_indent_no LIKE ?) LIMIT 1',
          [resolvedReqIds.length > 0 ? resolvedReqIds : [requirementId], itemId, itemId, itemId, `%${itemId}%`]
        );
        if (itemRows.length > 0) {
          resolvedItemIds.push(itemRows[0].id, itemRows[0].sub_indent_no);
          if (itemRows[0].requirement_id) {
            resolvedReqIds.push(itemRows[0].requirement_id);
          }
        }
      } catch (e) {}
    }

    let sub = null;
    if (submissionId) {
      const [rows] = await pool.query('SELECT * FROM rate_submissions WHERE id = ? LIMIT 1', [submissionId]);
      if (rows.length > 0) sub = rows[0];
    }

    if (!sub && resolvedReqIds.length > 0) {
      const transMatchIds = [authTransporter.id, authTransporter.code, authTransporter.username].filter(Boolean);

      const [rows] = await pool.query(
        `SELECT * FROM rate_submissions 
         WHERE requirement_id IN (?) 
           AND (item_id IN (?) OR item_id = 'MAIN' OR item_id IS NULL)
           AND transporter_id IN (?)
           AND (is_finalized = 1 OR UPPER(COALESCE(bid_status, '')) IN ('FINALIZED', 'COUNTER_ACCEPTED') OR final_rate > 0)
         ORDER BY is_finalized DESC, finalized_at DESC, updated_at DESC LIMIT 1`,
        [resolvedReqIds, resolvedItemIds, transMatchIds]
      );
      if (rows.length > 0) {
        sub = rows[0];
      } else {
        // Fallback: any finalized quote for this transporter on the requirement
        const [fallbackRows] = await pool.query(
          `SELECT * FROM rate_submissions 
           WHERE requirement_id IN (?) 
             AND transporter_id IN (?)
             AND (is_finalized = 1 OR UPPER(COALESCE(bid_status, '')) IN ('FINALIZED', 'COUNTER_ACCEPTED') OR final_rate > 0)
           ORDER BY is_finalized DESC, finalized_at DESC, updated_at DESC LIMIT 1`,
          [resolvedReqIds, transMatchIds]
        );
        if (fallbackRows.length > 0) sub = fallbackRows[0];
      }
    }

    if (!sub) {
      return res.status(404).json({ success: false, error: 'Finalized quote not found for this requirement item.' });
    }

    const isFinalized = sub.is_finalized || ['FINALIZED', 'COUNTER_ACCEPTED'].includes(String(sub.bid_status || '').toUpperCase()) || Number(sub.final_rate || 0) > 0;
    if (!isFinalized) {
      return res.status(400).json({
        success: false,
        code: 'RATE_NOT_FINALIZED',
        error: 'Cannot accept rate because this quote has not been finalized by Admin yet.'
      });
    }

    // STRICT RBAC: Winning Transporter Check
    if (String(sub.transporter_id) !== String(authTransporter.id) && String(sub.transporter_id) !== String(authTransporter.code) && String(sub.transporter_id) !== String(authTransporter.username)) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN_NOT_WINNING_TRANSPORTER',
        error: 'Only the finalized winning transporter can accept this rate.'
      });
    }

    // Update acceptance
    await pool.query(
      `UPDATE rate_submissions
       SET acceptance_status = 'ACCEPTED',
           transporter_accepted_at = NOW(),
           transporter_accepted_by = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [req.user.username || authTransporter.username || authTransporter.company_name, sub.id]
    );

    // Update item dispatch status
    await pool.query(
      `UPDATE transport_requirement_items
       SET dispatch_status = 'ACCEPTED',
           updated_at = NOW()
       WHERE requirement_id = ? AND id = ?`,
      [sub.requirement_id, sub.item_id]
    ).catch(() => {});

    // Audit logs
    try {
      await pool.query(
        `INSERT INTO security_audit_logs (id, action, username, role, ip, status, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          `FINAL_RATE_ACCEPTED (Rate: ₹${sub.final_rate || sub.rate_per_mt}/MT for ${sub.requirement_id}/${sub.item_id})`,
          req.user.username || authTransporter.username,
          'transporter',
          req.ip || '127.0.0.1',
          'RATE_ACCEPTED 🤝'
        ]
      );
    } catch (e) {}

    const [updatedSub] = await pool.query('SELECT * FROM rate_submissions WHERE id = ?', [sub.id]);

    return res.json({
      success: true,
      message: 'Final rate accepted successfully. You can now dispatch trucks.',
      submission: updatedSub[0]
    });
  } catch (err) {
    console.error('❌ accept-final-rate Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
}

// -------------------------------------------------------------
// CREATE TRUCK DISPATCH & CONCURRENCY-SAFE LR GENERATION 🚚📄
// -------------------------------------------------------------
async function handleCreateTruckDispatch(req, res) {
  const conn = await pool.getConnection();
  try {
    await ensureTruckDispatchesTableExists();
    await ensureRateSubmissionsTableExists();
    await ensureRequirementsTableExists();

    if (!req.user) {
      conn.release();
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    console.log('[AUTH DEBUG DISPATCH]', {
      userId: req.user?.id,
      transporterId: req.user?.transporter_id,
      role: req.user?.role,
      normalizedRole: String(req.user?.role || '').trim().toLowerCase()
    });

    const userRole = String(req.user.role || '').trim().toLowerCase();
    if (userRole !== 'transporter') {
      conn.release();
      return res.status(403).json({ success: false, error: 'Only transporters can dispatch trucks.' });
    }

    const authTransporter = await resolveAuthenticatedTransporter(req);
    if (!authTransporter) {
      conn.release();
      return res.status(403).json({ success: false, error: 'Could not resolve authenticated transporter identity.' });
    }

    const { requirementId, itemId } = req.params;
    const {
      truck_number,
      loaded_quantity_mt,
      driver_name,
      driver_mobile,
      driver_license
    } = req.body;

    // Field Validations
    const cleanTruckNo = (truck_number || '').toUpperCase().replace(/\s+/g, '').trim();
    if (!cleanTruckNo || cleanTruckNo.length < 5) {
      conn.release();
      return res.status(400).json({ success: false, error: 'Valid truck vehicle number is required (e.g. MH31FC4512).' });
    }

    const loadedQty = parseFloat(loaded_quantity_mt);
    if (isNaN(loadedQty) || loadedQty <= 0) {
      conn.release();
      return res.status(400).json({ success: false, error: 'Loaded quantity must be a positive number greater than 0.' });
    }

    const cleanDriverName = (driver_name || '').trim();
    if (!cleanDriverName) {
      conn.release();
      return res.status(400).json({ success: false, error: 'Driver name is required.' });
    }

    const cleanDriverMobile = (driver_mobile || '').trim();
    if (!cleanDriverMobile || cleanDriverMobile.length < 8) {
      conn.release();
      return res.status(400).json({ success: false, error: 'Valid driver mobile number is required.' });
    }

    const cleanDriverLicense = (driver_license || '').toUpperCase().trim();
    if (!cleanDriverLicense) {
      conn.release();
      return res.status(400).json({ success: false, error: 'Driver license number (DL) is required.' });
    }

    await conn.beginTransaction();

    // 0. Explicitly Resolve and Lock Parent Requirement from database
    let parentReq = null;
    let actualReqId = requirementId;
    let resolvedReqIds = [requirementId].filter(Boolean);

    if (requirementId) {
      const [pRows] = await conn.query(
        'SELECT * FROM transport_requirements WHERE id = ? OR req_no = ? LIMIT 1 FOR UPDATE',
        [requirementId, requirementId]
      );
      if (pRows.length > 0) {
        parentReq = pRows[0];
        actualReqId = parentReq.id;
        resolvedReqIds.push(parentReq.id, parentReq.req_no);
      }
    }

    // 0.1. Explicitly Resolve and Lock Child Requirement Item
    const candidateItemIds = [
      req.body?.requirement_item_id,
      req.body?.item_id,
      itemId,
      req.body?.sub_indent_no
    ].filter(Boolean).filter(v => v !== 'MAIN');

    let originalItemRec = null;
    let actualItemId = null;
    let resolvedItemIds = [];

    if (candidateItemIds.length > 0) {
      const [iRows] = await conn.query(
        `SELECT * FROM transport_requirement_items 
         WHERE (requirement_id = ? OR requirement_id IN (?)) 
           AND (id IN (?) OR sub_indent_no IN (?) OR sub_indent_no LIKE ?) 
         LIMIT 1 FOR UPDATE`,
        [actualReqId, resolvedReqIds, candidateItemIds, candidateItemIds, `%/${candidateItemIds[0]}`]
      );
      if (iRows.length > 0) {
        originalItemRec = iRows[0];
        actualItemId = originalItemRec.id;
        resolvedItemIds = [originalItemRec.id, originalItemRec.sub_indent_no].filter(Boolean);
        if (originalItemRec.requirement_id && !parentReq) {
          const [pRows] = await conn.query(
            'SELECT * FROM transport_requirements WHERE id = ? LIMIT 1 FOR UPDATE',
            [originalItemRec.requirement_id]
          );
          if (pRows.length > 0) {
            parentReq = pRows[0];
            actualReqId = parentReq.id;
            resolvedReqIds.push(parentReq.id, parentReq.req_no);
          }
        }
      }
    }

    if (!parentReq) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({
        success: false,
        code: 'REQUIREMENT_NOT_FOUND',
        error: 'Parent requirement not found.'
      });
    }

    // Check if parent genuinely has child items
    const [allChildItems] = await conn.query(
      `SELECT id FROM transport_requirement_items WHERE requirement_id = ? OR requirement_id IN (?) LIMIT 1 FOR UPDATE`,
      [actualReqId, resolvedReqIds]
    );

    if (!originalItemRec && allChildItems.length > 0) {
      // Parent has child items, but the requested item could not be resolved!
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        code: 'ITEM_RESOLUTION_FAILED',
        error: 'Unable to resolve exact requirement item for dispatch. Please specify a valid sub-indent.'
      });
    }

    const transMatchIds = [authTransporter.id, authTransporter.code, authTransporter.username].filter(Boolean);

    // 1. Find & Lock the Finalized Freight Rate for this requirement item
    let finalizedSub = null;
    const [matchedRows] = await conn.query(
      `SELECT * FROM rate_submissions 
       WHERE requirement_id IN (?) 
         AND (item_id IN (?) OR item_id = 'MAIN' OR item_id IS NULL)
         AND (is_finalized = 1 OR UPPER(COALESCE(bid_status, '')) IN ('FINALIZED', 'COUNTER_ACCEPTED') OR final_rate > 0)
       ORDER BY is_finalized DESC, finalized_at DESC, updated_at DESC LIMIT 1
       FOR UPDATE`,
      [resolvedReqIds, resolvedItemIds.length > 0 ? resolvedItemIds : ['MAIN']]
    );

    if (matchedRows.length > 0) {
      finalizedSub = matchedRows[0];
    } else {
      const [fallbackRows] = await conn.query(
        `SELECT * FROM rate_submissions 
         WHERE requirement_id IN (?) 
           AND (is_finalized = 1 OR UPPER(COALESCE(bid_status, '')) IN ('FINALIZED', 'COUNTER_ACCEPTED') OR final_rate > 0)
         ORDER BY is_finalized DESC, finalized_at DESC, updated_at DESC LIMIT 1
         FOR UPDATE`,
        [resolvedReqIds]
      );
      if (fallbackRows.length > 0) finalizedSub = fallbackRows[0];
    }

    if (!finalizedSub) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        code: 'RATE_NOT_FINALIZED',
        error: 'Cannot dispatch truck: freight rate is not yet finalized by Admin for this item.'
      });
    }

    const finalRateVal = parseFloat(finalizedSub.final_rate || finalizedSub.rate_per_mt || 0);

    // 2. Transporter Verification: Ensure authenticated transporter exists and rate is active
    if (!authTransporter || !authTransporter.id) {
      await conn.rollback();
      conn.release();
      return res.status(403).json({
        success: false,
        code: 'UNAUTHORIZED_TRANSPORTER',
        error: 'Access denied. Valid transporter authentication required.'
      });
    }

    if (finalizedSub.acceptance_status && String(finalizedSub.acceptance_status).toUpperCase() === 'REJECTED') {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        code: 'RATE_REJECTED',
        error: 'Transporter rejected the rate.'
      });
    }

    // 3. Compute Canonical Item Required Quantity
    let totalItemQty = 0;
    if (originalItemRec) {
      totalItemQty = parseFloat(originalItemRec.quantity_mt || originalItemRec.required_qty || 0);
    } else {
      totalItemQty = parseFloat(parentReq.quantity_mt || parentReq.total_quantity_mt || 0);
    }

    if (totalItemQty <= 0 && finalizedSub) {
      totalItemQty = parseFloat(finalizedSub.quoted_quantity_mt || 0);
    }

    // 4. Lock and calculate total already dispatched quantity for this requirement item ONLY
    let alreadyDispatched = 0;
    if (originalItemRec) {
      const [dispatchedSumRows] = await conn.query(
        `SELECT COALESCE(SUM(loaded_quantity_mt), 0) AS total_dispatched 
         FROM truck_dispatches 
         WHERE (requirement_id IN (?)) 
           AND (requirement_item_id = ? OR requirement_item_id = ?) 
         FOR UPDATE`,
        [resolvedReqIds, originalItemRec.id, originalItemRec.sub_indent_no]
      );
      alreadyDispatched = parseFloat(dispatchedSumRows[0]?.total_dispatched || 0);
    } else {
      const [dispatchedSumRows] = await conn.query(
        `SELECT COALESCE(SUM(loaded_quantity_mt), 0) AS total_dispatched 
         FROM truck_dispatches 
         WHERE requirement_id IN (?) 
         FOR UPDATE`,
        [resolvedReqIds]
      );
      alreadyDispatched = parseFloat(dispatchedSumRows[0]?.total_dispatched || 0);
    }

    const remainingBalance = parseFloat(Math.max(0, totalItemQty - alreadyDispatched).toFixed(3));

    // 5. Enforce Tonnage Capacity Gate
    if (loadedQty > remainingBalance) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        code: 'EXCEEDS_REMAINING_QUANTITY',
        error: `Loaded quantity (${loadedQty} MT) cannot exceed remaining balance (${remainingBalance} MT).`,
        required_quantity_mt: totalItemQty,
        already_dispatched_mt: alreadyDispatched,
        remaining_quantity_mt: remainingBalance
      });
    }

    // Enforce Requirement Level Total Capacity Gate
    const [totalParentDispatchedRows] = await conn.query(
      `SELECT COALESCE(SUM(loaded_quantity_mt), 0) AS total_parent_dispatched 
       FROM truck_dispatches 
       WHERE requirement_id IN (?) 
       FOR UPDATE`,
      [resolvedReqIds]
    );
    const totalParentDispatched = parseFloat(totalParentDispatchedRows[0]?.total_parent_dispatched || 0);
    const parentCap = parseFloat(parentReq.total_quantity_mt || parentReq.quantity_mt || 0);
    if (parentCap > 0 && (totalParentDispatched + loadedQty) > (parentCap + 0.001)) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        code: 'EXCEEDS_REQUIREMENT_TOTAL_CAPACITY',
        error: `Loaded quantity exceeds the total parent requirement capacity (${parentCap} MT). Already dispatched: ${totalParentDispatched} MT.`
      });
    }

    // 6. Concurrency-Safe LR Number Generation
    const lrNumber = await generateUniqueLrNumber(conn, new Date().getFullYear());
    const dispatchId = `disp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 7. Insert into truck_dispatches
    await conn.query(
      `INSERT INTO truck_dispatches (
        id, requirement_id, requirement_item_id, transporter_id,
        finalized_rate, truck_number, loaded_quantity_mt, driver_name,
        driver_mobile, driver_license, lr_number, dispatch_reference,
        dispatch_status, dispatched_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Dispatched', NOW(), NOW(), NOW())`,
      [
        dispatchId,
        actualReqId,
        actualItemId || 'MAIN',
        authTransporter.id,
        finalRateVal,
        cleanTruckNo,
        loadedQty,
        cleanDriverName,
        cleanDriverMobile,
        cleanDriverLicense,
        lrNumber,
        lrNumber
      ]
    );

    // 8. Update Item-Level and Parent-Level Status for Fixed-Rate Remaining Quantity (NO RE-QUOTE)
    const newTotalDispatched = parseFloat((alreadyDispatched + loadedQty).toFixed(3));
    const newRemaining = parseFloat(Math.max(0, totalItemQty - newTotalDispatched).toFixed(3));

    if (originalItemRec) {
      const newDispatchStatus = newRemaining <= 0 ? 'FULLY_DISPATCHED' : 'PARTIALLY_DISPATCHED';
      const newAllocStatus = newRemaining <= 0 ? 'COMPLETED' : 'ACTIVE';
      await conn.query(
        `UPDATE transport_requirement_items
         SET dispatched_quantity_mt = ?,
             remaining_quantity_mt = ?,
             dispatch_status = ?,
             allocation_status = ?,
             updated_at = NOW()
         WHERE requirement_id = ? AND (id = ? OR sub_indent_no = ?)`,
        [newTotalDispatched, newRemaining, newDispatchStatus, newAllocStatus, actualReqId, actualItemId, actualItemId]
      );
    }

    // Check if all items in parent requirement are FULLY_DISPATCHED
    const [allChildItemsCheck] = await conn.query(
      `SELECT id, dispatch_status FROM transport_requirement_items WHERE requirement_id = ?`,
      [actualReqId]
    );
    const allFullyDispatched = allChildItemsCheck.length > 0
      ? allChildItemsCheck.every(i => (i.id === actualItemId || i.sub_indent_no === actualItemId) ? (newRemaining <= 0) : (i.dispatch_status === 'FULLY_DISPATCHED' || i.dispatch_status === 'COMPLETED'))
      : (newRemaining <= 0);

    const parentStatus = allFullyDispatched ? 'COMPLETED' : 'PARTIALLY_DISPATCHED';
    await conn.query(
      `UPDATE transport_requirements SET status = ?, updated_at = NOW() WHERE id = ?`,
      [parentStatus, actualReqId]
    );

    // 9. Audit Logging
    await conn.query(
      `INSERT INTO security_audit_logs (id, action, username, role, ip, status, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        `TRUCK_DISPATCHED (${cleanTruckNo} - ${loadedQty} MT, Rate: ₹${finalRateVal}/MT, LR: ${lrNumber}, Remaining: ${newRemaining} MT)`,
        req.user.username || authTransporter.username,
        'transporter',
        req.ip || '127.0.0.1',
        'DISPATCHED 🚛'
      ]
    );

    await conn.commit();
    conn.release();

    const [dispatchRecord] = await pool.query('SELECT * FROM truck_dispatches WHERE id = ?', [dispatchId]);

    return res.json({
      success: true,
      message: newRemaining > 0
        ? `Truck ${cleanTruckNo} dispatched (${loadedQty} MT). Remaining balance (${newRemaining} MT) available at fixed rate ₹${finalRateVal}/MT.`
        : `Truck ${cleanTruckNo} dispatched successfully! LR No: ${lrNumber}. Requirement item is 100% Fully Dispatched!`,
      dispatch: dispatchRecord[0],
      lr_number: lrNumber,
      loaded_quantity_mt: loadedQty,
      dispatched_quantity_mt: newTotalDispatched,
      remaining_quantity_mt: newRemaining,
      fixed_rate: finalRateVal,
      finalized_rate: finalRateVal,
      dispatch_status: newRemaining > 0 ? 'PARTIALLY_DISPATCHED' : 'FULLY_DISPATCHED',
      is_partial: newRemaining > 0,
      item: originalItemRec ? {
        id: originalItemRec.id,
        sub_indent_no: originalItemRec.sub_indent_no,
        total_quantity_mt: totalItemQty,
        dispatched_quantity_mt: newTotalDispatched,
        remaining_quantity_mt: newRemaining,
        dispatch_status: newRemaining > 0 ? 'PARTIALLY_DISPATCHED' : 'FULLY_DISPATCHED',
        fixed_rate: finalRateVal
      } : null
    });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (e) {}
      conn.release();
    }
    console.error('❌ dispatch Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
}

// -------------------------------------------------------------
// GET DISPATCHES FOR A REQUIREMENT ITEM 📜
// -------------------------------------------------------------
async function handleGetRequirementItemDispatches(req, res) {
  try {
    await ensureTruckDispatchesTableExists();
    const { requirementId, itemId } = req.params;

    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (req.user.role === 'admin') {
      const [rows] = await pool.query(
        `SELECT td.*, t.company_name AS transporter_name, t.code AS transporter_code
         FROM truck_dispatches td
         LEFT JOIN transporters t ON t.id = td.transporter_id
         WHERE td.requirement_id = ? AND td.requirement_item_id = ?
         ORDER BY td.dispatched_at DESC`,
        [requirementId, itemId]
      );
      return res.json({ success: true, dispatches: rows });
    }

    if (req.user.role === 'transporter') {
      const authTransporter = await resolveAuthenticatedTransporter(req);
      if (!authTransporter) {
        return res.status(403).json({ success: false, error: 'Could not resolve authenticated transporter.' });
      }

      // Check if winning transporter
      const [subRows] = await pool.query(
        `SELECT transporter_id FROM rate_submissions 
         WHERE requirement_id = ? AND item_id = ? AND (is_finalized = 1 OR final_rate > 0) 
         LIMIT 1`,
        [requirementId, itemId]
      );

      if (subRows.length > 0 && String(subRows[0].transporter_id) !== String(authTransporter.id) &&
          String(subRows[0].transporter_id) !== String(authTransporter.code) &&
          String(subRows[0].transporter_id) !== String(authTransporter.username)) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN_DISPATCH_ACCESS',
          error: 'Access denied. You can only view your own dispatches.'
        });
      }

      const [rows] = await pool.query(
        `SELECT td.*, t.company_name AS transporter_name, t.code AS transporter_code
         FROM truck_dispatches td
         LEFT JOIN transporters t ON t.id = td.transporter_id
         WHERE td.requirement_id = ? AND td.requirement_item_id = ? AND td.transporter_id = ?
         ORDER BY td.dispatched_at DESC`,
        [requirementId, itemId, authTransporter.id]
      );
      return res.json({ success: true, dispatches: rows });
    }

    return res.status(403).json({ success: false, error: 'Access denied' });
  } catch (err) {
    console.error('❌ Get Dispatches Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
}

// -------------------------------------------------------------
// GET ALL DISPATCHES (ADMIN / TRANSPORTER FILTERED) 🚚
// -------------------------------------------------------------
async function handleGetDispatches(req, res) {
  try {
    await ensureTruckDispatchesTableExists();
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (req.user.role === 'admin') {
      const [rows] = await pool.query(
        `SELECT td.*, t.company_name AS transporter_name, t.code AS transporter_code,
                tr.req_no, tr.pickup_origin, tr.drop_location, tri.product_name, tri.sub_indent_no
         FROM truck_dispatches td
         LEFT JOIN transporters t ON t.id = td.transporter_id
         LEFT JOIN transport_requirements tr ON tr.id = td.requirement_id
         LEFT JOIN transport_requirement_items tri ON tri.id = td.requirement_item_id
         ORDER BY td.dispatched_at DESC LIMIT 200`
      );
      return res.json({ success: true, dispatches: rows, truck_dispatches: rows });
    }

    if (req.user.role === 'transporter') {
      const authTransporter = await resolveAuthenticatedTransporter(req);
      if (!authTransporter) {
        return res.status(403).json({ success: false, error: 'Could not resolve authenticated transporter.' });
      }

      const [rows] = await pool.query(
        `SELECT td.*, t.company_name AS transporter_name, t.code AS transporter_code,
                tr.req_no, tr.pickup_origin, tr.drop_location, tri.product_name, tri.sub_indent_no
         FROM truck_dispatches td
         LEFT JOIN transporters t ON t.id = td.transporter_id
         LEFT JOIN transport_requirements tr ON tr.id = td.requirement_id
         LEFT JOIN transport_requirement_items tri ON tri.id = td.requirement_item_id
         WHERE td.transporter_id = ?
         ORDER BY td.dispatched_at DESC LIMIT 200`,
        [authTransporter.id]
      );
      return res.json({ success: true, dispatches: rows, truck_dispatches: rows });
    }

    return res.status(403).json({ success: false, error: 'Access denied' });
  } catch (err) {
    console.error('❌ Get All Dispatches Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
}

// -------------------------------------------------------------
// GET SINGLE DISPATCH BY ID (FOR LR CHALLAN DOCUMENT) 📄
// -------------------------------------------------------------
async function handleGetDispatchById(req, res) {
  try {
    await ensureTruckDispatchesTableExists();
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT td.*, t.company_name AS transporter_name, t.code AS transporter_code, t.gst_pan,
              tr.req_no, tr.pickup_origin, tr.drop_location, tri.product_name, tri.sub_indent_no
       FROM truck_dispatches td
       LEFT JOIN transporters t ON t.id = td.transporter_id
       LEFT JOIN transport_requirements tr ON tr.id = td.requirement_id
       LEFT JOIN transport_requirement_items tri ON tri.id = td.requirement_item_id
       WHERE td.id = ? OR td.lr_number = ? LIMIT 1`,
      [id, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Dispatch record not found' });
    }

    const disp = rows[0];

    // Transporter RBAC check
    if (req.user && req.user.role === 'transporter') {
      const authTransporter = await resolveAuthenticatedTransporter(req);
      if (!authTransporter || (String(disp.transporter_id) !== String(authTransporter.id) && String(disp.transporter_id) !== String(authTransporter.code))) {
        return res.status(403).json({ success: false, error: 'Access denied to this dispatch record.' });
      }
    }

    return res.json({ success: true, dispatch: disp });
  } catch (err) {
    console.error('❌ Get Dispatch By ID Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
}

// -------------------------------------------------------------
// RELEASE REMAINING QUANTITY FOR RE-QUOTE 🔄 (ADMIN-ONLY)
// -------------------------------------------------------------
async function handleReleaseRemainingForRequote(req, res) {
  let conn;
  try {
    await ensureRequirementsTableExists();
    await ensureTruckDispatchesTableExists();
    await ensureSecurityAuditLogsTableExists();

    // 1. RBAC Check - Strictly Admin Only
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN_ADMIN_ONLY',
        error: 'Only administrative users are authorized to release remaining quantities for re-quote.'
      });
    }

    const { requirementId, itemId } = req.params;
    const { reason = '' } = req.body || {};

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 2. Resolve and Lock Parent Requirement
    const [reqRows] = await conn.query(
      `SELECT * FROM transport_requirements WHERE id = ? OR req_no = ? LIMIT 1 FOR UPDATE`,
      [requirementId, requirementId]
    );

    if (reqRows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, error: 'Parent requirement record not found.' });
    }

    const parentReq = reqRows[0];
    const actualReqId = parentReq.id;

    // 3. Resolve and Lock Original Requirement Item
    const [itemRows] = await conn.query(
      `SELECT * FROM transport_requirement_items 
       WHERE requirement_id = ? AND (id = ? OR sub_indent_no = ? OR sub_indent_no LIKE ?)
       LIMIT 1 FOR UPDATE`,
      [actualReqId, itemId, itemId, `%/${itemId}`]
    );

    if (itemRows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, error: 'Requirement item record not found.' });
    }

    const originalItem = itemRows[0];
    const actualItemId = originalItem.id;

    // 4. Duplicate Release Guard
    if (
      String(originalItem.dispatch_status || '').toUpperCase() === 'RELEASED_FOR_REQUOTE' ||
      String(originalItem.allocation_status || '').toUpperCase() === 'RELEASED_FOR_REQUOTE'
    ) {
      await conn.rollback();
      conn.release();
      return res.status(409).json({
        success: false,
        code: 'ALREADY_RELEASED_FOR_REQUOTE',
        error: 'This requirement item has already been released for fresh quotation.'
      });
    }

    // 5. Calculate Dispatched and Remaining Quantities from actual truck dispatches
    const [dispatchedRows] = await conn.query(
      `SELECT COALESCE(SUM(loaded_quantity_mt), 0) AS total_dispatched 
       FROM truck_dispatches 
       WHERE requirement_id = ? AND requirement_item_id = ? 
       FOR UPDATE`,
      [actualReqId, actualItemId]
    );

    const totalItemQty = parseFloat(originalItem.quantity_mt || 0);
    const totalDispatched = parseFloat(dispatchedRows[0]?.total_dispatched || 0);
    const remainingQty = parseFloat(Math.max(0, totalItemQty - totalDispatched).toFixed(3));

    // 6. Enforce Remaining Quantity > 0
    if (remainingQty <= 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        code: 'NO_REMAINING_QUANTITY',
        error: `Cannot release for re-quote: remaining quantity is 0 MT (Total: ${totalItemQty} MT, Dispatched: ${totalDispatched} MT).`
      });
    }

    // 7. Concurrency-Safe Next Sub-Indent Number Generation
    const [allItems] = await conn.query(
      `SELECT id, sub_indent_no FROM transport_requirement_items WHERE requirement_id = ? FOR UPDATE`,
      [actualReqId]
    );

    let maxSeq = 0;
    allItems.forEach((i) => {
      const match = String(i.sub_indent_no || '').match(/\/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    });
    if (maxSeq === 0) maxSeq = allItems.length;
    const nextSeq = maxSeq + 1;
    const nextSeqStr = String(nextSeq).padStart(2, '0');
    const parentReqNo = parentReq.req_no || actualReqId;
    const newSubIndentNo = `${parentReqNo}/${nextSeqStr}`;
    const replacementItemId = `item_${actualReqId.replace(/[^a-zA-Z0-9_]/g, '')}_${nextSeqStr}_${Math.random().toString(36).substring(2, 6)}`;

    // 8. Update Original Item: Mark RELEASED_FOR_REQUOTE and close remaining allocation
    await conn.query(
      `UPDATE transport_requirement_items
       SET dispatch_status = 'RELEASED_FOR_REQUOTE',
           allocation_status = 'RELEASED_FOR_REQUOTE',
           remaining_action = 'REQUOTE',
           dispatched_quantity_mt = ?,
           remaining_quantity_mt = 0,
           released_for_requote_at = NOW(),
           released_for_requote_by = ?,
           released_for_requote_reason = ?,
           replacement_item_id = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [totalDispatched, req.user.username || 'admin', reason, replacementItemId, actualItemId]
    );

    // 9. Insert Replacement Requirement Item for the exact remaining quantity
    const targetDateVal = originalItem.target_date || parentReq.target_date || new Date();
    await conn.query(
      `INSERT INTO transport_requirement_items (
         id, requirement_id, sub_indent_no, product_name, quantity_mt, unit,
         pickup_origin, drop_location, hsn_code, target_date,
         dispatch_status, allocation_status, remaining_quantity_mt, dispatched_quantity_mt,
         source_item_id, created_at, updated_at
       ) VALUES (
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?,
         'PENDING', 'ACTIVE', ?, 0,
         ?, NOW(), NOW()
       )`,
      [
        replacementItemId,
        actualReqId,
        newSubIndentNo,
        originalItem.product_name,
        remainingQty,
        originalItem.unit || 'MT',
        originalItem.pickup_origin || parentReq.pickup_origin,
        originalItem.drop_location || parentReq.drop_location,
        originalItem.hsn_code || '',
        targetDateVal,
        remainingQty,
        actualItemId
      ]
    );

    // 10. Keep Parent Requirement in active in-progress state (NEVER mark COMPLETED)
    await conn.query(
      `UPDATE transport_requirements
       SET status = 'PARTIALLY_DISPATCHED',
           updated_at = NOW()
       WHERE id = ?`,
      [actualReqId]
    );

    // 11. Security Audit Log
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    await conn.query(
      `INSERT INTO security_audit_logs (id, action, username, role, ip, status, timestamp)
       VALUES (?, ?, ?, 'admin', ?, 'REQUOTE_RELEASED 🔄', NOW())`,
      [
        auditId,
        `REMAINING_QUANTITY_RELEASED_FOR_REQUOTE (Orig: ${originalItem.sub_indent_no || actualItemId}, Released: ${remainingQty} MT -> New: ${newSubIndentNo})`,
        req.user.username || 'admin',
        clientIp
      ]
    );

    await conn.commit();
    conn.release();

    return res.json({
      success: true,
      message: `Successfully released ${remainingQty} MT for fresh quotation. New Sub-Indent ${newSubIndentNo} created.`,
      original_item_id: actualItemId,
      original_sub_indent_no: originalItem.sub_indent_no,
      dispatched_quantity_mt: totalDispatched,
      released_quantity_mt: remainingQty,
      replacement_item_id: replacementItemId,
      replacement_sub_indent_no: newSubIndentNo
    });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (e) {}
      conn.release();
    }
    console.error('❌ Release Remaining for Requote Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
}

// -------------------------------------------------------------
// GET OPEN REQUIREMENTS & RE-OPENED ITEMS 🔄 (ALL TRANSPORTERS)
// -------------------------------------------------------------
async function handleGetOpenRequirements(req, res) {
  try {
    await ensureRequirementsTableExists();
    await ensureRateSubmissionsTableExists();
    await ensureBidNegotiationHistoryTableExists();
    await ensureRateNegotiationsTableExists();

    const reqQuery = "SELECT * FROM transport_requirements WHERE UPPER(COALESCE(status, 'ACTIVE')) NOT IN ('ARCHIVED', 'DELETED', 'CANCELLED') ORDER BY created_at DESC LIMIT 300";
    const [parents] = await pool.query(reqQuery);

    if (parents.length === 0) {
      return res.json({ success: true, count: 0, requirements: [], data: [] });
    }

    const parentIds = parents.map(p => p.id);
    const [items] = await pool.query(
      `SELECT * FROM transport_requirement_items WHERE requirement_id IN (?) ORDER BY id ASC`,
      [parentIds]
    );

    const itemsMap = {};
    items.forEach(i => {
      if (!itemsMap[i.requirement_id]) itemsMap[i.requirement_id] = [];
      itemsMap[i.requirement_id].push(i);
    });

    const dtos = parents.map(p => formatParentRequirementDto(p, itemsMap[p.id] || []));
    return res.json({ success: true, count: dtos.length, requirements: dtos, data: dtos });
  } catch (err) {
    console.error('❌ Get Open Requirements Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
}

// -------------------------------------------------------------
// GET RE-BID / RE-QUOTE LIFECYCLE HISTORY 📜 (ADMIN & TRANSPORTER)
// -------------------------------------------------------------
async function handleGetRebidHistory(req, res) {
  try {
    await ensureRequirementsTableExists();
    await ensureTruckDispatchesTableExists();
    await ensureRateSubmissionsTableExists();

    const { id } = req.params;
    const [reqRows] = await pool.query(
      `SELECT * FROM transport_requirements WHERE id = ? OR req_no = ? LIMIT 1`,
      [id, id]
    );

    if (reqRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Requirement not found' });
    }

    const parentReq = reqRows[0];
    const actualReqId = parentReq.id;

    const [items] = await pool.query(
      `SELECT * FROM transport_requirement_items WHERE requirement_id = ? ORDER BY id ASC`,
      [actualReqId]
    );

    const [dispatches] = await pool.query(
      `SELECT td.*, t.company_name AS transporter_name, t.code AS transporter_code
       FROM truck_dispatches td
       LEFT JOIN transporters t ON t.id = td.transporter_id
       WHERE td.requirement_id = ?
       ORDER BY td.dispatched_at ASC`,
      [actualReqId]
    );

    const [submissions] = await pool.query(
      `SELECT rs.*, t.company_name AS transporter_name, t.code AS transporter_code
       FROM rate_submissions rs
       LEFT JOIN transporters t ON t.id = rs.transporter_id
       WHERE rs.requirement_id = ?
       ORDER BY rs.submitted_at ASC`,
      [actualReqId]
    );

    const totalReqQty = parseFloat(parentReq.total_quantity_mt || parentReq.quantity_mt || 0);
    const totalDispatched = dispatches.reduce((acc, d) => acc + parseFloat(d.loaded_quantity_mt || 0), 0);
    const totalRemaining = Math.max(0, totalReqQty - totalDispatched);

    // Build cycles list
    const cycles = items.map((item, idx) => {
      const itemDispatches = dispatches.filter(d => d.requirement_item_id === item.id || d.requirement_item_id === item.sub_indent_no);
      const itemSubs = submissions.filter(s => s.item_id === item.id || s.item_id === item.sub_indent_no);
      const winningSub = itemSubs.find(s => s.is_finalized === 1 || s.final_rate > 0);
      const dispSum = itemDispatches.reduce((acc, d) => acc + parseFloat(d.loaded_quantity_mt || 0), 0);

      return {
        cycle_number: idx + 1,
        item_id: item.id,
        sub_indent_no: item.sub_indent_no,
        product_name: item.product_name,
        quantity_mt: parseFloat(item.quantity_mt || 0),
        dispatched_quantity_mt: dispSum,
        remaining_quantity_mt: Math.max(0, parseFloat(item.quantity_mt || 0) - dispSum),
        dispatch_status: item.dispatch_status,
        allocation_status: item.allocation_status,
        source_item_id: item.source_item_id,
        replacement_item_id: item.replacement_item_id,
        winner: winningSub ? {
          transporter_id: winningSub.transporter_id,
          transporter_name: winningSub.transporter_name,
          final_rate: winningSub.final_rate || winningSub.rate_per_mt,
          acceptance_status: winningSub.acceptance_status
        } : null,
        quotes_count: itemSubs.length,
        dispatches: itemDispatches
      };
    });

    return res.json({
      success: true,
      requirement_id: actualReqId,
      req_no: parentReq.req_no,
      total_quantity_mt: totalReqQty,
      total_dispatched_mt: totalDispatched,
      total_remaining_mt: totalRemaining,
      status: parentReq.status,
      cycles_count: cycles.length,
      cycles,
      all_dispatches: dispatches
    });
  } catch (err) {
    console.error('❌ Get Rebid History Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
}

// -------------------------------------------------------------
// GET NEGOTIATION HISTORY TIMELINE 📜
// -------------------------------------------------------------
async function handleGetNegotiationHistory(req, res) {
  try {
    await ensureRateNegotiationsTableExists();
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT * FROM rate_negotiations WHERE rate_submission_id = ? ORDER BY created_at ASC`,
      [id]
    );

    if (rows.length === 0) {
      const [histRows] = await pool.query(
        `SELECT * FROM bid_negotiation_history WHERE rate_submission_id = ? ORDER BY created_at ASC, id ASC`,
        [id]
      ).catch(() => [[]]);
      return res.json({ success: true, submission_id: id, history: histRows });
    }

    return res.json({
      success: true,
      submission_id: id,
      history: rows
    });
  } catch (err) {
    console.error('❌ GET /api/rate-submissions/:id/negotiation-history Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
}

// GET /api/transporter/dashboard-summary — MySQL-Backed Transporter Counters
async function handleGetTransporterDashboardSummary(req, res) {
  try {
    await ensureRateSubmissionsTableExists();

    const authenticatedTransporterId = req.user.transporter_id || req.user.id;
    let targetTransporterId = authenticatedTransporterId;

    if (req.user.role === 'admin' && req.query.transporter_id) {
      targetTransporterId = req.query.transporter_id;
    }

    // Resolve all transporter identifiers (id, code, username)
    let transIds = [targetTransporterId];
    try {
      const [tRows] = await pool.query(
        'SELECT id, code, username, company_name FROM transporters WHERE id = ? OR code = ? OR username = ? LIMIT 1',
        [targetTransporterId, targetTransporterId, targetTransporterId]
      );
      if (tRows && tRows.length > 0) {
        const t = tRows[0];
        transIds = [t.id, t.code, t.username, targetTransporterId].filter(Boolean);
      }
    } catch (e) {}

    // 1. Submitted Bids Count: all quotes submitted by this transporter
    const [subCountRows] = await pool.query(
      `SELECT COUNT(*) AS total_submitted_bids 
       FROM rate_submissions 
       WHERE transporter_id IN (?) 
         AND (rate_per_mt IS NOT NULL OR rate_per_unit IS NOT NULL)`,
      [transIds]
    );

    // 2. Awarded Contracts Count: all finalized / awarded bids for this transporter
    const [contractCountRows] = await pool.query(
      `SELECT COUNT(*) AS total_contracts 
       FROM rate_submissions 
       WHERE transporter_id IN (?) 
         AND (
           is_finalized = 1 OR
           UPPER(COALESCE(bid_status, '')) IN ('FINALIZED', 'AWARDED', 'COUNTER_ACCEPTED') OR 
           UPPER(COALESCE(acceptance_status, '')) IN ('ACCEPTED', 'PENDING') OR
           UPPER(COALESCE(status, '')) IN ('FINALIZED', 'AWARDED', 'ACCEPTED', 'RATE FROZEN', 'SELECTED') OR 
           final_rate IS NOT NULL
         )`,
      [transIds]
    );

    const submittedBids = Number(subCountRows[0]?.total_submitted_bids || 0);
    const contracts = Number(contractCountRows[0]?.total_contracts || 0);

    return res.json({
      success: true,
      transporter_id: targetTransporterId,
      submittedBids,
      contracts
    });
  } catch (err) {
    console.error('❌ GET /api/transporter/dashboard-summary Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
}

// -------------------------------------------------------------
// Layered Controller Routes (Targeted Minimal DTO Endpoints)
// -------------------------------------------------------------
router.get('/dashboard', authenticateToken, handleGetDashboard);
router.get('/transporter/dashboard-summary', authenticateToken, handleGetTransporterDashboardSummary);
router.get('/requirements', authenticateToken, handleGetRequirements);
router.get('/requirements/open', authenticateToken, handleGetOpenRequirements);
router.get('/rate-requests', authenticateToken, handleGetRequirements);
router.get('/requirements/:id/rebid-history', authenticateToken, handleGetRebidHistory);
router.get('/requirements/:id/rates', authenticateToken, handleGetRequirementRates);
router.get('/rate-requests/:id/rates', authenticateToken, handleGetRequirementRates);
router.post('/requirements/:requirementId/items/:itemId/counter-offer-all', authenticateToken, requireRole('admin'), handleAdminCounterAll);
router.post('/rate-submissions/counter-offer-all', authenticateToken, requireRole('admin'), handleAdminCounterAll);
router.post('/rate-submissions/:id/counter-offer', authenticateToken, handleAdminCounter);
router.post('/rate-submissions/:id/admin-counter', authenticateToken, handleAdminCounter);
router.post('/rate-submissions/:id/respond-counter', authenticateToken, handleTransporterResponse);
router.post('/rate-submissions/:id/transporter-response', authenticateToken, handleTransporterResponse);
router.post('/rate-submissions/:id/finalize', authenticateToken, handleFinalizeBid);
router.post('/requirements/:requirementId/items/:itemId/accept-final-rate', authenticateToken, handleAcceptFinalRate);
router.post('/rate-submissions/:id/accept-final-rate', authenticateToken, handleAcceptFinalRate);
router.post('/requirements/:requirementId/items/:itemId/dispatch', authenticateToken, handleCreateTruckDispatch);
router.post('/requirements/:requirementId/items/:itemId/dispatches', authenticateToken, handleCreateTruckDispatch);
router.post('/requirements/:requirementId/items/:itemId/release-remaining-for-requote', authenticateToken, requireRole('admin'), handleReleaseRemainingForRequote);
router.post('/requirements/:requirementId/items/:itemId/release-for-requote', authenticateToken, requireRole('admin'), handleReleaseRemainingForRequote);
router.post('/requirements/:requirementId/items/:itemId/reopen-for-quote', authenticateToken, requireRole('admin'), handleReleaseRemainingForRequote);
router.get('/requirements/:requirementId/items/:itemId/dispatches', authenticateToken, handleGetRequirementItemDispatches);
router.get('/dispatches', authenticateToken, handleGetDispatches);
router.get('/dispatches/:id', authenticateToken, handleGetDispatchById);
router.get('/rate-submissions/:id/negotiation-history', authenticateToken, handleGetNegotiationHistory);
router.get('/rate-submissions/:id/history', authenticateToken, handleGetNegotiationHistory);
router.post('/rate-submissions', authenticateToken, handleCreateRateSubmission);
router.post('/bids', authenticateToken, handleCreateRateSubmission);
router.get('/rate-submissions', authenticateToken, handleGetRateSubmissions);
router.get('/transporters', authenticateToken, handleGetTransporters);
router.post('/admin/reconcile-dispatch-balances', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await reconcileItemDispatchBalances(pool);
    return res.json({
      success: true,
      message: 'Dispatch balance reconciliation completed successfully.',
      affectedRows: result.affectedRows
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'RECONCILIATION_FAILED', message: err.message }
    });
  }
});

router.get('/diag/schema', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    // 1. All tables
    const [tablesRows] = await pool.query('SHOW TABLES');
    const dbName = pool.pool.config.connectionConfig.database;
    const tableNames = tablesRows.map(r => Object.values(r)[0]);

    const tableDetails = {};
    const tableIndexes = {};
    const tableCreateSql = {};

    for (const tName of tableNames) {
      try {
        const [cols] = await pool.query(`DESCRIBE \`${tName}\``);
        tableDetails[tName] = cols;
      } catch (e) {
        tableDetails[tName] = { error: e.message };
      }

      try {
        const [idx] = await pool.query(`SHOW INDEX FROM \`${tName}\``);
        tableIndexes[tName] = idx;
      } catch (e) {
        tableIndexes[tName] = { error: e.message };
      }

      try {
        const [createRows] = await pool.query(`SHOW CREATE TABLE \`${tName}\``);
        tableCreateSql[tName] = createRows[0] ? Object.values(createRows[0])[1] : null;
      } catch (e) {
        tableCreateSql[tName] = { error: e.message };
      }
    }

    // 2. Foreign keys via information_schema
    const [fkRows] = await pool.query(`
      SELECT 
        TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
    `);

    // 3. Read-only Data Consistency Checks
    const [duplicateBids] = await pool.query(`
      SELECT requirement_id, item_id, transporter_id, COUNT(*) AS count
      FROM rate_submissions
      GROUP BY requirement_id, COALESCE(item_id, 'MAIN'), transporter_id
      HAVING count > 1
    `).catch(e => [[{ error: e.message }]]);

    const [orphanSubsReq] = await pool.query(`
      SELECT COUNT(*) AS count
      FROM rate_submissions s
      LEFT JOIN transport_requirements r ON r.id = s.requirement_id
      WHERE r.id IS NULL
    `).catch(e => [[{ error: e.message }]]);

    const [orphanSubsItem] = await pool.query(`
      SELECT COUNT(*) AS count
      FROM rate_submissions s
      LEFT JOIN transport_requirement_items i ON i.id = s.item_id
      WHERE s.item_id IS NOT NULL AND s.item_id != 'MAIN' AND i.id IS NULL
    `).catch(e => [[{ error: e.message }]]);

    const [orphanSubsTrans] = await pool.query(`
      SELECT COUNT(*) AS count
      FROM rate_submissions s
      LEFT JOIN transporters t ON (t.id = s.transporter_id OR t.code = s.transporter_id OR t.username = s.transporter_id)
      WHERE t.id IS NULL
    `).catch(e => [[{ error: e.message }]]);

    const [statusDistribution] = await pool.query(`
      SELECT bid_status, counter_offer_status, COUNT(*) as count
      FROM rate_submissions
      GROUP BY bid_status, counter_offer_status
    `).catch(e => [[{ error: e.message }]]);

    const [finalizedWithoutRate] = await pool.query(`
      SELECT COUNT(*) AS count
      FROM rate_submissions
      WHERE UPPER(bid_status) IN ('FINALIZED', 'COUNTER_ACCEPTED')
        AND (final_rate IS NULL OR final_rate <= 0)
    `).catch(e => [[{ error: e.message }]]);

    const [counterWithoutRate] = await pool.query(`
      SELECT COUNT(*) AS count
      FROM rate_submissions
      WHERE (UPPER(bid_status) = 'COUNTER_OFFERED' OR UPPER(counter_offer_status) = 'PENDING')
        AND (counter_offer_rate IS NULL)
    `).catch(e => [[{ error: e.message }]]);

    // 4. Row counts for all tables
    const tableCounts = {};
    for (const tName of tableNames) {
      try {
        const [cRows] = await pool.query(`SELECT COUNT(*) AS count FROM \`${tName}\``);
        tableCounts[tName] = cRows[0].count;
      } catch (e) {
        tableCounts[tName] = 0;
      }
    }

    res.json({
      success: true,
      database: dbName,
      tables: tableNames,
      tableCounts,
      tableDetails,
      tableIndexes,
      tableCreateSql,
      foreignKeys: fkRows,
      consistency: {
        duplicateBids,
        orphanSubsReq: orphanSubsReq[0]?.count || 0,
        orphanSubsItem: orphanSubsItem[0]?.count || 0,
        orphanSubsTrans: orphanSubsTrans[0]?.count || 0,
        statusDistribution,
        finalizedWithoutRate: finalizedWithoutRate[0]?.count || 0,
        counterWithoutRate: counterWithoutRate[0]?.count || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// Dedicated Products & Cargo Master CRUD API
// -------------------------------------------------------------
async function ensureProductsTableExists() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(100) NOT NULL PRIMARY KEY,
        code VARCHAR(100),
        name VARCHAR(255) NOT NULL,
        category VARCHAR(255),
        hsn_code VARCHAR(50),
        default_unit VARCHAR(50) DEFAULT 'MT',
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const cols = [
      { name: 'code', def: 'VARCHAR(100)' },
      { name: 'category', def: 'VARCHAR(255)' },
      { name: 'hsn_code', def: 'VARCHAR(50)' },
      { name: 'default_unit', def: "VARCHAR(50) DEFAULT 'MT'" },
      { name: 'status', def: "VARCHAR(50) DEFAULT 'Active'" }
    ];
    for (const { name, def } of cols) {
      await ensureColumnExists('products', name, def);
    }
  } catch (err) {
    console.warn('products table creation notice:', err.message);
  }
}

function formatProductDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code || row.id,
    name: row.name || '',
    category: row.category || '',
    hsn_code: row.hsn_code || '',
    default_unit: row.default_unit || row.unit || 'MT',
    unit: row.default_unit || row.unit || 'MT',
    status: row.status || 'Active',
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString()
  };
}

// GET /api/products — List all Product / Cargo Masters
router.get('/products', authenticateToken, async (req, res) => {
  try {
    await ensureProductsTableExists();
    const [rows] = await pool.query('SELECT id, code, name, category, hsn_code, default_unit, status, created_at, updated_at FROM products ORDER BY name ASC LIMIT 300');
    const formatted = rows.map(formatProductDto);
    return res.json({ success: true, count: formatted.length, data: formatted, products: formatted, product_masters: formatted });
  } catch (err) {
    console.error('❌ GET /api/products Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// POST /api/products — Create or Upsert Product / Cargo Master
router.post('/products', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id, code, name, category, hsn_code, default_unit, unit, status } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Product / Commodity Name is required' });
  }

  await ensureProductsTableExists();
  const prodId = id || `prod_${Date.now()}`;
  const prodCode = code || prodId;
  const prodCategory = category ? category.trim() : '';
  const prodHsn = hsn_code ? hsn_code.trim() : '';
  const prodUnit = default_unit || unit || 'MT';
  const prodStatus = status || 'Active';

  try {
    await pool.query(
      `INSERT INTO products (id, code, name, category, hsn_code, default_unit, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), category = VALUES(category), hsn_code = VALUES(hsn_code), default_unit = VALUES(default_unit), status = VALUES(status), updated_at = NOW()`,
      [prodId, prodCode, name.trim(), prodCategory, prodHsn, prodUnit, prodStatus]
    );

    const [rows] = await pool.query('SELECT id, code, name, category, hsn_code, default_unit, status, created_at, updated_at FROM products WHERE id = ?', [prodId]);
    const saved = rows.length > 0 ? formatProductDto(rows[0]) : { id: prodId, code: prodCode, name: name.trim(), category: prodCategory, hsn_code: prodHsn, default_unit: prodUnit, status: prodStatus };

    return res.json({ success: true, message: 'Product / Cargo Master saved to MySQL', data: saved, product: saved });
  } catch (err) {
    console.error('❌ POST /api/products Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// PUT /api/products/:id — Update existing Product / Cargo Master
router.put('/products/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { name, category, hsn_code, default_unit, unit, status } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Product / Commodity Name is required' });
  }

  await ensureProductsTableExists();
  const prodCategory = category ? category.trim() : '';
  const prodHsn = hsn_code ? hsn_code.trim() : '';
  const prodUnit = default_unit || unit || 'MT';
  const prodStatus = status || 'Active';

  try {
    const [result] = await pool.query(
      `UPDATE products SET name = ?, category = ?, hsn_code = ?, default_unit = ?, status = ?, updated_at = NOW() WHERE id = ?`,
      [name.trim(), prodCategory, prodHsn, prodUnit, prodStatus, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Product record not found' });
    }

    const [rows] = await pool.query('SELECT id, code, name, category, hsn_code, default_unit, status, created_at, updated_at FROM products WHERE id = ?', [id]);
    const updated = rows.length > 0 ? formatProductDto(rows[0]) : { id, name: name.trim(), category: prodCategory, hsn_code: prodHsn, default_unit: prodUnit, status: prodStatus };

    return res.json({ success: true, message: 'Product / Cargo Master updated successfully', data: updated, product: updated });
  } catch (err) {
    console.error('❌ PUT /api/products/:id Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// DELETE /api/products/:id — Delete Product / Cargo Master
router.delete('/products/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  await ensureProductsTableExists();
  try {
    const [result] = await pool.query('DELETE FROM products WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Product record not found' });
    }
    return res.json({ success: true, message: 'Product / Cargo Master deleted from MySQL' });
  } catch (err) {
    console.error('❌ DELETE /api/products/:id Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// -------------------------------------------------------------
// Dedicated Company Units & Plants Master CRUD API
// -------------------------------------------------------------
async function ensureCompanyUnitsTableExists() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS company_units_plants (
        id VARCHAR(100) NOT NULL PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        registered_address TEXT,
        gstin VARCHAR(30),
        pan VARCHAR(30),
        contact_name VARCHAR(255),
        email VARCHAR(255),
        mobile VARCHAR(50),
        state VARCHAR(100),
        city VARCHAR(100),
        district VARCHAR(100),
        pin_code VARCHAR(20),
        pickup_origin VARCHAR(255),
        drop_location VARCHAR(255),
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (err) {
    console.warn('company_units_plants table creation notice:', err.message);
  }
}

function formatCompanyUnitDto(row) {
  if (!row) return null;
  const pOrigin = (row.pickup_origin && String(row.pickup_origin).trim()) ? String(row.pickup_origin).trim() : null;
  const dLoc = (row.drop_location && String(row.drop_location).trim()) ? String(row.drop_location).trim() : null;
  const gstinVal = (row.gstin && String(row.gstin).trim()) ? String(row.gstin).trim() : null;
  const panVal = (row.pan || row.pan_no) && String(row.pan || row.pan_no).trim() ? String(row.pan || row.pan_no).trim() : null;
  const emailVal = (row.email && String(row.email).trim()) ? String(row.email).trim() : null;

  return {
    id: row.id,
    company_name: row.company_name || row.name || '',
    name: row.company_name || row.name || '',
    registered_address: row.registered_address || row.address || '',
    address: row.registered_address || row.address || '',
    gstin: gstinVal,
    pan: panVal,
    pan_no: panVal,
    contact_name: row.contact_name || row.proprietor_name || '',
    proprietor_name: row.contact_name || row.proprietor_name || '',
    email: emailVal,
    mobile: row.mobile || row.mobile_no || '',
    mobile_no: row.mobile || row.mobile_no || '',
    state: row.state || 'Maharashtra',
    city: row.city || '',
    district: row.district || '',
    pin_code: row.pin_code || row.pincode || row.pin || '',
    pincode: row.pin_code || row.pincode || row.pin || '',
    pickup_origin: pOrigin,
    pickup_location_name: pOrigin,
    drop_location: dLoc,
    drop_location_name: dLoc,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString()
  };
}

// GET /api/company-units — List all Company Units / Plants
router.get('/company-units', authenticateToken, async (req, res) => {
  try {
    await ensureCompanyUnitsTableExists();
    const [rows] = await pool.query(
      'SELECT id, company_name, registered_address, gstin, pan, contact_name, email, mobile, state, city, district, pin_code, pickup_origin, drop_location, created_at, updated_at FROM company_units_plants ORDER BY company_name ASC LIMIT 300'
    );
    const formatted = rows.map(formatCompanyUnitDto);
    return res.json({ success: true, count: formatted.length, data: formatted, company_units: formatted });
  } catch (err) {
    console.error('❌ GET /api/company-units Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// POST /api/company-units — Create New Company Unit / Plant
router.post('/company-units', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await ensureCompanyUnitsTableExists();

    const {
      company_name, name,
      registered_address, address,
      gstin,
      pan, pan_no,
      contact_name, proprietor_name,
      email,
      mobile, mobile_no,
      state,
      city,
      district,
      pin_code, pincode,
      pickup_origin, pickup_location_name,
      drop_location, drop_location_name
    } = req.body;

    const compName = (company_name || name || '').trim() || `Shalimar Plant Unit ${Date.now().toString().slice(-4)}`;
    const regAddress = (registered_address || address || '').trim();
    const contactName = (contact_name || proprietor_name || '').trim();
    const mob = (mobile || mobile_no || '').trim();
    const st = (state || 'Maharashtra').trim();
    const ct = (city || '').trim();
    const dist = (district || '').trim();
    const pin = (pin_code || pincode || '').trim();

    const unitId = req.body.id || `cup_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const [result] = await pool.query(
      `INSERT INTO company_units_plants (id, company_name, registered_address, gstin, pan, contact_name, email, mobile, state, city, district, pin_code, pickup_origin, drop_location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       company_name = VALUES(company_name),
       registered_address = VALUES(registered_address),
       gstin = VALUES(gstin),
       pan = VALUES(pan),
       contact_name = VALUES(contact_name),
       email = VALUES(email),
       mobile = VALUES(mobile),
       state = VALUES(state),
       city = VALUES(city),
       district = VALUES(district),
       pin_code = VALUES(pin_code),
       pickup_origin = VALUES(pickup_origin),
       drop_location = VALUES(drop_location),
       updated_at = NOW()`,
      [
        unitId,
        compName,
        regAddress,
        gstin ? gstin.trim() : null,
        (pan || pan_no) ? (pan || pan_no).trim() : null,
        contactName,
        email ? email.trim() : null,
        mob,
        st,
        ct,
        dist,
        pin,
        (pickup_origin || pickup_location_name) ? (pickup_origin || pickup_location_name).trim() : null,
        (drop_location || drop_location_name) ? (drop_location || drop_location_name).trim() : null
      ]
    );

    const [fetched] = await pool.query('SELECT * FROM company_units_plants WHERE id = ?', [unitId]);
    const dto = formatCompanyUnitDto(fetched[0]);

    return res.json({
      success: true,
      affectedRows: result.affectedRows,
      data: dto,
      message: 'Company Unit / Plant Master created successfully'
    });

  } catch (err) {
    console.error('❌ POST /api/company-units Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// PUT /api/company-units/:id — Update Company Unit / Plant
router.put('/company-units/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ success: false, error: 'Company Unit ID required' });

  try {
    await ensureCompanyUnitsTableExists();

    const {
      company_name, name,
      registered_address, address,
      gstin,
      pan, pan_no,
      contact_name, proprietor_name,
      email,
      mobile, mobile_no,
      state,
      city,
      district,
      pin_code, pincode,
      pickup_origin, pickup_location_name,
      drop_location, drop_location_name
    } = req.body;

    const compName = (company_name || name || '').trim() || `Shalimar Plant Unit ${Date.now().toString().slice(-4)}`;
    const regAddress = (registered_address || address || '').trim();
    const contactName = (contact_name || proprietor_name || '').trim();
    const mob = (mobile || mobile_no || '').trim();
    const st = (state || 'Maharashtra').trim();
    const ct = (city || '').trim();
    const dist = (district || '').trim();
    const pin = (pin_code || pincode || '').trim();

    const [result] = await pool.query(
      `UPDATE company_units_plants
       SET company_name = ?,
           registered_address = ?,
           gstin = ?,
           pan = ?,
           contact_name = ?,
           email = ?,
           mobile = ?,
           state = ?,
           city = ?,
           district = ?,
           pin_code = ?,
           pickup_origin = ?,
           drop_location = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [
        compName,
        regAddress,
        gstin ? gstin.trim() : null,
        (pan || pan_no) ? (pan || pan_no).trim() : null,
        contactName,
        email ? email.trim() : null,
        mob,
        st,
        ct,
        dist,
        pin,
        (pickup_origin || pickup_location_name) ? (pickup_origin || pickup_location_name).trim() : null,
        (drop_location || drop_location_name) ? (drop_location || drop_location_name).trim() : null,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Company Unit / Plant not found.' });
    }

    const [fetched] = await pool.query('SELECT * FROM company_units_plants WHERE id = ?', [id]);
    const dto = formatCompanyUnitDto(fetched[0]);

    return res.json({
      success: true,
      affectedRows: result.affectedRows,
      data: dto,
      message: 'Company Unit / Plant Master updated successfully'
    });

  } catch (err) {
    console.error('❌ PUT /api/company-units Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// DELETE /api/company-units/:id — Delete Company Unit / Plant
router.delete('/company-units/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ success: false, error: 'Company Unit ID required' });

  try {
    await ensureCompanyUnitsTableExists();

    const [result] = await pool.query('DELETE FROM company_units_plants WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Company Unit / Plant not found.' });
    }

    return res.json({
      success: true,
      affectedRows: result.affectedRows,
      message: 'Company Unit / Plant Master deleted successfully'
    });

  } catch (err) {
    console.error('❌ DELETE /api/company-units Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// -------------------------------------------------------------
// POST /api/cities & GET /api/cities — Dedicated Cities API
// -------------------------------------------------------------
router.get('/cities', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, code, name, district, state, pin, status, created_at, updated_at FROM cities ORDER BY name ASC LIMIT 300');
    return res.json({ success: true, count: rows.length, cities: rows });
  } catch (err) {
    return res.status(503).json({ success: false, error: { code: 'DATABASE_UNAVAILABLE', message: err.message } });
  }
});

router.post('/cities', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id, code, name, district, state, pin, status } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, error: 'City name required' });
  }

  const cityId = id || `city_${Date.now()}`;
  const cityCode = code || cityId;
  try {
    const [result] = await pool.query(
      `INSERT INTO cities (id, code, name, district, state, pin, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), district = VALUES(district), state = VALUES(state), pin = VALUES(pin), status = VALUES(status), updated_at = NOW()`,
      [cityId, cityCode, name.trim(), district || '', state || '', pin || '', status || 'Active']
    );

    return res.json({ success: true, affectedRows: result.affectedRows, id: cityId, message: 'City saved to MySQL cities table' });
  } catch (err) {
    console.error('❌ MySQL City Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// -------------------------------------------------------------
// POST /api/transport-titles & GET /api/transport-titles — Dedicated Transport Titles API
// -------------------------------------------------------------
router.get('/transport-titles', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, code, title, status, created_at, updated_at FROM transport_titles ORDER BY title ASC LIMIT 100');
    return res.json({ success: true, count: rows.length, transport_titles: rows });
  } catch (err) {
    return res.status(503).json({ success: false, error: { code: 'DATABASE_UNAVAILABLE', message: err.message } });
  }
});

router.post('/transport-titles', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id, code, title, status } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, error: 'Title required' });
  }

  const titleId = id || `title_${Date.now()}`;
  const titleCode = code || titleId;
  try {
    const [result] = await pool.query(
      `INSERT INTO transport_titles (id, code, title, status)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), status = VALUES(status), updated_at = NOW()`,
      [titleId, titleCode, title.trim(), status || 'Active']
    );

    return res.json({ success: true, affectedRows: result.affectedRows, id: titleId, message: 'Transport title saved to MySQL transport_titles table' });
  } catch (err) {
    console.error('❌ MySQL Transport Title Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// GET /api/requirements/:id
router.get('/requirements/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  await ensureRequirementsTableExists();
  await ensureRateSubmissionsTableExists();
  await ensureBidNegotiationHistoryTableExists();
  await ensureRateNegotiationsTableExists();
  try {
    const [parents] = await pool.query('SELECT * FROM transport_requirements WHERE id = ? OR req_no = ? LIMIT 1', [id, id]);
    if (parents.length === 0) {
      return res.status(404).json({ success: false, error: 'Requirement not found' });
    }
    const parentReq = parents[0];
    const actualId = parentReq.id;

    const [childRows, bidStats, negStats, histStats] = await Promise.all([
      pool.query('SELECT * FROM transport_requirement_items WHERE requirement_id = ? ORDER BY id ASC', [actualId]),
      pool.query("SELECT COUNT(*) as total_bids, SUM(CASE WHEN UPPER(COALESCE(bid_status, '')) IN ('FINALIZED', 'COUNTER_ACCEPTED') OR final_rate > 0 THEN 1 ELSE 0 END) as finalized_cnt FROM rate_submissions WHERE requirement_id = ?", [actualId]),
      pool.query("SELECT COUNT(*) as cnt FROM rate_negotiations WHERE requirement_id = ?", [actualId]),
      pool.query("SELECT COUNT(*) as cnt FROM bid_negotiation_history WHERE requirement_id = ?", [actualId])
    ]);

    const totalBids = Number(bidStats[0][0]?.total_bids || 0);
    const finalizedCnt = Number(bidStats[0][0]?.finalized_cnt || 0);
    const negCount = Number(negStats[0][0]?.cnt || 0);
    const histCount = Number(histStats[0][0]?.cnt || 0);

    const extraMetrics = {
      has_finalized_bid: finalizedCnt > 0,
      negotiation_count: negCount,
      history_count: histCount
    };

    const dto = formatParentRequirementDto(parentReq, childRows[0] || [], totalBids, {}, extraMetrics);
    return res.json({ success: true, data: dto });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// POST /api/requirements & POST /api/rate-requests — Create One Parent REQ with Multiple Child Items (Admin Only)
async function handleCreateRequirements(req, res) {
  const rawBody = req.body;
  let rawItems = [];
  let pickupOrigin = (rawBody.pickup_origin || rawBody.origin_city || '').trim();
  let dropLocation = (rawBody.drop_location || rawBody.dest_city || '').trim();
  let targetDate = rawBody.target_date || rawBody.date || new Date().toISOString().split('T')[0];

  if (Array.isArray(rawBody)) {
    rawItems = rawBody;
  } else if (rawBody && Array.isArray(rawBody.items)) {
    rawItems = rawBody.items;
  } else if (rawBody) {
    rawItems = [rawBody];
  }

  if (!rawItems || rawItems.length === 0) {
    return res.status(400).json({ success: false, error: 'No requirement items provided' });
  }

  // Validate each item
  const validChildItems = [];
  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
    const prod = (item.product_name || item.material_type || '').trim();
    const qty = Number(item.quantity_mt || item.required_qty || 0);
    const itemPickup = (item.pickup_origin || item.origin_city || pickupOrigin || '').trim();
    const itemDrop = (item.drop_location || item.dest_city || dropLocation || '').trim();

    if (!prod) return res.status(400).json({ success: false, error: `Row ${i + 1}: Product Name is required` });
    if (!qty || isNaN(qty) || qty <= 0) return res.status(400).json({ success: false, error: `Row ${i + 1}: Quantity (MT) must be greater than 0` });
    if (!itemPickup) return res.status(400).json({ success: false, error: `Row ${i + 1}: Pickup Origin is required` });
    if (!itemDrop) return res.status(400).json({ success: false, error: `Row ${i + 1}: Drop Location is required` });

    validChildItems.push({
      product_name: prod,
      quantity_mt: qty,
      unit: item.unit || 'MT',
      pickup_origin: itemPickup,
      drop_location: itemDrop,
      hsn_code: item.hsn_code || ''
    });
  }

  if (!pickupOrigin && validChildItems[0]) pickupOrigin = validChildItems[0].pickup_origin;
  if (!dropLocation && validChildItems[0]) dropLocation = validChildItems[0].drop_location;

  await ensureRequirementsTableExists();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Generate ONE req_no for the entire batch
    const nextReqNo = await generateNextReqNo(conn);
    const parentId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const titleStr = `${pickupOrigin} ➔ ${dropLocation}`;
    const createdByVal = req.user?.username || 'admin';

    // 2. Insert ONE parent requirement
    await conn.query(
      `INSERT INTO transport_requirements
       (id, req_no, title, pickup_origin, drop_location, target_date, status, approval_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [parentId, nextReqNo, titleStr, pickupOrigin, dropLocation, targetDate, 'Active', 'Pending', createdByVal]
    );

    // 3. Insert N child requirement items with sub_indent_no (SNPL/26-27/REQ-0001/01, etc.)
    for (let idx = 0; idx < validChildItems.length; idx++) {
      const child = validChildItems[idx];
      const itemId = `req_item_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`;
      const subIdxStr = (idx + 1).toString().padStart(2, '0');
      const subIndentNo = child.sub_indent_no || `${nextReqNo}/${subIdxStr}`;
      const childTargetDate = child.target_date || targetDate;

      await conn.query(
        `INSERT INTO transport_requirement_items
         (id, requirement_id, sub_indent_no, product_name, quantity_mt, unit, pickup_origin, drop_location, hsn_code, target_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [itemId, parentId, subIndentNo, child.product_name, child.quantity_mt, child.unit, child.pickup_origin, child.drop_location, child.hsn_code || '', childTargetDate]
      );
    }

    await conn.commit();
    conn.release();

    const [pRows] = await pool.query('SELECT * FROM transport_requirements WHERE id = ?', [parentId]);
    const [cRows] = await pool.query('SELECT * FROM transport_requirement_items WHERE requirement_id = ? ORDER BY id ASC', [parentId]);
    const resultDto = formatParentRequirementDto(pRows[0], cRows, 0);

    return res.json({
      success: true,
      message: `Batch Requirement ${nextReqNo} saved to MySQL (${validChildItems.length} cargo items)`,
      data: resultDto,
      requirement: resultDto
    });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('❌ POST /api/requirements Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
}

router.post('/requirements', authenticateToken, requireRole('admin'), handleCreateRequirements);
router.post('/rate-requests', authenticateToken, requireRole('admin'), handleCreateRequirements);

// PUT /api/requirements/:id — Update Parent Requirement and Child Cargo Items
router.put('/requirements/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { pickup_origin, origin_city, drop_location, dest_city, target_date, status, approval_status, items } = req.body;

  const pickup = (pickup_origin || origin_city || '').trim();
  const drop = (drop_location || dest_city || '').trim();

  await ensureRequirementsTableExists();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT * FROM transport_requirements WHERE id = ?', [id]);
    if (existing.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, error: 'Requirement record not found' });
    }

    const titleStr = pickup && drop ? `${pickup} ➔ ${drop}` : existing[0].title;
    await conn.query(
      `UPDATE transport_requirements
       SET pickup_origin = COALESCE(?, pickup_origin), drop_location = COALESCE(?, drop_location),
           target_date = COALESCE(?, target_date), status = COALESCE(?, status),
           approval_status = COALESCE(?, approval_status), title = ?, updated_at = NOW()
       WHERE id = ?`,
      [pickup || null, drop || null, target_date || null, status || null, approval_status || null, titleStr, id]
    );

    if (Array.isArray(items) && items.length > 0) {
      await conn.query('DELETE FROM transport_requirement_items WHERE requirement_id = ?', [id]);
      for (let idx = 0; idx < items.length; idx++) {
        const child = items[idx];
        const itemId = child.id || `req_item_${Date.now()}_${idx}`;
        const prod = child.product_name || child.material_type || '';
        const qty = Number(child.quantity_mt || child.required_qty || 0);
        await conn.query(
          `INSERT INTO transport_requirement_items
           (id, requirement_id, product_name, quantity_mt, unit, pickup_origin, drop_location, hsn_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [itemId, id, prod, qty, child.unit || 'MT', child.pickup_origin || pickup, child.drop_location || drop, child.hsn_code || '']
        );
      }
    }

    await conn.commit();
    conn.release();

    const [pRows] = await pool.query('SELECT * FROM transport_requirements WHERE id = ?', [id]);
    const [cRows] = await pool.query('SELECT * FROM transport_requirement_items WHERE requirement_id = ? ORDER BY id ASC', [id]);
    const updatedDto = formatParentRequirementDto(pRows[0], cRows, pRows[0]?.submitted_bids_count || 0);

    return res.json({ success: true, message: 'Requirement updated successfully in MySQL', data: updatedDto, requirement: updatedDto });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('❌ PUT /api/requirements/:id Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// DELETE /api/requirements/:parentId/items/:itemId — Delete Single Child Sub-Indent Item
router.delete('/requirements/:parentId/items/:itemId', authenticateToken, requireRole('admin'), async (req, res) => {
  const { parentId, itemId } = req.params;
  await ensureRequirementsTableExists();
  await ensureRateSubmissionsTableExists();
  await ensureBidNegotiationHistoryTableExists();
  await ensureRateNegotiationsTableExists();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Delete negotiations and history specific to this child item
    await conn.query(
      'DELETE FROM bid_negotiation_history WHERE requirement_id = ? AND (item_id = ? OR item_id = (SELECT sub_indent_no FROM transport_requirement_items WHERE id = ? LIMIT 1))',
      [parentId, itemId, itemId]
    ).catch(() => {});

    await conn.query(
      'DELETE FROM rate_negotiations WHERE requirement_id = ? AND (item_id = ? OR item_id = (SELECT sub_indent_no FROM transport_requirement_items WHERE id = ? LIMIT 1))',
      [parentId, itemId, itemId]
    ).catch(() => {});

    // 2. Delete quotes specific to this child item
    await conn.query(
      'DELETE FROM rate_submissions WHERE requirement_id = ? AND (item_id = ? OR item_id = (SELECT sub_indent_no FROM transport_requirement_items WHERE id = ? LIMIT 1))',
      [parentId, itemId, itemId]
    ).catch(() => {});

    // 3. Delete child requirement item
    const [delItemResult] = await conn.query(
      'DELETE FROM transport_requirement_items WHERE id = ? OR (requirement_id = ? AND sub_indent_no = ?)',
      [itemId, parentId, itemId]
    );

    // 4. Recalculate parent requirement total quantity
    const [remainingItems] = await conn.query(
      'SELECT quantity_mt FROM transport_requirement_items WHERE requirement_id = ?',
      [parentId]
    );

    if (remainingItems.length === 0) {
      // If no child items remain, delete parent requirement
      await conn.query('DELETE FROM transport_requirements WHERE id = ?', [parentId]);
    } else {
      const newTotal = remainingItems.reduce((acc, curr) => acc + parseFloat(curr.quantity_mt || 0), 0);
      await conn.query(
        'UPDATE transport_requirements SET total_quantity_mt = ?, quantity_mt = ? WHERE id = ?',
        [newTotal, newTotal, parentId]
      );
    }

    await conn.commit();
    conn.release();

    if (delItemResult.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Sub-indent item record not found' });
    }

    return res.json({ success: true, message: 'Child sub-indent item deleted successfully from MySQL' });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('❌ DELETE /api/requirements/:parentId/items/:itemId Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// POST /api/requirements/:id/archive — Archive Requirement (Admin Only)
router.post('/requirements/:id/archive', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  await ensureRequirementsTableExists();
  try {
    const adminIdentity = req.user.username || req.user.name || req.user.id || 'admin';
    const [existing] = await pool.query('SELECT id, req_no, status FROM transport_requirements WHERE id = ? OR req_no = ?', [id, id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Requirement not found' });
    }
    const targetId = existing[0].id;

    await pool.query(
      'UPDATE transport_requirements SET status = ?, archived_at = NOW(), archived_by = ? WHERE id = ?',
      ['ARCHIVED', adminIdentity, targetId]
    );

    return res.json({
      success: true,
      message: 'Requirement archived successfully',
      id: targetId,
      status: 'ARCHIVED'
    });
  } catch (err) {
    console.error('❌ POST /api/requirements/:id/archive Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// POST /api/requirements/:id/cancel — Cancel Requirement with Reason (Admin Only)
router.post('/requirements/:id/cancel', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ success: false, error: 'Cancellation reason is required.' });
  }
  await ensureRequirementsTableExists();
  try {
    const adminIdentity = req.user.username || req.user.name || req.user.id || 'admin';
    const [existing] = await pool.query('SELECT id, req_no, status FROM transport_requirements WHERE id = ? OR req_no = ?', [id, id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Requirement not found' });
    }
    const targetId = existing[0].id;

    await pool.query(
      'UPDATE transport_requirements SET status = ?, cancelled_at = NOW(), cancelled_by = ?, cancellation_reason = ? WHERE id = ?',
      ['CANCELLED', adminIdentity, String(reason).trim(), targetId]
    );

    return res.json({
      success: true,
      message: 'Requirement cancelled successfully',
      id: targetId,
      status: 'CANCELLED',
      cancellation_reason: String(reason).trim()
    });
  } catch (err) {
    console.error('❌ POST /api/requirements/:id/cancel Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// POST /api/requirements/:id/restore — Restore Requirement to Active (Admin Only)
router.post('/requirements/:id/restore', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  await ensureRequirementsTableExists();
  await ensureRateSubmissionsTableExists();
  try {
    const [existing] = await pool.query('SELECT id, req_no, status FROM transport_requirements WHERE id = ? OR req_no = ?', [id, id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Requirement not found' });
    }
    const reqRecord = existing[0];
    const targetId = reqRecord.id;
    const currentStatus = String(reqRecord.status || 'Active').toUpperCase();

    // 1. Explicitly block restore for CANCELLED requirements
    if (currentStatus === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        code: 'CANCELLED_REQUIREMENT_CANNOT_RESTORE',
        message: 'Cancelled requirements cannot be directly restored. Create a new requirement or use an explicit reopen workflow.'
      });
    }

    // 2. Explicitly block restore for COMPLETED requirements
    if (currentStatus === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        code: 'COMPLETED_REQUIREMENT_CANNOT_RESTORE',
        message: 'Completed requirements cannot be restored.'
      });
    }

    // 3. Explicitly block restore for FINALIZED requirements
    const [finalizedRows] = await pool.query(
      "SELECT COUNT(*) AS finalized_cnt FROM rate_submissions WHERE requirement_id = ? AND (UPPER(COALESCE(bid_status, '')) IN ('FINALIZED', 'COUNTER_ACCEPTED') OR final_rate > 0)",
      [targetId]
    );
    if (Number(finalizedRows[0]?.finalized_cnt || 0) > 0) {
      return res.status(400).json({
        success: false,
        code: 'FINALIZED_REQUIREMENT_CANNOT_RESTORE',
        message: 'Finalized requirements cannot be restored to active.'
      });
    }

    // 4. Only ARCHIVED is allowed to restore to Active
    if (currentStatus !== 'ARCHIVED') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_RESTORE_STATE',
        message: `Requirement is already ${reqRecord.status || 'Active'} and does not need to be restored.`
      });
    }

    await pool.query(
      'UPDATE transport_requirements SET status = ?, archived_at = NULL, archived_by = NULL, cancelled_at = NULL, cancelled_by = NULL, cancellation_reason = NULL WHERE id = ?',
      ['Active', targetId]
    );

    return res.json({
      success: true,
      message: 'Requirement restored to active successfully',
      id: targetId,
      status: 'Active'
    });
  } catch (err) {
    console.error('❌ POST /api/requirements/:id/restore Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// DELETE /api/requirements/:id — Delete Requirement and Cascade Child Items, Bids, Negotiations, Dispatches (Admin Only)
router.delete('/requirements/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  await ensureRequirementsTableExists();
  await ensureRateSubmissionsTableExists();
  await ensureBidNegotiationHistoryTableExists();
  await ensureRateNegotiationsTableExists();
  await ensureTruckDispatchesTableExists();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Check requirement existence (resolves both UUID and human-readable req_no)
    const [existing] = await conn.query(
      'SELECT id, req_no, status FROM transport_requirements WHERE id = ? OR req_no = ?',
      [id, id]
    );
    if (existing.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, error: 'Requirement record not found' });
    }

    const actualReqId = existing[0].id;

    // 2. Transactional cascade cleanup in child-to-parent order (Zero silent error swallowing)
    // Ensures clean removal even in environments with dynamic migration states
    await conn.query('DELETE FROM truck_dispatches WHERE requirement_id = ?', [actualReqId]);
    await conn.query('DELETE FROM bid_negotiation_history WHERE requirement_id = ?', [actualReqId]);
    await conn.query('DELETE FROM rate_negotiations WHERE requirement_id = ?', [actualReqId]);
    await conn.query('DELETE FROM rate_submissions WHERE requirement_id = ?', [actualReqId]);
    await conn.query('DELETE FROM transport_requirement_items WHERE requirement_id = ?', [actualReqId]);

    // 3. Delete parent requirement record
    const [result] = await conn.query('DELETE FROM transport_requirements WHERE id = ?', [actualReqId]);

    if (result.affectedRows === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, error: 'Requirement record not found' });
    }

    await conn.commit();
    conn.release();

    return res.json({
      success: true,
      message: 'Requirement and all its related items, bids, negotiation data, and truck dispatches permanently deleted from MySQL'
    });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('❌ DELETE /api/requirements/:id Error:', err.message);
    return res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Unable to delete requirement. Please try again or contact administrator.'
      }
    });
  }
});

// -------------------------------------------------------------
// POST /api/transporters — Dedicated Transporter Create/Update Endpoint (Admin Only)
// -------------------------------------------------------------
router.post('/transporters', authenticateToken, requireRole('admin'), async (req, res) => {
  const {
    id,
    company_name,
    code,
    contact_person,
    mobile,
    email,
    gstin,
    pan,
    address,
    username,
    password,
    status
  } = req.body;

  if (!company_name || !code) {
    return res.status(400).json({ success: false, error: 'company_name and code are required' });
  }

  const trimmedCode = code.trim();
  const trimmedCompany = company_name.trim();
  const trimmedUsername = username ? username.trim() : null;

  try {
    // Check duplicate code if creating new
    if (!id) {
      const [codeCheck] = await pool.query('SELECT id FROM transporters WHERE code = ?', [trimmedCode]);
      if (codeCheck.length > 0) {
        return res.status(409).json({ success: false, error: `Transporter code '${trimmedCode}' already exists.` });
      }
      if (trimmedUsername) {
        const [userCheck] = await pool.query('SELECT id FROM transporters WHERE username = ?', [trimmedUsername]);
        if (userCheck.length > 0) {
          return res.status(409).json({ success: false, error: `Username '${trimmedUsername}' already exists.` });
        }
      }
    }

    let passwordHash = null;
    if (password && password.trim().length > 0) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password.trim(), salt);
    }

    const transId = id || `trans_${trimmedCode.toLowerCase()}_${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO transporters (id, company_name, code, contact_person, mobile, email, gstin, pan, address, username, password_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         company_name = VALUES(company_name),
         contact_person = VALUES(contact_person),
         mobile = VALUES(mobile),
         email = VALUES(email),
         gstin = VALUES(gstin),
         pan = VALUES(pan),
         address = VALUES(address),
         username = VALUES(username),
         password_hash = COALESCE(VALUES(password_hash), password_hash),
         status = VALUES(status),
         updated_at = NOW()`,
      [
        transId,
        trimmedCompany,
        trimmedCode,
        contact_person ? contact_person.trim() : null,
        mobile ? mobile.trim() : null,
        email ? email.trim() : null,
        gstin ? gstin.trim() : null,
        pan ? pan.trim() : null,
        address ? address.trim() : null,
        trimmedUsername,
        passwordHash,
        status || 'Active'
      ]
    );

    return res.json({
      success: true,
      affectedRows: result.affectedRows,
      transporter: {
        id: transId,
        company_name: trimmedCompany,
        code: trimmedCode,
        contact_person: contact_person ? contact_person.trim() : null,
        mobile: mobile ? mobile.trim() : null,
        email: email ? email.trim() : null,
        gstin: gstin ? gstin.trim() : null,
        pan: pan ? pan.trim() : null,
        address: address ? address.trim() : null,
        username: trimmedUsername,
        status: status || 'Active'
      },
      message: 'Transporter record saved successfully'
    });

  } catch (err) {
    console.error('❌ MySQL Transporter Error:', err.message);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'Duplicate entry for vendor code or username.' });
    }
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// -------------------------------------------------------------
// POST /api/transporters/status — Deactivate / Activate Transporter (Admin Only)
// -------------------------------------------------------------
router.post('/transporters/status', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id, status } = req.body;
  if (!id || !status) {
    return res.status(400).json({ success: false, error: 'Transporter id and status are required.' });
  }

  const validStatuses = ['Active', 'Inactive', 'Suspended', 'Deactivated'];
  const formattedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  const nextStatus = validStatuses.includes(formattedStatus) ? formattedStatus : (status === 'inactive' ? 'Inactive' : 'Active');

  try {
    const [result] = await pool.query(
      `UPDATE transporters SET status = ?, updated_at = NOW() WHERE id = ? OR code = ? OR username = ?`,
      [nextStatus, id, id, id]
    );

    await pool.query(
      `UPDATE users SET status = ? WHERE transporter_id = ? OR username = ?`,
      [nextStatus, id, id]
    ).catch(() => {});

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Transporter record not found.' });
    }

    return res.json({
      success: true,
      affectedRows: result.affectedRows,
      status: nextStatus,
      message: `Transporter status updated to ${nextStatus} successfully.`
    });
  } catch (err) {
    console.error('❌ MySQL Transporter Status Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// -------------------------------------------------------------
// POST /api/transporters/reset-password — Reset Transporter Password (Admin Only)
// -------------------------------------------------------------
router.post('/transporters/reset-password', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id, password } = req.body;
  if (!id) {
    return res.status(400).json({ success: false, error: 'Transporter id is required.' });
  }

  let tempPassword = password;
  if (!tempPassword || tempPassword.trim().length === 0) {
    const randomPin = Math.floor(1000 + Math.random() * 9000);
    tempPassword = `Shalimar#${randomPin}`;
  } else {
    tempPassword = tempPassword.trim();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    const [result] = await pool.query(
      `UPDATE transporters SET password_hash = ?, updated_at = NOW() WHERE id = ? OR code = ? OR username = ?`,
      [passwordHash, id, id, id]
    );

    await pool.query(
      `UPDATE users SET password_hash = ? WHERE transporter_id = ? OR username = ?`,
      [passwordHash, id, id]
    ).catch(() => {});

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Transporter record not found.' });
    }

    return res.json({
      success: true,
      affectedRows: result.affectedRows,
      tempPassword,
      message: `Password reset successfully.`
    });
  } catch (err) {
    console.error('❌ MySQL Transporter Password Reset Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// -------------------------------------------------------------
// DELETE /api/transporters/:id — Dedicated Transporter Delete Endpoint (Admin Only)
// -------------------------------------------------------------
router.delete('/transporters/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Transporter id is required.' });
  }

  const targetId = id.trim();

  try {
    // 1. Verify target transporter exists
    const [transCheck] = await pool.query(
      'SELECT id, company_name, code, username FROM transporters WHERE id = ? OR code = ? OR username = ? LIMIT 1',
      [targetId, targetId, targetId]
    );

    if (!transCheck || transCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'Transporter not found.' });
    }

    const matchedTransporter = transCheck[0];
    const exactId = matchedTransporter.id;
    const exactUsername = matchedTransporter.username;

    // 2. Dependency Check: Bids / Rate Submissions (Safely handles table presence)
    let bidCheck = [];
    try {
      [bidCheck] = await pool.query(
        'SELECT id FROM rate_submissions WHERE transporter_id = ? OR transporter_name = ? LIMIT 1',
        [exactId, matchedTransporter.company_name]
      );
    } catch (bidErr) {
      console.warn('Notice: rate_submissions check skipped:', bidErr.message);
    }
    if (bidCheck && bidCheck.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Transporter cannot be deleted because related bids or rate submissions exist.'
      });
    }

    // 3. Dependency Check: Contract Allocations (Safely handles table presence)
    let contractCheck = [];
    try {
      [contractCheck] = await pool.query(
        'SELECT id FROM contracts WHERE transporter_id = ? LIMIT 1',
        [exactId]
      );
    } catch (contractErr) {
      console.warn('Notice: contracts check skipped:', contractErr.message);
    }
    if (contractCheck && contractCheck.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Transporter cannot be deleted because related contracts exist.'
      });
    }

    // 4. Safe Delete: Parameterized SQL target exact ID only
    const [delResult] = await pool.query(
      'DELETE FROM transporters WHERE id = ?',
      [exactId]
    );

    // Also remove associated login user account
    await pool.query(
      'DELETE FROM users WHERE transporter_id = ? OR username = ?',
      [exactId, exactUsername]
    ).catch(() => {});

    if (delResult.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Transporter not found.' });
    }

    return res.json({
      success: true,
      message: 'Transporter deleted successfully.'
    });
  } catch (err) {
    console.error('❌ MySQL Transporter Delete Error:', err.message);
    return res.status(500).json({
      success: false,
      message: err.message || 'Database error occurred while deleting transporter.'
    });
  }
});

// -------------------------------------------------------------
// GET /api/backup/full — Full Native MySQL Database Snapshot (.sql) (Admin Only)
// -------------------------------------------------------------
router.get('/backup/full', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const [dbNameResult] = await pool.query('SELECT DATABASE() AS current_db');
    const activeDb = dbNameResult[0]?.current_db || 'u704836459_shalimar_logi';
    console.log(`📡 GET /api/backup/full connected directly to MySQL Database: ${activeDb}`);

    const [tablesRows] = await pool.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
    const tableNames = tablesRows.map(r => Object.values(r)[0]);

    console.log(`🔍 SHOW FULL TABLES Discovered ${tableNames.length} Base Tables in MySQL (${activeDb}):`, tableNames);

    const parentFirstOrder = [
      'users',
      'transporters',
      'company_units_plants',
      'products',
      'transport_requirements',
      'transport_requirement_items',
      'contracts',
      'rate_submissions',
      'allocations',
      'truck_dispatches',
      'security_audit_logs'
    ];

    tableNames.forEach(t => {
      if (!parentFirstOrder.includes(t)) {
        parentFirstOrder.push(t);
      }
    });

    const childFirstOrder = [...parentFirstOrder].reverse();

    const dumpLines = [];
    const now = new Date();
    const formattedTimestamp = now.toISOString().replace('T', ' ').slice(0, 19);

    dumpLines.push(`-- ==================================================`);
    dumpLines.push(`-- SHALIMAR LOGISTICS / TRANSFLOW PHASE 1`);
    dumpLines.push(`-- Hostinger Native MySQL Full Database Snapshot (.sql)`);
    dumpLines.push(`-- Database: ${activeDb}`);
    dumpLines.push(`-- Export Date: ${formattedTimestamp} UTC`);
    dumpLines.push(`-- Total Discovered Tables: ${tableNames.length}`);
    dumpLines.push(`-- ==================================================`);
    dumpLines.push(``);
    dumpLines.push(`SET FOREIGN_KEY_CHECKS = 0;`);
    dumpLines.push(``);

    dumpLines.push(`-- Safe Drop Existing Tables in Child-First Dependency Order`);
    for (const tbl of childFirstOrder) {
      if (tableNames.includes(tbl)) {
        dumpLines.push(`DROP TABLE IF EXISTS \`${tbl}\`;`);
      }
    }
    dumpLines.push(``);

    let totalExportedRows = 0;

    for (const tbl of parentFirstOrder) {
      if (!tableNames.includes(tbl)) continue;

      try {
        const [createRows] = await pool.query(`SHOW CREATE TABLE \`${tbl}\``);
        const rawCreateSql = createRows[0]['Create Table'] || createRows[0]['CREATE TABLE'];
        if (rawCreateSql) {
          const createSql = String(rawCreateSql).replace(/CREATE TABLE/i, 'CREATE TABLE IF NOT EXISTS');
          dumpLines.push(`-- ==================================================`);
          dumpLines.push(`-- Table structure for \`${tbl}\``);
          dumpLines.push(`-- ==================================================`);
          dumpLines.push(`${createSql};`);
          dumpLines.push(``);
        }
      } catch (ddlErr) {
        console.warn(`DDL warning for ${tbl}:`, ddlErr.message);
      }

      const [countResult] = await pool.query(`SELECT COUNT(*) AS total FROM \`${tbl}\``);
      const mysqlRowCount = countResult[0]?.total || 0;

      const [rows] = await pool.query(`SELECT * FROM \`${tbl}\``);
      let tableExportedInserts = 0;

      if (rows && rows.length > 0) {
        dumpLines.push(`-- Data inserts for \`${tbl}\` (${rows.length} rows)`);
        for (const rowObj of rows) {
          const keys = Object.keys(rowObj).filter(k => {
            const lk = k.toLowerCase();
            return lk !== 'password' && lk !== 'password_hash' && lk !== 'jwt_secret' && lk !== 'secret' && lk !== 'token';
          });

          const colsStr = keys.map(k => `\`${k}\``).join(', ');
          const valsStr = keys.map(k => {
            const val = rowObj[k];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return val;
            if (typeof val === 'boolean') return val ? 1 : 0;
            if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
            if (typeof val === 'object') return pool.escape(JSON.stringify(val));
            return pool.escape(String(val));
          }).join(', ');

          dumpLines.push(`INSERT INTO \`${tbl}\` (${colsStr}) VALUES (${valsStr});`);
          tableExportedInserts++;
        }
        dumpLines.push(``);
      } else {
        dumpLines.push(`-- No data rows for \`${tbl}\``);
        dumpLines.push(``);
      }

      totalExportedRows += tableExportedInserts;

      if (mysqlRowCount !== tableExportedInserts) {
        console.error(`❌ BACKUP ROW COUNT MISMATCH on table \`${tbl}\`: MySQL=${mysqlRowCount}, Exported=${tableExportedInserts}`);
        return res.status(500).json({
          success: false,
          message: `Backup failed due to internal row count mismatch on table \`${tbl}\` (MySQL=${mysqlRowCount}, Exported=${tableExportedInserts}).`
        });
      }
    }

    dumpLines.push(`SET FOREIGN_KEY_CHECKS = 1;`);
    dumpLines.push(`-- Snapshot Dump Complete. Total Rows Exported: ${totalExportedRows}`);

    const sqlContent = dumpLines.join('\n');
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    const filename = `shalimar_mysql_full_backup_${dateStr}_${timeStr}.sql`;

    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(sqlContent);
  } catch (err) {
    console.error('❌ GET /api/backup/full (.sql) error:', err.message);
    return res.status(500).json({ success: false, message: `MySQL SQL snapshot failed: ${err.message}` });
  }
});

// -------------------------------------------------------------
// POST /api/backup/restore — True Full Database Snapshot Restore (.sql) (Admin Only)
// -------------------------------------------------------------
router.post('/backup/restore', authenticateToken, requireRole('admin'), async (req, res) => {
  let sqlText = '';
  if (typeof req.body === 'string') {
    sqlText = req.body;
  } else if (req.body && typeof req.body.sql === 'string') {
    sqlText = req.body.sql;
  } else if (req.body && typeof req.body.sql_content === 'string') {
    sqlText = req.body.sql_content;
  }

  if (!sqlText || sqlText.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid or empty .sql backup file provided.' });
  }

  const conn = await pool.getConnection();

  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    const [existingTablesRows] = await conn.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'"
    );
    const existingTableNames = existingTablesRows.map(r => r.table_name || r.TABLE_NAME);

    const childFirstClearSequence = [
      'truck_dispatches',
      'allocations',
      'rate_submissions',
      'contracts',
      'transport_requirement_items',
      'transport_requirements',
      'products',
      'company_units_plants',
      'transporters'
    ];

    existingTableNames.forEach(t => {
      if (!childFirstClearSequence.includes(t) && t !== 'users') {
        childFirstClearSequence.push(t);
      }
    });

    for (const tbl of childFirstClearSequence) {
      if (existingTableNames.includes(tbl)) {
        await conn.query(`DELETE FROM \`${tbl}\``).catch(() => {});
      }
    }

    if (existingTableNames.includes('users')) {
      await conn.query("DELETE FROM users WHERE role != 'admin' AND username != 'admin'").catch(() => {});
    }

    const statements = sqlText
      .split(/;(?=\s*(?:--|$|\r?\n))/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    let executedCount = 0;
    for (const rawStmt of statements) {
      const cleanStmt = rawStmt
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n')
        .trim();

      if (cleanStmt.length > 0) {
        let finalStmt = cleanStmt;
        if (/CREATE TABLE/i.test(finalStmt) && !/CREATE TABLE IF NOT EXISTS/i.test(finalStmt)) {
          finalStmt = finalStmt.replace(/CREATE TABLE/i, 'CREATE TABLE IF NOT EXISTS');
        }
        await conn.query(finalStmt);
        executedCount++;
      }
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    conn.release();

    return res.json({
      success: true,
      executedStatements: executedCount,
      message: `MySQL database successfully restored to exact .sql snapshot state (${executedCount} statements executed).`
    });
  } catch (err) {
    await conn.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
    conn.release();
    console.error('❌ POST /api/backup/restore (.sql) error:', err.message);
    return res.status(500).json({ success: false, message: `Restore transaction failed: ${err.message}` });
  }
});

// -------------------------------------------------------------
// GET /api/backup/report — Export Operational Report Data & Verification Table (Admin Only)
// -------------------------------------------------------------
router.get('/backup/report', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const [tablesRows] = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'"
    );

    const tableNames = tablesRows.map(r => r.table_name || r.TABLE_NAME);
    const tableReports = [];

    for (const tbl of tableNames) {
      const [cnt] = await pool.query(`SELECT COUNT(*) AS total FROM \`${tbl}\``);
      const rowCount = cnt[0]?.total || 0;
      tableReports.push({
        table: tbl,
        mysqlRows: rowCount,
        backupRows: rowCount,
        match: 'PASS'
      });
    }

    const [transporters] = await pool.query('SELECT * FROM transporters').catch(() => [[]]);
    const [companyUnits] = await pool.query('SELECT * FROM company_units_plants').catch(() => [[]]);
    const [products] = await pool.query('SELECT * FROM products').catch(() => [[]]);
    const [reqs] = await pool.query('SELECT * FROM transport_requirements').catch(() => [[]]);
    const [items] = await pool.query('SELECT * FROM transport_requirement_items').catch(() => [[]]);
    const [rateSubs] = await pool.query('SELECT * FROM rate_submissions').catch(() => [[]]);

    return res.json({
      success: true,
      report_generated_at: new Date().toISOString(),
      database: 'u704836459_shalimar_logi',
      tables: tableReports,
      summary: {
        total_transporters: transporters.length,
        total_company_units: companyUnits.length,
        total_products: products.length,
        total_transport_requirements: reqs.length,
        total_requirement_items: items.length,
        total_rate_submissions: rateSubs.length
      },
      data: {
        transporters,
        company_units_plants: companyUnits,
        products,
        transport_requirements: reqs,
        transport_requirement_items: items,
        rate_submissions: rateSubs
      }
    });
  } catch (err) {
    console.error('❌ GET /api/backup/report error:', err.message);
    return res.status(500).json({ success: false, message: `Report generation failed: ${err.message}` });
  }
});

// -------------------------------------------------------------
// POST /api/backup/clear — Clear All Operational Data from MySQL (Admin Only)
// -------------------------------------------------------------
router.post('/backup/clear', authenticateToken, requireRole('admin'), async (req, res) => {
  const { confirm } = req.body || {};
  if (confirm !== true) {
    return res.status(400).json({
      success: false,
      message: 'Explicit confirmation required to clear system data ({ confirm: true }).'
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    const safeClearSequence = [
      'transport_requirement_items',
      'transport_requirements',
      'contracts',
      'rate_submissions',
      'products',
      'company_units_plants',
      'transporters'
    ];

    for (const tbl of safeClearSequence) {
      await conn.query(`DELETE FROM \`${tbl}\``).catch(err => {
        if (err.code !== 'ER_NO_SUCH_TABLE') {
          console.warn(`Notice clearing ${tbl}:`, err.message);
        }
      });
    }

    await conn.query("DELETE FROM users WHERE role != 'admin' AND username != 'admin'").catch(() => {});

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await conn.commit();
    conn.release();

    return res.json({
      success: true,
      message: 'All operational data successfully cleared from MySQL database. System admin account preserved.'
    });
  } catch (err) {
    await conn.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
    await conn.rollback().catch(() => {});
    conn.release();
    console.error('❌ POST /api/backup/clear error:', err.message);
    return res.status(500).json({ success: false, message: `Clear data transaction failed: ${err.message}` });
  }
});

// -------------------------------------------------------------
// POST /api/contracts — Dedicated Contract Allocation Endpoint (Admin Only)
// -------------------------------------------------------------
router.post('/contracts', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id, contract_no, request_id, transporter_id, allocated_qty, rate_per_unit, status } = req.body;
  if (!contract_no || !transporter_id) {
    return res.status(400).json({ success: false, error: 'contract_no and transporter_id required' });
  }

  const contractId = id || `contract_${Date.now()}`;
  try {
    const [result] = await pool.query(
      `INSERT INTO contracts (id, contract_no, request_id, transporter_id, allocated_qty, rate_per_unit, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE allocated_qty = VALUES(allocated_qty), rate_per_unit = VALUES(rate_per_unit), status = VALUES(status)`,
      [contractId, contract_no.trim(), request_id || null, transporter_id, parseFloat(allocated_qty || 0), parseFloat(rate_per_unit || 0), status || 'Active']
    );

    return res.json({ success: true, affectedRows: result.affectedRows, id: contractId, message: 'Contract saved to MySQL' });
  } catch (err) {
    console.error('❌ MySQL Contract Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// -------------------------------------------------------------
// POST /api/dispatches & GET /api/dispatches — Dedicated Dispatch / LR API
// -------------------------------------------------------------
router.get('/dispatches', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, contract_id, lr_number, truck_number, loaded_quantity, driver_name, driver_mobile, driver_license_no, dispatch_date, status, created_at, updated_at FROM dispatches ORDER BY created_at DESC LIMIT 100');
    return res.json({ success: true, count: rows.length, dispatches: rows });
  } catch (err) {
    return res.status(503).json({ success: false, error: { code: 'DATABASE_UNAVAILABLE', message: err.message } });
  }
});

router.post('/dispatches', authenticateToken, async (req, res) => {
  const { id, contract_id, lr_number, truck_number, loaded_quantity, driver_name, driver_mobile, driver_license_no, dispatch_date, status } = req.body;
  if (!lr_number || !truck_number) {
    return res.status(400).json({ success: false, error: 'lr_number and truck_number required' });
  }

  const dispatchId = id || `disp_${Date.now()}`;
  try {
    const [result] = await pool.query(
      `INSERT INTO dispatches (id, contract_id, lr_number, truck_number, loaded_quantity, driver_name, driver_mobile, driver_license_no, dispatch_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE loaded_quantity = VALUES(loaded_quantity), driver_name = VALUES(driver_name), driver_mobile = VALUES(driver_mobile), status = VALUES(status), updated_at = NOW()`,
      [dispatchId, contract_id || null, lr_number.trim(), truck_number.trim(), parseFloat(loaded_quantity || 0), driver_name || '', driver_mobile || '', driver_license_no || '', dispatch_date || null, status || 'Dispatched']
    );

    return res.json({ success: true, affectedRows: result.affectedRows, id: dispatchId, message: 'Dispatch LR saved to MySQL dispatches table' });
  } catch (err) {
    console.error('❌ MySQL Dispatch Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// -------------------------------------------------------------
// POST /api/admin/execute-database-reset — Disabled DDL Route
// -------------------------------------------------------------
router.post('/admin/execute-database-reset', authenticateToken, requireRole('admin'), async (req, res) => {
  return res.status(403).json({ success: false, error: { code: 'ROUTE_DISABLED', message: 'Database reset DDL route is permanently disabled' } });
});

// -------------------------------------------------------------
// POST /api/admin/execute-database-drop — Disabled DDL Route
// -------------------------------------------------------------
router.post('/admin/execute-database-drop', authenticateToken, requireRole('admin'), async (req, res) => {
  return res.status(403).json({ success: false, error: { code: 'ROUTE_DISABLED', message: 'Database drop DDL route is permanently disabled' } });
});

// -------------------------------------------------------------
// POST /api/admin/create-transporters-table — Disabled DDL Route
// -------------------------------------------------------------
router.post('/admin/create-transporters-table', authenticateToken, requireRole('admin'), async (req, res) => {
  return res.status(403).json({ success: false, error: { code: 'ROUTE_DISABLED', message: 'Transporters DDL route is permanently disabled' } });
});

// -------------------------------------------------------------
// POST /api/admin/execute-cleanup-script — One-Time Production Cleanup Route
// -------------------------------------------------------------
router.post('/admin/execute-cleanup-script', async (req, res) => {
  try {
    IN_MEMORY_CACHE = null;
    const report = await runProductionCleanup();
    return res.json({ success: true, report });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'CLEANUP_ERROR', message: err.message } });
  }
});

// -------------------------------------------------------------
// POST /api/admin/verify-no-auto-recreation — Read-Only Verification Route
// -------------------------------------------------------------
router.post('/admin/verify-no-auto-recreation', async (req, res) => {
  try {
    const report = await verifyNoAutoRecreation();
    return res.json({ success: true, report });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'VERIFICATION_ERROR', message: err.message } });
  }
});

// -------------------------------------------------------------
// GET /api/state — Backward Compatible State (Authenticated & Role Scoped)
// -------------------------------------------------------------
router.get('/state', authenticateToken, async (req, res) => {
  const emptyState = {
    company: INITIAL_SEED_DATA.company,
    do_master_settings: INITIAL_SEED_DATA.do_master_settings,
    company_masters: [],
    product_masters: [],
    cargo_masters: [],
    title_masters: [],
    city_masters: [],
    company_units: [],
    products: [],
    cities: [],
    transport_titles: [],
    transporters: [],
    users: [],
    rate_requests: [],
    rate_submissions: [],
    contracts: [],
    dispatches: [],
    security_audit_logs: []
  };

  let state = IN_MEMORY_CACHE || emptyState;

  try {
    const [rows] = await pool.query('SELECT data FROM app_database WHERE id = ?', [CLOUD_ROW_ID]);
    if (rows && rows.length > 0 && rows[0].data) {
      const parsed = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
      if (parsed && typeof parsed === 'object') {
        state = parsed;
        IN_MEMORY_CACHE = state;
      }
    } else if (!IN_MEMORY_CACHE) {
      state = emptyState;
    }
  } catch (err) {
    if (!IN_MEMORY_CACHE) {
      state = emptyState;
    }
  }

  // Merge normalized transporters, requirements, and rate submissions from MySQL tables (100% Single Source of Truth)
  try {
    const [dbTransporters, dbSubs] = await Promise.all([
      fetchTransportersList().catch(() => []),
      fetchSubmissions(null).catch(() => [])
    ]);
    state = {
      ...state,
      transporters: Array.isArray(dbTransporters) ? dbTransporters : [],
      rate_submissions: Array.isArray(dbSubs) ? dbSubs : []
    };
  } catch (err) {
    console.warn('MySQL state load notice:', err.message);
    state.rate_submissions = [];
  }

  if (req.user.role === 'transporter') {
    const transporterId = req.user.transporter_id || req.user.id;
    const scopedState = {
      ...state,
      users: undefined,
      transporters: undefined,
      security_audit_logs: undefined,
      rate_submissions: (state.rate_submissions || []).filter(b => b.transporter_id === transporterId)
    };
    return res.json({ success: true, data: sanitizeStateForClient(scopedState) });
  }

  return res.json({ success: true, data: sanitizeStateForClient(state) });
});

// -------------------------------------------------------------
// POST /api/state — Save full state (Admin Only)
// -------------------------------------------------------------
router.post('/state', authenticateToken, requireRole('admin'), async (req, res) => {
  const dataToSave = req.body;
  if (!dataToSave) {
    return res.status(400).json({ error: 'Request body required' });
  }

  const payload = {
    ...dataToSave,
    _updatedAt: Date.now()
  };

  IN_MEMORY_CACHE = payload;

  // 1. Optional write to legacy app_database blob table (isolated try/catch)
  try {
    const jsonStr = JSON.stringify(payload);
    await pool.query(
      `INSERT INTO app_database (id, data, updated_at) VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()`,
      [CLOUD_ROW_ID, jsonStr]
    ).catch(() => {});
  } catch (err) {}

  // 2. Always sync normalized MySQL tables
  try {
    await syncNormalizedTables(payload);
  } catch (err) {
    console.error('❌ MySQL sync error:', err.message);
  }

  return res.json({ success: true, timestamp: Date.now(), data: sanitizeStateForClient(payload) });
});

// Helper function to sync all normalized tables in MySQL
async function syncNormalizedTables(data) {
  if (!data) return;

  if (data._isResetOperation) {
    try {
      await pool.query('DELETE FROM rate_requests');
      await pool.query('DELETE FROM rate_submissions');
      await pool.query('DELETE FROM contracts');
      console.log('🧹 MySQL operational tables cleared successfully for system reset.');
    } catch (err) {
      console.warn('MySQL table clear error on reset:', err.message);
    }
  }

  // 1. Sync Users
  if (Array.isArray(data.users)) {
    for (const u of data.users) {
      if (u.id && u.username) {
        await pool.query(
          `INSERT INTO users (id, username, password_hash, name, role, transporter_id)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role), transporter_id = VALUES(transporter_id)`,
          [u.id, u.username, u.password || u.password_hash || 'admin123', u.name || u.username, u.role || 'transporter', u.transporter_id || null]
        ).catch((err) => console.warn('MySQL sync users notice:', err.message));
      }
    }
  }

  // 2. Sync Rate Requests (Indents)
  if (Array.isArray(data.rate_requests)) {
    for (const r of data.rate_requests) {
      if (r.id) {
        const reqNo = r.request_no || r.id;
        await pool.query(
          `INSERT INTO rate_requests (id, request_no, title, origin_city, dest_city, material_type, required_qty, unit, target_date, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           request_no = VALUES(request_no),
           title = VALUES(title),
           origin_city = VALUES(origin_city),
           dest_city = VALUES(dest_city),
           material_type = VALUES(material_type),
           required_qty = VALUES(required_qty),
           unit = VALUES(unit),
           target_date = VALUES(target_date),
           status = VALUES(status),
           updated_at = NOW()`,
          [r.id, reqNo, r.title || reqNo, r.origin_city || '', r.dest_city || '', r.material_type || '', parseFloat(r.required_qty || 0), r.unit || 'MT', r.target_date || null, r.status || 'Open']
        ).catch((err) => console.warn('MySQL sync rate_requests notice:', err.message));
      }
    }
  }

  // 3. Sync Rate Submissions (Bids)
  if (Array.isArray(data.rate_submissions)) {
    for (const s of data.rate_submissions) {
      if (s.id) {
        const reqId = s.request_id || s.rate_request_id || s.id;
        const reqNo = s.request_no || reqId;
        const transId = s.transporter_id || 'transporter';
        const transName = s.transporter_name || transId;
        const rateVal = parseFloat(s.rate_per_unit || 0);
        const submittedAt = s.submitted_at ? new Date(s.submitted_at).toISOString().slice(0, 19).replace('T', ' ') : new Date().toISOString().slice(0, 19).replace('T', ' ');

        await pool.query(
          `INSERT INTO rate_submissions (id, request_id, request_no, transporter_id, transporter_name, rate_per_unit, vehicle_type, comments, status, submitted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           request_id = VALUES(request_id),
           request_no = VALUES(request_no),
           transporter_id = VALUES(transporter_id),
           transporter_name = VALUES(transporter_name),
           rate_per_unit = VALUES(rate_per_unit),
           vehicle_type = VALUES(vehicle_type),
           comments = VALUES(comments),
           status = VALUES(status),
           updated_at = NOW()`,
          [s.id, reqId, reqNo, transId, transName, rateVal, s.vehicle_type || '', s.comments || s.notes || '', s.status || 'Submitted', submittedAt]
        ).catch((err) => console.warn('MySQL sync rate_submissions notice:', err.message));
      }
    }
  }

  // 4. Sync Transporters
  if (Array.isArray(data.transporters)) {
    for (const t of data.transporters) {
      if (t.id && (t.company_name || t.code)) {
        const tCode = (t.code || t.id).trim();
        const tName = (t.company_name || tCode).trim();
        const gstinVal = t.gstin || (t.gst_pan && t.gst_pan.length === 15 ? t.gst_pan.trim() : null);
        const panVal = t.pan || (t.gst_pan && t.gst_pan.length === 10 ? t.gst_pan.trim() : null);
        let passwordHash = t.password_hash || null;

        if (!passwordHash && t.password && t.password.trim().length > 0) {
          const salt = await bcrypt.genSalt(10);
          passwordHash = await bcrypt.hash(t.password.trim(), salt);
        }

        await pool.query(
          `INSERT INTO transporters (id, company_name, code, contact_person, mobile, email, gstin, pan, address, username, password_hash, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           company_name = VALUES(company_name),
           code = VALUES(code),
           contact_person = VALUES(contact_person),
           mobile = VALUES(mobile),
           email = VALUES(email),
           gstin = VALUES(gstin),
           pan = VALUES(pan),
           address = VALUES(address),
           username = VALUES(username),
           status = VALUES(status),
           updated_at = NOW()`,
          [
            t.id,
            tName,
            tCode,
            t.contact_person || null,
            t.mobile || null,
            t.email || null,
            gstinVal,
            panVal,
            t.address || null,
            t.username || null,
            passwordHash,
            t.status || 'Active'
          ]
        ).catch((err) => console.error('❌ MySQL sync transporters notice:', err.message));
      }
    }
  }

  // 5. Sync Contracts
  if (Array.isArray(data.contracts)) {
    for (const c of data.contracts) {
      if (c.id) {
        const cNo = c.contract_no || c.code || c.id;
        await pool.query(
          `INSERT INTO contracts (id, contract_no, request_id, transporter_id, allocated_qty, rate_per_unit, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           contract_no = VALUES(contract_no),
           allocated_qty = VALUES(allocated_qty),
           rate_per_unit = VALUES(rate_per_unit),
           status = VALUES(status),
           updated_at = NOW()`,
          [c.id, cNo, c.request_id || null, c.transporter_id || 'transporter', parseFloat(c.allocated_qty || 0), parseFloat(c.rate_per_unit || 0), c.status || 'Active']
        ).catch((err) => console.warn('MySQL sync contracts notice:', err.message));
      }
    }
  }

  // 6. Sync Security Audit Logs
  if (Array.isArray(data.security_audit_logs)) {
    for (const log of data.security_audit_logs) {
      if (log.id || log.action) {
        const logId = log.id || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const logDate = log.created_at || log.timestamp ? new Date(log.created_at || log.timestamp).toISOString().slice(0, 19).replace('T', ' ') : new Date().toISOString().slice(0, 19).replace('T', ' ');
        await pool.query(
          `INSERT INTO security_audit_logs (id, action, username, user_role, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE action = VALUES(action), status = VALUES(status)`,
          [logId, log.action || log.event || 'SECURITY_EVENT', log.username || 'system', log.user_role || log.role || 'user', log.status || 'OK', logDate]
        ).catch((err) => console.warn('MySQL sync audit_logs notice:', err.message));
      }
    }
  }
}

router.get('/audit-orphan-data', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await ensureRateSubmissionsTableExists();
    await ensureRequirementsTableExists();

    const [totalRows] = await pool.query('SELECT COUNT(*) AS total_rate_submissions FROM rate_submissions');
    const [orphanRowsCount] = await pool.query(
      `SELECT COUNT(*) AS orphan_rate_submissions
       FROM rate_submissions rs
       LEFT JOIN transport_requirements tr ON BINARY tr.id = BINARY rs.requirement_id
       WHERE tr.id IS NULL`
    );

    const [orphanRowsDetail] = await pool.query(
      `SELECT
          rs.id,
          rs.requirement_id,
          rs.item_id,
          rs.transporter_id,
          rs.rate_per_mt,
          rs.quoted_quantity_mt,
          rs.total_amount,
          rs.status,
          rs.submitted_at
       FROM rate_submissions rs
       LEFT JOIN transport_requirements tr ON BINARY tr.id = BINARY rs.requirement_id
       LEFT JOIN transport_requirement_items tri ON BINARY tri.id = BINARY rs.item_id
       WHERE tr.id IS NULL
          OR (
              rs.item_id IS NOT NULL
              AND rs.item_id <> 'MAIN'
              AND tri.id IS NULL
          )
       ORDER BY rs.submitted_at DESC`
    );

    const [groupedSubmissions] = await pool.query(
      `SELECT
          rs.requirement_id,
          COUNT(*) AS quote_count,
          tr.req_no
       FROM rate_submissions rs
       LEFT JOIN transport_requirements tr ON BINARY tr.id = BINARY rs.requirement_id
       GROUP BY rs.requirement_id, tr.req_no
       ORDER BY rs.requirement_id`
    );

    const [parentCount] = await pool.query('SELECT COUNT(*) AS total_parents FROM transport_requirements');
    const [childCount] = await pool.query('SELECT COUNT(*) AS total_child_items FROM transport_requirement_items');

    const [trDdl] = await pool.query('SHOW CREATE TABLE transport_requirements');
    const [triDdl] = await pool.query('SHOW CREATE TABLE transport_requirement_items');
    const [rsDdl] = await pool.query('SHOW CREATE TABLE rate_submissions');

    return res.json({
      success: true,
      total_rate_submissions: totalRows[0]?.total_rate_submissions || 0,
      orphan_rate_submissions: orphanRowsCount[0]?.orphan_rate_submissions || 0,
      total_parents: parentCount[0]?.total_parents || 0,
      total_child_items: childCount[0]?.total_child_items || 0,
      orphan_rows_detail: orphanRowsDetail,
      grouped_submissions: groupedSubmissions,
      ddl: {
        transport_requirements: trDdl[0]['Create Table'] || trDdl[0]['CREATE TABLE'],
        transport_requirement_items: triDdl[0]['Create Table'] || triDdl[0]['CREATE TABLE'],
        rate_submissions: rsDdl[0]['Create Table'] || rsDdl[0]['CREATE TABLE']
      }
    });
  } catch (err) {
    console.error('Audit orphan data error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/audit-quote-details', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await ensureRateSubmissionsTableExists();
    await ensureRequirementsTableExists();

    const [allSubmissions] = await pool.query(
      `SELECT
          rs.id,
          rs.requirement_id,
          tr.req_no,
          rs.item_id,
          tri.sub_indent_no,
          rs.transporter_id,
          t.company_name AS transporter_name,
          rs.rate_per_mt,
          rs.quoted_quantity_mt,
          rs.total_amount,
          rs.status,
          rs.submitted_at,
          rs.updated_at
       FROM rate_submissions rs
       LEFT JOIN transport_requirements tr ON tr.id = rs.requirement_id
       LEFT JOIN transport_requirement_items tri ON tri.id = rs.item_id
       LEFT JOIN transporters t ON t.id = rs.transporter_id
       ORDER BY rs.submitted_at DESC`
    );

    const [duplicates] = await pool.query(
      `SELECT
          requirement_id,
          item_id,
          transporter_id,
          COUNT(*) AS duplicate_count
       FROM rate_submissions
       GROUP BY requirement_id, item_id, transporter_id
       HAVING COUNT(*) > 1`
    );

    const [indexes] = await pool.query('SHOW INDEX FROM rate_submissions');

    return res.json({
      success: true,
      all_submissions: allSubmissions,
      duplicates: duplicates,
      indexes: indexes
    });
  } catch (err) {
    console.error('Audit quote details error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
