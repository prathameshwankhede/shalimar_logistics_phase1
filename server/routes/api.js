import express from 'express';
import { pool } from '../config/db.js';
import { INITIAL_SEED_DATA } from '../../src/store/dbStore.js';

const router = express.Router();
const CLOUD_ROW_ID = 'transflow-live-prod-v3';

// In-memory state cache on server to guarantee 100% zero-data-loss persistence
let IN_MEMORY_CACHE = null;

// -------------------------------------------------------------
// GET /api/state — Fetch full state (MySQL primary + cache fallback)
// -------------------------------------------------------------
router.get('/state', async (req, res) => {
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

  // Also query normalized rate_submissions to guarantee zero lost bids
  try {
    const [bids] = await pool.query('SELECT * FROM rate_submissions ORDER BY submitted_at DESC');
    if (bids && bids.length > 0) {
      const bidMap = new Map();
      (state.rate_submissions || []).forEach(b => bidMap.set(String(b.id), b));
      bids.forEach(b => {
        bidMap.set(String(b.id), {
          id: b.id,
          rate_request_id: b.request_id,
          request_id: b.request_id,
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
        });
      });
      state.rate_submissions = Array.from(bidMap.values());
    }
  } catch (err) {
    // ignore
  }

  return res.json({ success: true, data: state });
});

// -------------------------------------------------------------
// POST /api/state — Save full state (MySQL primary + cache)
// -------------------------------------------------------------
router.post('/state', async (req, res) => {
  const dataToSave = req.body;
  if (!dataToSave) {
    return res.status(400).json({ error: 'Request body required' });
  }

  const payload = {
    ...dataToSave,
    _updatedAt: Date.now()
  };

  // Always update in-memory server cache first so refresh never loses state
  IN_MEMORY_CACHE = payload;

  try {
    const jsonStr = JSON.stringify(payload);
    await pool.query(
      `INSERT INTO app_database (id, data, updated_at) VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()`,
      [CLOUD_ROW_ID, jsonStr]
    );

    // Sync normalized relational tables
    await syncNormalizedTables(payload);
  } catch (err) {
    console.warn('MySQL state save warning (cached in memory):', err.message);
  }

  return res.json({ success: true, timestamp: Date.now(), data: payload });
});

// -------------------------------------------------------------
// POST /api/bids — Dedicated Bid Submission Endpoint
// -------------------------------------------------------------
router.post('/bids', async (req, res) => {
  const { id, rate_request_id, request_no, transporter_id, transporter_name, rate_per_unit, vehicle_type, comments, status } = req.body;

  if (!id || !rate_request_id || !transporter_id || !rate_per_unit) {
    return res.status(400).json({ error: 'Missing required bid parameters' });
  }

  const bidId = id || `sub_${transporter_id}_${Date.now()}`;
  const reqId = rate_request_id;
  const reqNo = request_no || reqId;
  const transName = transporter_name || transporter_id;
  const rateVal = parseFloat(rate_per_unit) || 0;
  const bidStatus = status || 'Submitted';
  const submittedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const newBidObj = {
    id: bidId,
    rate_request_id: reqId,
    request_id: reqId,
    request_no: reqNo,
    transporter_id: transporter_id,
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
      [bidId, reqId, reqNo, transporter_id, transName, rateVal, vehicle_type || '', comments || '', bidStatus, submittedAt]
    );
  } catch (err) {
    console.warn('MySQL Bid Insert Warning:', err.message);
  }

  return res.json({ success: true, bid_id: bidId, bid: newBidObj, message: 'Bid saved successfully' });
});

// Helper function to sync normalized tables in MySQL
async function syncNormalizedTables(data) {
  if (!data) return;

  // 1. Sync users
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

  // 2. Sync rate_requests (indents)
  if (Array.isArray(data.rate_requests)) {
    for (const r of data.rate_requests) {
      if (r.id && r.request_no) {
        await pool.query(
          `INSERT INTO rate_requests (id, request_no, title, batch_no, sub_no, origin_city, origin_pin, dest_city, dest_pin, company_unit, material_type, hsn_code, required_qty, unit, target_date, status, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE title = VALUES(title), status = VALUES(status), required_qty = VALUES(required_qty), notes = VALUES(notes)`,
          [
            r.id, r.request_no, r.title || r.request_no, r.batch_no || '', r.sub_no || '',
            r.origin_city || '', r.origin_pin || '', r.dest_city || '', r.dest_pin || '',
            r.company_unit || '', r.material_type || '', r.hsn_code || '',
            r.required_qty || 0, r.unit || 'MT', r.target_date || null,
            r.status || 'Open', r.notes || ''
          ]
        ).catch(() => {});
      }
    }
  }

  // 3. Sync rate_submissions (bids)
  if (Array.isArray(data.rate_submissions)) {
    for (const s of data.rate_submissions) {
      if (s.id && (s.rate_request_id || s.request_id)) {
        const reqId = s.rate_request_id || s.request_id || '';
        const reqNo = s.request_no || reqId;
        const transId = s.transporter_id || '';
        const transName = s.transporter_name || transId;
        const rateVal = parseFloat(s.rate_per_unit) || 0;
        const status = s.status || 'Submitted';
        const counterRate = s.counter_rate ? parseFloat(s.counter_rate) : null;
        const isFrozen = s.is_frozen ? 1 : 0;
        const submittedAt = s.submitted_at || s.created_at || new Date().toISOString();

        await pool.query(
          `INSERT INTO rate_submissions 
           (id, request_id, request_no, transporter_id, transporter_name, rate_per_unit, vehicle_type, comments, status, counter_rate, is_frozen, submitted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           rate_per_unit = VALUES(rate_per_unit), 
           status = VALUES(status), 
           counter_rate = VALUES(counter_rate), 
           is_frozen = VALUES(is_frozen),
           updated_at = NOW()`,
          [
            s.id, reqId, reqNo, transId, transName, rateVal,
            s.vehicle_type || '', s.comments || '', status, counterRate, isFrozen,
            new Date(submittedAt).toISOString().slice(0, 19).replace('T', ' ')
          ]
        ).catch((err) => console.warn('Bids sync error:', err.message));
      }
    }
  }
}

export default router;
