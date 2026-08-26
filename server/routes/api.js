import express from 'express';
import { pool } from '../config/db.js';
import { INITIAL_SEED_DATA } from '../../src/store/dbStore.js';
import { authenticateToken, requirePermission, requireRole } from '../middleware/auth.js';

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
  delete copy.security_audit_logs; // Stripped from generic state
  return copy;
}

// -------------------------------------------------------------
// GET /api/dashboard — Scoped Summary Dashboard Metrics DTO
// -------------------------------------------------------------
router.get('/dashboard', authenticateToken, async (req, res) => {
  const isTransporter = req.user.role === 'transporter';
  const transporterId = req.user.transporter_id;

  try {
    let openIndentsCount = 0;
    let mySubmissionsCount = 0;
    let totalAwardedCount = 0;

    // 1. Count Open Rate Requests
    const [reqRows] = await pool.query("SELECT COUNT(*) AS count FROM rate_requests WHERE status = 'Open'");
    openIndentsCount = reqRows[0]?.count || 0;

    // 2. Count Rate Submissions (Scoped to transporter if role is transporter)
    if (isTransporter && transporterId) {
      const [subRows] = await pool.query("SELECT COUNT(*) AS count FROM rate_submissions WHERE transporter_id = ?", [transporterId]);
      mySubmissionsCount = subRows[0]?.count || 0;
    } else {
      const [subRows] = await pool.query("SELECT COUNT(*) AS count FROM rate_submissions");
      mySubmissionsCount = subRows[0]?.count || 0;
    }

    // 3. Count Awarded Submissions
    if (isTransporter && transporterId) {
      const [awdRows] = await pool.query("SELECT COUNT(*) AS count FROM rate_submissions WHERE transporter_id = ? AND status = 'Accepted'", [transporterId]);
      totalAwardedCount = awdRows[0]?.count || 0;
    } else {
      const [awdRows] = await pool.query("SELECT COUNT(*) AS count FROM rate_submissions WHERE status = 'Accepted'");
      totalAwardedCount = awdRows[0]?.count || 0;
    }

    return res.json({
      success: true,
      dashboard: {
        role: req.user.role,
        open_indents: openIndentsCount,
        submissions_count: mySubmissionsCount,
        awarded_count: totalAwardedCount
      }
    });
  } catch (err) {
    console.warn('Dashboard query fallback:', err.message);
    return res.json({
      success: true,
      dashboard: {
        role: req.user.role,
        open_indents: 0,
        submissions_count: 0,
        awarded_count: 0
      }
    });
  }
});

// -------------------------------------------------------------
// GET /api/rate-requests — Paginated & Scoped Rate Requests DTO
// -------------------------------------------------------------
router.get('/rate-requests', authenticateToken, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const offset = (page - 1) * limit;

  try {
    const [rows] = await pool.query(
      `SELECT id, request_no, title, origin_city, dest_city, company_unit, material_type, required_qty, unit, target_date, status, created_at
       FROM rate_requests
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const requests = rows.map(r => ({
      id: r.id,
      request_no: r.request_no,
      title: r.title || r.request_no,
      origin_city: r.origin_city || '',
      dest_city: r.dest_city || '',
      company_unit: r.company_unit || '',
      material_type: r.material_type || '',
      required_qty: Number(r.required_qty),
      unit: r.unit || 'MT',
      target_date: r.target_date ? String(r.target_date).slice(0, 10) : null,
      status: r.status || 'Open',
      created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    }));

    return res.json({ success: true, page, limit, count: requests.length, rate_requests: requests });
  } catch (err) {
    const state = IN_MEMORY_CACHE || INITIAL_SEED_DATA;
    const requests = (state.rate_requests || []).slice(offset, offset + limit).map(r => ({
      id: r.id,
      request_no: r.request_no,
      title: r.title || r.request_no,
      origin_city: r.origin_city || '',
      dest_city: r.dest_city || '',
      material_type: r.material_type || '',
      required_qty: Number(r.required_qty),
      unit: r.unit || 'MT',
      target_date: r.target_date,
      status: r.status || 'Open'
    }));
    return res.json({ success: true, page, limit, count: requests.length, rate_requests: requests });
  }
});

// -------------------------------------------------------------
// GET /api/rate-submissions — Role-Scoped Rate Submissions (Bids) DTO
// -------------------------------------------------------------
router.get('/rate-submissions', authenticateToken, async (req, res) => {
  const isTransporter = req.user.role === 'transporter';
  const transporterId = req.user.transporter_id;

  try {
    let query = `SELECT id, request_id, request_no, transporter_id, transporter_name, rate_per_unit, vehicle_type, comments, status, counter_rate, is_frozen, submitted_at FROM rate_submissions`;
    const params = [];

    // TENANT ISOLATION: Transporter can ONLY view their own bids
    if (isTransporter) {
      query += ` WHERE transporter_id = ?`;
      params.push(transporterId || req.user.id);
    }
    query += ` ORDER BY submitted_at DESC LIMIT 100`;

    const [rows] = await pool.query(query, params);
    const submissions = rows.map(b => ({
      id: b.id,
      rate_request_id: b.request_id,
      request_no: b.request_no,
      transporter_id: b.transporter_id,
      transporter_name: b.transporter_name,
      rate_per_unit: Number(b.rate_per_unit),
      vehicle_type: b.vehicle_type,
      comments: b.comments,
      status: b.status,
      counter_rate: b.counter_rate ? Number(b.counter_rate) : null,
      is_frozen: Boolean(b.is_frozen),
      submitted_at: b.submitted_at ? new Date(b.submitted_at).toISOString() : new Date().toISOString()
    }));

    return res.json({ success: true, count: submissions.length, rate_submissions: submissions });
  } catch (err) {
    const state = IN_MEMORY_CACHE || INITIAL_SEED_DATA;
    let subs = state.rate_submissions || [];
    if (isTransporter) {
      subs = subs.filter(b => b.transporter_id === (transporterId || req.user.id));
    }
    return res.json({ success: true, count: subs.length, rate_submissions: subs });
  }
});

// -------------------------------------------------------------
// GET /api/transporters — Minimal Transporter List DTO
// -------------------------------------------------------------
router.get('/transporters', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, company_name, code, mobile, email, status FROM transporters LIMIT 100');
    const transporters = rows.map(t => ({
      id: t.id,
      company_name: t.company_name,
      code: t.code,
      mobile: t.mobile,
      email: t.email,
      status: t.status
    }));
    return res.json({ success: true, count: transporters.length, transporters });
  } catch (err) {
    const state = IN_MEMORY_CACHE || INITIAL_SEED_DATA;
    const transporters = (state.transporters || []).map(t => ({
      id: t.id,
      company_name: t.company_name,
      code: t.code,
      status: t.status
    }));
    return res.json({ success: true, count: transporters.length, transporters });
  }
});

// -------------------------------------------------------------
// GET /api/master-data — Lightweight Reference Dropdown Items DTO
// -------------------------------------------------------------
router.get('/master-data', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, category, code, name FROM master_records LIMIT 200');
    const masters = rows.map(m => ({
      id: m.id,
      category: m.category,
      code: m.code,
      name: m.name
    }));
    return res.json({ success: true, count: masters.length, master_records: masters });
  } catch (err) {
    return res.json({ success: true, master_records: [] });
  }
});

// -------------------------------------------------------------
// GET /api/security/audit-logs — Protected Admin Audit Logs DTO
// -------------------------------------------------------------
router.get('/security/audit-logs', authenticateToken, requireRole('admin'), async (req, res) => {
  const state = IN_MEMORY_CACHE || INITIAL_SEED_DATA;
  const logs = (state.security_audit_logs || []).slice(0, 50);
  return res.json({ success: true, count: logs.length, audit_logs: logs });
});

// -------------------------------------------------------------
// POST /api/bids — Dedicated Bid Submission Endpoint (Scoped & Validated)
// -------------------------------------------------------------
router.post('/bids', authenticateToken, async (req, res) => {
  const { id, rate_request_id, request_no, transporter_id, transporter_name, rate_per_unit, vehicle_type, comments, status } = req.body;

  // AUTHORIZATION / BOLA CHECK: Verify transporter_id matches authenticated user
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

  // TENANT ISOLATION FOR STATE ENDPOINT:
  // Transporters receive only open rate requests and their own bids
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
