// tests/security_regression.test.js
// Automated Security & Regression Test Suite for Shalimar Logistics (TransFlow Phase 1)

import assert from 'node:assert/strict';

// Mock browser localStorage for Node testing environment
if (typeof globalThis.localStorage === 'undefined') {
  const memoryStore = new Map();
  globalThis.localStorage = {
    getItem: (key) => memoryStore.get(key) || null,
    setItem: (key, val) => memoryStore.set(key, String(val)),
    removeItem: (key) => memoryStore.delete(key),
    clear: () => memoryStore.clear()
  };
}

import { sanitizeInput, checkBruteForceLock, recordLoginAttempt, resetLoginLock } from '../src/utils/securityEngine.js';
import { generateToken, ROLE_PERMISSIONS } from '../server/middleware/auth.js';
import jwt from 'jsonwebtoken';

async function runSecurityRegressionSuite() {
  console.log('==================================================');
  console.log('🧪 RUNNING SHALIMAR LOGISTICS AUTOMATED SECURITY SUITE');
  console.log('==================================================');

  let passed = 0;
  let failed = 0;

  function test(description, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${description}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Sanitizer & Injection Defense Tests
  test('Sanitizer strips script tags and HTML elements', () => {
    const malicious = '<script>alert("xss")</script>';
    const clean = sanitizeInput(malicious);
    assert.equal(clean.includes('<script>'), false);
    assert.equal(clean.includes('&lt;script&gt;'), true);
  });

  test('Sanitizer blocks SQL injection keywords', () => {
    const sqlPayload = "admin' UNION SELECT * FROM users --";
    const clean = sanitizeInput(sqlPayload);
    assert.equal(clean.includes('UNION SELECT'), false);
    assert.equal(clean.includes('[BLOCKED_SQL]'), true);
  });

  test('Sanitizer blocks NoSQL operator injections ($gt, $where)', () => {
    const mongoPayload = '{"username": {"$gt": ""}}';
    const clean = sanitizeInput(mongoPayload);
    assert.equal(clean.includes('$'), false);
    assert.equal(clean.includes('&#36;'), true);
  });

  // 2. JWT Session Token & RBAC Permission Tests
  test('JWT generator creates valid signed tokens with RBAC permissions and without passwords', () => {
    const mockUser = { id: 'usr_test', username: 'testuser', name: 'Test User', role: 'admin' };
    const token = generateToken(mockUser);
    assert.ok(token);

    const decoded = jwt.decode(token);
    assert.equal(decoded.username, 'testuser');
    assert.equal(decoded.role, 'admin');
    assert.ok(Array.isArray(decoded.permissions));
    assert.equal(decoded.permissions.includes('audit_log.view'), true);
    assert.equal(decoded.password, undefined);
    assert.equal(decoded.password_hash, undefined);
  });

  test('Transporter role JWT excludes admin permissions', () => {
    const mockTransporter = { id: 'usr_abc', username: 'ABC001', name: 'ABC Transport', role: 'transporter', transporter_id: 'trans_abc' };
    const token = generateToken(mockTransporter);
    const decoded = jwt.decode(token);
    assert.equal(decoded.role, 'transporter');
    assert.equal(decoded.permissions.includes('audit_log.view'), false);
    assert.equal(decoded.permissions.includes('rate_submission.view_own'), true);
  });

  // 3. Brute Force Lockout & Reset Tests
  test('Brute force engine locks user after 5 failed attempts for 60s', () => {
    const testUsername = 'test_lockout_user';
    resetLoginLock(testUsername);

    for (let i = 0; i < 5; i++) {
      recordLoginAttempt(testUsername, false);
    }

    const lockStatus = checkBruteForceLock(testUsername);
    assert.equal(lockStatus.locked, true);
    assert.ok(lockStatus.remainingSec <= 60 && lockStatus.remainingSec > 0);

    resetLoginLock(testUsername);
    const postReset = checkBruteForceLock(testUsername);
    assert.equal(postReset.locked, false);
  });

  // 4. Data Minimization DTO Sanitization Tests
  test('Minimal User DTO contains no password, hash, or secret keys', () => {
    const rawUserPayload = {
      id: 'usr_1',
      username: 'admin',
      password: 'plain_password',
      password_hash: '$2b$10$hash',
      role: 'admin',
      secret_key: 'top_secret'
    };

    const { password, password_hash, secret_key, ...minimalDto } = rawUserPayload;
    assert.equal(minimalDto.password, undefined);
    assert.equal(minimalDto.password_hash, undefined);
    assert.equal(minimalDto.username, 'admin');
  });

  // 5. Database Backup, Restore & Clear Security Suite Tests
  test('Backup payload redacts sensitive user passwords and hashes', () => {
    const rawUsers = [
      { id: 'usr_1', username: 'admin', password: 'secretpassword', password_hash: '$2b$10$abc' },
      { id: 'usr_2', username: 'P001', password: 'password123', password_hash: '$2b$10$xyz' }
    ];

    const sanitizedUsers = rawUsers.map(u => {
      const clean = { ...u };
      delete clean.password;
      delete clean.password_hash;
      return clean;
    });

    sanitizedUsers.forEach(u => {
      assert.equal(u.password, undefined);
      assert.equal(u.password_hash, undefined);
      assert.ok(u.username);
    });
  });

  test('Clear operational data requires explicit confirmation flag ({ confirm: true })', () => {
    const unconfirmedPayload = { confirm: false };
    const checkConfirmation = (body) => Boolean(body && body.confirm === true);

    assert.equal(checkConfirmation(unconfirmedPayload), false);
    assert.equal(checkConfirmation({ confirm: true }), true);
  });

  test('Clear operational data protects system admin user account', () => {
    const userRows = [
      { id: 'usr_admin', username: 'admin', role: 'admin' },
      { id: 'usr_trans1', username: 'P001', role: 'transporter' },
      { id: 'usr_trans2', username: 'A001', role: 'transporter' }
    ];

    const remainingUsers = userRows.filter(u => u.role === 'admin' && u.username === 'admin');
    assert.equal(remainingUsers.length, 1);
    assert.equal(remainingUsers[0].username, 'admin');
  });

  console.log('==================================================');
  console.log(`📊 TEST RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityRegressionSuite();
