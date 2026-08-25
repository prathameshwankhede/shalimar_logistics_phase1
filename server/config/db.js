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
    // 1. Storage Blob Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_database (
        id VARCHAR(64) PRIMARY KEY,
        data LONGTEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Users Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(150) NOT NULL,
        role ENUM('admin', 'transporter') NOT NULL DEFAULT 'transporter',
        transporter_id VARCHAR(64) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY idx_users_username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Transporters Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transporters (
        id VARCHAR(64) PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        code VARCHAR(50) NOT NULL,
        contact_person VARCHAR(150) DEFAULT NULL,
        mobile VARCHAR(30) DEFAULT NULL,
        email VARCHAR(150) DEFAULT NULL,
        address TEXT DEFAULT NULL,
        gst_pan VARCHAR(50) DEFAULT NULL,
        username VARCHAR(100) DEFAULT NULL,
        status ENUM('Active', 'Inactive') DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Rate Requests Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate_requests (
        id VARCHAR(64) PRIMARY KEY,
        request_no VARCHAR(100) NOT NULL,
        title VARCHAR(255) DEFAULT NULL,
        batch_no VARCHAR(100) DEFAULT NULL,
        sub_no VARCHAR(50) DEFAULT NULL,
        origin_city VARCHAR(100) DEFAULT NULL,
        origin_pin VARCHAR(20) DEFAULT NULL,
        dest_city VARCHAR(100) DEFAULT NULL,
        dest_pin VARCHAR(20) DEFAULT NULL,
        company_unit VARCHAR(255) DEFAULT NULL,
        material_type VARCHAR(255) DEFAULT NULL,
        hsn_code VARCHAR(50) DEFAULT NULL,
        required_qty DECIMAL(12,2) DEFAULT 0.00,
        unit VARCHAR(50) DEFAULT 'MT',
        target_date VARCHAR(50) DEFAULT NULL,
        status VARCHAR(50) DEFAULT 'Open',
        notes TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_requests_status (status),
        KEY idx_requests_no (request_no)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Rate Submissions Table
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

    // 6. Master Records Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS master_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category VARCHAR(50) NOT NULL,
        code VARCHAR(50) DEFAULT NULL,
        name VARCHAR(255) NOT NULL,
        extra_data JSON DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_masters_category (category)
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
