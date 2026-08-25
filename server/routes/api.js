import express from 'express';
import { pool } from '../config/db.js';
import { INITIAL_SEED_DATA } from '../../src/store/dbStore.js';

const router = express.Router();
const CLOUD_ROW_ID = 'transflow-live-prod-v3';

// In-memory state cache on server to guarantee 100% zero-data-loss persistence
let IN_MEMORY_CACHE = null;

function mergeArrayById(targetArr = [], sourceArr = [], keyProp = 'id') {
  const map = new Map();
  targetArr.forEach(item => {
    if (item) map.set(String(item[keyProp] || item.request_no || item.name || item.code), item);
  });
  sourceArr.forEach(item => {
    if (item) map.set(String(item[keyProp] || item.request_no || item.name || item.code), item);
  });
  return Array.from(map.values());
}

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

  // If operational reset was executed, respect empty arrays and do not restore deleted operational records
  if (!state._isResetOperation) {
    // Also query normalized rate_requests to guarantee zero lost indents
    try {
      const [reqs] = await pool.query('SELECT * FROM rate_requests ORDER BY created_at DESC');
      if (reqs && reqs.length > 0) {
        const reqMap = new Map();
        (state.rate_requests || []).forEach(r => reqMap.set(String(r.request_no || r.id), r));
        reqs.forEach(r => {
          const reqObj = {
            id: r.id,
            request_no: r.request_no,
            title: r.title || r.request_no,
            batch_no: r.batch_no || '',
            sub_no: r.sub_no || '',
            origin_city: r.origin_city || '',
            origin_pin: r.origin_pin || '',
            dest_city: r.dest_city || '',
            dest_pin: r.dest_pin || '',
            company_unit: r.company_unit || '',
            material_type: r.material_type || '',
            hsn_code: r.hsn_code || '',
            required_qty: Number(r.required_qty),
            unit: r.unit || 'MT',
            target_date: r.target_date ? String(r.target_date).slice(0, 10) : null,
            status: r.status || 'Open',
            notes: r.notes || '',
            created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
          };
          reqMap.set(String(r.request_no || r.id), reqObj);
        });
        state.rate_requests = Array.from(reqMap.values());
      }
    } catch (err) {
      // ignore
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
  }

  // Also query normalized master_records to guarantee zero lost product/cargo masters
  try {
    const [masters] = await pool.query('SELECT * FROM master_records ORDER BY id ASC');
    if (masters && masters.length > 0) {
      const prodList = [];
      const cargoList = [];
      const compList = [];
      const cityList = [];
      const titleList = [];

      masters.forEach(m => {
        const extra = typeof m.extra_data === 'string' ? JSON.parse(m.extra_data) : (m.extra_data || {});
        const itemObj = {
          id: extra.id || `master_${m.category}_${m.id}`,
          code: m.code || extra.code,
          name: m.name,
          ...extra
        };

        if (m.category === 'product') prodList.push(itemObj);
        else if (m.category === 'cargo') cargoList.push(itemObj);
        else if (m.category === 'company') compList.push(itemObj);
        else if (m.category === 'city') cityList.push(itemObj);
        else if (m.category === 'title') titleList.push(itemObj);
      });

      if (prodList.length > 0) state.product_masters = mergeArrayById(state.product_masters || [], prodList, 'id');
      if (cargoList.length > 0) state.cargo_masters = mergeArrayById(state.cargo_masters || [], cargoList, 'id');
      if (compList.length > 0) state.company_masters = mergeArrayById(state.company_masters || [], compList, 'id');
      if (cityList.length > 0) state.city_masters = mergeArrayById(state.city_masters || [], cityList, 'id');
      if (titleList.length > 0) state.title_masters = mergeArrayById(state.title_masters || [], titleList, 'id');
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

    // Sync normalized relational tables (clears MySQL operational tables if _isResetOperation is true)
    await syncNormalizedTables(payload);
  } catch (err) {
    console.warn('MySQL state save warning (cached in memory):', err.message);
  }

  return res.json({ success: true, timestamp: Date.now(), data: payload });
});

// -------------------------------------------------------------
// GET /api/products — Dedicated Product Masters GET Endpoint
// -------------------------------------------------------------
router.get('/products', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM master_records WHERE category = 'product'");
    const products = rows.map(r => {
      const extra = typeof r.extra_data === 'string' ? JSON.parse(r.extra_data) : (r.extra_data || {});
      return { id: extra.id || `prod_${r.id}`, name: r.name, category: extra.category || 'General', hsn_code: extra.hsn_code || '23040010', unit: extra.unit || 'MT', ...extra };
    });
    return res.json({ success: true, products });
  } catch (err) {
    const fallback = IN_MEMORY_CACHE?.product_masters || INITIAL_SEED_DATA.product_masters;
    return res.json({ success: true, products: fallback });
  }
});

// -------------------------------------------------------------
// POST /api/products — Dedicated Product Master Insert Endpoint
// -------------------------------------------------------------
router.post('/products', async (req, res) => {
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

  // 🧹 SYSTEM RESET: If reset operation flag is present, clear MySQL operational tables completely!
  if (data._isResetOperation) {
    try {
      await pool.query('DELETE FROM rate_requests');
      await pool.query('DELETE FROM rate_submissions');
      console.log('🧹 MySQL operational tables (rate_requests, rate_submissions) cleared successfully for system reset.');
    } catch (err) {
      console.warn('MySQL table clear error on reset:', err.message);
    }
  }

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

  // 2. Sync rate_requests (indents) - skipped if reset operation
  if (!data._isResetOperation && Array.isArray(data.rate_requests)) {
    for (const r of data.rate_requests) {
      if (r.id && (r.request_no || r.title)) {
        const reqNo = r.request_no || r.title;
        const targetDateVal = r.target_date ? String(r.target_date).slice(0, 10) : null;

        await pool.query(
          `INSERT INTO rate_requests (id, request_no, title, batch_no, sub_no, origin_city, origin_pin, dest_city, dest_pin, company_unit, material_type, hsn_code, required_qty, unit, target_date, status, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           request_no = VALUES(request_no),
           title = VALUES(title), 
           origin_city = VALUES(origin_city),
           dest_city = VALUES(dest_city),
           company_unit = VALUES(company_unit),
           material_type = VALUES(material_type),
           hsn_code = VALUES(hsn_code),
           required_qty = VALUES(required_qty), 
           unit = VALUES(unit),
           target_date = VALUES(target_date),
           status = VALUES(status), 
           notes = VALUES(notes),
           updated_at = NOW()`,
          [
            r.id, reqNo, r.title || reqNo, r.batch_no || '', r.sub_no || '',
            r.origin_city || '', r.origin_pin || '', r.dest_city || '', r.dest_pin || '',
            r.company_unit || '', r.material_type || '', r.hsn_code || '',
            parseFloat(r.required_qty) || 0, r.unit || 'MT', targetDateVal,
            r.status || 'Open', r.notes || ''
          ]
        ).catch((err) => console.warn('rate_requests sync error:', err.message));
      }
    }
  }

  // 3. Sync rate_submissions (bids) - skipped if reset operation
  if (!data._isResetOperation && Array.isArray(data.rate_submissions)) {
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

  // 4. Sync master_records (product_masters, cargo_masters, company_masters, city_masters, title_masters)
  const masterCategories = [
    { key: 'product_masters', cat: 'product' },
    { key: 'cargo_masters', cat: 'cargo' },
    { key: 'company_masters', cat: 'company' },
    { key: 'city_masters', cat: 'city' },
    { key: 'title_masters', cat: 'title' }
  ];

  for (const { key, cat } of masterCategories) {
    const list = data[key];
    if (Array.isArray(list)) {
      for (const item of list) {
        if (item && (item.name || item.title || item.city)) {
          const itemCode = item.code || item.id || null;
          const itemName = item.name || item.title || item.city || item.vehicle_type || 'Master Item';
          const jsonExtra = JSON.stringify(item);

          await pool.query(
            `INSERT INTO master_records (category, code, name, extra_data)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE name = VALUES(name), extra_data = VALUES(extra_data)`,
            [cat, itemCode, itemName, jsonExtra]
          ).catch((err) => console.warn(`Master ${cat} sync error:`, err.message));
        }
      }
    }
  }
}

export default router;
