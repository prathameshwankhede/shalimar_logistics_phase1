import express from 'express';
import { pool } from '../config/db.js';
import { INITIAL_SEED_DATA } from '../../src/store/dbStore.js';

const router = express.Router();
const CLOUD_ROW_ID = 'transflow-live-prod-v3';

// -------------------------------------------------------------
// GET /api/state — Fetch full state (MySQL primary / fallback)
// -------------------------------------------------------------
router.get('/state', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT data FROM app_database WHERE id = ?', [CLOUD_ROW_ID]);
    if (rows && rows.length > 0 && rows[0].data) {
      const parsed = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
      return res.json({ success: true, data: parsed });
    }
  } catch (err) {
    console.warn('MySQL state load warning, returning initial seed fallback:', err.message);
  }

  return res.json({ success: true, data: INITIAL_SEED_DATA });
});

// -------------------------------------------------------------
// POST /api/state — Save full state (MySQL primary)
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

  try {
    const jsonStr = JSON.stringify(payload);
    await pool.query(
      `INSERT INTO app_database (id, data, updated_at) VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()`,
      [CLOUD_ROW_ID, jsonStr]
    );

    // Also populate relational tables asynchronously if present
    syncNormalizedTables(payload).catch(err => console.warn('Normalized sync error:', err.message));

    return res.json({ success: true, timestamp: Date.now(), data: payload });
  } catch (err) {
    console.error('MySQL state save error:', err.message);
    return res.status(500).json({ error: 'Failed to save state to MySQL database' });
  }
});

// Helper function to sync normalized tables in MySQL
async function syncNormalizedTables(data) {
  if (!data) return;

  // Sync users
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

  // Sync rate_requests
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
}

export default router;
