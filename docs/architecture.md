# Shalimar Logistics (TransFlow) — System Architecture Documentation

## 1. Executive Summary
Shalimar Logistics (TransFlow) is an enterprise transport procurement and freight management portal for Shalimar Nutrients Pvt Ltd. The application manages rate requirement broadcasting, transporter bidding, counter-rate negotiations, contract allocation, and truck dispatch logging.

## 2. Technical Stack
- **Frontend**: React 19, Vite, Lucide React, Glassmorphic Design Token CSS System.
- **Backend**: Node.js (ES Modules), Express.js 5 REST API Engine.
- **Database**: Hostinger Managed MySQL Database connected via `mysql2/promise` connection pool.
- **Security**: JWT Authentication, bcrypt password hashing, 1-minute brute force lockout, SQL parameterization, and state payload password sanitization.

## 3. High-Level Architecture Diagram

```
[ Browser Client (React 19 SPA) ]
              │
              │ REST API Requests (HTTP / JSON)
              ▼
 [ Hostinger Node.js Express Server ]
   ├── Static File Middleware (dist/)
   ├── Authentication Router (/api/auth)
   ├── State & Business API Router (/api)
   └── MySQL Connection Pool (127.0.0.1:3306)
              │
              ▼
[ Hostinger Managed MySQL Database ]
   ├── app_database (JSON Backup Blob)
   ├── users (Credentials)
   ├── transporters (Vendor Profiles)
   ├── rate_requests (Freight Indents)
   ├── rate_submissions (Transporter Bids)
   └── master_records (Directories)
```

## 4. Real-time Synchronization
- Client app performs 3-second polling against `GET /api/state`.
- Local browser tabs synchronize state changes using the HTML5 `BroadcastChannel` API (`transflow_live_sync_v1`).
