// server/services/migrationRunner.js
// Automated Production Database Reset, Rebuild & Verification Service

import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';

export async function executeFullDatabaseResetAndRebuild() {
  console.log('==================================================');
  console.log('💥 EXECUTING HOSTINGER PRODUCTION DATABASE RESET & REBUILD');
  console.log('==================================================');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Recreate 11 Relational Tables
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(150) NOT NULL,
        role ENUM('admin', 'transporter') NOT NULL DEFAULT 'transporter',
        transporter_id VARCHAR(64) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_users_transporter (transporter_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS transporters (
        id VARCHAR(64) PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        code VARCHAR(50) NOT NULL,
        contact_name VARCHAR(150) DEFAULT NULL,
        mobile VARCHAR(30) DEFAULT NULL,
        email VARCHAR(150) DEFAULT NULL,
        gstin VARCHAR(50) DEFAULT NULL,
        pan VARCHAR(50) DEFAULT NULL,
        status VARCHAR(50) DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_transporter_code (code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
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
        UNIQUE KEY uq_products_code (code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
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

    await connection.query(`
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
        UNIQUE KEY uq_cities_code (code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
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

    await connection.query(`
      CREATE TABLE IF NOT EXISTS rate_requests (
        id VARCHAR(64) PRIMARY KEY,
        request_no VARCHAR(100) NOT NULL,
        title VARCHAR(255) DEFAULT NULL,
        origin_city VARCHAR(100) DEFAULT NULL,
        dest_city VARCHAR(100) DEFAULT NULL,
        material_type VARCHAR(255) DEFAULT NULL,
        required_qty DECIMAL(12,2) DEFAULT 0.00,
        unit VARCHAR(50) DEFAULT 'MT',
        target_date VARCHAR(50) DEFAULT NULL,
        status VARCHAR(50) DEFAULT 'Open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
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
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS contracts (
        id VARCHAR(64) PRIMARY KEY,
        contract_no VARCHAR(100) NOT NULL,
        request_id VARCHAR(64) DEFAULT NULL,
        transporter_id VARCHAR(64) DEFAULT NULL,
        allocated_qty DECIMAL(12,2) DEFAULT 0.00,
        rate_per_unit DECIMAL(12,2) DEFAULT 0.00,
        status VARCHAR(50) DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
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
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS security_audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        action VARCHAR(150) NOT NULL,
        username VARCHAR(100) DEFAULT NULL,
        user_role VARCHAR(50) DEFAULT NULL,
        status VARCHAR(100) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Clear operational test data from rate_requests and rate_submissions
    await connection.query('DELETE FROM rate_requests');
    await connection.query('DELETE FROM rate_submissions');
    await connection.query('DELETE FROM contracts');
    await connection.query('DELETE FROM dispatches');

    // 3. Seed Products (3)
    const seedProducts = [
      { id: 'prod_001', code: 'PROD-SOYAMEAL', name: 'Soyameal Bulk', category: 'Dry Bulk', hsn: '23040010', unit: 'MT' },
      { id: 'prod_002', code: 'PROD-SOYAOIL', name: 'Refined Soyabean Oil Bulk', category: 'Liquid Bulk', hsn: '15071000', unit: 'MT' },
      { id: 'prod_003', code: 'PROD-DOC-BAG', name: 'De Oiled Cake Bagged', category: 'Bagged Freight', hsn: '23040020', unit: 'MT' }
    ];
    for (const p of seedProducts) {
      await connection.query(
        `INSERT INTO products (id, code, name, category, hsn_code, default_unit, status)
         VALUES (?, ?, ?, ?, ?, ?, 'Active')
         ON DUPLICATE KEY UPDATE name = VALUES(name), category = VALUES(category)`,
        [p.id, p.code, p.name, p.category, p.hsn, p.unit]
      );
    }

    // 4. Seed Company Units (3)
    const seedUnits = [
      { id: 'unit_001', code: 'UNIT-SHALIMAR-SOLVEX', name: 'Plant Unit Shalimar Solvex', contact: 'Logistics Head', gstin: '23AAACS1234F1Z0', pan: 'AAACS1234F', mobile: '9876543210', email: 'plant@shalimar.com', city: 'Indore', district: 'Indore', pin: '452001', address: 'Plot 12, Industrial Area, Sector A' },
      { id: 'unit_002', code: 'UNIT-REFINERY-02', name: 'Refinery Unit 2', contact: 'Operations Manager', gstin: '23AAACS1234F1Z1', pan: 'AAACS1234F', mobile: '9876543211', email: 'refinery2@shalimar.com', city: 'Dewas', district: 'Dewas', pin: '455001', address: 'Plot 45, Industrial Zone' },
      { id: 'unit_003', code: 'UNIT-CENTRAL-WH', name: 'Central Warehouse Logistics', contact: 'Warehouse Incharge', gstin: '27AAACS1234F1Z2', pan: 'AAACS1234F', mobile: '9876543212', email: 'warehouse@shalimar.com', city: 'Mumbai', district: 'Thane', pin: '400705', address: 'Jawahar Logistics Park' }
    ];
    for (const u of seedUnits) {
      await connection.query(
        `INSERT INTO company_units (id, code, name, contact_name, gstin, pan, mobile, email, city, district, pin, address, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
         ON DUPLICATE KEY UPDATE name = VALUES(name), contact_name = VALUES(contact_name)`,
        [u.id, u.code, u.name, u.contact, u.gstin, u.pan, u.mobile, u.email, u.city, u.district, u.pin, u.address]
      );
    }

    // 5. Seed Cities (5)
    const seedCities = [
      { id: 'city_001', code: 'CITY-IND', name: 'Indore', district: 'Indore', state: 'Madhya Pradesh', pin: '452001' },
      { id: 'city_002', code: 'CITY-DEW', name: 'Dewas', district: 'Dewas', state: 'Madhya Pradesh', pin: '455001' },
      { id: 'city_003', code: 'CITY-MUM', name: 'Mumbai', district: 'Mumbai Suburban', state: 'Maharashtra', pin: '400001' },
      { id: 'city_004', code: 'CITY-KAN', name: 'Kandla Port', district: 'Kutch', state: 'Gujarat', pin: '370210' },
      { id: 'city_005', code: 'CITY-NAG', name: 'Nagpur', district: 'Nagpur', state: 'Maharashtra', pin: '440001' }
    ];
    for (const c of seedCities) {
      await connection.query(
        `INSERT INTO cities (id, code, name, district, state, pin, status)
         VALUES (?, ?, ?, ?, ?, ?, 'Active')
         ON DUPLICATE KEY UPDATE name = VALUES(name), district = VALUES(district)`,
        [c.id, c.code, c.name, c.district, c.state, c.pin]
      );
    }

    // 6. Seed Transport Titles (4)
    const seedTitles = [
      { id: 'title_001', code: 'TITLE-SUPT-FREIGHT', title: 'Superintendent Freight' },
      { id: 'title_002', code: 'TITLE-PLANT-LOG-OFFICER', title: 'Plant Logistics Officer' },
      { id: 'title_003', code: 'TITLE-DISPATCH-CTRL', title: 'Dispatch Controller' },
      { id: 'title_004', code: 'TITLE-REG-OPS-MGR', title: 'Regional Operations Manager' }
    ];
    for (const t of seedTitles) {
      await connection.query(
        `INSERT INTO transport_titles (id, code, title, status)
         VALUES (?, ?, ?, 'Active')
         ON DUPLICATE KEY UPDATE title = VALUES(title)`,
        [t.id, t.code, t.title]
      );
    }

    // 7. Seed Transporters & Users (with bcrypt hashing)
    const salt = await bcrypt.genSalt(10);
    const adminHash = await bcrypt.hash('admin123', salt);
    const transHash = await bcrypt.hash('trans123', salt);

    const seedTransporters = [
      { id: 'trans_abc_001', name: 'ABC Freight Logistics Pvt Ltd', code: 'ABC001', contact: 'Rajesh Sharma', mobile: '9876543210', email: 'rajesh@abcfreight.com', gstin: '23ABCDE1234F1Z5', pan: 'ABCDE1234F' },
      { id: 'trans_xyz_002', name: 'XYZ Freight Logistics', code: 'XYZ001', contact: 'Vikram Singh', mobile: '9876543211', email: 'vikram@xyzfreight.com', gstin: '23XYZDE1234F1Z6', pan: 'XYZDE1234F' },
      { id: 'trans_pqr_003', name: 'PQR Transport Carriers', code: 'PQR001', contact: 'Sanjay Kumar', mobile: '9876543212', email: 'sanjay@pqrtransport.com', gstin: '23PQRDE1234F1Z7', pan: 'PQRDE1234F' }
    ];
    for (const t of seedTransporters) {
      await connection.query(
        `INSERT INTO transporters (id, company_name, code, contact_name, mobile, email, gstin, pan, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')
         ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), mobile = VALUES(mobile)`,
        [t.id, t.name, t.code, t.contact, t.mobile, t.email, t.gstin, t.pan]
      );
    }

    const seedUsers = [
      { id: 'usr_admin', username: 'admin', hash: adminHash, name: 'Logistics Head', role: 'admin', transId: null },
      { id: 'usr_abc', username: 'ABC001', hash: transHash, name: 'ABC Freight Logistics Pvt Ltd', role: 'transporter', transId: 'trans_abc_001' },
      { id: 'usr_xyz', username: 'XYZ001', hash: transHash, name: 'XYZ Freight Logistics', role: 'transporter', transId: 'trans_xyz_002' },
      { id: 'usr_pqr', username: 'PQR001', hash: transHash, name: 'PQR Transport Carriers', role: 'transporter', transId: 'trans_pqr_003' }
    ];
    for (const u of seedUsers) {
      await connection.query(
        `INSERT INTO users (id, username, password_hash, name, role, transporter_id)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role), transporter_id = VALUES(transporter_id)`,
        [u.id, u.username, u.hash, u.name, u.role, u.transId]
      );
    }

    await connection.commit();

    // Drop legacy master_records table
    await pool.query('DROP TABLE IF EXISTS master_records');

    // Post-commit read-back SELECT verification
    const [pRes] = await pool.query('SELECT COUNT(*) AS c FROM products');
    const [uRes] = await pool.query('SELECT COUNT(*) AS c FROM company_units');
    const [cRes] = await pool.query('SELECT COUNT(*) AS c FROM cities');
    const [tRes] = await pool.query('SELECT COUNT(*) AS c FROM transport_titles');
    const [trRes] = await pool.query('SELECT COUNT(*) AS c FROM transporters');
    const [usrRes] = await pool.query('SELECT COUNT(*) AS c FROM users');
    const [reqRes] = await pool.query('SELECT COUNT(*) AS c FROM rate_requests');
    const [subRes] = await pool.query('SELECT COUNT(*) AS c FROM rate_submissions');

    const statusReport = {
      success: true,
      timestamp: new Date().toISOString(),
      counts: {
        products: pRes[0].c,
        company_units: uRes[0].c,
        cities: cRes[0].c,
        transport_titles: tRes[0].c,
        transporters: trRes[0].c,
        users: usrRes[0].c,
        rate_requests: reqRes[0].c,
        rate_submissions: subRes[0].c
      },
      master_records_removed: true
    };

    console.log('✅ DATABASE RESET COMPLETED SUCCESSFULLY!');
    console.log(JSON.stringify(statusReport, null, 2));
    return statusReport;

  } catch (err) {
    await connection.rollback();
    console.error('❌ MIGRATION FAILED & ROLLED BACK:', err.message);
    throw err;
  } finally {
    connection.release();
  }
}
