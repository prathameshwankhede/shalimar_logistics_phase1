# Database Architecture Audit — Shalimar Logistics

**Audit Date**: August 25, 2026  
**Target Repository**: `prathameshwankhede/shalimar_logistics_phase1`  

---

## 1. Schema & Column Audit

### JSON / JSONB Column Analysis

| Table | Column | Type | Assessment & Classification | Recommended Action |
|---|---|---|---|---|
| `app_database` | `data` | `LONGTEXT` (JSON) | ❌ **Relational Data Anti-Pattern**: Stores full monolithic application state snapshot. | Migrate to pure relational queries against normalized tables. |
| `master_records` | `extra_data` | `JSON` | ✅ **Legitimate Dynamic Document Data**: Stores category-specific extra attributes (HSN codes, unit types, capacity MT). | Retain as JSON document column. |

---

## 2. Table Indexing & Key Audit

| Table | Primary Key | Existing Indexes | Missing Recommended Indexes |
|---|---|---|---|
| `app_database` | `id (VARCHAR 64)` | None | None |
| `users` | `id (VARCHAR 64)` | `UNIQUE KEY idx_users_username` | `KEY idx_users_role` |
| `transporters` | `id (VARCHAR 64)` | None | `KEY idx_transporters_code`, `KEY idx_transporters_status` |
| `rate_requests` | `id (VARCHAR 64)` | `idx_requests_status`, `idx_requests_no` | `KEY idx_requests_cities (origin_city, dest_city)` |
| `rate_submissions` | `id (VARCHAR 64)` | `idx_submissions_request`, `idx_submissions_transporter` | `KEY idx_submissions_status` |
| `master_records` | `id (INT AUTO_INC)` | `idx_masters_category` | `KEY idx_masters_code` |

---

## 3. Migration Strategy

To transition from the hybrid JSON blob model to 100% normalized MySQL:
1. Deprecate `app_database` table.
2. Implement direct SQL CRUD handlers for `allocations`, `contracts`, and `truck_dispatches`.
3. Add foreign key constraints between `rate_submissions` ➔ `rate_requests` and `rate_submissions` ➔ `transporters`.
