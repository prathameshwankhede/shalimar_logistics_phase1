---
name: api-security
description: API Security auditing workflow for REST endpoints, authentication tokens, rate limiting, and CORS headers.
---
# API Security Skill

## Overview
Use this skill to audit security controls on Express REST endpoints.

## Verification Checklist
1. **Endpoint Protection**: Ensure sensitive routes verify JWT tokens via `authenticateToken` middleware.
2. **Payload Sanitization**: Verify `sanitizeStateForClient()` strips sensitive properties from `GET /api/state` and `POST /api/state`.
3. **CORS & Headers**: Check `cors()` middleware configuration and ensure safe header processing.
4. **Rate Limiting**: Verify rate limiting in `securityEngine.js` restricts excessive requests to prevent brute force and DDoS attacks.
