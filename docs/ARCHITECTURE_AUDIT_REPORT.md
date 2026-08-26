# Codebase Architecture Audit Report — Shalimar Logistics (TransFlow Phase 1)

**Audit Date**: August 26, 2026  
**Auditor**: Lead Software Architect & Principal Security Engineer  
**Target Repository**: `prathameshwankhede/shalimar_logistics_phase1`  

---

## 1. Executive Summary & Stack Assessment

Shalimar Logistics (TransFlow) is an Enterprise Freight Procurement & Logistics Platform built with:
- **Frontend**: React 19 SPA, Vite 8, CSS Variable Token Glassmorphic Theme, Lucide Icons.
- **Backend**: Node.js ES Modules (`"type": "module"`), Express.js 5.2.
- **Database Engine**: Hostinger Managed MySQL Database connected via `mysql2/promise` pool.
- **Authentication**: JWT-based session tokens + bcrypt password hashing.

---

## 2. Comprehensive Audit Breakdown (1 to 12)

### 1. Current Frontend Architecture
- React 19 SPA with single entry point [`src/main.jsx`](file:///d:/shalimar-logistics/src/main.jsx) and [`src/App.jsx`](file:///d:/shalimar-logistics/src/App.jsx).
- Components reside in [`src/components/`](file:///d:/shalimar-logistics/src/components/) (`AdminDashboard.jsx`, `TransporterPortal.jsx`, `Navbar.jsx`, `LoginModal.jsx`).
- Session and auth state managed by `AuthProvider` in [`src/context/AuthContext.jsx`](file:///d:/shalimar-logistics/src/context/AuthContext.jsx).

### 2. Current Backend Architecture
- Express 5 application setup in [`server/index.js`](file:///d:/shalimar-logistics/server/index.js).
- Route handlers located in [`server/routes/api.js`](file:///d:/shalimar-logistics/server/routes/api.js) and [`server/routes/auth.js`](file:///d:/shalimar-logistics/server/routes/auth.js).

### 3. Current Database Architecture
- MySQL pool configured in [`server/config/db.js`](file:///d:/shalimar-logistics/server/config/db.js).
- Schema auto-healing initializes 6 tables: `app_database`, `users`, `transporters`, `rate_requests`, `rate_submissions`, `master_records`.

### 4. Current Authentication Flow
- Client submits credentials via `POST /api/auth/login`.
- Server validates against `users` table, generates a 30-day JWT token, and returns a minimal user session DTO.
- Client passes `Authorization: Bearer <token>` header for authenticated requests.

### 5. Current Authorization Flow
- RBAC permissions defined in [`server/middleware/auth.js`](file:///d:/shalimar-logistics/server/middleware/auth.js) (`ROLE_PERMISSIONS.admin` vs `ROLE_PERMISSIONS.transporter`).
- Middleware `requireRole('admin')` restricts admin endpoints.

### 6. Current API Endpoints
- `POST /api/auth/login` — User authentication.
- `GET /api/auth/me` — User session verification.
- `GET /api/dashboard` — Scoped summary counts DTO.
- `GET /api/rate-requests` — Paginated rate requests DTO.
- `GET /api/rate-submissions` — Role-scoped bids DTO.
- `GET /api/transporters` — Minimal transporter list DTO.
- `GET /api/master-data` — Lightweight reference dropdown DTO.
- `GET /api/security/audit-logs` — Protected audit logs DTO.

### 7. Current Database Queries
- Parameterized queries with `?` placeholders in all routes.
- Explicit column selection applied to prevent `SELECT *` leaks.

### 8. Current Security Problems
- Frontend API calls were previously decentralized inside components rather than routed through a unified API client.
- Layered backend architecture (Controllers -> Services -> Repositories) needed formalization for maintainability.

### 9. Current Excessive Data Exposure
- Resolved via `sanitizeStateForClient()` and minimal DTO endpoint projections.

### 10. Current Frontend/Backend Coupling
- Components previously called `fetch()` directly; refactoring to `src/api/client.js` decouples network calls from UI rendering.

### 11. Files Requiring Refactoring
- [`src/store/dbStore.js`](file:///d:/shalimar-logistics/src/store/dbStore.js): Create centralized API client wrappers (`src/api/`).
- [`server/routes/api.js`](file:///d:/shalimar-logistics/server/routes/api.js): Refactor logic into layered Architecture (Controllers, Services, Repositories).

### 12. Files That Should NOT Be Changed
- [`src/index.css`](file:///d:/shalimar-logistics/src/index.css) & [`src/App.css`](file:///d:/shalimar-logistics/src/App.css): Visual design, colors, fonts, and spacing.
- UI Layout Components: `AdminDashboard.jsx`, `TransporterPortal.jsx`, `Navbar.jsx`, `LoginModal.jsx` (Keep layout & UX 100% untouched).
