---
name: database-review
description: Database review workflow for MySQL schema, tables, connection pool, and synchronization logic.
---
# Database Review Skill

## Overview
Use this skill to inspect and verify MySQL database integration in Shalimar Logistics.

## Review Steps
1. **Connection Pool Verification**: Ensure `server/config/db.js` uses `mysql2/promise` pool with loopback resolution mapping (`localhost`/`::1` -> `127.0.0.1`).
2. **Schema Auto-Healing Check**: Confirm `initDatabaseSchema()` executes `CREATE TABLE IF NOT EXISTS` for all 6 core tables (`app_database`, `users`, `transporters`, `rate_requests`, `rate_submissions`, `master_records`).
3. **Data Loss Audit**: Confirm `syncNormalizedTables()` in `server/routes/api.js` uses `ON DUPLICATE KEY UPDATE` to preserve existing records during state sync.
4. **Reset Operation Check**: Confirm `_isResetOperation` flag properly clears operational tables (`rate_requests`, `rate_submissions`) when requested by Admin.
