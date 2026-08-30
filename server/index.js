// Hostinger Passenger Process Reload Signal v1.9.0 - Winning Transporter Acceptance, Dispatch & Auto LR
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded before modules initialize
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { testConnection } from './config/db.js';
import authRoutes from './routes/auth.js';
import apiRoutes, { ensureRateSubmissionsTableExists } from './routes/api.js';

const app = express();

// Phusion Passenger on Hostinger passes process.env.PORT as a string or Unix socket path.
// DO NOT convert process.env.PORT to Number!
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ type: ['text/*', 'application/sql'], limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Prevent HTTP caching on all API responses 🛡️⚡
app.use('/api', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  next();
});

// Logging Middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// Health check endpoint with deployment version and frontend dist status
app.get('/api/health', (req, res) => {
  const distCandidate1 = path.resolve(__dirname, '../dist');
  const distCandidate2 = path.resolve(process.cwd(), 'dist');
  const distExists = fs.existsSync(distCandidate1) || fs.existsSync(distCandidate2);
  const indexExists = fs.existsSync(path.resolve(distCandidate1, 'index.html')) || fs.existsSync(path.resolve(distCandidate2, 'index.html'));

  res.json({
    status: 'ok',
    version: '1.9.0-phase1',
    commit: '7dd7237+',
    deploy_timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    port: PORT,
    frontend_dist_exists: distExists,
    frontend_index_exists: indexExists,
    db_host: process.env.DB_HOST || process.env.DATABASE_HOST || '127.0.0.1',
    db_user: process.env.DB_USER || process.env.DATABASE_USER || 'root',
    db_name: process.env.DB_NAME || process.env.DATABASE_NAME || 'transflow_db'
  });
});

// Full read-only schema and consistency audit endpoint
app.get('/api/diag/full-audit', async (req, res) => {
  try {
    const { pool } = await import('./config/db.js');
    const [tablesRows] = await pool.query('SHOW TABLES');
    const tableNames = tablesRows.map(r => Object.values(r)[0]);

    const tableDetails = {};
    const tableIndexes = {};
    const tableCreateSql = {};
    const tableCounts = {};

    for (const tName of tableNames) {
      try {
        const [cols] = await pool.query(`DESCRIBE \`${tName}\``);
        tableDetails[tName] = cols;
      } catch (e) {
        tableDetails[tName] = { error: e.message };
      }

      try {
        const [idx] = await pool.query(`SHOW INDEX FROM \`${tName}\``);
        tableIndexes[tName] = idx.map(i => ({ Table: i.Table, Key_name: i.Key_name, Column_name: i.Column_name, Non_unique: i.Non_unique }));
      } catch (e) {
        tableIndexes[tName] = { error: e.message };
      }

      try {
        const [createRows] = await pool.query(`SHOW CREATE TABLE \`${tName}\``);
        tableCreateSql[tName] = createRows[0] ? Object.values(createRows[0])[1] : null;
      } catch (e) {
        tableCreateSql[tName] = { error: e.message };
      }

      try {
        const [cRows] = await pool.query(`SELECT COUNT(*) AS count FROM \`${tName}\``);
        tableCounts[tName] = cRows[0].count;
      } catch (e) {
        tableCounts[tName] = 0;
      }
    }

    const [fkRows] = await pool.query(`
      SELECT 
        TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
    `);

    // Read-only Data Consistency Checks
    const [duplicateBids] = await pool.query(`
      SELECT requirement_id, item_id, transporter_id, COUNT(*) AS count
      FROM rate_submissions
      GROUP BY requirement_id, COALESCE(item_id, 'MAIN'), transporter_id
      HAVING count > 1
    `).catch(e => [[{ error: e.message }]]);

    const [orphanSubsReq] = await pool.query(`
      SELECT COUNT(*) AS count
      FROM rate_submissions s
      LEFT JOIN transport_requirements r ON r.id = s.requirement_id
      WHERE r.id IS NULL
    `).catch(e => [[{ error: e.message }]]);

    const [orphanSubsItem] = await pool.query(`
      SELECT COUNT(*) AS count
      FROM rate_submissions s
      LEFT JOIN transport_requirement_items i ON i.id = s.item_id
      WHERE s.item_id IS NOT NULL AND s.item_id != 'MAIN' AND i.id IS NULL
    `).catch(e => [[{ error: e.message }]]);

    const [orphanSubsTrans] = await pool.query(`
      SELECT COUNT(*) AS count
      FROM rate_submissions s
      LEFT JOIN transporters t ON (t.id = s.transporter_id OR t.code = s.transporter_id OR t.username = s.transporter_id)
      WHERE t.id IS NULL
    `).catch(e => [[{ error: e.message }]]);

    const [statusDistribution] = await pool.query(`
      SELECT bid_status, counter_offer_status, COUNT(*) as count
      FROM rate_submissions
      GROUP BY bid_status, counter_offer_status
    `).catch(e => [[{ error: e.message }]]);

    res.json({
      success: true,
      database: 'u704836459_shalimar_logi',
      tables: tableNames,
      tableCounts,
      tableDetails,
      tableIndexes,
      tableCreateSql,
      foreignKeys: fkRows,
      consistency: {
        duplicateBids,
        orphanSubsReq: orphanSubsReq[0]?.count || 0,
        orphanSubsItem: orphanSubsItem[0]?.count || 0,
        orphanSubsTrans: orphanSubsTrans[0]?.count || 0,
        statusDistribution
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// Hostinger Passenger Process Reload Signal v1.8.0 - Full Production Database Schema Audit


// Static File Serving for Hostinger Production Build (dist folder)
const distPath1 = path.resolve(__dirname, '../dist');
const distPath2 = path.resolve(process.cwd(), 'dist');
const resolvedDistPath = fs.existsSync(distPath1) ? distPath1 : (fs.existsSync(distPath2) ? distPath2 : distPath1);

console.log(`📂 Static asset directory configured: ${resolvedDistPath}`);
app.use(express.static(resolvedDistPath, { index: false }));

// Fallback for root "/" and client-side SPA routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.resolve(resolvedDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  const rootIndexPath = path.resolve(process.cwd(), 'index.html');
  if (fs.existsSync(rootIndexPath)) {
    return res.sendFile(rootIndexPath);
  }
  return res.status(200).send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Shalimar Logistics</title>
      </head>
      <body>
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h2>TransFlow Logistics Portal is Initializing...</h2>
          <p>Please refresh the page in a few seconds.</p>
          <script>setTimeout(() => window.location.reload(), 3000);</script>
        </div>
      </body>
    </html>
  `);
});

// Hostinger Production Express Listener
console.log(`==================================================`);
console.log(`🚀 Starting TransFlow Logistics Hostinger Express App`);
console.log(`📌 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`📌 PORT / Socket: ${PORT}`);
console.log(`==================================================`);

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Express HTTP Server Listening on: ${PORT}`);
  // Asynchronously test MySQL Connection
  testConnection()
    .then(async (dbConnected) => {
      if (dbConnected) {
        console.log('✅ MySQL Connection established.');
        await ensureRateSubmissionsTableExists().catch(e => console.warn('Startup table ensure notice:', e.message));
      } else {
        console.warn('⚠️ MySQL connection check returned false. Verify Hostinger DB environment variables.');
      }
    })
    .catch((err) => {
      console.error('⚠️ Async MySQL Connection Error:', err.message);
    });
});

export default app;
