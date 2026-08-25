---
name: architecture-review
description: Architecture review workflow for frontend SPA components, Express routes, and Hostinger runtime binding.
---
# Architecture Review Skill

## Overview
Use this skill to evaluate full-stack application architecture and component design.

## Evaluation Criteria
1. **Frontend Architecture**:
   - Verify React 19 functional component structure in `src/components/`.
   - Ensure `AuthContext.jsx` manages user session, role permissions, and database sync.
2. **Backend Architecture**:
   - Confirm Express 5 application setup in `server/index.js`.
   - Verify route modularization in `server/routes/`.
3. **Static File Serving**:
   - Confirm Express serves `dist/` production assets and falls back to `dist/index.html` for client-side SPA routing.
4. **Environment Port Binding**:
   - Confirm server listens on `process.env.PORT` and `HOST=0.0.0.0`.
