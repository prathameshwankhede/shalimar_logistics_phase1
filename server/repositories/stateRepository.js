// server/repositories/stateRepository.js
import { pool } from '../config/db.js';
import { INITIAL_SEED_DATA } from '../../src/store/dbStore.js';

const CLOUD_ROW_ID = 'transflow-live-prod-v3';

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function handleDbError(err, fallbackData = null) {
  console.error('MySQL Query Exception:', err.message);
  if (isProduction() || process.env.ALLOW_SEED_FALLBACK === 'false') {
    throw err;
  }
  return fallbackData;
}

export async function fetchStateBlob() {
  try {
    const [rows] = await pool.query('SELECT data FROM app_database WHERE id = ?', [CLOUD_ROW_ID]);
    if (rows && rows.length > 0 && rows[0].data) {
      return typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
    }
    return null;
  } catch (err) {
    return handleDbError(err, null);
  }
}

export async function saveStateBlob(payload) {
  try {
    const jsonStr = JSON.stringify(payload);
    await pool.query(
      `INSERT INTO app_database (id, data, updated_at) VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()`,
      [CLOUD_ROW_ID, jsonStr]
    );
  } catch (err) {
    return handleDbError(err, null);
  }
}

export async function countOpenRequests() {
  try {
    const [rows] = await pool.query("SELECT COUNT(*) AS count FROM rate_requests WHERE status = 'Open'");
    return rows[0]?.count || 0;
  } catch (err) {
    const seedReqs = INITIAL_SEED_DATA.rate_requests || [];
    const fallbackCount = seedReqs.filter(r => r.status === 'Open').length;
    return handleDbError(err, fallbackCount);
  }
}

export async function countSubmissions(transporterId = null) {
  try {
    if (transporterId) {
      const [rows] = await pool.query("SELECT COUNT(*) AS count FROM rate_submissions WHERE transporter_id = ?", [transporterId]);
      return rows[0]?.count || 0;
    }
    const [rows] = await pool.query("SELECT COUNT(*) AS count FROM rate_submissions");
    return rows[0]?.count || 0;
  } catch (err) {
    const seedSubs = INITIAL_SEED_DATA.rate_submissions || [];
    const fallbackCount = transporterId ? seedSubs.filter(s => s.transporter_id === transporterId).length : seedSubs.length;
    return handleDbError(err, fallbackCount);
  }
}

export async function fetchPaginatedRequests(limit, offset) {
  try {
    const [rows] = await pool.query(
      `SELECT id, request_no, title, batch_no, sub_no, origin_city, origin_pin, dest_city, dest_pin, company_unit, material_type, hsn_code, required_qty, unit, target_date, status, notes, created_at, updated_at
       FROM rate_requests
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return rows;
  } catch (err) {
    const seedReqs = (INITIAL_SEED_DATA.rate_requests || []).slice(offset, offset + limit);
    return handleDbError(err, seedReqs);
  }
}

export async function fetchSubmissions(transporterId = null) {
  try {
    let transIds = [];
    if (transporterId) {
      try {
        const [tRows] = await pool.query(
          'SELECT id, code, username, company_name FROM transporters WHERE id = ? OR code = ? OR username = ? LIMIT 1',
          [transporterId, transporterId, transporterId]
        );
        if (tRows && tRows.length > 0) {
          const t = tRows[0];
          transIds = [t.id, t.code, t.username, t.company_name, transporterId].filter(Boolean);
        } else {
          transIds = [transporterId];
        }
      } catch (e) {
        transIds = [transporterId];
      }
    }

    let query = `
      SELECT 
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
        s.original_rate AS original_rate_per_mt,
        s.counter_offer_rate,
        s.counter_offer_rate AS counter_rate,
        s.counter_offer_status,
        s.counter_offer_by,
        s.counter_offer_by AS countered_by,
        s.counter_message,
        s.counter_offer_at,
        s.counter_offer_at AS counter_updated_at,
        s.final_rate,
        s.final_rate AS final_rate_per_mt,
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
    `;
    const params = [];
    if (transIds.length > 0) {
      query += ` WHERE (s.transporter_id IN (?) OR t.code IN (?) OR t.username IN (?) OR t.id IN (?) OR t.company_name IN (?))`;
      params.push(transIds, transIds, transIds, transIds, transIds);
    }
    query += ` ORDER BY s.submitted_at DESC LIMIT 500`;
    const [rows] = await pool.query(query, params);
    console.log(`🔍 [FETCH SUBMISSIONS] Filter: ${JSON.stringify(transIds)}, rows count: ${rows.length}`);
    return rows;
  } catch (err) {
    console.warn('fetchSubmissions query notice:', err.message);
    let seedSubs = INITIAL_SEED_DATA.rate_submissions || [];
    if (transporterId) {
      seedSubs = seedSubs.filter(s => s.transporter_id === transporterId);
    }
    return handleDbError(err, seedSubs);
  }
}

export async function fetchTransportersList() {
  try {
    const [rows] = await pool.query('SELECT id, company_name, code, contact_person, mobile, email, gstin, pan, address, username, status, created_at, updated_at FROM transporters ORDER BY created_at DESC LIMIT 100');
    return rows;
  } catch (err) {
    const seedTransporters = INITIAL_SEED_DATA.transporters || [];
    return handleDbError(err, seedTransporters);
  }
}

export async function fetchMasterRecords() {
  try {
    const [rows] = await pool.query('SELECT id, category, code, name FROM master_records LIMIT 200');
    return rows;
  } catch (err) {
    return handleDbError(err, []);
  }
}

export async function fetchAuditLogsRelational() {
  try {
    const [rows] = await pool.query('SELECT id, action, username, user_role, status, created_at FROM security_audit_logs ORDER BY created_at DESC LIMIT 50');
    return rows;
  } catch (err) {
    return handleDbError(err, INITIAL_SEED_DATA.security_audit_logs || []);
  }
}

export async function fetchContractsRelational() {
  try {
    const [rows] = await pool.query('SELECT id, contract_no, request_id, transporter_id, allocated_qty, rate_per_unit, status, created_at FROM contracts ORDER BY created_at DESC LIMIT 100');
    return rows;
  } catch (err) {
    return handleDbError(err, []);
  }
}
