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
 * Strict No-Op Function: Automatic Schema Initialization Permanently Disabled
 */
export async function initDatabaseSchema() {
  console.log('🛡️ Automatic database schema creation is permanently disabled.');
  return true;
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
