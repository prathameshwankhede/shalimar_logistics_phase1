---
name: production-readiness
description: Production deployment readiness verification checklist for Hostinger Node.js Web App environment.
---
# Production Readiness Skill

## Overview
Use this skill to verify that the application is fully prepared for Hostinger production deployment.

## Deployment Checklist
1. **Environment Variables**: Verify `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `NODE_ENV=production`, `PORT` are configured in Hostinger Web App dashboard.
2. **Server Entry Point**: Confirm `server.js` starts `./server/index.js` and `package.json` `"start"` script is `"node server.js"`.
3. **Build Artifacts**: Ensure `npm run build` produces the static `dist/` directory before server deployment.
4. **Static File Serving**: Confirm `server/index.js` serves `dist/` and provides SPA fallback to `dist/index.html`.
5. **No Password Exposure**: Confirm state API responses sanitize user passwords before sending payloads over HTTP.
