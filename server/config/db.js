import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dbHost = process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '3306', 10);
const dbUser = process.env.DATABASE_USER || process.env.DB_USER || 'root';
const dbPassword = process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || '';
const dbName = process.env.DATABASE_NAME || process.env.DB_NAME || 'transflow_db';

console.log(`🔌 Initializing MySQL Connection Pool to [${dbHost}:${dbPort}/${dbName}] as ${dbUser}...`);

export const pool = mysql.createPool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

export async function initDatabaseSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_database (
        id VARCHAR(64) PRIMARY KEY,
        data LONGTEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate_submissions (
        id VARCHAR(64) PRIMARY KEY,
        request_id VARCHAR(64) NOT NULL,
        request_no VARCHAR(100) NOT NULL,
        transporter_id VARCHAR(64) NOT NULL,
        transporter_name VARCHAR(255) NOT NULL,
        rate_per_unit DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        vehicle_type VARCHAR(100) DEFAULT NULL,
        comments TEXT DEFAULT NULL,
        status ENUM('Submitted', 'Accepted', 'Rejected', 'Counter') NOT NULL DEFAULT 'Submitted',
        counter_rate DECIMAL(12,2) DEFAULT NULL,
        is_frozen TINYINT(1) DEFAULT 0,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_submissions_request (request_id),
        KEY idx_submissions_transporter (transporter_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ MySQL Database tables initialized successfully!');
    return true;
  } catch (err) {
    console.warn('⚠️ MySQL Schema Init Warning:', err.message);
    return false;
  }
}

export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL Database connected successfully!');
    connection.release();
    await initDatabaseSchema();
    return true;
  } catch (error) {
    console.warn('⚠️ MySQL Connection Warning:', error.message);
    console.warn('💡 Make sure MySQL server is running or configure DATABASE_* variables in .env');
    return false;
  }
}
