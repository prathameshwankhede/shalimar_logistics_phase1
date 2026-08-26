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
// POST /api/bids — Dedicated Bid Submission Endpoint (Scoped & Validated)
// -------------------------------------------------------------
router.post('/bids', authenticateToken, async (req, res) => {
  const { id, rate_request_id, request_no, transporter_id, transporter_name, rate_per_unit, vehicle_type, comments, status } = req.body;

  const authenticatedTransporterId = req.user.transporter_id || req.user.id;
  if (req.user.role === 'transporter' && transporter_id && transporter_id !== authenticatedTransporterId) {
    return res.status(403).json({ error: 'Access denied. You can only submit bids under your own transporter account.' });
  }

  if (!rate_request_id || !rate_per_unit) {
    return res.status(400).json({ error: 'Missing required bid parameters: rate_request_id and rate_per_unit' });
  }

  const effectiveTransporterId = req.user.role === 'transporter' ? authenticatedTransporterId : (transporter_id || authenticatedTransporterId);
  const bidId = id || `sub_${effectiveTransporterId}_${Date.now()}`;
  const reqId = rate_request_id;
  const reqNo = request_no || reqId;
  const transName = transporter_name || req.user.name || effectiveTransporterId;
  const rateVal = parseFloat(rate_per_unit) || 0;
  const bidStatus = status || 'Submitted';
  const submittedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const newBidObj = {
    id: bidId,
    rate_request_id: reqId,
    request_id: reqId,
    request_no: reqNo,
    transporter_id: effectiveTransporterId,
    transporter_name: transName,
    rate_per_unit: rateVal,
    vehicle_type: vehicle_type || '',
    comments: comments || '',
    status: bidStatus,
    submitted_at: new Date().toISOString()
  };

  if (IN_MEMORY_CACHE) {
    const subs = IN_MEMORY_CACHE.rate_submissions || [];
    const idx = subs.findIndex(b => b.id === bidId);
    if (idx >= 0) subs[idx] = newBidObj;
    else subs.unshift(newBidObj);
    IN_MEMORY_CACHE.rate_submissions = subs;
  }

  try {
    await pool.query(
      `INSERT INTO rate_submissions 
       (id, request_id, request_no, transporter_id, transporter_name, rate_per_unit, vehicle_type, comments, status, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
       rate_per_unit = VALUES(rate_per_unit), 
       status = VALUES(status), 
       updated_at = NOW()`,
      [bidId, reqId, reqNo, effectiveTransporterId, transName, rateVal, vehicle_type || '', comments || '', bidStatus, submittedAt]
    );
  } catch (err) {
    console.warn('MySQL Bid Insert Warning:', err.message);
  }

  return res.json({ success: true, bid_id: bidId, bid: newBidObj, message: 'Bid saved successfully' });
});

// -------------------------------------------------------------
// POST /api/products — Dedicated Product Master Insert Endpoint (Admin Only)
// -------------------------------------------------------------
router.post('/products', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id, name, category, hsn_code, unit } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Product name required' });
  }

  const prodId = id || `prod_${Date.now()}`;
  const prodObj = { id: prodId, name: name.trim(), category: category || 'General', hsn_code: hsn_code || '23040010', unit: unit || 'MT' };

  if (IN_MEMORY_CACHE) {
    const prods = IN_MEMORY_CACHE.product_masters || [];
    const idx = prods.findIndex(p => p.id === prodId || p.name === name);
    if (idx >= 0) prods[idx] = prodObj;
    else prods.unshift(prodObj);
    IN_MEMORY_CACHE.product_masters = prods;
  }

  try {
    const jsonExtra = JSON.stringify(prodObj);
    await pool.query(
      `INSERT INTO master_records (category, code, name, extra_data)
       VALUES ('product', ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), extra_data = VALUES(extra_data)`,
      [prodId, name.trim(), jsonExtra]
    );
  } catch (err) {
    console.warn('MySQL Product Insert Warning:', err.message);
  }

  return res.json({ success: true, product: prodObj, message: 'Product Master saved to MySQL' });
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
