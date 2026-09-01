# CHANGELOG: Surgical Backward-Compatible Fixes

## Phase 0: Discovery & Baseline Verification (Completed)
- Completed end-to-end dependency analysis across authentication, rate bidding, dispatches, database schema, and frontend consumers.
- Baseline test suite verified: 68 tests passing (14 suites).
- Established SAFE_MIGRATION_PLAN.md with zero-downtime, non-breaking constraints.

## Phase 1: Critical Security Hardening (In Progress)
- Remove hardcoded admin bypasses (admin123, admin, master strings).
- Implement Safe Password Migration (verify legacy plaintext once upon valid login, auto-upgrade to bcrypt hash, clear plaintext).
- Enforce mandatory JWT_SECRET with startup failure if unset in production.
- Apply RBAC authorization middleware to sensitive rate, dispatch, and maintenance routes.

## Phase 2: Atomic Bulk Rate Submission (Planned)
- Implement POST /api/rate-submissions/batch with dedicated connection, BEGIN TRANSACTION, and rollback on any item error.
- Preserve POST /api/rate-submissions single endpoint intact.
- Update frontend handleBatchSubmitAll to use batch endpoint with identical UI behavior.

## Phase 3: Organization & Multi-Tenant Data Isolation (Planned)
- Create organizations table.
- Seed default organization org_shalimar (Shalimar Nutrients Pvt Ltd).
- Add nullable organization_id to core tables with safe backfill and index.
- Propagate organization_id in JWT and scope database queries safely.

## Phase 4: Database Foreign Key Integrity (Planned)
- Correct allocations.request_id foreign key reference to transport_requirements(id).
- Support legacy item_id = 'MAIN' by ensuring a compatible fallback/lookup without constraint violations.

## Phase 5: Database Performance & Safe Indexing (Planned)
- Add composite indexes on rate_submissions(transporter_id, bid_status) and truck_dispatches(created_at, dispatched_at, truck_number).
- Index organization_id across core tables using idempotent DDL.

## Phase 6: Comprehensive Security Audit Trail (Planned)
- Automatically populate updated_by from authenticated user context.
- Log critical security events (login, failed login, password upgrades, finalization, dispatches, backups) in security_audit_logs.

## Phase 7: Background Polling Input Preservation (Planned)
- Update AuthContext.jsx background synchronization to check for active input focus/dirty state before state replacement, preventing UI typing loss.

## Phase 8: Concurrency-Safe LR Generation (Planned)
- Ensure sequence generation executes with atomic row locking on dedicated transaction connection, preventing duplicates.

## Phase 9: Secure Database Backup & Restore (Planned)
- Restrict POST /api/backup/restore with strict confirmation, SQL statement validation, and blocking of hazardous commands (DROP DATABASE, GRANT, etc.).

## Phase 10: Modular Architecture Extraction (Planned)
- Extract focused sub-routers and service modules without breaking existing imports or API routes.
