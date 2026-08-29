-- ==================================================
-- SHALIMAR LOGISTICS / TRANSFLOW PHASE 1
-- Hostinger Native MySQL Full Database Snapshot (.sql)
-- Database: u704836459_shalimar_logi
-- Export Date: 2026-08-29 16:56:29 UTC
-- Total Discovered Tables: 8
-- ==================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Safe Drop Existing Tables in Child-First Dependency Order
DROP TABLE IF EXISTS `rate_negotiations`;
DROP TABLE IF EXISTS `bid_negotiation_history`;
DROP TABLE IF EXISTS `rate_submissions`;
DROP TABLE IF EXISTS `transport_requirement_items`;
DROP TABLE IF EXISTS `transport_requirements`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `company_units_plants`;
DROP TABLE IF EXISTS `transporters`;

-- ==================================================
-- Table structure for `transporters`
-- ==================================================
CREATE TABLE IF NOT EXISTS `transporters` (
  `id` varchar(64) NOT NULL,
  `company_name` varchar(255) NOT NULL,
  `code` varchar(50) NOT NULL,
  `contact_person` varchar(150) DEFAULT NULL,
  `mobile` varchar(30) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `gstin` varchar(50) DEFAULT NULL,
  `pan` varchar(50) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `username` varchar(100) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `status` enum('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_transporters_code` (`code`),
  UNIQUE KEY `uq_transporters_username` (`username`),
  KEY `idx_transporters_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data inserts for `transporters` (3 rows)
INSERT INTO `transporters` (`id`, `company_name`, `code`, `contact_person`, `mobile`, `email`, `gstin`, `pan`, `address`, `username`, `status`, `created_at`, `updated_at`) VALUES ('trans_1787987173256', 'malpani', 'M001', 'malpani', '9960071332', 'prathmeshwankhede22@gmail.com', NULL, NULL, 'IUDP Katol rural hospital road', 'M001', 'Active', '2026-08-29 07:06:13', '2026-08-29 16:24:09');
INSERT INTO `transporters` (`id`, `company_name`, `code`, `contact_person`, `mobile`, `email`, `gstin`, `pan`, `address`, `username`, `status`, `created_at`, `updated_at`) VALUES ('trans_1787987207430', 'sanjay', 'S001', 'Prathmesh Wankhede', '9960071332', 'prathmeshwankhede22@gmail.com', NULL, NULL, 'IUDP Katol rural hospital road', 'S001', 'Active', '2026-08-29 07:06:47', '2026-08-29 16:24:09');
INSERT INTO `transporters` (`id`, `company_name`, `code`, `contact_person`, `mobile`, `email`, `gstin`, `pan`, `address`, `username`, `status`, `created_at`, `updated_at`) VALUES ('trans_1787987244713', 'ram', 'R001', 'ram', '9960071332', 'prathmeshwankhede22@gmail.com', NULL, NULL, 'IUDP Katol rural hospital road', 'R001', 'Active', '2026-08-29 07:07:25', '2026-08-29 16:24:09');

-- ==================================================
-- Table structure for `company_units_plants`
-- ==================================================
CREATE TABLE IF NOT EXISTS `company_units_plants` (
  `id` varchar(100) NOT NULL,
  `company_name` varchar(255) NOT NULL,
  `registered_address` text DEFAULT NULL,
  `gstin` varchar(30) DEFAULT NULL,
  `pan` varchar(30) DEFAULT NULL,
  `contact_name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `mobile` varchar(50) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `district` varchar(100) DEFAULT NULL,
  `pin_code` varchar(20) DEFAULT NULL,
  `pickup_origin` varchar(255) DEFAULT NULL,
  `drop_location` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data inserts for `company_units_plants` (4 rows)
INSERT INTO `company_units_plants` (`id`, `company_name`, `registered_address`, `gstin`, `pan`, `contact_name`, `email`, `mobile`, `state`, `city`, `district`, `pin_code`, `pickup_origin`, `drop_location`, `created_at`, `updated_at`) VALUES ('cup_1787978523432_796', 'Shalimar Plant Unit 3043', '', NULL, NULL, '', NULL, '', 'Maharashtra', '', '', '', 'katol', 'nagpur', '2026-08-29 04:42:03', '2026-08-29 04:42:03');
INSERT INTO `company_units_plants` (`id`, `company_name`, `registered_address`, `gstin`, `pan`, `contact_name`, `email`, `mobile`, `state`, `city`, `district`, `pin_code`, `pickup_origin`, `drop_location`, `created_at`, `updated_at`) VALUES ('cup_1787978536146_129', 'Shalimar Plant Unit 5702', '', NULL, NULL, '', NULL, '', 'Maharashtra', '', '', '', 'pune', 'mumbai', '2026-08-29 04:42:16', '2026-08-29 04:42:16');
INSERT INTO `company_units_plants` (`id`, `company_name`, `registered_address`, `gstin`, `pan`, `contact_name`, `email`, `mobile`, `state`, `city`, `district`, `pin_code`, `pickup_origin`, `drop_location`, `created_at`, `updated_at`) VALUES ('cup_1787978545832_867', 'Shalimar Plant Unit 5457', '', NULL, NULL, '', NULL, '', 'Maharashtra', '', '', '', NULL, 'yenva', '2026-08-29 04:42:25', '2026-08-29 04:42:25');
INSERT INTO `company_units_plants` (`id`, `company_name`, `registered_address`, `gstin`, `pan`, `contact_name`, `email`, `mobile`, `state`, `city`, `district`, `pin_code`, `pickup_origin`, `drop_location`, `created_at`, `updated_at`) VALUES ('cup_1787978561426_485', 'Shalimar Plant Unit 1024', '', NULL, NULL, '', NULL, '', 'Maharashtra', '', '', '', NULL, 'nashik', '2026-08-29 04:42:41', '2026-08-29 04:42:41');

-- ==================================================
-- Table structure for `products`
-- ==================================================
CREATE TABLE IF NOT EXISTS `products` (
  `id` varchar(100) NOT NULL,
  `code` varchar(100) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `category` varchar(255) DEFAULT NULL,
  `hsn_code` varchar(50) DEFAULT NULL,
  `default_unit` varchar(50) DEFAULT 'MT',
  `status` varchar(50) DEFAULT 'Active',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data inserts for `products` (2 rows)
INSERT INTO `products` (`id`, `code`, `name`, `category`, `hsn_code`, `default_unit`, `status`, `created_at`, `updated_at`) VALUES ('prod_1787978583784', 'prod_1787978583784', 'soya', 'oil', '8888888', 'MT', 'Active', '2026-08-29 04:43:03', '2026-08-29 04:43:03');
INSERT INTO `products` (`id`, `code`, `name`, `category`, `hsn_code`, `default_unit`, `status`, `created_at`, `updated_at`) VALUES ('prod_1787978597524', 'prod_1787978597524', 'fruit', 'oil', '99993', 'MT', 'Active', '2026-08-29 04:43:17', '2026-08-29 04:43:17');

-- ==================================================
-- Table structure for `transport_requirements`
-- ==================================================
CREATE TABLE IF NOT EXISTS `transport_requirements` (
  `id` varchar(100) NOT NULL,
  `req_no` varchar(100) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `pickup_origin` varchar(255) NOT NULL,
  `drop_location` varchar(255) NOT NULL,
  `product_name` varchar(255) NOT NULL,
  `quantity_mt` decimal(12,3) NOT NULL,
  `unit` varchar(50) DEFAULT 'MT',
  `target_date` date NOT NULL,
  `status` varchar(50) DEFAULT 'Active',
  `submitted_bids_count` int(11) DEFAULT 0,
  `approval_status` varchar(50) DEFAULT 'Pending',
  `created_by` varchar(100) DEFAULT 'admin',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `total_quantity_mt` decimal(12,3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `req_no` (`req_no`),
  KEY `idx_req_status_created` (`status`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data inserts for `transport_requirements` (1 rows)
INSERT INTO `transport_requirements` (`id`, `req_no`, `title`, `pickup_origin`, `drop_location`, `product_name`, `quantity_mt`, `unit`, `target_date`, `status`, `submitted_bids_count`, `approval_status`, `created_by`, `created_at`, `updated_at`, `total_quantity_mt`) VALUES ('req_1788020602290_rkp6', 'SNPL/26-27/REQ-0001', 'Nagpur (MIDC) ➔ nashik', 'Nagpur (MIDC)', 'nashik', '', '0.000', 'MT', '2026-08-29 00:00:00', 'Active', 0, 'Pending', 'admin', '2026-08-29 16:23:22', '2026-08-29 16:23:22', NULL);

-- ==================================================
-- Table structure for `transport_requirement_items`
-- ==================================================
CREATE TABLE IF NOT EXISTS `transport_requirement_items` (
  `id` varchar(100) NOT NULL,
  `requirement_id` varchar(100) NOT NULL,
  `product_name` varchar(255) NOT NULL,
  `quantity_mt` decimal(12,3) NOT NULL,
  `unit` varchar(50) DEFAULT 'MT',
  `pickup_origin` varchar(255) DEFAULT NULL,
  `drop_location` varchar(255) DEFAULT NULL,
  `hsn_code` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `sub_indent_no` varchar(100) DEFAULT NULL,
  `target_date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_req_id` (`requirement_id`),
  KEY `idx_sub_indent_no` (`sub_indent_no`),
  KEY `idx_req_item_lookup` (`requirement_id`,`id`),
  CONSTRAINT `fk_tri_req` FOREIGN KEY (`requirement_id`) REFERENCES `transport_requirements` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data inserts for `transport_requirement_items` (1 rows)
INSERT INTO `transport_requirement_items` (`id`, `requirement_id`, `product_name`, `quantity_mt`, `unit`, `pickup_origin`, `drop_location`, `hsn_code`, `created_at`, `updated_at`, `sub_indent_no`, `target_date`) VALUES ('req_item_1788020602290_0_xtr', 'req_1788020602290_rkp6', 'soya', '55.000', 'MT', 'Nagpur (MIDC)', 'nashik', '8888888', '2026-08-29 16:23:22', '2026-08-29 16:23:22', 'SNPL/26-27/REQ-0001/01', '2026-08-29 00:00:00');

-- ==================================================
-- Table structure for `rate_submissions`
-- ==================================================
CREATE TABLE IF NOT EXISTS `rate_submissions` (
  `id` varchar(100) NOT NULL,
  `requirement_id` varchar(100) NOT NULL,
  `transporter_id` varchar(100) NOT NULL,
  `rate_per_mt` decimal(12,2) NOT NULL,
  `quoted_quantity_mt` decimal(12,3) DEFAULT NULL,
  `total_amount` decimal(14,2) DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `status` varchar(50) DEFAULT 'Submitted',
  `submitted_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `item_id` varchar(100) DEFAULT 'MAIN',
  `original_rate` decimal(12,2) DEFAULT NULL,
  `original_rate_per_mt` decimal(12,2) DEFAULT NULL,
  `counter_rate` decimal(12,2) DEFAULT NULL,
  `final_rate` decimal(12,2) DEFAULT NULL,
  `final_rate_per_mt` decimal(12,2) DEFAULT NULL,
  `bid_status` varchar(50) DEFAULT 'Submitted',
  `negotiation_status` varchar(50) DEFAULT 'Submitted',
  `countered_by` varchar(50) DEFAULT NULL,
  `counter_message` text DEFAULT NULL,
  `counter_updated_at` datetime DEFAULT NULL,
  `finalized_at` datetime DEFAULT NULL,
  `counter_offer_rate` decimal(12,2) DEFAULT NULL,
  `counter_offer_status` varchar(50) DEFAULT NULL,
  `counter_offer_at` datetime DEFAULT NULL,
  `counter_offer_by` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_req_item_trans` (`requirement_id`,`item_id`,`transporter_id`),
  KEY `idx_rate_requirement` (`requirement_id`),
  KEY `idx_rate_transporter` (`transporter_id`),
  KEY `idx_rate_item` (`item_id`),
  CONSTRAINT `fk_rs_item` FOREIGN KEY (`item_id`) REFERENCES `transport_requirement_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rs_req` FOREIGN KEY (`requirement_id`) REFERENCES `transport_requirements` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data inserts for `rate_submissions` (3 rows)
INSERT INTO `rate_submissions` (`id`, `requirement_id`, `transporter_id`, `rate_per_mt`, `quoted_quantity_mt`, `total_amount`, `remarks`, `status`, `submitted_at`, `updated_at`, `item_id`, `original_rate`, `original_rate_per_mt`, `counter_rate`, `final_rate`, `final_rate_per_mt`, `bid_status`, `negotiation_status`, `countered_by`, `counter_message`, `counter_updated_at`, `finalized_at`, `counter_offer_rate`, `counter_offer_status`, `counter_offer_at`, `counter_offer_by`) VALUES ('rate_sub_trans_1787987173256_req_item_1788020602290_0_xtr_1788020637285_ah7eo', 'req_1788020602290_rkp6', 'trans_1787987173256', '2.00', '55.000', '110.00', NULL, 'Submitted', '2026-08-29 16:23:57', '2026-08-29 16:44:46', 'req_item_1788020602290_0_xtr', '22.00', NULL, '2.00', '2.00', NULL, 'COUNTER_ACCEPTED', 'COUNTER_ACCEPTED', 'ADMIN', NULL, '2026-08-29 16:42:47', '2026-08-29 16:44:46', '2.00', 'ACCEPTED', '2026-08-29 16:42:47', 'ADMIN');
INSERT INTO `rate_submissions` (`id`, `requirement_id`, `transporter_id`, `rate_per_mt`, `quoted_quantity_mt`, `total_amount`, `remarks`, `status`, `submitted_at`, `updated_at`, `item_id`, `original_rate`, `original_rate_per_mt`, `counter_rate`, `final_rate`, `final_rate_per_mt`, `bid_status`, `negotiation_status`, `countered_by`, `counter_message`, `counter_updated_at`, `finalized_at`, `counter_offer_rate`, `counter_offer_status`, `counter_offer_at`, `counter_offer_by`) VALUES ('rate_sub_trans_1787987207430_req_item_1788020602290_0_xtr_1788020649711_s437v', 'req_1788020602290_rkp6', 'trans_1787987207430', '12.00', '55.000', '660.00', NULL, 'Submitted', '2026-08-29 16:24:09', '2026-08-29 16:42:47', 'req_item_1788020602290_0_xtr', '12.00', NULL, '2.00', NULL, NULL, 'COUNTER_OFFERED', 'COUNTER_OFFERED', 'ADMIN', NULL, '2026-08-29 16:42:47', NULL, '2.00', 'PENDING', '2026-08-29 16:42:47', 'ADMIN');
INSERT INTO `rate_submissions` (`id`, `requirement_id`, `transporter_id`, `rate_per_mt`, `quoted_quantity_mt`, `total_amount`, `remarks`, `status`, `submitted_at`, `updated_at`, `item_id`, `original_rate`, `original_rate_per_mt`, `counter_rate`, `final_rate`, `final_rate_per_mt`, `bid_status`, `negotiation_status`, `countered_by`, `counter_message`, `counter_updated_at`, `finalized_at`, `counter_offer_rate`, `counter_offer_status`, `counter_offer_at`, `counter_offer_by`) VALUES ('rate_sub_trans_1787987244713_req_item_1788020602290_0_xtr_1788020643538_9adad', 'req_1788020602290_rkp6', 'trans_1787987244713', '15.00', '55.000', '825.00', 'Final Production Verification Test', 'Submitted', '2026-08-29 16:38:28', '2026-08-29 16:42:47', 'req_item_1788020602290_0_xtr', '33.00', NULL, '2.00', '15.00', NULL, 'COUNTER_OFFERED', 'COUNTER_OFFERED', 'ADMIN', NULL, '2026-08-29 16:42:47', '2026-08-29 16:38:28', '2.00', 'PENDING', '2026-08-29 16:42:47', 'ADMIN');

-- ==================================================
-- Table structure for `bid_negotiation_history`
-- ==================================================
CREATE TABLE IF NOT EXISTS `bid_negotiation_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `rate_submission_id` varchar(100) NOT NULL,
  `requirement_id` varchar(100) NOT NULL,
  `item_id` varchar(100) DEFAULT NULL,
  `transporter_id` varchar(100) NOT NULL,
  `action_type` varchar(50) NOT NULL,
  `previous_rate` decimal(12,2) DEFAULT NULL,
  `new_rate` decimal(12,2) DEFAULT NULL,
  `actor_type` enum('ADMIN','TRANSPORTER') NOT NULL,
  `actor_id` varchar(100) DEFAULT NULL,
  `message` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_bnh_submission` (`rate_submission_id`),
  KEY `idx_bnh_req_item` (`requirement_id`,`item_id`),
  KEY `idx_bnh_transporter` (`transporter_id`)
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data inserts for `bid_negotiation_history` (17 rows)
INSERT INTO `bid_negotiation_history` (`id`, `rate_submission_id`, `requirement_id`, `item_id`, `transporter_id`, `action_type`, `previous_rate`, `new_rate`, `actor_type`, `actor_id`, `message`, `created_at`) VALUES (37, 'rate_sub_trans_1787987173256_req_item_1788020602290_0_xtr_1788020637285_ah7eo', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987173256', 'INITIAL_BID', NULL, '22.00', 'TRANSPORTER', 'trans_1787987173256', 'Initial bid submitted by transporter', '2026-08-29 16:23:57');
INSERT INTO `bid_negotiation_history` (`id`, `rate_submission_id`, `requirement_id`, `item_id`, `transporter_id`, `action_type`, `previous_rate`, `new_rate`, `actor_type`, `actor_id`, `message`, `created_at`) VALUES (38, 'rate_sub_trans_1787987244713_req_item_1788020602290_0_xtr_1788020643538_9adad', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987244713', 'INITIAL_BID', NULL, '33.00', 'TRANSPORTER', 'trans_1787987244713', 'Initial bid submitted by transporter', '2026-08-29 16:24:03');
INSERT INTO `bid_negotiation_history` (`id`, `rate_submission_id`, `requirement_id`, `item_id`, `transporter_id`, `action_type`, `previous_rate`, `new_rate`, `actor_type`, `actor_id`, `message`, `created_at`) VALUES (39, 'rate_sub_trans_1787987207430_req_item_1788020602290_0_xtr_1788020649711_s437v', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987207430', 'INITIAL_BID', NULL, '12.00', 'TRANSPORTER', 'trans_1787987207430', 'Initial bid submitted by transporter', '2026-08-29 16:24:09');
INSERT INTO `bid_negotiation_history` (`id`, `rate_submission_id`, `requirement_id`, `item_id`, `transporter_id`, `action_type`, `previous_rate`, `new_rate`, `actor_type`, `actor_id`, `message`, `created_at`) VALUES (40, 'rate_sub_trans_1787987173256_req_item_1788020602290_0_xtr_1788020637285_ah7eo', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987173256', 'ADMIN_COUNTER', '22.00', '11.00', 'ADMIN', 'admin', 'Admin proposed counter offer of ₹11/MT to all bidders', '2026-08-29 16:24:35');
INSERT INTO `bid_negotiation_history` (`id`, `rate_submission_id`, `requirement_id`, `item_id`, `transporter_id`, `action_type`, `previous_rate`, `new_rate`, `actor_type`, `actor_id`, `message`, `created_at`) VALUES (41, 'rate_sub_trans_1787987207430_req_item_1788020602290_0_xtr_1788020649711_s437v', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987207430', 'ADMIN_COUNTER', '12.00', '11.00', 'ADMIN', 'admin', 'Admin proposed counter offer of ₹11/MT to all bidders', '2026-08-29 16:24:35');
INSERT INTO `bid_negotiation_history` (`id`, `rate_submission_id`, `requirement_id`, `item_id`, `transporter_id`, `action_type`, `previous_rate`, `new_rate`, `actor_type`, `actor_id`, `message`, `created_at`) VALUES (42, 'rate_sub_trans_1787987244713_req_item_1788020602290_0_xtr_1788020643538_9adad', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987244713', 'ADMIN_COUNTER', '33.00', '11.00', 'ADMIN', 'admin', 'Admin proposed counter offer of ₹11/MT to all bidders', '2026-08-29 16:24:35');
INSERT INTO `bid_negotiation_history` (`id`, `rate_submission_id`, `requirement_id`, `item_id`, `transporter_id`, `action_type`, `previous_rate`, `new_rate`, `actor_type`, `actor_id`, `message`, `created_at`) VALUES (43, 'rate_sub_trans_1787987244713_req_item_1788020602290_0_xtr_1788020643538_9adad', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987244713', 'ADMIN_COUNTER', '11.00', '15.00', 'ADMIN', 'admin', 'Production verification counter ₹15', '2026-08-29 16:37:29');
INSERT INTO `bid_negotiation_history` (`id`, `rate_submission_id`, `requirement_id`, `item_id`, `transporter_id`, `action_type`, `previous_rate`, `new_rate`, `actor_type`, `actor_id`, `message`, `created_at`) VALUES (44, 'rate_sub_trans_1787987244713_req_item_1788020602290_0_xtr_1788020643538_9adad', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987244713', 'COUNTER_ACCEPTED', '15.00', '15.00', 'TRANSPORTER', 'admin', 'Transporter accepted counter offer of ₹15/MT', '2026-08-29 16:37:30');
INSERT INTO `bid_negotiation_history` (`id`, `rate_submission_id`, `requirement_id`, `item_id`, `transporter_id`, `action_type`, `previous_rate`, `new_rate`, `actor_type`, `actor_id`, `message`, `created_at`) VALUES (45, 'rate_sub_trans_1787987244713_req_item_1788020602290_0_xtr_1788020643538_9adad', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987244713', 'ADMIN_COUNTER', '15.00', '15.00', 'ADMIN', 'admin', 'Admin proposed counter offer of ₹15/MT', '2026-08-29 16:38:28');
INSERT INTO `bid_negotiation_history` (`id`, `rate_submission_id`, `requirement_id`, `item_id`, `transporter_id`, `action_type`, `previous_rate`, `new_rate`, `actor_type`, `actor_id`, `message`, `created_at`) VALUES (46, 'rate_sub_trans_1787987244713_req_item_1788020602290_0_xtr_1788020643538_9adad', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987244713', 'COUNTER_ACCEPTED', '15.00', '15.00', 'TRANSPORTER', 'admin', 'Transporter accepted counter offer of ₹15/MT', '2026-08-29 16:38:28');
INSERT INTO `bid_negotiation_history` (`id`, `rate_submission_id`, `requirement_id`, `item_id`, `transporter_id`, `action_type`, `previous_rate`, `new_rate`, `actor_type`, `actor_id`, `message`, `created_at`) VALUES (47, 'rate_sub_trans_1787987173256_req_item_1788020602290_0_xtr_1788020637285_ah7eo', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987173256', 'ADMIN_COUNTER', '11.00', '4.00', 'ADMIN', 'admin', 'Admin proposed counter offer of ₹4/MT to all bidders', '2026-08-29 16:42:12');
INSERT INTO `bid_negotiation_history` (`id`, `rate_submission_id`, `requirement_id`, `item_id`, `transporter_id`, `action_type`, `previous_rate`, `new_rate`, `actor_type`, `actor_id`, `message`, `created_at`) VALUES (48, 'rate_sub_trans_1787987207430_req_item_1788020602290_0_xtr_1788020649711_s437v', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987207430', 'ADMIN_COUNTER', '11.00', '4.00', 'ADMIN', 'admin', 'Admin proposed counter offer of ₹4/MT to all bidders', '2026-08-29 16:42:12');
INSERT INTO `bid_negotiation_history` (`id`, `rate_submission_id`, `requirement_id`, `item_id`, `transporter_id`, `action_type`, `previous_rate`, `new_rate`, `actor_type`, `actor_id`, `message`, `created_at`) VALUES (49, 'rate_sub_trans_1787987244713_req_item_1788020602290_0_xtr_1788020643538_9adad', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987244713', 'ADMIN_COUNTER', '15.00', '4.00', 'ADMIN', 'admin', 'Admin proposed counter offer of ₹4/MT to all bidders', '2026-08-29 16:42:12');
INSERT INTO `bid_negotiation_history` (`id`, `rate_submission_id`, `requirement_id`, `item_id`, `transporter_id`, `action_type`, `previous_rate`, `new_rate`, `actor_type`, `actor_id`, `message`, `created_at`) VALUES (50, 'rate_sub_trans_1787987173256_req_item_1788020602290_0_xtr_1788020637285_ah7eo', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987173256', 'ADMIN_COUNTER', '4.00', '2.00', 'ADMIN', 'admin', 'Admin proposed counter offer of ₹2/MT to all bidders', '2026-08-29 16:42:47');
INSERT INTO `bid_negotiation_history` (`id`, `rate_submission_id`, `requirement_id`, `item_id`, `transporter_id`, `action_type`, `previous_rate`, `new_rate`, `actor_type`, `actor_id`, `message`, `created_at`) VALUES (51, 'rate_sub_trans_1787987207430_req_item_1788020602290_0_xtr_1788020649711_s437v', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987207430', 'ADMIN_COUNTER', '4.00', '2.00', 'ADMIN', 'admin', 'Admin proposed counter offer of ₹2/MT to all bidders', '2026-08-29 16:42:47');
INSERT INTO `bid_negotiation_history` (`id`, `rate_submission_id`, `requirement_id`, `item_id`, `transporter_id`, `action_type`, `previous_rate`, `new_rate`, `actor_type`, `actor_id`, `message`, `created_at`) VALUES (52, 'rate_sub_trans_1787987244713_req_item_1788020602290_0_xtr_1788020643538_9adad', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987244713', 'ADMIN_COUNTER', '4.00', '2.00', 'ADMIN', 'admin', 'Admin proposed counter offer of ₹2/MT to all bidders', '2026-08-29 16:42:47');
INSERT INTO `bid_negotiation_history` (`id`, `rate_submission_id`, `requirement_id`, `item_id`, `transporter_id`, `action_type`, `previous_rate`, `new_rate`, `actor_type`, `actor_id`, `message`, `created_at`) VALUES (53, 'rate_sub_trans_1787987173256_req_item_1788020602290_0_xtr_1788020637285_ah7eo', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987173256', 'COUNTER_ACCEPTED', '2.00', '2.00', 'TRANSPORTER', 'admin', 'Transporter accepted counter offer of ₹2/MT', '2026-08-29 16:44:46');

-- ==================================================
-- Table structure for `rate_negotiations`
-- ==================================================
CREATE TABLE IF NOT EXISTS `rate_negotiations` (
  `id` varchar(100) NOT NULL,
  `requirement_id` varchar(100) NOT NULL,
  `item_id` varchar(100) NOT NULL,
  `transporter_id` varchar(100) NOT NULL,
  `rate_submission_id` varchar(100) NOT NULL,
  `action_type` varchar(50) NOT NULL,
  `offered_rate` decimal(12,2) DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_negotiation_requirement` (`requirement_id`),
  KEY `idx_negotiation_item` (`item_id`),
  KEY `idx_negotiation_transporter` (`transporter_id`),
  KEY `idx_negotiation_submission` (`rate_submission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data inserts for `rate_negotiations` (17 rows)
INSERT INTO `rate_negotiations` (`id`, `requirement_id`, `item_id`, `transporter_id`, `rate_submission_id`, `action_type`, `offered_rate`, `remarks`, `created_by`, `created_at`) VALUES ('neg_1788020637286_2zmt2', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987173256', 'rate_sub_trans_1787987173256_req_item_1788020602290_0_xtr_1788020637285_ah7eo', 'INITIAL_QUOTE', '22.00', 'Initial quote submitted by transporter', 'trans_1787987173256', '2026-08-29 16:23:57');
INSERT INTO `rate_negotiations` (`id`, `requirement_id`, `item_id`, `transporter_id`, `rate_submission_id`, `action_type`, `offered_rate`, `remarks`, `created_by`, `created_at`) VALUES ('neg_1788020643538_vr3vu', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987244713', 'rate_sub_trans_1787987244713_req_item_1788020602290_0_xtr_1788020643538_9adad', 'INITIAL_QUOTE', '33.00', 'Initial quote submitted by transporter', 'trans_1787987244713', '2026-08-29 16:24:03');
INSERT INTO `rate_negotiations` (`id`, `requirement_id`, `item_id`, `transporter_id`, `rate_submission_id`, `action_type`, `offered_rate`, `remarks`, `created_by`, `created_at`) VALUES ('neg_1788020649712_qchur', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987207430', 'rate_sub_trans_1787987207430_req_item_1788020602290_0_xtr_1788020649711_s437v', 'INITIAL_QUOTE', '12.00', 'Initial quote submitted by transporter', 'trans_1787987207430', '2026-08-29 16:24:09');
INSERT INTO `rate_negotiations` (`id`, `requirement_id`, `item_id`, `transporter_id`, `rate_submission_id`, `action_type`, `offered_rate`, `remarks`, `created_by`, `created_at`) VALUES ('neg_1788020675950_yykrl', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987173256', 'rate_sub_trans_1787987173256_req_item_1788020602290_0_xtr_1788020637285_ah7eo', 'ADMIN_COUNTER', '11.00', NULL, 'admin', '2026-08-29 16:24:35');
INSERT INTO `rate_negotiations` (`id`, `requirement_id`, `item_id`, `transporter_id`, `rate_submission_id`, `action_type`, `offered_rate`, `remarks`, `created_by`, `created_at`) VALUES ('neg_1788020675951_r3k93', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987207430', 'rate_sub_trans_1787987207430_req_item_1788020602290_0_xtr_1788020649711_s437v', 'ADMIN_COUNTER', '11.00', NULL, 'admin', '2026-08-29 16:24:35');
INSERT INTO `rate_negotiations` (`id`, `requirement_id`, `item_id`, `transporter_id`, `rate_submission_id`, `action_type`, `offered_rate`, `remarks`, `created_by`, `created_at`) VALUES ('neg_1788020675952_a0xfh', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987244713', 'rate_sub_trans_1787987244713_req_item_1788020602290_0_xtr_1788020643538_9adad', 'ADMIN_COUNTER', '11.00', NULL, 'admin', '2026-08-29 16:24:35');
INSERT INTO `rate_negotiations` (`id`, `requirement_id`, `item_id`, `transporter_id`, `rate_submission_id`, `action_type`, `offered_rate`, `remarks`, `created_by`, `created_at`) VALUES ('neg_1788021449905_da8wv', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987244713', 'rate_sub_trans_1787987244713_req_item_1788020602290_0_xtr_1788020643538_9adad', 'ADMIN_COUNTER', '15.00', 'Production verification counter ₹15', 'admin', '2026-08-29 16:37:29');
INSERT INTO `rate_negotiations` (`id`, `requirement_id`, `item_id`, `transporter_id`, `rate_submission_id`, `action_type`, `offered_rate`, `remarks`, `created_by`, `created_at`) VALUES ('neg_1788021450055_1hu66', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987244713', 'rate_sub_trans_1787987244713_req_item_1788020602290_0_xtr_1788020643538_9adad', 'COUNTER_ACCEPTED', '15.00', 'Accepted counter offer', 'admin', '2026-08-29 16:37:30');
INSERT INTO `rate_negotiations` (`id`, `requirement_id`, `item_id`, `transporter_id`, `rate_submission_id`, `action_type`, `offered_rate`, `remarks`, `created_by`, `created_at`) VALUES ('neg_1788021508193_j6xq4', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987244713', 'rate_sub_trans_1787987244713_req_item_1788020602290_0_xtr_1788020643538_9adad', 'ADMIN_COUNTER', '15.00', 'Admin proposed counter offer of ₹15/MT', 'admin', '2026-08-29 16:38:28');
INSERT INTO `rate_negotiations` (`id`, `requirement_id`, `item_id`, `transporter_id`, `rate_submission_id`, `action_type`, `offered_rate`, `remarks`, `created_by`, `created_at`) VALUES ('neg_1788021508339_ce2dz', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987244713', 'rate_sub_trans_1787987244713_req_item_1788020602290_0_xtr_1788020643538_9adad', 'COUNTER_ACCEPTED', '15.00', 'Accepted counter offer', 'admin', '2026-08-29 16:38:28');
INSERT INTO `rate_negotiations` (`id`, `requirement_id`, `item_id`, `transporter_id`, `rate_submission_id`, `action_type`, `offered_rate`, `remarks`, `created_by`, `created_at`) VALUES ('neg_1788021732265_2kg5r', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987173256', 'rate_sub_trans_1787987173256_req_item_1788020602290_0_xtr_1788020637285_ah7eo', 'ADMIN_COUNTER', '4.00', NULL, 'admin', '2026-08-29 16:42:12');
INSERT INTO `rate_negotiations` (`id`, `requirement_id`, `item_id`, `transporter_id`, `rate_submission_id`, `action_type`, `offered_rate`, `remarks`, `created_by`, `created_at`) VALUES ('neg_1788021732267_92x4d', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987207430', 'rate_sub_trans_1787987207430_req_item_1788020602290_0_xtr_1788020649711_s437v', 'ADMIN_COUNTER', '4.00', NULL, 'admin', '2026-08-29 16:42:12');
INSERT INTO `rate_negotiations` (`id`, `requirement_id`, `item_id`, `transporter_id`, `rate_submission_id`, `action_type`, `offered_rate`, `remarks`, `created_by`, `created_at`) VALUES ('neg_1788021732268_1f2ci', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987244713', 'rate_sub_trans_1787987244713_req_item_1788020602290_0_xtr_1788020643538_9adad', 'ADMIN_COUNTER', '4.00', NULL, 'admin', '2026-08-29 16:42:12');
INSERT INTO `rate_negotiations` (`id`, `requirement_id`, `item_id`, `transporter_id`, `rate_submission_id`, `action_type`, `offered_rate`, `remarks`, `created_by`, `created_at`) VALUES ('neg_1788021767428_5kt3t', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987173256', 'rate_sub_trans_1787987173256_req_item_1788020602290_0_xtr_1788020637285_ah7eo', 'ADMIN_COUNTER', '2.00', NULL, 'admin', '2026-08-29 16:42:47');
INSERT INTO `rate_negotiations` (`id`, `requirement_id`, `item_id`, `transporter_id`, `rate_submission_id`, `action_type`, `offered_rate`, `remarks`, `created_by`, `created_at`) VALUES ('neg_1788021767429_ufigx', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987207430', 'rate_sub_trans_1787987207430_req_item_1788020602290_0_xtr_1788020649711_s437v', 'ADMIN_COUNTER', '2.00', NULL, 'admin', '2026-08-29 16:42:47');
INSERT INTO `rate_negotiations` (`id`, `requirement_id`, `item_id`, `transporter_id`, `rate_submission_id`, `action_type`, `offered_rate`, `remarks`, `created_by`, `created_at`) VALUES ('neg_1788021767430_jk4gq', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987244713', 'rate_sub_trans_1787987244713_req_item_1788020602290_0_xtr_1788020643538_9adad', 'ADMIN_COUNTER', '2.00', NULL, 'admin', '2026-08-29 16:42:47');
INSERT INTO `rate_negotiations` (`id`, `requirement_id`, `item_id`, `transporter_id`, `rate_submission_id`, `action_type`, `offered_rate`, `remarks`, `created_by`, `created_at`) VALUES ('neg_1788021886874_q4ylm', 'req_1788020602290_rkp6', 'req_item_1788020602290_0_xtr', 'trans_1787987173256', 'rate_sub_trans_1787987173256_req_item_1788020602290_0_xtr_1788020637285_ah7eo', 'COUNTER_ACCEPTED', '2.00', 'Accepted counter offer', 'admin', '2026-08-29 16:44:46');

SET FOREIGN_KEY_CHECKS = 1;
-- Snapshot Dump Complete. Total Rows Exported: 48