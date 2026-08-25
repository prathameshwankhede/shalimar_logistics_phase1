# Database Design Specification — Shalimar Logistics

## 1. Overview
The database layer uses Hostinger Managed MySQL (InnoDB Engine, `utf8mb4_unicode_ci` charset). Schema tables are automatically created on application boot using `CREATE TABLE IF NOT EXISTS`.

## 2. Table Schemas

### `users`
| Column | Type | Attributes | Description |
|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | User unique identifier |
| `username` | `VARCHAR(100)` | `NOT NULL, UNIQUE` | Login username / vendor code |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | bcrypt hashed password |
| `name` | `VARCHAR(150)` | `NOT NULL` | Full display name |
| `role` | `ENUM('admin', 'transporter')` | `NOT NULL` | Role permission level |
| `transporter_id` | `VARCHAR(64)` | `DEFAULT NULL` | Linked vendor ID |

### `transporters`
| Column | Type | Attributes | Description |
|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | Transporter unique ID |
| `company_name` | `VARCHAR(255)` | `NOT NULL` | Registered company name |
| `code` | `VARCHAR(50)` | `NOT NULL` | Vendor code (e.g. ABC001) |
| `mobile` | `VARCHAR(30)` | `DEFAULT NULL` | Contact mobile number |
| `email` | `VARCHAR(150)` | `DEFAULT NULL` | Contact email address |
| `status` | `ENUM('Active', 'Inactive')` | `DEFAULT 'Active'` | Vendor account status |

### `rate_requests`
| Column | Type | Attributes | Description |
|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | Requirement unique ID |
| `request_no` | `VARCHAR(100)` | `NOT NULL` | Indent reference number (SNPL/26-27/REQ-01/01) |
| `origin_city` | `VARCHAR(100)` | `DEFAULT NULL` | Loading city |
| `dest_city` | `VARCHAR(100)` | `DEFAULT NULL` | Unloading destination |
| `material_type` | `VARCHAR(255)` | `DEFAULT NULL` | Agri commodity / cargo name |
| `required_qty` | `DECIMAL(12,2)` | `DEFAULT 0.00` | Volume in MT |
| `target_date` | `VARCHAR(50)` | `DEFAULT NULL` | Target dispatch date string |
| `status` | `VARCHAR(50)` | `DEFAULT 'Open'` | Status (`Open`, `Awarded`, `Completed`) |

### `rate_submissions`
| Column | Type | Attributes | Description |
|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | Submission unique ID |
| `request_id` | `VARCHAR(64)` | `NOT NULL` | Linked rate_requests ID |
| `transporter_id` | `VARCHAR(64)` | `NOT NULL` | Bidding transporter ID |
| `rate_per_unit` | `DECIMAL(12,2)` | `NOT NULL` | Freight rate quoted per MT |
| `status` | `ENUM('Submitted', 'Accepted', 'Rejected', 'Counter')` | `DEFAULT 'Submitted'` | Bid status |

### `master_records`
| Column | Type | Attributes | Description |
|---|---|---|---|
| `id` | `INT` | `AUTO_INCREMENT PRIMARY KEY` | Record ID |
| `category` | `VARCHAR(50)` | `NOT NULL` | Master category (`product`, `cargo`, `company`, `city`, `title`) |
| `code` | `VARCHAR(50)` | `DEFAULT NULL` | Master item code |
| `name` | `VARCHAR(255)` | `NOT NULL` | Display name |
| `extra_data` | `JSON` | `DEFAULT NULL` | Category-specific JSON attributes |

### `app_database`
| Column | Type | Attributes | Description |
|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | State row key (`transflow-live-prod-v3`) |
| `data` | `LONGTEXT` | `NOT NULL` | JSON state backup string |
