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

// -------------------------------------------------------------
// Dedicated Transport Requirements & Rate Requests CRUD API
// Parent: transport_requirements | Child: transport_requirement_items
// -------------------------------------------------------------
async function ensureRequirementsTableExists() {
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS transport_requirement_items (
        id VARCHAR(100) NOT NULL PRIMARY KEY,
        requirement_id VARCHAR(100) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        quantity_mt DECIMAL(12,3) NOT NULL,
        unit VARCHAR(50) DEFAULT 'MT',
        pickup_origin VARCHAR(255),
        drop_location VARCHAR(255),
        hsn_code VARCHAR(50),
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_req_id (requirement_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
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

function formatParentRequirementDto(parentRow, childItems = [], bidsCount = 0) {
  if (!parentRow) return null;
  const itemsFormatted = childItems.map((item, idx) => ({
    id: item.id || `item_${idx}`,
    requirement_id: parentRow.id,
    product_name: item.product_name || item.material_type || '',
    material_type: item.product_name || item.material_type || '',
    quantity_mt: Number(item.quantity_mt || item.required_qty || 0),
    required_qty: Number(item.quantity_mt || item.required_qty || 0),
    unit: item.unit || 'MT',
    pickup_origin: item.pickup_origin || parentRow.pickup_origin || '',
    drop_location: item.drop_location || parentRow.drop_location || '',
    hsn_code: item.hsn_code || ''
  }));

  const totalQty = itemsFormatted.reduce((acc, curr) => acc + curr.quantity_mt, 0);

  const firstItem = itemsFormatted[0] || {};
  const pickup = parentRow.pickup_origin || firstItem.pickup_origin || '';
  const drop = parentRow.drop_location || firstItem.drop_location || '';
  const reqNo = parentRow.req_no || parentRow.id || '';
  const targetDateStr = parentRow.target_date ? (parentRow.target_date instanceof Date ? parentRow.target_date.toISOString().split('T')[0] : String(parentRow.target_date).split('T')[0]) : new Date().toISOString().split('T')[0];

  return {
    id: parentRow.id,
    req_no: reqNo,
    request_no: reqNo,
    batch_no: reqNo,
    title: parentRow.title || `${pickup} ➔ ${drop}`,
    pickup_origin: pickup,
    origin_city: pickup,
    drop_location: drop,
    dest_city: drop,
    target_date: targetDateStr,
    status: parentRow.status || 'Active',
    submitted_bids_count: bidsCount || Number(parentRow.submitted_bids_count || 0),
    approval_status: parentRow.approval_status || 'Pending',
    created_by: parentRow.created_by || 'admin',
    created_at: parentRow.created_at || new Date().toISOString(),
    updated_at: parentRow.updated_at || new Date().toISOString(),
    items: itemsFormatted,
    total_quantity_mt: totalQty,
    quantity_mt: totalQty,
    required_qty: totalQty,
    product_name: itemsFormatted.map(i => i.product_name).join(', '),
    material_type: itemsFormatted.map(i => i.product_name).join(', ')
  };
}

async function handleGetRequirements(req, res) {
  try {
    await ensureRequirementsTableExists();
    let bidsCountMap = {};
    try {
      const [bidRows] = await pool.query(
        'SELECT rate_request_id, COUNT(*) as cnt FROM rate_submissions GROUP BY rate_request_id'
      );
      (bidRows || []).forEach((b) => {
        if (b.rate_request_id) bidsCountMap[b.rate_request_id] = Number(b.cnt || 0);
      });
    } catch (e) {}

    const [parents] = await pool.query('SELECT * FROM transport_requirements ORDER BY created_at DESC LIMIT 300');
    if (parents.length === 0) {
      return res.json({ success: true, count: 0, data: [], requirements: [], rate_requests: [] });
    }

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

    const formatted = parents.map((p) => formatParentRequirementDto(p, itemsMap[p.id] || [], bidsCountMap[p.id] || 0));
    return res.json({ success: true, count: formatted.length, data: formatted, requirements: formatted, rate_requests: formatted });
  } catch (err) {
    console.error('❌ GET /api/requirements Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
}

// -------------------------------------------------------------
// Layered Controller Routes (Targeted Minimal DTO Endpoints)
// -------------------------------------------------------------
router.get('/dashboard', authenticateToken, handleGetDashboard);
router.get('/requirements', authenticateToken, handleGetRequirements);
router.get('/rate-requests', authenticateToken, handleGetRequirements);
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
      "code VARCHAR(100)",
      "category VARCHAR(255)",
      "hsn_code VARCHAR(50)",
      "default_unit VARCHAR(50) DEFAULT 'MT'",
      "status VARCHAR(50) DEFAULT 'Active'"
    ];
    for (const colDef of cols) {
      await pool.query(`ALTER TABLE products ADD COLUMN ${colDef}`).catch(() => {});
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
  return {
    id: row.id,
    company_name: row.company_name || row.name || '',
    name: row.company_name || row.name || '',
    registered_address: row.registered_address || row.address || '',
    address: row.registered_address || row.address || '',
    gstin: row.gstin || '',
    pan: row.pan || row.pan_no || '',
    pan_no: row.pan || row.pan_no || '',
    contact_name: row.contact_name || row.proprietor_name || '',
    proprietor_name: row.contact_name || row.proprietor_name || '',
    email: row.email || '',
    mobile: row.mobile || row.mobile_no || '',
    mobile_no: row.mobile || row.mobile_no || '',
    state: row.state || 'Maharashtra',
    city: row.city || '',
    district: row.district || '',
    pin_code: row.pin_code || row.pincode || row.pin || '',
    pincode: row.pin_code || row.pincode || row.pin || '',
    pickup_origin: row.pickup_origin || row.pickup_location_name || '',
    pickup_location_name: row.pickup_origin || row.pickup_location_name || '',
    drop_location: row.drop_location || row.drop_location_name || '',
    drop_location_name: row.drop_location || row.drop_location_name || '',
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

    const compName = (company_name || name || '').trim();
    if (!compName) {
      return res.status(400).json({ success: false, error: 'Company / Plant Name is required.' });
    }

    const regAddress = (registered_address || address || '').trim();
    const contactName = (contact_name || proprietor_name || '').trim();
    const mob = (mobile || mobile_no || '').trim();
    const st = (state || 'Maharashtra').trim();
    const ct = (city || '').trim();
    const dist = (district || '').trim();
    const pin = (pin_code || pincode || '').trim();

    if (!regAddress || !contactName || !mob || !st || !ct || !dist || !pin) {
      return res.status(400).json({
        success: false,
        error: 'Company Name, Registered Address, Contact Name, Mobile, State, City, District, and PIN Code are required.'
      });
    }

    if (email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success: false, error: 'Invalid email address format.' });
    }

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

    const compName = (company_name || name || '').trim();
    if (!compName) {
      return res.status(400).json({ success: false, error: 'Company / Plant Name is required.' });
    }

    const regAddress = (registered_address || address || '').trim();
    const contactName = (contact_name || proprietor_name || '').trim();
    const mob = (mobile || mobile_no || '').trim();
    const st = (state || 'Maharashtra').trim();
    const ct = (city || '').trim();
    const dist = (district || '').trim();
    const pin = (pin_code || pincode || '').trim();

    if (!regAddress || !contactName || !mob || !st || !ct || !dist || !pin) {
      return res.status(400).json({
        success: false,
        error: 'Company Name, Registered Address, Contact Name, Mobile, State, City, District, and PIN Code are required.'
      });
    }

    if (email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success: false, error: 'Invalid email address format.' });
    }

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
  try {
    const [parents] = await pool.query('SELECT * FROM transport_requirements WHERE id = ?', [id]);
    if (parents.length === 0) {
      return res.status(404).json({ success: false, error: 'Requirement not found' });
    }
    const [childRows] = await pool.query('SELECT * FROM transport_requirement_items WHERE requirement_id = ? ORDER BY id ASC', [id]);
    const dto = formatParentRequirementDto(parents[0], childRows, parents[0]?.submitted_bids_count || 0);
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

    // 3. Insert THREE (or N) child requirement items
    for (let idx = 0; idx < validChildItems.length; idx++) {
      const child = validChildItems[idx];
      const itemId = `req_item_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`;
      await conn.query(
        `INSERT INTO transport_requirement_items
         (id, requirement_id, product_name, quantity_mt, unit, pickup_origin, drop_location, hsn_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [itemId, parentId, child.product_name, child.quantity_mt, child.unit, child.pickup_origin, child.drop_location, child.hsn_code]
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

// DELETE /api/requirements/:id — Delete Parent Requirement and All Child Cargo Items
router.delete('/requirements/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  await ensureRequirementsTableExists();
  try {
    let hasBids = false;
    try {
      const [bidRows] = await pool.query(
        'SELECT id FROM rate_submissions WHERE rate_request_id = ? OR requirement_id = ? LIMIT 1',
        [id, id]
      );
      if (bidRows && bidRows.length > 0) hasBids = true;
    } catch (e) {}

    if (hasBids) {
      return res.status(409).json({
        success: false,
        error: 'Cannot delete requirement: Active bids or awarded contracts are attached to this requirement'
      });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM transport_requirement_items WHERE requirement_id = ?', [id]);
      const [result] = await conn.query('DELETE FROM transport_requirements WHERE id = ?', [id]);
      await conn.commit();
      conn.release();

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Requirement record not found' });
      }

      return res.json({ success: true, message: 'Requirement and all child items deleted from MySQL' });
    } catch (e) {
      await conn.rollback();
      conn.release();
    }
  } catch (err) {
    console.error('❌ DELETE /api/requirements/:id Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
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
    const [tablesRows] = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'"
    );

    const tableNames = tablesRows.map(r => r.table_name || r.TABLE_NAME);

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
      'truck_dispatches'
    ];

    tableNames.forEach(t => {
      if (!parentFirstOrder.includes(t)) {
        parentFirstOrder.push(t);
      }
    });

    const dumpLines = [];
    dumpLines.push(`-- ==================================================`);
    dumpLines.push(`-- SHALIMAR LOGISTICS / TRANSFLOW PHASE 1`);
    dumpLines.push(`-- Hostinger Native MySQL Full Database Snapshot (.sql)`);
    dumpLines.push(`-- Database: u704836459_shalimar_logi`);
    dumpLines.push(`-- Export Date: ${new Date().toISOString()}`);
    dumpLines.push(`-- ==================================================`);
    dumpLines.push(``);
    dumpLines.push(`SET FOREIGN_KEY_CHECKS = 0;`);
    dumpLines.push(``);

    for (const tbl of parentFirstOrder) {
      if (!tableNames.includes(tbl)) continue;

      try {
        const [createRows] = await pool.query(`SHOW CREATE TABLE \`${tbl}\``);
        const rawCreateSql = createRows[0]['Create Table'] || createRows[0]['CREATE TABLE'];
        if (rawCreateSql) {
          const createSql = rawCreateSql.replace(/^CREATE TABLE\s*/i, 'CREATE TABLE IF NOT EXISTS ');
          dumpLines.push(`-- Table structure for \`${tbl}\``);
          dumpLines.push(`${createSql};`);
          dumpLines.push(``);
        }
      } catch (ddlErr) {
        console.warn(`DDL warning for ${tbl}:`, ddlErr.message);
      }

      const [rows] = await pool.query(`SELECT * FROM \`${tbl}\``);
      if (rows && rows.length > 0) {
        dumpLines.push(`-- Data inserts for \`${tbl}\``);
        for (const rowObj of rows) {
          const keys = Object.keys(rowObj);
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
        }
        dumpLines.push(``);
      }
    }

    dumpLines.push(`SET FOREIGN_KEY_CHECKS = 1;`);
    dumpLines.push(`-- Snapshot Dump Complete`);

    const sqlContent = dumpLines.join('\n');
    const filename = `shalimar_mysql_backup_${new Date().toISOString().slice(0, 10)}.sql`;

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
        if (/^CREATE TABLE\s+/i.test(finalStmt) && !/CREATE TABLE IF NOT EXISTS/i.test(finalStmt)) {
          finalStmt = finalStmt.replace(/^CREATE TABLE\s+/i, 'CREATE TABLE IF NOT EXISTS ');
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
// GET /api/backup/report — Export Operational Report Data (Admin Only)
// -------------------------------------------------------------
router.get('/backup/report', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const [transporters] = await pool.query('SELECT id, company_name, code, contact_person, mobile, email, status FROM transporters').catch(() => [[]]);
    const [companyUnits] = await pool.query('SELECT id, company_name, name, city, state, pickup_origin, drop_location FROM company_units_plants').catch(() => [[]]);
    const [products] = await pool.query('SELECT id, name, category, hsn_code, default_unit FROM products').catch(() => [[]]);
    const [reqs] = await pool.query('SELECT id, req_no, batch_code, title, pickup_origin, drop_location, target_date, total_tonnage, status, created_at FROM transport_requirements').catch(() => [[]]);
    const [items] = await pool.query('SELECT id, requirement_id, product_name, total_quantity, unit FROM transport_requirement_items').catch(() => [[]]);

    return res.json({
      success: true,
      report_generated_at: new Date().toISOString(),
      summary: {
        total_transporters: transporters.length,
        total_company_units: companyUnits.length,
        total_products: products.length,
        total_transport_requirements: reqs.length,
        total_requirement_items: items.length
      },
      data: {
        transporters,
        company_units_plants: companyUnits,
        products,
        transport_requirements: reqs,
        transport_requirement_items: items
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

  // Merge normalized transporters table from MySQL database
  try {
    const dbTransporters = await fetchTransportersList();
    state = {
      ...state,
      transporters: Array.isArray(dbTransporters) ? dbTransporters : []
    };
  } catch (err) {
    console.warn('MySQL transporters load notice:', err.message);
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

export default router;
