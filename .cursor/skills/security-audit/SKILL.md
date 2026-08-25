---
name: security-audit
description: Security audit workflow for Shalimar Logistics application code and API endpoints.
---
# Security Audit Skill

## Overview
Use this skill to audit security posture across authentication, database queries, API responses, and client state.

## Audit Checklist
1. **Password Leakage Check**: Verify that `GET /api/state` and `POST /api/state` sanitize `users` array using `sanitizeStateForClient()`.
2. **SQL Injection Check**: Inspect `server/config/db.js`, `server/routes/api.js`, `server/routes/auth.js` for proper `?` parameterized queries.
3. **Authentication Check**: Verify JWT token generation and validation in `server/middleware/auth.js`.
4. **Lockout Check**: Ensure `checkBruteForceLock()` in `src/utils/securityEngine.js` enforces 1-minute (60s) lockouts after 5 failed attempts.
5. **Secret Exposure Check**: Confirm zero hardcoded passwords in `.env` templates, `dbStore.js`, `live_db.json`, and diagnostic logs.
