-- Hostinger MySQL Schema Migration: Ensure security_audit_logs Table Exists
-- Database: u704836459_shalimar_logi

CREATE TABLE IF NOT EXISTS `security_audit_logs` (
  `id` VARCHAR(64) NOT NULL,
  `action` VARCHAR(255) NOT NULL,
  `username` VARCHAR(100) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'system',
  `user_role` VARCHAR(50) DEFAULT NULL,
  `ip` VARCHAR(50) DEFAULT NULL,
  `ip_address` VARCHAR(50) DEFAULT NULL,
  `status` VARCHAR(100) DEFAULT NULL,
  `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_timestamp` (`timestamp`),
  KEY `idx_audit_created_at` (`created_at`),
  KEY `idx_audit_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
