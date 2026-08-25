# TransFlow Logistics — Hostinger Deployment & Migration Guide 🚀

This document outlines the complete steps to deploy **TransFlow Logistics** on **Hostinger Business / Web Apps Hosting** with **Hostinger Managed MySQL**.

---

## 📋 Stack Overview
- **Frontend**: React 19 + Vite 8
- **Backend API**: Express Node.js REST API
- **Database**: Hostinger Managed MySQL
- **Authentication**: JWT Token + bcryptjs Password Hashing
- **Hosting Target**: Hostinger Web Apps / Node.js Hosting

---

## 1. 🗄️ Hostinger MySQL Setup

1. Log into your **Hostinger hPanel**.
2. Navigate to **Databases** → **Management**.
3. Create a new MySQL database:
   - **Database Name**: `transflow_db` (or custom name)
   - **MySQL Username**: `transflow_user`
   - **Password**: *(Set a strong password)*
4. Note your **MySQL Hostname** (usually `localhost` or `127.0.0.1` for Hostinger Web Apps, or host IP provided in hPanel).
5. Open **phpMyAdmin** from hPanel.
6. Select your database and click **Import**.
7. Choose and upload [`database/schema.sql`](file:///d:/shalimar-logistics/database/schema.sql) from your repository to create all 12 relational tables and indexes.

---

## 2. 🔑 Environment Variables Configuration

Create an `.env` file in the root directory (or enter these key-value pairs in Hostinger's Environment Variables setting):

```env
# Server Port & Environment
PORT=3000
NODE_ENV=production

# Hostinger Managed MySQL Credentials
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_NAME=transflow_db
DATABASE_USER=transflow_user
DATABASE_PASSWORD=your_mysql_password_here

# JWT Authentication Secret
JWT_SECRET=your_random_secure_jwt_secret_key_2026
```

> [!IMPORTANT]
> Never commit `.env` to GitHub. The `.gitignore` file has been configured to exclude all `.env` files while preserving `.env.example`.

---

## 3. 🌐 Hostinger Web Apps Deployment Setup

1. In **Hostinger hPanel**, navigate to **Web Apps / Node.js Apps**.
2. Select your connected GitHub repository:
   - **Repository**: `https://github.com/prathameshwankhede/transflow-logistics`
   - **Branch**: `main`
3. Set the following build and startup commands:
   - **Node.js Version**: 18.x or 20.x
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start` *(runs `node server/index.js`)*
   - **App Root / Directory**: `/` (Root directory)
4. Add all environment variables listed in Section 2 under **Environment Variables**.
5. Click **Deploy**. Hostinger will automatically run `npm install`, `npm run build`, and launch the Express server.

---

## 4. 🔒 Custom Domain & SSL Setup

1. In Hostinger hPanel, go to **Domains** → **Custom Domain**.
2. Point your custom domain (e.g. `logistics.yourcompany.com`) to your Hostinger Web App slot.
3. Under **SSL / Security**, click **Install SSL** to enable free automatic Let's Encrypt HTTPS certificates.

---

## 5. 💾 Database Backup & Restore Protocol

### Hostinger Daily Backups
Hostinger automatically creates daily backups of your MySQL database under **Databases** → **Backups**.

### Manual Export (SQL Dump)
To create a manual backup using phpMyAdmin or command line:
```bash
mysqldump -u transflow_user -p transflow_db > backup_$(date +%F).sql
```

### Manual Restore
To restore from an SQL dump:
```bash
mysql -u transflow_user -p transflow_db < backup_file.sql
```

---

## 6. 🧪 Verification Checklist

- [x] Dependencies installed (`express`, `mysql2`, `bcryptjs`, `jsonwebtoken`, `cors`, `dotenv`)
- [x] `@supabase/supabase-js` and `@libsql/client` SDK dependencies removed
- [x] Production build passes clean (`npm run build`)
- [x] Node.js Express server starts clean (`npm start` / `node server/index.js`)
- [x] `.env.example` created
- [x] `.gitignore` updated to protect secrets
- [x] MySQL schema created in [`database/schema.sql`](file:///d:/shalimar-logistics/database/schema.sql)
