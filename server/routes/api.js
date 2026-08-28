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
// POST /api/products & GET /api/products — Dedicated Products API
// -------------------------------------------------------------
router.get('/products', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, code, name, category, hsn_code, default_unit, status, created_at, updated_at FROM products ORDER BY name ASC LIMIT 200');
    return res.json({ success: true, count: rows.length, products: rows });
  } catch (err) {
    return res.status(503).json({ success: false, error: { code: 'DATABASE_UNAVAILABLE', message: err.message } });
  }
});

router.post('/products', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id, code, name, category, hsn_code, default_unit, status } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, error: 'Product name required' });
  }

  const prodId = id || `prod_${Date.now()}`;
  const prodCode = code || prodId;
  try {
    const [result] = await pool.query(
      `INSERT INTO products (id, code, name, category, hsn_code, default_unit, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), category = VALUES(category), hsn_code = VALUES(hsn_code), default_unit = VALUES(default_unit), status = VALUES(status), updated_at = NOW()`,
      [prodId, prodCode, name.trim(), category || 'General', hsn_code || '23040010', default_unit || 'MT', status || 'Active']
    );

    return res.json({ success: true, affectedRows: result.affectedRows, id: prodId, message: 'Product saved to MySQL products table' });
  } catch (err) {
    console.error('❌ MySQL Product Error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: err.message } });
  }
});

// -------------------------------------------------------------
// POST /api/company-units & GET /api/company-units — Dedicated Company Units API
// -------------------------------------------------------------
router.get('/company-units', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, code, name, contact_name, gstin, pan, mobile, email, city, district, pin, address, status, created_at, updated_at FROM company_units ORDER BY name ASC LIMIT 200');
    return res.json({ success: true, count: rows.length, company_units: rows });
  } catch (err) {
    return res.status(503).json({ success: false, error: { code: 'DATABASE_UNAVAILABLE', message: err.message } });
  }
});

router.post('/company-units', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id, code, name, contact_name, gstin, pan, mobile, email, city, district, pin, address, status } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, error: 'Company unit name required' });
  }

  const unitId = id || `unit_${Date.now()}`;
  const unitCode = code || unitId;
  try {
    const [result] = await pool.query(
      `INSERT INTO company_units (id, code, name, contact_name, gstin, pan, mobile, email, city, district, pin, address, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), contact_name = VALUES(contact_name), mobile = VALUES(mobile), email = VALUES(email), address = VALUES(address), status = VALUES(status), updated_at = NOW()`,
      [unitId, unitCode, name.trim(), contact_name || '', gstin || '', pan || '', mobile || '', email || '', city || '', district || '', pin || '', address || '', status || 'Active']
    );

    return res.json({ success: true, affectedRows: result.affectedRows, id: unitId, message: 'Company Unit saved to MySQL company_units table' });
  } catch (err) {
    console.error('❌ MySQL Company Unit Error:', err.message);
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

// -------------------------------------------------------------
// POST /api/rate-requests — Dedicated Rate Request Create Endpoint (Admin Only)
// -------------------------------------------------------------
router.post('/rate-requests', authenticateToken, requireRole('admin'), async (req, res) => {
  const {
    id,
    request_no,
    title,
    batch_no,
    sub_no,
    origin_city,
    origin_pin,
    dest_city,
    dest_pin,
    company_unit,
    material_type,
    hsn_code,
    required_qty,
    unit,
    target_date,
    status,
    notes
  } = req.body;

  const reqNo = request_no || id;
  if (!reqNo) {
    return res.status(400).json({ success: false, error: 'request_no required' });
  }

  const reqId = id || `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  try {
    const [result] = await pool.query(
      `INSERT INTO rate_requests 
       (id, request_no, title, batch_no, sub_no, origin_city, origin_pin, dest_city, dest_pin, company_unit, material_type, hsn_code, required_qty, unit, target_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
       title = VALUES(title), 
       batch_no = VALUES(batch_no),
       sub_no = VALUES(sub_no),
       origin_city = VALUES(origin_city),
       origin_pin = VALUES(origin_pin),
       dest_city = VALUES(dest_city),
       dest_pin = VALUES(dest_pin),
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
        reqId,
        reqNo,
        title || reqNo,
        batch_no || '',
        sub_no || '1',
        origin_city || '',
        origin_pin || '440028',
        dest_city || '',
        dest_pin || '413001',
        company_unit || 'Shalimar Nutrients Pvt Ltd',
        material_type || '',
        hsn_code || '15071000',
        parseFloat(required_qty || 0),
        unit || 'MT',
        target_date || null,
        status || 'Open',
        notes || ''
      ]
    );

    console.log(`✅ Rate Request ${reqNo} (${reqId}) persisted to MySQL rate_requests (affectedRows: ${result.affectedRows})`);

    return res.json({
      success: true,
      affectedRows: result.affectedRows,
      insertId: result.insertId,
      id: reqId,
      request_no: reqNo,
      message: 'Rate request saved to MySQL rate_requests table'
    });
  } catch (err) {
    console.error('❌ MySQL Rate Request Error:', err.message);
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
