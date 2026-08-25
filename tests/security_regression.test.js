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
import { generateToken } from '../server/middleware/auth.js';
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

  // 2. JWT Session Token Security Tests
  test('JWT generator creates valid signed tokens without passwords', () => {
    const mockUser = { id: 'usr_test', username: 'testuser', name: 'Test User', role: 'admin' };
    const token = generateToken(mockUser);
    assert.ok(token);

    const decoded = jwt.decode(token);
    assert.equal(decoded.username, 'testuser');
    assert.equal(decoded.role, 'admin');
    assert.equal(decoded.password, undefined);
    assert.equal(decoded.password_hash, undefined);
  });

  // 3. Brute Force Lockout & Reset Tests
  test('Brute force engine locks user after 5 failed attempts for 60s', () => {
    const testUsername = 'test_lockout_user';
    resetLoginLock(testUsername);

    // Record 5 failed attempts
    for (let i = 0; i < 5; i++) {
      recordLoginAttempt(testUsername, false);
    }

    const lockStatus = checkBruteForceLock(testUsername);
    assert.equal(lockStatus.locked, true);
    assert.ok(lockStatus.remainingSec <= 60 && lockStatus.remainingSec > 0);

    // Clean up lock
    resetLoginLock(testUsername);
    const postReset = checkBruteForceLock(testUsername);
    assert.equal(postReset.locked, false);
  });

  console.log('==================================================');
  console.log(`📊 TEST RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityRegressionSuite();
