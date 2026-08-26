# JSON ➔ Relational Database Migration Strategy Report

**Audit Date**: August 26, 2026  
**Auditor**: Lead Database Architect  
**Target Repository**: `prathameshwankhede/shalimar_logistics_phase1`  

---

## 1. Executive Summary & Audit Purpose
A read-only audit of the production database structure was conducted to evaluate whether `app_database.data` (`LONGTEXT` JSON blob) is still serving as a source of truth for application entities and to formulate a safe, zero-data-loss migration strategy to 100% pure relational MySQL tables.

---

## 2. Assessment of `app_database.data`

### Is `app_database.data` Still Used as Source of Truth?
- **Hybrid Status**:
  - **Normalized Relational Tables**: Primary business data (`rate_requests`, `rate_submissions`, `users`, `transporters`, `master_records`) are written directly to normalized MySQL relational tables via parameterized queries.
  - **`app_database.data` Blob**: Currently holds general company settings (`do_master_settings`), `whatsapp_notifications`, and `security_audit_logs`.

---

## 3. Backend References Traced

The following file locations contain references to `app_database`:

1. **[`server/config/db.js`](file:///d:/shalimar-logistics/server/config/db.js#L58)**: Schema initialization (`CREATE TABLE IF NOT EXISTS app_database ...`).
2. **[`server/repositories/stateRepository.js`](file:///d:/shalimar-logistics/server/repositories/stateRepository.js#L25)**: State blob query (`SELECT data FROM app_database WHERE id = ?`).
3. **[`server/repositories/stateRepository.js`](file:///d:/shalimar-logistics/server/repositories/stateRepository.js#L39)**: State blob update (`INSERT INTO app_database ... ON DUPLICATE KEY UPDATE`).
4. **[`server/routes/api.js`](file:///d:/shalimar-logistics/server/routes/api.js#L157)**: State read fallback.
5. **[`server/routes/api.js`](file:///d:/shalimar-logistics/server/routes/api.js#L203)**: Security audit log retrieval.

---

## 4. Proposed Migration Strategy (JSON ➔ 100% Relational)

### Phase 1: Relational Table Expansion
Create dedicated relational MySQL tables to replace remaining JSON structures:

```sql
-- 1. Dedicated Security Audit Logs Table
CREATE TABLE IF NOT EXISTS security_audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  action VARCHAR(150) NOT NULL,
  username VARCHAR(100) DEFAULT NULL,
  user_role VARCHAR(50) DEFAULT NULL,
  status VARCHAR(100) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Dedicated Contracts & Allocations Table
CREATE TABLE IF NOT EXISTS contracts (
  id VARCHAR(64) PRIMARY KEY,
  contract_no VARCHAR(100) NOT NULL,
  request_id VARCHAR(64) NOT NULL,
  transporter_id VARCHAR(64) NOT NULL,
  allocated_qty DECIMAL(12,2) DEFAULT 0.00,
  rate_per_unit DECIMAL(12,2) DEFAULT 0.00,
  status VARCHAR(50) DEFAULT 'Active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_contracts_transporter (transporter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Phase 2: Data Extraction & Relational Seeding
- Extract existing audit logs and contract allocations out of `app_database.data` and insert into `security_audit_logs` and `contracts`.

### Phase 3: Codebase Migration & `app_database` Deprecation
- Update `server/repositories/stateRepository.js` to fetch audit logs directly from `security_audit_logs`.
- Deprecate `app_database` table once zero dependencies remain.

---

## 🛑 MANDATORY STEP FOR USER APPROVAL

> [!IMPORTANT]
> **NO CODE OR DATABASE SCHEMA CHANGES HAVE BEEN APPLIED.**  
> Pursuant to the explicit instruction: *"If migration is required, STOP and wait for my approval before modifying production"*, execution has paused.  
> Please review this report and confirm if you approve proceeding with Phase 1 migration.
