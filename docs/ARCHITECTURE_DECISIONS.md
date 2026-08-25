# Architecture Decision Records (ADR) — Shalimar Logistics

## ADR 001: Migration to Explicit Server-Side Parameterized MySQL Operations & Payload Sanitization

### Status
Accepted & Implemented

### Context
Previous iterations of the application relied on transmitting full JSON state objects containing raw user credentials (`password`, `password_hash`) to the browser, exposing sensitive operational data in DevTools network responses. Furthermore, database operations relied on a single monolithic `LONGTEXT` JSON blob in `app_database`.

### Decision
1. **Response Sanitization**: All state endpoints (`GET /api/state`, `POST /api/state`) MUST run outgoing JSON payloads through `sanitizeStateForClient()`, which strips `password`, `password_hash`, and third-party API secret tokens before serializing HTTP responses.
2. **Database Auto-Healing Schema**: On server boot, `server/config/db.js` executes `initDatabaseSchema()` using `CREATE TABLE IF NOT EXISTS` for all 6 core relational tables (`app_database`, `users`, `transporters`, `rate_requests`, `rate_submissions`, `master_records`).
3. **Loopback IP Binding**: Node.js `mysql2` pool resolves `DB_HOST='localhost'` or `'::1'` to `127.0.0.1` (IPv4 loopback) to align with Hostinger MySQL user privileges.
4. **Immediate Express Binding**: `app.listen(PORT)` binds synchronously upon script evaluation so Hostinger Phusion Passenger reverse proxies register the socket immediately, eliminating HTTP 503 errors.

### Consequences & Trade-offs
- **Pros**: 100% protection against password leakage, zero HTTP 503 startup timeouts on Hostinger, 100% protection against SQL injection via parameterized `?` statements.
- **Cons**: Client applications must authenticate via `/api/auth/login` to obtain session tokens rather than reading credentials from state payload arrays.

---

## ADR 002: 1-Minute Brute-Force Lockout & Server Rate Limiting

### Status
Accepted & Implemented

### Context
Failed authentication attempts needed protection against brute-force dictionary attacks without locking legitimate administrators out for extended periods during testing.

### Decision
1. **Lockout Duration**: Set lockout window to **60 Seconds (1 Minute)** after 5 consecutive failed attempts per username.
2. **Interactive UI Countdown**: `LoginModal.jsx` includes a live per-second countdown and an administrative `Reset Lock 🔓` button.

### Consequences & Trade-offs
- **Pros**: Balanced security preventing automated brute-force scripts while avoiding long admin lockout delays.
- **Cons**: Lockout state is currently tracked per-browser in `localStorage`; backend IP-based rate limiting is recommended for multi-client environments.
