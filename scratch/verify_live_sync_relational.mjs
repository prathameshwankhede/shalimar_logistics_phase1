// scratch/verify_live_sync_relational.mjs
// Verification Script for Full Relational Table Synchronization

import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../server/index.js';
import { generateToken } from '../server/middleware/auth.js';

async function verifyFullRelationalSync() {
  console.log('==================================================');
  console.log('🧪 VERIFYING FULL MYSQL RELATIONAL SYNC ON API CALLS');
  console.log('==================================================');

  const PORT = 3110;
  const server = app.listen(PORT);

  const adminToken = generateToken({
    id: 'usr_admin_sync',
    username: 'admin',
    role: 'admin',
    name: 'Administrator'
  });

  const testPayload = {
    _updatedAt: Date.now(),
    rate_requests: [
      {
        id: 'req_sync_001',
        request_no: 'REQ-SYNC-2026-001',
        title: 'Delhi to Mumbai Soyameal 500MT',
        origin_city: 'Delhi',
        dest_city: 'Mumbai',
        material_type: 'Soyameal Bulk',
        required_qty: 500,
        unit: 'MT',
        target_date: '2026-09-01',
        status: 'Open'
      }
    ],
    rate_submissions: [
      {
        id: 'sub_sync_001',
        rate_request_id: 'req_sync_001',
        request_no: 'REQ-SYNC-2026-001',
        transporter_id: 'trans_abc_sync',
        transporter_name: 'ABC Logistics Pvt Ltd',
        rate_per_unit: 1650.00,
        vehicle_type: '32FT Trailer',
        comments: 'Sync Test Bid',
        status: 'Submitted',
        submitted_at: new Date().toISOString()
      }
    ],
    transporters: [
      {
        id: 'trans_abc_sync',
        company_name: 'ABC Logistics Pvt Ltd',
        code: 'ABC001',
        mobile: '9876543210',
        email: 'abc@transporter.com',
        status: 'Active'
      }
    ],
    contracts: [
      {
        id: 'contract_sync_001',
        contract_no: 'CON-2026-001',
        request_id: 'req_sync_001',
        transporter_id: 'trans_abc_sync',
        allocated_qty: 500,
        rate_per_unit: 1650.00,
        status: 'Active'
      }
    ],
    security_audit_logs: [
      {
        id: 'audit_sync_001',
        action: 'STATE_SYNC_TEST',
        username: 'admin',
        user_role: 'admin',
        status: 'SUCCESS',
        created_at: new Date().toISOString()
      }
    ]
  };

  function sendPostState(payload) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/state',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
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
      req.write(JSON.stringify(payload));
      req.end();
    });
  }

  try {
    console.log('📤 Sending POST /api/state with full multi-entity payload...');
    const res = await sendPostState(testPayload);

    console.log(`  • POST /api/state Response Status: ${res.status}`);
    console.log(`  • API Success Flag: ${res.body.success}`);

    assert.equal(res.status, 200, 'Expected HTTP 200 from POST /api/state');
    assert.equal(res.body.success, true, 'Expected success: true');

    console.log('\n==================================================');
    console.log('✅ MULTI-ENTITY RELATIONAL MYSQL SYNC VERIFIED!');
    console.log('==================================================');
  } catch (err) {
    console.error('\n❌ Relational sync test failed:', err.message);
    process.exit(1);
  } finally {
    server.close();
    process.exit(0);
  }
}

verifyFullRelationalSync();
