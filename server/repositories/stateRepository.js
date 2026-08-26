// server/repositories/stateRepository.js
import { pool } from '../config/db.js';

const CLOUD_ROW_ID = 'transflow-live-prod-v3';

export async function fetchStateBlob() {
  const [rows] = await pool.query('SELECT data FROM app_database WHERE id = ?', [CLOUD_ROW_ID]);
  if (rows && rows.length > 0 && rows[0].data) {
    return typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
  }
  return null;
}

export async function saveStateBlob(payload) {
  const jsonStr = JSON.stringify(payload);
  await pool.query(
    `INSERT INTO app_database (id, data, updated_at) VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()`,
    [CLOUD_ROW_ID, jsonStr]
  );
}

export async function countOpenRequests() {
  const [rows] = await pool.query("SELECT COUNT(*) AS count FROM rate_requests WHERE status = 'Open'");
  return rows[0]?.count || 0;
}

export async function countSubmissions(transporterId = null) {
  if (transporterId) {
    const [rows] = await pool.query("SELECT COUNT(*) AS count FROM rate_submissions WHERE transporter_id = ?", [transporterId]);
    return rows[0]?.count || 0;
  }
  const [rows] = await pool.query("SELECT COUNT(*) AS count FROM rate_submissions");
  return rows[0]?.count || 0;
}

export async function fetchPaginatedRequests(limit, offset) {
  const [rows] = await pool.query(
    `SELECT id, request_no, title, origin_city, dest_city, company_unit, material_type, required_qty, unit, target_date, status, created_at
     FROM rate_requests
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows;
}

export async function fetchSubmissions(transporterId = null) {
  let query = `SELECT id, request_id, request_no, transporter_id, transporter_name, rate_per_unit, vehicle_type, comments, status, counter_rate, is_frozen, submitted_at FROM rate_submissions`;
  const params = [];
  if (transporterId) {
    query += ` WHERE transporter_id = ?`;
    params.push(transporterId);
  }
  query += ` ORDER BY submitted_at DESC LIMIT 100`;
  const [rows] = await pool.query(query, params);
  return rows;
}

export async function fetchTransportersList() {
  const [rows] = await pool.query('SELECT id, company_name, code, mobile, email, status FROM transporters LIMIT 100');
  return rows;
}

export async function fetchMasterRecords() {
  const [rows] = await pool.query('SELECT id, category, code, name FROM master_records LIMIT 200');
  return rows;
}
