# PRODUCTION DEPLOYMENT CHECKLIST: TransFlow Logistics

**Target Platform:** Hostinger Cloud / Node.js (Phusion Passenger) + Managed MySQL  
**Application:** TransFlow Logistics / Shalimar Nutrients Transport Procurement Portal  
**Document Classification:** Operations & Deployment Runbook  

---

## 1. Pre-Deployment Environment Configuration

Verify and configure the following environment variables in the Hostinger Node.js Application environment settings (or production `.env` file). **DO NOT** commit real production credentials into Git.

| Environment Variable | Required | Recommended / Example Value | Description |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **YES** | `production` | Enables strict security guards and production optimizations. |
| `PORT` | **YES** | Assigned by Hostinger Passenger | Port or Unix socket provided by Phusion Passenger. |
| `DB_HOST` | **YES** | `127.0.0.1` or `localhost` | Hostinger MySQL server hostname or IP. |
| `DB_PORT` | **YES** | `3306` | MySQL server port. |
| `DB_NAME` | **YES** | `u704836459_shalimar_logi` | Production database name. |
| `DB_USER` | **YES** | `u704836459_shalimar_user` | Production database user. |
| `DB_PASSWORD` | **YES** | *(Your strong MySQL password)* | Production database user password. |
| `JWT_SECRET` | **YES** | *(Generate 64+ char random string)* | **MANDATORY IN PRODUCTION.** Startup fails if missing. |
| `ALLOW_SEED_FALLBACK` | NO | `false` | Disables mock seed fallback in case of DB errors. |

> [!CAUTION]
> In production (`NODE_ENV=production`), the application will immediately refuse to start if `JWT_SECRET` is missing. Generate a high-entropy secret (e.g. `openssl rand -hex 32`).

---

## 2. Pre-Deployment Backup

Before applying code or database updates, execute a full logical backup of the production database:

```bash
# Using mysqldump via SSH terminal on Hostinger:
mysqldump -u <DB_USER> -p<DB_PASSWORD> -h <DB_HOST> <DB_NAME> > backup_pre_hardening_$(date +%Y%m%d_%H%M%S).sql
```

Confirm that the backup file is non-empty and stored safely outside the deployment directory.

---

## 3. Database Migration Execution

Execute the idempotent migration script `DATABASE_MIGRATION.sql` against the production MySQL database:

```bash
mysql -u <DB_USER> -p<DB_PASSWORD> -h <DB_HOST> <DB_NAME> < DATABASE_MIGRATION.sql
```

**Verification Queries after Migration:**
```sql
-- 1. Confirm default organization exists
SELECT id, name, status FROM organizations WHERE id = 'org_shalimar';

-- 2. Confirm organization_id column on core tables
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND COLUMN_NAME = 'organization_id' 
  AND TABLE_NAME IN ('users', 'transport_requirements', 'rate_submissions', 'truck_dispatches');

-- 3. Confirm zero unmapped records
SELECT COUNT(*) AS unmapped_requirements 
FROM transport_requirements 
WHERE organization_id IS NULL OR organization_id = '';
```

---

## 4. Application Build & Dependency Verification

1. **Verify Node.js Version:**
   * Ensure Hostinger Node.js selector is set to **Node.js 20.x, 22.x, or 24.x** (ES Module support required).
2. **Install Production Dependencies:**
   ```bash
   npm install --production=false
   ```
3. **Build Frontend Production Bundle:**
   ```bash
   npm run build
   ```
   * Ensure `dist/index.html` and `dist/assets/` are generated with 0 errors.

---

## 5. Passenger Application Restart

Trigger a graceful restart of the Phusion Passenger Node.js daemon:

```bash
# In the application root directory:
mkdir -p tmp
touch tmp/restart.txt
```

---

## 6. Post-Deployment Smoke Verification

1. **Health Check Endpoint:**
   * `GET https://your-domain.com/api/health`
   * Expected: HTTP 200 `{ "status": "ok" }`
2. **Admin Login:**
   * Verify login using admin credentials.
   * Confirm token is received and user state loads without errors.
3. **Transporter Login:**
   * Log in as a transporter.
   * Verify Open Requirements, Awarded Contracts, and Dispatches tabs render properly.
4. **Submit Rate Check:**
   * Test single quote submission.
   * Test "Submit All Rates" batch submission.
5. **Form Typing & Polling Check:**
   * Open quote entry form, start typing, and verify cursor/focus is not reset by background polling.
6. **Security Audit Log Check:**
   * Admin Dashboard -> Security Logs: Verify `LOGIN_SUCCESS` and `LOGIN_FAILED` records appear with timestamps.
