-- ============================================================
-- TransFlow Logistics — Hostinger Managed MySQL Production Schema
-- Engine: InnoDB | Character Set: utf8mb4 | collation: utf8mb4_unicode_ci
-- ============================================================

CREATE DATABASE IF NOT EXISTS `transflow_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `transflow_db`;

-- 1. USERS & AUTHENTICATION TABLE
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) NOT NULL,
  `username` VARCHAR(100) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `role` ENUM('admin', 'transporter') NOT NULL DEFAULT 'transporter',
  `transporter_id` VARCHAR(64) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. COMPANY PROFILE & MASTER SETTINGS TABLE
CREATE TABLE IF NOT EXISTS `company_settings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `company_name` VARCHAR(255) DEFAULT 'Shalimar Nutrients Pvt Ltd',
  `short_name` VARCHAR(100) DEFAULT 'Shalimar Nutrients',
  `tagline` TEXT,
  `gstin` VARCHAR(30) DEFAULT '27AAPCS1419M1ZV',
  `logo` TEXT,
  `reg_office` TEXT,
  `contact_email` VARCHAR(150) DEFAULT 'logistics@shalimarnutrients.com',
  `contact_phone` VARCHAR(50) DEFAULT '+91 712 2567890',
  `hsn_code` VARCHAR(20) DEFAULT '23040010',
  `igst_rate` DECIMAL(5,2) DEFAULT 5.00,
  `do_prefix` VARCHAR(30) DEFAULT 'DOR-SNPL-',
  `state_name` VARCHAR(100) DEFAULT 'MAHARASHTRA',
  `state_code` VARCHAR(50) DEFAULT '27 (MAHARASHTRA)',
  `dispatch_plant_name` VARCHAR(255) DEFAULT 'Shalimar Nutrients MIDC Processing Unit',
  `dispatch_plant_address` TEXT,
  `terms_conditions` TEXT,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. TRANSPORTERS TABLE
CREATE TABLE IF NOT EXISTS `transporters` (
  `id` VARCHAR(64) NOT NULL,
  `company_name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `contact_person` VARCHAR(150) DEFAULT NULL,
  `mobile` VARCHAR(50) DEFAULT NULL,
  `email` VARCHAR(150) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `gst_pan` VARCHAR(50) DEFAULT NULL,
  `username` VARCHAR(100) DEFAULT NULL,
  `status` ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  `vehicles` JSON DEFAULT NULL,
  `bank_details` JSON DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_transporters_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. MASTER RECORDS TABLE (Companies, Products, Cargo, Titles, Cities)
CREATE TABLE IF NOT EXISTS `master_records` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `category` VARCHAR(50) NOT NULL,
  `code` VARCHAR(50) DEFAULT NULL,
  `name` VARCHAR(255) NOT NULL,
  `extra_data` JSON DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_masters_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. INDENTS / RATE REQUESTS TABLE
CREATE TABLE IF NOT EXISTS `rate_requests` (
  `id` VARCHAR(64) NOT NULL,
  `request_no` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `batch_no` VARCHAR(50) DEFAULT NULL,
  `sub_no` VARCHAR(20) DEFAULT NULL,
  `origin_city` VARCHAR(150) NOT NULL,
  `origin_pin` VARCHAR(20) DEFAULT NULL,
  `dest_city` VARCHAR(150) NOT NULL,
  `dest_pin` VARCHAR(20) DEFAULT NULL,
  `company_unit` VARCHAR(255) DEFAULT NULL,
  `material_type` VARCHAR(150) DEFAULT NULL,
  `hsn_code` VARCHAR(30) DEFAULT NULL,
  `required_qty` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `unit` VARCHAR(20) DEFAULT 'MT',
  `target_date` DATE DEFAULT NULL,
  `target_rate` DECIMAL(12,2) DEFAULT NULL,
  `vehicle_type` VARCHAR(100) DEFAULT NULL,
  `status` ENUM('Open', 'Allocated', 'Closed', 'Cancelled') NOT NULL DEFAULT 'Open',
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_requests_no` (`request_no`),
  KEY `idx_requests_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. BIDS / RATE SUBMISSIONS TABLE
CREATE TABLE IF NOT EXISTS `rate_submissions` (
  `id` VARCHAR(64) NOT NULL,
  `request_id` VARCHAR(64) NOT NULL,
  `request_no` VARCHAR(100) NOT NULL,
  `transporter_id` VARCHAR(64) NOT NULL,
  `transporter_name` VARCHAR(255) NOT NULL,
  `rate_per_unit` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `vehicle_type` VARCHAR(100) DEFAULT NULL,
  `comments` TEXT DEFAULT NULL,
  `status` ENUM('Submitted', 'Accepted', 'Rejected', 'Counter') NOT NULL DEFAULT 'Submitted',
  `counter_rate` DECIMAL(12,2) DEFAULT NULL,
  `is_frozen` TINYINT(1) DEFAULT 0,
  `submitted_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_submissions_request` (`request_id`),
  KEY `idx_submissions_transporter` (`transporter_id`),
  CONSTRAINT `fk_submissions_request` FOREIGN KEY (`request_id`) REFERENCES `rate_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_submissions_transporter` FOREIGN KEY (`transporter_id`) REFERENCES `transporters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. ALLOCATIONS TABLE
CREATE TABLE IF NOT EXISTS `allocations` (
  `id` VARCHAR(64) NOT NULL,
  `request_id` VARCHAR(64) NOT NULL,
  `request_no` VARCHAR(100) NOT NULL,
  `transporter_id` VARCHAR(64) NOT NULL,
  `transporter_name` VARCHAR(255) NOT NULL,
  `allocated_qty` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `agreed_rate` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('Allocated', 'Dispatched', 'Completed') NOT NULL DEFAULT 'Allocated',
  `allocated_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `notes` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_allocations_request` (`request_id`),
  KEY `idx_allocations_transporter` (`transporter_id`),
  CONSTRAINT `fk_allocations_request` FOREIGN KEY (`request_id`) REFERENCES `rate_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_allocations_transporter` FOREIGN KEY (`transporter_id`) REFERENCES `transporters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. TRANSPORTER CONTRACTS TABLE
CREATE TABLE IF NOT EXISTS `contracts` (
  `id` VARCHAR(64) NOT NULL,
  `contract_no` VARCHAR(100) NOT NULL,
  `transporter_id` VARCHAR(64) NOT NULL,
  `transporter_name` VARCHAR(255) NOT NULL,
  `valid_from` DATE NOT NULL,
  `valid_to` DATE NOT NULL,
  `routes` JSON DEFAULT NULL,
  `status` ENUM('Active', 'Expired', 'Terminated') NOT NULL DEFAULT 'Active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_contracts_no` (`contract_no`),
  CONSTRAINT `fk_contracts_transporter` FOREIGN KEY (`transporter_id`) REFERENCES `transporters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. TRUCK DISPATCHES TABLE
CREATE TABLE IF NOT EXISTS `truck_dispatches` (
  `id` VARCHAR(64) NOT NULL,
  `allocation_id` VARCHAR(64) DEFAULT NULL,
  `request_id` VARCHAR(64) DEFAULT NULL,
  `transporter_id` VARCHAR(64) NOT NULL,
  `truck_no` VARCHAR(50) NOT NULL,
  `driver_name` VARCHAR(150) DEFAULT NULL,
  `driver_phone` VARCHAR(50) DEFAULT NULL,
  `driver_license` VARCHAR(100) DEFAULT NULL,
  `lr_no` VARCHAR(100) DEFAULT NULL,
  `lr_date` DATE DEFAULT NULL,
  `loaded_qty` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('Dispatched', 'In-Transit', 'Delivered') NOT NULL DEFAULT 'Dispatched',
  `dispatched_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dispatches_transporter` (`transporter_id`),
  CONSTRAINT `fk_dispatches_transporter` FOREIGN KEY (`transporter_id`) REFERENCES `transporters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. SECURITY AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS `security_audit_logs` (
  `id` VARCHAR(64) NOT NULL,
  `action` VARCHAR(255) NOT NULL,
  `username` VARCHAR(100) NOT NULL,
  `role` VARCHAR(50) NOT NULL,
  `ip` VARCHAR(50) DEFAULT NULL,
  `status` VARCHAR(100) DEFAULT NULL,
  `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. WHATSAPP NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS `whatsapp_notifications` (
  `id` VARCHAR(64) NOT NULL,
  `recipient` VARCHAR(100) NOT NULL,
  `message` TEXT NOT NULL,
  `status` VARCHAR(50) DEFAULT 'Sent',
  `sent_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. FALLBACK/SYNC APP STATE BACKUP TABLE
CREATE TABLE IF NOT EXISTS `app_database` (
  `id` VARCHAR(64) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
