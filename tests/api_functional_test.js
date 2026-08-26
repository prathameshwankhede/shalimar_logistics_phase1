// tests/api_functional_test.js
// Comprehensive API Functional Diagnostic Suite for Shalimar Logistics

import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../server/index.js';
import { generateToken } from '../server/middleware/auth.js';

async function runApiFunctionalDiagnostic() {
  console.log('==================================================');
  console.log('🔌 RUNNING SHALIMAR LOGISTICS API REPAIR DIAGNOSTIC');
  console.log('==================================================');

  // Start temporary local server on port 3099 for testing
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

  // 4. Authenticated Dashboard Test
  await testApi('GET /api/dashboard with valid token returns HTTP 200 summary DTO', async () => {
    const res = await request('GET', '/api/dashboard', { Authorization: `Bearer ${adminToken}` });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.dashboard);
  });

  // 5. Rate Requests Paginated Test
  await testApi('GET /api/rate-requests returns HTTP 200 paginated indents DTO', async () => {
    const res = await request('GET', '/api/rate-requests?page=1&limit=10', { Authorization: `Bearer ${adminToken}` });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.rate_requests));
  });

  // 6. Role Scoped Rate Submissions Test
  await testApi('GET /api/rate-submissions returns scoped submissions DTO', async () => {
    const res = await request('GET', '/api/rate-submissions', { Authorization: `Bearer ${transporterToken}` });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.rate_submissions));
  });

  // 7. Transporters List Test
  await testApi('GET /api/transporters returns HTTP 200 minimal transporters list', async () => {
    const res = await request('GET', '/api/transporters', { Authorization: `Bearer ${adminToken}` });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.transporters));
  });

  // 8. Master Data Test
  await testApi('GET /api/master-data returns HTTP 200 master records DTO', async () => {
    const res = await request('GET', '/api/master-data', { Authorization: `Bearer ${adminToken}` });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.master_records));
  });

  // 9. Admin Audit Logs Role Restriction Test
  await testApi('GET /api/security/audit-logs returns 403 for Transporter and 200 for Admin', async () => {
    const resForbidden = await request('GET', '/api/security/audit-logs', { Authorization: `Bearer ${transporterToken}` });
    assert.equal(resForbidden.status, 403);

    const resAllowed = await request('GET', '/api/security/audit-logs', { Authorization: `Bearer ${adminToken}` });
    assert.equal(resAllowed.status, 200);
    assert.equal(resAllowed.body.success, true);
  });

  server.close();

  console.log('==================================================');
  console.log(`📊 API FUNCTIONAL DIAGNOSTIC RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runApiFunctionalDiagnostic();
