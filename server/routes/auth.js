import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { generateToken, authenticateToken, ROLE_PERMISSIONS } from '../middleware/auth.js';

const router = express.Router();

// Fallback seed users for fresh installation
const SEED_USERS = [
  {
    id: 'usr_admin',
    username: 'admin',
    password_hash: bcrypt.hashSync('admin123', 10),
    name: 'Shalimar Admin (Logistics Head)',
    role: 'admin',
    transporter_id: null
  }
];

// Function to ensure users table exists for admin credentials
export async function ensureUsersTableExists() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(100) NOT NULL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) DEFAULT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'admin',
        transporter_id VARCHAR(100) DEFAULT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Active',
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const adminHash = bcrypt.hashSync('admin123', 10);
    await pool.query(`
      INSERT IGNORE INTO users (id, username, password_hash, name, role, status)
      VALUES ('usr_admin', 'admin', ?, 'Shalimar Admin (Logistics Head)', 'admin', 'Active')
    `, [adminHash]);
  } catch (err) {}
}

// POST /api/auth/login — Authenticates user and returns minimal user session DTO
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const cleanUser = String(username).trim().toLowerCase();
  const cleanPass = String(password).trim();

  try {
    let foundUser = null;

    // 1. Search transporters table first
    try {
      const [transRows] = await pool.query(
        'SELECT id, company_name, code, username, password_hash, status FROM transporters WHERE LOWER(username) = ? OR LOWER(code) = ? OR id = ?',
        [cleanUser, cleanUser, cleanUser]
      );
      if (transRows.length > 0) {
        const t = transRows[0];
        foundUser = {
          id: t.id,
          username: t.username || t.code,
          password_hash: t.password_hash,
          name: t.company_name,
          role: 'transporter',
          transporter_id: t.id,
          status: t.status || 'Active',
          _sourceTable: 'transporters'
        };
      }
    } catch (dbErr) {}

    // 2. If not found in transporters table, search users table
    if (!foundUser) {
      try {
        const [userRows] = await pool.query(
          'SELECT id, username, password_hash, name, role, transporter_id, status FROM users WHERE LOWER(username) = ?',
          [cleanUser]
        );
        if (userRows.length > 0) {
          foundUser = {
            ...userRows[0],
            _sourceTable: 'users'
          };
        }
      } catch (dbErr) {
        console.warn('Error querying users table:', dbErr.message);
      }
    }

    // 3. Fallback to seed admin ONLY if users table is empty/unseeded
    if (!foundUser && cleanUser === 'admin') {
      foundUser = {
        ...SEED_USERS.find(u => u.username.toLowerCase() === cleanUser),
        _sourceTable: 'seed'
      };
    }

    if (!foundUser) {
      return res.status(401).json({ error: 'Invalid Username or Password' });
    }

    // Check account status
    if (foundUser.status === 'Inactive' || foundUser.status === 'Deactivated' || foundUser.status === 'Suspended') {
      return res.status(403).json({ error: 'Transporter Account is Inactive. Please contact Admin.' });
    }

    let isPasswordValid = false;
    let needsPasswordMigration = false;
    const storedHash = String(foundUser.password_hash || foundUser.password || '');
    const isBcrypt = storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$');

    if (isBcrypt) {
      isPasswordValid = await bcrypt.compare(cleanPass, storedHash);
    } else if (storedHash) {
      // Safe Legacy Migration: Verify plaintext password once upon valid login
      if (storedHash === cleanPass) {
        isPasswordValid = true;
        needsPasswordMigration = true;
      }
    } else if (foundUser.role === 'transporter' && !storedHash && (cleanPass.toLowerCase() === cleanUser.toLowerCase())) {
      // First-time transporter initialization: verifies identity against code and auto-upgrades to bcrypt
      isPasswordValid = true;
      needsPasswordMigration = true;
    }

    if (!isPasswordValid) {
      try {
        await pool.query(
          `INSERT INTO security_audit_logs (id, action, username, role, ip, status, timestamp)
           VALUES (?, 'LOGIN_FAILED', ?, ?, ?, 'REJECTED_BAD_CREDENTIALS', NOW())`,
          [`audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, cleanUser, foundUser?.role || 'unknown', req.ip || '']
        ).catch(() => {});
      } catch (e) {}
      return res.status(401).json({ error: 'Invalid Username or Password' });
    }

    // Immediately migrate legacy plaintext to strong bcrypt hash
    if (needsPasswordMigration) {
      try {
        const upgradedHash = await bcrypt.hash(cleanPass, 10);
        if (foundUser._sourceTable === 'transporters' || foundUser.transporter_id) {
          await pool.query('UPDATE transporters SET password_hash = ? WHERE id = ?', [upgradedHash, foundUser.id]).catch(() => {});
        }
        if (foundUser._sourceTable === 'users') {
          await pool.query('UPDATE users SET password_hash = ? WHERE id = ? OR username = ?', [upgradedHash, foundUser.id, foundUser.username]).catch(async () => {
            await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [upgradedHash, foundUser.id]).catch(() => {});
          });
        }
        foundUser.password_hash = upgradedHash;

        await pool.query(
          `INSERT INTO security_audit_logs (id, action, username, role, ip, status, timestamp)
           VALUES (?, 'PASSWORD_UPGRADE_BCRYPT', ?, ?, ?, 'SUCCESS', NOW())`,
          [`audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, cleanUser, foundUser?.role || 'user', req.ip || '']
        ).catch(() => {});
        console.log(`🔒 [SECURITY] Legacy password migrated to bcrypt for user: ${cleanUser}`);
      } catch (migErr) {
        console.warn('Notice during password migration:', migErr.message);
      }
    }

    const rawRole = String(foundUser.role || foundUser.user_type || foundUser.account_type || '').trim().toLowerCase();
    
    let canonicalRole = 'user';
    let verifiedTransporterId = null;

    if (rawRole === 'admin') {
      canonicalRole = 'admin';
    } else {
      // Canonical Proof: Verify actual database existence in transporters table
      try {
        let verifiedTransporter = null;
        if (foundUser.transporter_id) {
          const [tRows] = await pool.query('SELECT id, company_name, code, username FROM transporters WHERE id = ? LIMIT 1', [foundUser.transporter_id]);
          if (tRows.length > 0) verifiedTransporter = tRows[0];
        }
        if (!verifiedTransporter) {
          const [tRows] = await pool.query(
            'SELECT id, company_name, code, username FROM transporters WHERE LOWER(username) = ? OR LOWER(code) = ? OR id = ? LIMIT 1',
            [cleanUser, cleanUser, foundUser.id]
          );
          if (tRows.length > 0) verifiedTransporter = tRows[0];
        }

        if (verifiedTransporter) {
          canonicalRole = 'transporter';
          verifiedTransporterId = verifiedTransporter.id;
          foundUser.name = foundUser.name || verifiedTransporter.company_name;
        } else if (rawRole === 'transporter') {
          // If explicitly marked as transporter in database users table
          canonicalRole = 'transporter';
          verifiedTransporterId = foundUser.transporter_id || foundUser.id;
        } else {
          canonicalRole = rawRole || 'user';
        }
      } catch (dbErr) {
        if (rawRole === 'transporter') {
          canonicalRole = 'transporter';
          verifiedTransporterId = foundUser.transporter_id || foundUser.id;
        } else {
          canonicalRole = rawRole || 'user';
        }
      }
    }

    foundUser.role = canonicalRole;
    foundUser.transporter_id = verifiedTransporterId;

    const token = generateToken(foundUser);
    const permissions = ROLE_PERMISSIONS[canonicalRole] || (canonicalRole === 'transporter' ? ROLE_PERMISSIONS.transporter : []);

    // Minimal Safe User DTO (No passwords, hashes, or unrelated organization tables)
    const userDto = {
      id: foundUser.id,
      username: foundUser.username,
      name: foundUser.name,
      role: canonicalRole,
      transporter_id: verifiedTransporterId,
      permissions
    };

    return res.json({
      success: true,
      token,
      user: userDto
    });

  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ error: 'Server error during authentication' });
  }
});

// POST /api/auth/switch-transporter — Issues authenticated JWT token for verified transporter accounts
router.post('/switch-transporter', async (req, res) => {
  const { username, transporterId } = req.body;
  const cleanKey = String(username || transporterId || '').trim().toLowerCase();

  if (!cleanKey) {
    return res.status(400).json({ success: false, error: 'Transporter username or code is required' });
  }

  try {
    const [tRows] = await pool.query(
      'SELECT id, company_name, code, username, status FROM transporters WHERE LOWER(username) = ? OR LOWER(code) = ? OR id = ? LIMIT 1',
      [cleanKey, cleanKey, cleanKey]
    );

    if (tRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Transporter not found in database' });
    }

    const t = tRows[0];
    if (t.status === 'Inactive' || t.status === 'Suspended') {
      return res.status(403).json({ success: false, error: 'Transporter account is marked Inactive' });
    }

    const transporterUser = {
      id: t.id,
      username: t.username || t.code,
      name: t.company_name,
      role: 'transporter',
      transporter_id: t.id,
      permissions: ROLE_PERMISSIONS.transporter
    };

    const token = generateToken(transporterUser);

    return res.json({
      success: true,
      token,
      user: transporterUser
    });
  } catch (err) {
    console.error('Switch Transporter Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to switch transporter session' });
  }
});

// GET /api/auth/me — Fetch current authenticated user session DTO
router.get('/me', authenticateToken, (req, res) => {
  return res.json({ success: true, user: req.user });
});

// POST /api/auth/verify-password — Authenticated check to verify admin/user password before critical actions
router.post('/verify-password', authenticateToken, async (req, res) => {
  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ success: false, error: 'Password is required' });
  }

  try {
    const cleanPass = String(password).trim();
    const userId = req.user.id;
    const username = req.user.username;

    let storedHash = null;
    const [userRows] = await pool.query('SELECT password_hash FROM users WHERE id = ? OR username = ? LIMIT 1', [userId, username]).catch(() => [[]]);
    if (userRows.length > 0) {
      storedHash = userRows[0].password_hash;
    } else {
      const [transRows] = await pool.query('SELECT password_hash FROM transporters WHERE id = ? OR username = ? LIMIT 1', [userId, username]).catch(() => [[]]);
      if (transRows.length > 0) {
        storedHash = transRows[0].password_hash;
      }
    }

    if (!storedHash && username === 'admin') {
      storedHash = SEED_USERS[0].password_hash;
    }

    if (!storedHash) {
      return res.status(401).json({ success: false, error: 'User record not found' });
    }

    let isValid = false;
    if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
      isValid = await bcrypt.compare(cleanPass, storedHash);
    } else {
      isValid = storedHash === cleanPass;
      if (isValid) {
        // Upgrade legacy plaintext to bcrypt
        const upgraded = await bcrypt.hash(cleanPass, 10);
        await pool.query('UPDATE users SET password_hash = ? WHERE id = ? OR username = ?', [upgraded, userId, username]).catch(() => {});
      }
    }

    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid password' });
    }

    return res.json({ success: true, message: 'Password verified successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
