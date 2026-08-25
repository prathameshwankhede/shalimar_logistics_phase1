---
name: testing
description: Testing and verification workflow for Shalimar Logistics application code, production builds, and API endpoints.
---
# Testing Skill

## Overview
Use this skill to run verification commands, test production builds, and validate database synchronization.

## Testing Procedures
1. **Production Build Verification**:
   Run `npm run build` to verify Vite client bundling succeeds without JavaScript or JSX errors.
2. **API Endpoint Verification**:
   Test `/api/health` to confirm server status, timestamp, and environment variable resolution.
3. **Database Connectivity Test**:
   Execute diagnostic script `scratch/verify_live_db_storage.node.cjs` to test MySQL connection pool, table queries, and real-time read/write persistence.
