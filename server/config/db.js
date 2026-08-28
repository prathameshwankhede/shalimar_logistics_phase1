import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env loading happens before config is initialized
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Priority 1: DB_* (Hostinger Standard), Priority 2: DATABASE_* (Fallback)
const rawHost = process.env.DB_HOST || process.env.DATABASE_HOST || '127.0.0.1';

// Hostinger MySQL loopback resolution fix:
// In Node.js 17+, 'localhost' resolves via dns.lookup to IPv6 '::1'.
// Hostinger MySQL user permissions (e.g. 'u704836459_shalimar_app') are granted on IPv4 loopback ('127.0.0.1').
// Mapping 'localhost' and '::1' to '127.0.0.1' ensures connections use IPv4 and match Hostinger privileges.
const dbHost = (rawHost === 'localhost' || rawHost === '::1') ? '127.0.0.1' : rawHost;

const dbPort = Number(process.env.DB_PORT || process.env.DATABASE_PORT || 3306);
const dbName = process.env.DB_NAME || process.env.DATABASE_NAME || 'transflow_db';
const dbUser = process.env.DB_USER || process.env.DATABASE_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || '';
const nodeEnv = process.env.NODE_ENV || 'development';

// Safe diagnostic logging (NEVER prints password)
console.log(`🔌 Initializing MySQL Connection Pool:`);
console.log(`   • DB_HOST : ${dbHost} (raw: ${rawHost})`);
console.log(`   • DB_PORT : ${dbPort}`);
console.log(`   • DB_NAME : ${dbName}`);
console.log(`   • DB_USER : ${dbUser}`);
console.log(`   • NODE_ENV: ${nodeEnv}`);

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

/**
 * Self-Healing Database Schema Initialization
 * Automatically creates the 6 core tables if missing without destroying existing data.
 */
export async function initDatabaseSchema() {
  try {
    // 1. app_database (Storage Blob Table)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_database (
        id VARCHAR(64) PRIMARY KEY,
        data LONGTEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. users (Users & Authentication Table)
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

    // 3. transporters (Transporters & Vendors Table)
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

    // 4. rate_requests (Rate Requirements & Indents Table)
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

    // 5. rate_submissions (Bids & Rates Table)
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

    // 6. master_records (Master Directory Records Table)
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

    // 7. security_audit_logs (Relational Audit Logs Table)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS security_audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        action VARCHAR(150) NOT NULL,
        username VARCHAR(100) DEFAULT NULL,
        user_role VARCHAR(50) DEFAULT NULL,
        status VARCHAR(100) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_audit_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. whatsapp_notifications (Relational WhatsApp Notifications Table)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_notifications (
        id VARCHAR(64) PRIMARY KEY,
        recipient VARCHAR(100) DEFAULT NULL,
        message TEXT DEFAULT NULL,
        status VARCHAR(50) DEFAULT 'Sent',
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_wa_sent (sent_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. contracts (Relational Freight Contracts Table)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contracts (
        id VARCHAR(64) PRIMARY KEY,
        contract_no VARCHAR(100) NOT NULL,
        request_id VARCHAR(64) DEFAULT NULL,
        transporter_id VARCHAR(64) DEFAULT NULL,
        allocated_qty DECIMAL(12,2) DEFAULT 0.00,
        rate_per_unit DECIMAL(12,2) DEFAULT 0.00,
        status VARCHAR(50) DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_contracts_transporter (transporter_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 10. products (Dedicated Products Table with UNIQUE code)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(64) PRIMARY KEY,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'General',
        hsn_code VARCHAR(50) DEFAULT '23040010',
        default_unit VARCHAR(50) DEFAULT 'MT',
        status VARCHAR(50) DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_products_code (code),
        KEY idx_products_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 11. company_units (Dedicated Company Units Table with UNIQUE code)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS company_units (
        id VARCHAR(64) PRIMARY KEY,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        contact_name VARCHAR(150) DEFAULT NULL,
        gstin VARCHAR(50) DEFAULT NULL,
        pan VARCHAR(50) DEFAULT NULL,
        mobile VARCHAR(30) DEFAULT NULL,
        email VARCHAR(150) DEFAULT NULL,
        city VARCHAR(100) DEFAULT NULL,
        district VARCHAR(100) DEFAULT NULL,
        pin VARCHAR(20) DEFAULT NULL,
        address TEXT DEFAULT NULL,
        status VARCHAR(50) DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_company_units_code (code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 12. cities (Dedicated Cities Master Table with UNIQUE code)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cities (
        id VARCHAR(64) PRIMARY KEY,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(150) NOT NULL,
        district VARCHAR(100) DEFAULT NULL,
        state VARCHAR(100) DEFAULT NULL,
        pin VARCHAR(20) DEFAULT NULL,
        status VARCHAR(50) DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_cities_code (code),
        KEY idx_cities_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 13. transport_titles (Dedicated Transport Titles Table with UNIQUE code)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transport_titles (
        id VARCHAR(64) PRIMARY KEY,
        code VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_titles_code (code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 14. dispatches (Relational Truck Dispatch & LR Table)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dispatches (
        id VARCHAR(64) PRIMARY KEY,
        contract_id VARCHAR(64) DEFAULT NULL,
        lr_number VARCHAR(100) NOT NULL,
        truck_number VARCHAR(50) NOT NULL,
        loaded_quantity DECIMAL(12,2) DEFAULT 0.00,
        driver_name VARCHAR(150) DEFAULT NULL,
        driver_mobile VARCHAR(30) DEFAULT NULL,
        driver_license_no VARCHAR(100) DEFAULT NULL,
        dispatch_date VARCHAR(50) DEFAULT NULL,
        status VARCHAR(50) DEFAULT 'Dispatched',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_dispatches_contract (contract_id),
        KEY idx_dispatches_truck (truck_number),
        KEY idx_dispatches_lr (lr_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ Self-healing MySQL schema initialized (14 relational tables verified/created).');
    return true;
  } catch (err) {
    console.error('❌ MySQL Schema Init Error:', err.message);
    return false;
  }
}

/**
 * Verify Connection & Initialize Database Schema
 */
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.query('SELECT 1');
    console.log(`✅ MySQL Database connected successfully to [${dbHost}:${dbPort}/${dbName}] as '${dbUser}'!`);
    connection.release();
    return true;
  } catch (error) {
    console.error(`❌ MySQL Connection Failure for user '${dbUser}' on [${dbHost}:${dbPort}/${dbName}]:`, error.message);
    return false;
  }
}
