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

export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL Database connected successfully!');
    connection.release();
    return true;
  } catch (error) {
    console.warn('⚠️ MySQL Connection Warning:', error.message);
    console.warn('💡 Make sure MySQL server is running or configure DATABASE_* variables in .env');
    return false;
  }
}
