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
CREATE TABLE IF NOT EXISTS `transport_requirements` (
  `id` VARCHAR(100) NOT NULL,
  `req_no` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) DEFAULT NULL,
  `pickup_origin` VARCHAR(255) DEFAULT NULL,
  `drop_location` VARCHAR(255) DEFAULT NULL,
  `product_name` VARCHAR(255) DEFAULT NULL,
  `quantity_mt` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  `total_quantity_mt` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  `unit` VARCHAR(50) DEFAULT 'MT',
  `target_date` DATE DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Active',
  `submitted_bids_count` INT DEFAULT 0,
  `approval_status` VARCHAR(50) DEFAULT 'DRAFT',
  `created_by` VARCHAR(100) DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_req_no` (`req_no`),
  KEY `idx_req_status_created` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5.1. REQUIREMENT CHILD/SUB-INDENT ITEMS TABLE
CREATE TABLE IF NOT EXISTS `transport_requirement_items` (
  `id` VARCHAR(100) NOT NULL,
  `requirement_id` VARCHAR(100) NOT NULL,
  `sub_indent_no` VARCHAR(100) DEFAULT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `quantity_mt` DECIMAL(12,3) NOT NULL,
  `unit` VARCHAR(50) DEFAULT 'MT',
  `pickup_origin` VARCHAR(255) DEFAULT NULL,
  `drop_location` VARCHAR(255) DEFAULT NULL,
  `hsn_code` VARCHAR(50) DEFAULT NULL,
  `target_date` DATE DEFAULT NULL,
  `dispatch_status` VARCHAR(50) DEFAULT 'PENDING',
  `allocation_status` VARCHAR(50) DEFAULT 'ACTIVE',
  `remaining_action` VARCHAR(50) DEFAULT NULL,
  `dispatched_quantity_mt` DECIMAL(12,3) DEFAULT 0.000,
  `remaining_quantity_mt` DECIMAL(12,3) DEFAULT NULL,
  `released_for_requote_at` DATETIME DEFAULT NULL,
  `released_for_requote_by` VARCHAR(100) DEFAULT NULL,
  `released_for_requote_reason` TEXT DEFAULT NULL,
  `replacement_item_id` VARCHAR(100) DEFAULT NULL,
  `source_item_id` VARCHAR(100) DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_req_id` (`requirement_id`),
  KEY `idx_sub_indent_no` (`sub_indent_no`),
  KEY `idx_req_item_lookup` (`requirement_id`, `id`),
  CONSTRAINT `fk_tri_req` FOREIGN KEY (`requirement_id`) REFERENCES `transport_requirements` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. BIDS / RATE SUBMISSIONS TABLE (Canonical Production Schema)
CREATE TABLE IF NOT EXISTS `rate_submissions` (
  `id` VARCHAR(100) NOT NULL,
  `requirement_id` VARCHAR(100) NOT NULL,
  `item_id` VARCHAR(100) DEFAULT 'MAIN',
  `transporter_id` VARCHAR(100) NOT NULL,
  `rate_per_mt` DECIMAL(12,2) NOT NULL,
  `quoted_quantity_mt` DECIMAL(12,3) DEFAULT NULL,
  `total_amount` DECIMAL(14,2) DEFAULT NULL,
  `remarks` TEXT DEFAULT NULL,
  `original_rate` DECIMAL(12,2) DEFAULT NULL,
  `counter_offer_rate` DECIMAL(12,2) DEFAULT NULL,
  `counter_offer_status` VARCHAR(50) DEFAULT NULL,
  `counter_offer_by` VARCHAR(50) DEFAULT NULL,
  `counter_offer_at` DATETIME DEFAULT NULL,
  `counter_message` TEXT DEFAULT NULL,
  `final_rate` DECIMAL(12,2) DEFAULT NULL,
  `finalized_at` DATETIME DEFAULT NULL,
  `bid_status` VARCHAR(50) DEFAULT 'Submitted',
  `submitted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_req_item_trans` (`requirement_id`, `item_id`, `transporter_id`),
  KEY `idx_rate_requirement` (`requirement_id`),
  KEY `idx_rate_transporter` (`transporter_id`),
  KEY `idx_rate_item` (`item_id`),
  KEY `idx_rate_counter_status` (`bid_status`, `counter_offer_status`),
  CONSTRAINT `fk_rs_req` FOREIGN KEY (`requirement_id`) REFERENCES `transport_requirements` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rs_item` FOREIGN KEY (`item_id`) REFERENCES `transport_requirement_items` (`id`) ON DELETE CASCADE
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

-- 8. LR NUMBER CONCURRENCY-SAFE SEQUENCES TABLE
CREATE TABLE IF NOT EXISTS `lr_sequences` (
  `prefix` VARCHAR(50) NOT NULL PRIMARY KEY,
  `last_seq` INT NOT NULL DEFAULT 0,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. TRUCK DISPATCHES TABLE (ITEM-LEVEL & CANONICAL LR)
CREATE TABLE IF NOT EXISTS `truck_dispatches` (
  `id` VARCHAR(100) NOT NULL,
  `requirement_id` VARCHAR(100) NOT NULL,
  `requirement_item_id` VARCHAR(100) NOT NULL,
  `transporter_id` VARCHAR(100) NOT NULL,
  `finalized_rate` DECIMAL(12,2) NOT NULL,
  `truck_number` VARCHAR(50) NOT NULL,
  `loaded_quantity_mt` DECIMAL(12,3) NOT NULL,
  `driver_name` VARCHAR(150) NOT NULL,
  `driver_mobile` VARCHAR(50) NOT NULL,
  `driver_license` VARCHAR(100) NOT NULL,
  `lr_number` VARCHAR(100) NOT NULL,
  `dispatch_reference` VARCHAR(100) DEFAULT NULL,
  `dispatch_status` VARCHAR(50) NOT NULL DEFAULT 'Dispatched',
  `dispatched_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_lr_number` (`lr_number`),
  KEY `idx_dispatches_req_item` (`requirement_id`, `requirement_item_id`),
  KEY `idx_dispatches_transporter` (`transporter_id`),
  CONSTRAINT `fk_dispatches_req` FOREIGN KEY (`requirement_id`) REFERENCES `transport_requirements` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dispatches_req_item` FOREIGN KEY (`requirement_item_id`) REFERENCES `transport_requirement_items` (`id`) ON DELETE CASCADE,
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
