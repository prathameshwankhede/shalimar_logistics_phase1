# SAFE MIGRATION PLAN: TransFlow Logistics Non-Breaking System Hardening

## 1. Objectives & Ground Rules
- Strictly preserve all existing UI/UX elements, styling, buttons, workflows, and routes.
- Execute zero-downtime, backward-compatible enhancements.
- Eliminate security vulnerabilities (admin bypasses, plaintext passwords, arbitrary SQL execution).
- Ensure data consistency with database transactions and safe foreign keys.
- Run comprehensive regression tests after every phase.

## 2. Phased Execution Roadmap

### Phase 1: Authentication & Authorization Security
- **Target:** server/routes/auth.js, server/middleware/auth.js, src/context/AuthContext.jsx, src/components/AdminDashboard.jsx
- **Actions:**
  1. Remove hardcoded strings 'admin123', 'admin' from auth logic and verification dialogs.
  2. Implement safe on-login password migration: if a legacy user has plaintext password, verify it once, immediately hash it with bcryptjs (rounds=10), update the database row, and clear the plaintext column.
  3. Validate JWT_SECRET on server start; throw an explicit error in production if unset.
  4. Ensure RBAC middleware (requireRole('admin')) is placed on sensitive mutation routes.

### Phase 2: Transactional Bulk Rate Submission
- **Target:** server/routes/api.js, src/components/TransporterPortal.jsx
- **Actions:**
  1. Add endpoint POST /api/rate-submissions/batch accepting an array of submissions.
  2. Validate all submissions upfront; return 400 if any are malformed.
  3. Wrap all inserts in a single transaction (conn.beginTransaction()). Rollback on any failure.
  4. Update TransporterPortal.jsx handleBatchSubmitAll to call the batch endpoint instead of sequential loop.
  5. Keep existing POST /api/rate-submissions working for backward compatibility.

### Phase 3: Organization & Data Isolation
- **Target:** database/schema.sql, server/routes/api.js, server/routes/auth.js, server/middleware/auth.js
- **Actions:**
  1. Create organizations table (id, name, status, created_at, updated_at).
  2. Insert default organization 'org_shalimar' ('Shalimar Nutrients Pvt Ltd').
  3. Add nullable organization_id column to core operational tables (users, transport_requirements, transport_requirement_items, rate_submissions, truck_dispatches, transporters).
  4. Backfill existing records with organization_id = 'org_shalimar'.
  5. Include organization_id in JWT payload and default query filters gracefully.

### Phase 4: Foreign Key Integrity & Legacy Item Support
- **Target:** database/schema.sql, server/routes/api.js
- **Actions:**
  1. Fix schema foreign key: change fk_allocations_request to reference transport_requirements(id).
  2. For item_id = 'MAIN' in rate_submissions, ensure an auto-resolved item record exists or handle the reference safely without constraint violations.

### Phase 5: Database Performance & Indexes
- **Target:** database/schema.sql, server/routes/api.js
- **Actions:**
  1. Add composite index idx_rs_trans_status on rate_submissions(transporter_id, bid_status).
  2. Add indexes on truck_dispatches(created_at), (dispatched_at), (truck_number).
  3. Add indexes on organization_id across core tables.

### Phase 6: Audit Trail & Security Event Logging
- **Target:** server/routes/api.js, server/routes/auth.js
- **Actions:**
  1. Ensure updated_by is captured where authenticated user is present.
  2. Log security events (login success/failure, password migration, quote finalization, dispatch creation, backup/restore) to security_audit_logs.

### Phase 7: Background Polling Input Preservation
- **Target:** src/context/AuthContext.jsx
- **Actions:**
  1. Before replacing in-memory db during background polling, check if an input/textarea/select is currently active (document.activeElement).
  2. If user is actively typing or editing, defer full state replacement or merge selectively to avoid focus loss.

### Phase 8: Concurrency-Safe LR Generation
- **Target:** server/routes/api.js (generateUniqueLrNumber)
- **Actions:**
  1. Use atomic update on dedicated transaction connection: UPDATE lr_sequences SET last_seq = LAST_INSERT_ID(last_seq + 1) WHERE prefix = ? followed by SELECT LAST_INSERT_ID().

### Phase 9: Secure Database Backup & Restore
- **Target:** server/routes/api.js
- **Actions:**
  1. Add strict admin confirmation.
  2. Parse and validate SQL statements, rejecting destructive commands like DROP DATABASE or user privilege alterations.
  3. Wrap execution in transaction where possible and log audit event.

### Phase 10: Modular Refactoring
- **Target:** server/routes/api.js
- **Actions:**
  1. Extract modular routers incrementally into server/routes/ while preserving original route mounts and backward compatibility.
