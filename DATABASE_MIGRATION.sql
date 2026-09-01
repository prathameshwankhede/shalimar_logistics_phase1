-- ==============================================================================
-- TransFlow Logistics / Shalimar Nutrients
-- Production-Safe Idempotent Database Migration Script
-- Version: 2.1.0-Hardened
-- Applied Date: 2026-09-01
-- Supported RDBMS: MySQL 5.7+, MySQL 8.0+, MariaDB 10.2+ (Hostinger Cloud Compatible)
-- Guarantee: 100% Idempotent, Non-Destructive, Zero Data Loss
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. CREATE ORGANIZATIONS MASTER TABLE
CREATE TABLE IF NOT EXISTS `organizations` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Active',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. SEED DEFAULT ORGANIZATION FOR EXISTING SHALIMAR DATA
INSERT IGNORE INTO `organizations` (`id`, `name`, `status`)
VALUES ('org_shalimar', 'Shalimar Nutrients Pvt Ltd', 'Active');

-- 3. DEFENSIVE STORED PROCEDURES FOR IDEMPOTENT SCHEMA MUTATION
DELIMITER $$

DROP PROCEDURE IF EXISTS `AddColumnSafely`$$
CREATE PROCEDURE `AddColumnSafely`(
    IN in_table VARCHAR(64),
    IN in_col VARCHAR(64),
    IN in_def VARCHAR(255)
)
BEGIN
    DECLARE col_cnt INT DEFAULT 0;
    DECLARE tbl_cnt INT DEFAULT 0;

    SELECT COUNT(*) INTO tbl_cnt
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = in_table;

    IF tbl_cnt > 0 THEN
        SELECT COUNT(*) INTO col_cnt
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = in_table AND COLUMN_NAME = in_col;

        IF col_cnt = 0 THEN
            SET @ddl = CONCAT('ALTER TABLE `', in_table, '` ADD COLUMN `', in_col, '` ', in_def);
            PREPARE stmt FROM @ddl;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
        END IF;
    END IF;
END$$

DROP PROCEDURE IF EXISTS `AddIndexSafely`$$
CREATE PROCEDURE `AddIndexSafely`(
    IN in_table VARCHAR(64),
    IN in_idx VARCHAR(64),
    IN in_cols VARCHAR(255)
)
BEGIN
    DECLARE idx_cnt INT DEFAULT 0;
    DECLARE tbl_cnt INT DEFAULT 0;

    SELECT COUNT(*) INTO tbl_cnt
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = in_table;

    IF tbl_cnt > 0 THEN
        SELECT COUNT(*) INTO idx_cnt
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = in_table AND INDEX_NAME = in_idx;

        IF idx_cnt = 0 THEN
            SET @ddl = CONCAT('CREATE INDEX `', in_idx, '` ON `', in_table, '` (', in_cols, ')');
            PREPARE stmt FROM @ddl;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
        END IF;
    END IF;
END$$

DELIMITER ;

-- 4. APPLY ORGANIZATION_ID AND AUDIT COLUMNS SAFELY
CALL AddColumnSafely('users', 'organization_id', 'VARCHAR(64) NOT NULL DEFAULT \'org_shalimar\'');

CALL AddColumnSafely('transport_requirements', 'organization_id', 'VARCHAR(64) NOT NULL DEFAULT \'org_shalimar\'');
CALL AddColumnSafely('transport_requirements', 'created_by', 'VARCHAR(100) DEFAULT NULL');
CALL AddColumnSafely('transport_requirements', 'updated_by', 'VARCHAR(100) DEFAULT NULL');

CALL AddColumnSafely('transport_requirement_items', 'organization_id', 'VARCHAR(64) NOT NULL DEFAULT \'org_shalimar\'');

CALL AddColumnSafely('rate_submissions', 'organization_id', 'VARCHAR(64) NOT NULL DEFAULT \'org_shalimar\'');
CALL AddColumnSafely('rate_submissions', 'updated_by', 'VARCHAR(100) DEFAULT NULL');

CALL AddColumnSafely('truck_dispatches', 'organization_id', 'VARCHAR(64) NOT NULL DEFAULT \'org_shalimar\'');
CALL AddColumnSafely('truck_dispatches', 'created_by', 'VARCHAR(100) DEFAULT NULL');
CALL AddColumnSafely('truck_dispatches', 'updated_by', 'VARCHAR(100) DEFAULT NULL');

CALL AddColumnSafely('transporters', 'organization_id', 'VARCHAR(64) NOT NULL DEFAULT \'org_shalimar\'');
CALL AddColumnSafely('company_settings', 'organization_id', 'VARCHAR(64) NOT NULL DEFAULT \'org_shalimar\'');
CALL AddColumnSafely('rate_negotiations', 'organization_id', 'VARCHAR(64) NOT NULL DEFAULT \'org_shalimar\'');
CALL AddColumnSafely('bid_negotiation_history', 'organization_id', 'VARCHAR(64) NOT NULL DEFAULT \'org_shalimar\'');
CALL AddColumnSafely('allocations', 'organization_id', 'VARCHAR(64) NOT NULL DEFAULT \'org_shalimar\'');
CALL AddColumnSafely('contracts', 'organization_id', 'VARCHAR(64) NOT NULL DEFAULT \'org_shalimar\'');

-- 5. SAFELY BACKFILL EXISTING PRODUCTION RECORDS
UPDATE `users` SET `organization_id` = 'org_shalimar' WHERE `organization_id` IS NULL OR `organization_id` = '';
UPDATE `transport_requirements` SET `organization_id` = 'org_shalimar' WHERE `organization_id` IS NULL OR `organization_id` = '';
UPDATE `transport_requirement_items` SET `organization_id` = 'org_shalimar' WHERE `organization_id` IS NULL OR `organization_id` = '';
UPDATE `rate_submissions` SET `organization_id` = 'org_shalimar' WHERE `organization_id` IS NULL OR `organization_id` = '';
UPDATE `truck_dispatches` SET `organization_id` = 'org_shalimar' WHERE `organization_id` IS NULL OR `organization_id` = '';
UPDATE `transporters` SET `organization_id` = 'org_shalimar' WHERE `organization_id` IS NULL OR `organization_id` = '';

-- 6. APPLY DEFENSIVE PERFORMANCE INDEXES
CALL AddIndexSafely('rate_submissions', 'idx_rs_trans_status', '`transporter_id`, `bid_status`');
CALL AddIndexSafely('rate_submissions', 'idx_rs_org', '`organization_id`');
CALL AddIndexSafely('transport_requirements', 'idx_tr_org', '`organization_id`');
CALL AddIndexSafely('truck_dispatches', 'idx_td_org', '`organization_id`');
CALL AddIndexSafely('truck_dispatches', 'idx_td_created_at', '`created_at`');
CALL AddIndexSafely('truck_dispatches', 'idx_td_dispatched_at', '`dispatched_at`');
CALL AddIndexSafely('truck_dispatches', 'idx_td_truck_no', '`truck_number`');

-- 7. CLEAN UP TEMPORARY MIGRATION PROCEDURES
DROP PROCEDURE IF EXISTS `AddColumnSafely`;
DROP PROCEDURE IF EXISTS `AddIndexSafely`;

SET FOREIGN_KEY_CHECKS = 1;
