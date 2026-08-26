// tests/api_functional_test.js
// Comprehensive API Functional & Production Verification Suite

import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../server/index.js';
import { generateToken } from '../server/middleware/auth.js';

async function runApiFunctionalDiagnostic() {
  console.log('==================================================');
  console.log('🔌 RUNNING SHALIMAR LOGISTICS PRODUCTION VERIFICATION');
  console.log('==================================================');

  const PORT = 3099;
  const server = app.listen(PORT);

  const adminToken = generateToken({ id: 'usr_admin', username: 'admin', role: 'admin' });
  const transporterToken = generateToken({ id: 'usr_abc', username: 'ABC001', role: 'transporter', transporter_id: 'trans_abc' });

  let passed = 0;
  let failed = 0;

  function request(method, path, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      });

      req.on('error', reject);

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  async function testApi(description, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${description}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Health Check Test
  await testApi('GET /api/health returns HTTP 200 ok', async () => {
    const res = await request('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  // 2. Authentication Login Test
  await testApi('POST /api/auth/login with valid credentials returns token & user DTO', async () => {
    const res = await request('POST', '/api/auth/login', {}, { username: 'admin', password: 'admin123' });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.token);
    assert.equal(res.body.user.username, 'admin');
    assert.equal(res.body.user.password, undefined);
  });

  // 3. Unauthenticated Access Protection
  await testApi('GET /api/dashboard without token returns HTTP 401 Unauthorized', async () => {
    const res = await request('GET', '/api/dashboard');
    assert.equal(res.status, 401);
  });

  // 4. Production Database Failure Test (Ensures NO Fake Seed Data in Production)
  await testApi('Production mode database error returns HTTP 503 without fake seed data', async () => {
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_SEED_FALLBACK = 'false';

    const res = await request('GET', '/api/dashboard', { Authorization: `Bearer ${adminToken}` });
    
    // When DB is unavailable in production, must return HTTP 503 DATABASE_UNAVAILABLE
    assert.equal(res.status, 503);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'DATABASE_UNAVAILABLE');

    process.env.NODE_ENV = oldEnv;
  });

  // 5. Admin Audit Logs Role Restriction Test
  await testApi('GET /api/security/audit-logs returns 403 for Transporter and 200 for Admin', async () => {
    const resForbidden = await request('GET', '/api/security/audit-logs', { Authorization: `Bearer ${transporterToken}` });
    assert.equal(resForbidden.status, 403);

    const resAllowed = await request('GET', '/api/security/audit-logs', { Authorization: `Bearer ${adminToken}` });
    assert.equal(resAllowed.status, 200);
    assert.equal(resAllowed.body.success, true);
  });

  server.close();

  console.log('==================================================');
  console.log(`📊 PRODUCTION VERIFICATION RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runApiFunctionalDiagnostic();
