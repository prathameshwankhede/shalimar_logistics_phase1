import express from 'express';
import { pool } from '../config/db.js';
import { INITIAL_SEED_DATA } from '../../src/store/dbStore.js';
import { authenticateToken, requirePermission, requireRole } from '../middleware/auth.js';
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

// -------------------------------------------------------------
// Layered Controller Routes (Targeted Minimal DTO Endpoints)
// -------------------------------------------------------------
router.get('/dashboard', authenticateToken, handleGetDashboard);
router.get('/rate-requests', authenticateToken, handleGetRateRequests);
router.get('/rate-submissions', authenticateToken, handleGetRateSubmissions);
router.get('/transporters', authenticateToken, handleGetTransporters);
router.get('/master-data', authenticateToken, handleGetMasterData);

// -------------------------------------------------------------
// GET /api/security/audit-logs — Protected Admin Audit Logs (Relational MySQL)
// -------------------------------------------------------------
router.get('/security/audit-logs', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, action, username, user_role, status, created_at FROM security_audit_logs ORDER BY created_at DESC LIMIT 50');
    return res.json({ success: true, count: rows.length, audit_logs: rows });
  } catch (err) {
    const state = IN_MEMORY_CACHE || INITIAL_SEED_DATA;
    const logs = (state.security_audit_logs || []).slice(0, 50);
    return res.json({ success: true, count: logs.length, audit_logs: logs });
  }
});

// -------------------------------------------------------------
// POST /api/bids — Dedicated Bid Submission Endpoint (MySQL Relational Persistence)
// -------------------------------------------------------------
router.post('/bids', authenticateToken, async (req, res) => {
  const { id, rate_request_id, request_id, request_no, transporter_id, transporter_name, rate_per_unit, vehicle_type, comments, status } = req.body;

  const authenticatedTransporterId = req.user.transporter_id || req.user.id;
  if (req.user.role === 'transporter' && transporter_id && transporter_id !== authenticatedTransporterId) {
    return res.status(403).json({ success: false, error: 'Access denied. You can only submit bids under your own transporter account.' });
  }

  const effectiveReqId = rate_request_id || request_id;
  if (!effectiveReqId || !rate_per_unit) {
    return res.status(400).json({ success: false, error: 'Missing required bid parameters: rate_request_id and rate_per_unit' });
  }

  const effectiveTransporterId = req.user.role === 'transporter' ? authenticatedTransporterId : (transporter_id || authenticatedTransporterId);
  const bidId = id || `sub_${effectiveTransporterId}_${Date.now()}`;
  const reqNo = request_no || effectiveReqId;
  const transName = transporter_name || req.user.name || effectiveTransporterId;
  const rateVal = parseFloat(rate_per_unit) || 0;
  const bidStatus = status || 'Submitted';
  const submittedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const newBidObj = {
    id: bidId,
    request_id: effectiveReqId,
    rate_request_id: effectiveReqId,
    request_no: reqNo,
    transporter_id: effectiveTransporterId,
    transporter_name: transName,
    rate_per_unit: rateVal,
    vehicle_type: vehicle_type || '',
    comments: comments || '',
    status: bidStatus,
    submitted_at: submittedAt
  };

  try {
    const [result] = await pool.query(
      `INSERT INTO rate_submissions 
       (id, request_id, request_no, transporter_id, transporter_name, rate_per_unit, vehicle_type, comments, status, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
       rate_per_unit = VALUES(rate_per_unit), 
       vehicle_type = VALUES(vehicle_type),
       comments = VALUES(comments),
       status = VALUES(status), 
       updated_at = NOW()`,
      [bidId, effectiveReqId, reqNo, effectiveTransporterId, transName, rateVal, vehicle_type || '', comments || '', bidStatus, submittedAt]
    );

    if (IN_MEMORY_CACHE) {
      const subs = IN_MEMORY_CACHE.rate_submissions || [];
      const idx = subs.findIndex(b => b.id === bidId || (b.request_id === effectiveReqId && b.transporter_id === effectiveTransporterId));
      if (idx >= 0) subs[idx] = newBidObj;
      else subs.unshift(newBidObj);
      IN_MEMORY_CACHE.rate_submissions = subs;
    }

    console.log(`✅ Bid ${bidId} persisted to MySQL rate_submissions (affectedRows: ${result.affectedRows})`);

    return res.json({
      success: true,
      bid_id: bidId,
      affectedRows: result.affectedRows,
      insertId: result.insertId,
      bid: newBidObj,
      message: 'Bid saved and persisted to MySQL rate_submissions successfully'
    });
  } catch (err) {
    console.error('❌ MySQL Bid Insert Error:', err.message);
    return res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to persist bid to MySQL rate_submissions table'
      }
    });
  }
});

// -------------------------------------------------------------
// POST /api/products — Dedicated Product Master Insert Endpoint (Admin Only)
// -------------------------------------------------------------
router.post('/products', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id, name, category, hsn_code, unit } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, error: 'Product name required' });
  }

  const prodId = id || `prod_${Date.now()}`;
  const prodObj = { id: prodId, name: name.trim(), category: category || 'General', hsn_code: hsn_code || '23040010', unit: unit || 'MT' };

  try {
    const jsonExtra = JSON.stringify(prodObj);
    const [result] = await pool.query(
      `INSERT INTO master_records (category, code, name, extra_data)
       VALUES ('product', ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), extra_data = VALUES(extra_data)`,
      [prodId, name.trim(), jsonExtra]
    );

    return res.json({ success: true, affectedRows: result.affectedRows, product: prodObj, message: 'Product Master saved to MySQL' });
  } catch (err) {
    console.error('❌ MySQL Product Insert Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// -------------------------------------------------------------
// POST /api/rate-requests — Dedicated Rate Request Create Endpoint (Admin Only)
// -------------------------------------------------------------
router.post('/rate-requests', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id, request_no, title, origin_city, dest_city, material_type, required_qty, unit, target_date, status } = req.body;
  if (!request_no) {
    return res.status(400).json({ success: false, error: 'request_no required' });
  }

  const reqId = id || `req_${Date.now()}`;
  try {
    const [result] = await pool.query(
      `INSERT INTO rate_requests (id, request_no, title, origin_city, dest_city, material_type, required_qty, unit, target_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), required_qty = VALUES(required_qty), status = VALUES(status), updated_at = NOW()`,
      [reqId, request_no, title || request_no, origin_city || '', dest_city || '', material_type || '', parseFloat(required_qty || 0), unit || 'MT', target_date || null, status || 'Open']
    );

    return res.json({ success: true, affectedRows: result.affectedRows, id: reqId, message: 'Rate request saved to MySQL' });
  } catch (err) {
    console.error('❌ MySQL Rate Request Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// -------------------------------------------------------------
// POST /api/transporters — Dedicated Transporter Create/Update Endpoint (Admin Only)
// -------------------------------------------------------------
router.post('/transporters', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id, company_name, code, mobile, email, status } = req.body;
  if (!company_name || !code) {
    return res.status(400).json({ success: false, error: 'company_name and code required' });
  }

  const transId = id || `trans_${code.toLowerCase()}_${Date.now()}`;
  try {
    const [result] = await pool.query(
      `INSERT INTO transporters (id, company_name, code, mobile, email, status)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), mobile = VALUES(mobile), email = VALUES(email), status = VALUES(status), updated_at = NOW()`,
      [transId, company_name.trim(), code.trim(), mobile || '', email || '', status || 'Active']
    );

    return res.json({ success: true, affectedRows: result.affectedRows, id: transId, message: 'Transporter saved to MySQL' });
  } catch (err) {
    console.error('❌ MySQL Transporter Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
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
// GET /api/state — Backward Compatible State (Authenticated & Role Scoped)
// -------------------------------------------------------------
router.get('/state', authenticateToken, async (req, res) => {
  let state = IN_MEMORY_CACHE || { ...INITIAL_SEED_DATA };

  try {
    const [rows] = await pool.query('SELECT data FROM app_database WHERE id = ?', [CLOUD_ROW_ID]);
    if (rows && rows.length > 0 && rows[0].data) {
      const parsed = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
      if (parsed && typeof parsed === 'object') {
        state = parsed;
        IN_MEMORY_CACHE = state;
      }
    }
  } catch (err) {
    console.warn('MySQL state load warning:', err.message);
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

  try {
    const jsonStr = JSON.stringify(payload);
    await pool.query(
      `INSERT INTO app_database (id, data, updated_at) VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()`,
      [CLOUD_ROW_ID, jsonStr]
    );

    await syncNormalizedTables(payload);
  } catch (err) {
    console.warn('MySQL state save warning (cached in memory):', err.message);
  }

  return res.json({ success: true, timestamp: Date.now(), data: sanitizeStateForClient(payload) });
});

// Helper function to sync normalized tables in MySQL
async function syncNormalizedTables(data) {
  if (!data) return;

  if (data._isResetOperation) {
    try {
      await pool.query('DELETE FROM rate_requests');
      await pool.query('DELETE FROM rate_submissions');
      console.log('🧹 MySQL operational tables cleared successfully for system reset.');
    } catch (err) {
      console.warn('MySQL table clear error on reset:', err.message);
    }
  }

  if (Array.isArray(data.users)) {
    for (const u of data.users) {
      if (u.id && u.username) {
        await pool.query(
          `INSERT INTO users (id, username, password_hash, name, role, transporter_id)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role), transporter_id = VALUES(transporter_id)`,
          [u.id, u.username, u.password || u.password_hash || 'admin123', u.name || u.username, u.role || 'transporter', u.transporter_id || null]
        ).catch(() => {});
      }
    }
  }
}

export default router;
