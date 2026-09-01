# ROLLBACK PLAN: TransFlow Logistics Hardening Release

## 1. Overview & Rollback Feasibility
All changes introduced in this release are **strictly backward-compatible** and **additive**. None of the database schema updates dropped columns or tables, and existing single-submission API routes (POST /api/rate-submissions) remain fully operational alongside the new batch endpoints (POST /api/rate-submissions/batch).

---

## 2. Code Rollback Procedure

### If Node.js / Express Backend Needs Rollback:
1. Check out previous Git commit:
   `ash
   git log -n 5 --oneline
   git revert HEAD
   `
2. Re-build frontend assets:
   `ash
   npm run build
   `
3. Restart Passenger / Node.js service on Hostinger:
   `ash
   touch tmp/restart.txt
   `

---

## 3. Database Migration Rollback Procedure

### Reverting Non-Destructive DDL Columns:
The schema migration added nullable/defaulted columns (organization_id, created_by, updated_by) and indexes. These columns do not interfere with older application versions. If explicit rollback is requested:

`sql
SET FOREIGN_KEY_CHECKS = 0;

-- Drop newly created performance indexes
ALTER TABLE ate_submissions DROP INDEX IF EXISTS idx_rs_trans_status;
ALTER TABLE ate_submissions DROP INDEX IF EXISTS idx_rs_org;
ALTER TABLE 	ransport_requirements DROP INDEX IF EXISTS idx_tr_org;
ALTER TABLE 	ruck_dispatches DROP INDEX IF EXISTS idx_td_org;
ALTER TABLE 	ruck_dispatches DROP INDEX IF EXISTS idx_td_created_at;
ALTER TABLE 	ruck_dispatches DROP INDEX IF EXISTS idx_td_dispatched_at;
ALTER TABLE 	ruck_dispatches DROP INDEX IF EXISTS idx_td_truck_no;

-- Optional: Drop organization columns if reverting multi-tenancy
-- ALTER TABLE users DROP COLUMN IF EXISTS organization_id;
-- ALTER TABLE 	ransport_requirements DROP COLUMN IF EXISTS organization_id;
-- ALTER TABLE 	ransport_requirement_items DROP COLUMN IF EXISTS organization_id;
-- ALTER TABLE ate_submissions DROP COLUMN IF EXISTS organization_id;
-- ALTER TABLE 	ruck_dispatches DROP COLUMN IF EXISTS organization_id;
-- ALTER TABLE 	ransporters DROP COLUMN IF EXISTS organization_id;

SET FOREIGN_KEY_CHECKS = 1;
`

---

## 4. Disaster Recovery / Snapshot Restoration
If any operational data inconsistency occurs:
1. Locate the snapshot dump created prior to migration:
   - database/backups/shalimar_mysql_full_backup_*.sql
2. Restore via MySQL client:
   `ash
   mysql -u <username> -p<password> -h <host> <database_name> < database/backups/<backup_file>.sql
   `
