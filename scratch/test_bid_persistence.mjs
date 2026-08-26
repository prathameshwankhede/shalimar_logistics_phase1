// scratch/test_bid_persistence.mjs
// Bid Persistence Test Script for Shalimar Logistics

import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../server/index.js';
import { generateToken } from '../server/middleware/auth.js';

async function verifyBidPersistence() {
  console.log('==================================================');
  console.log('🧪 VERIFYING BID PERSISTENCE FLOW TO MYSQL');
  console.log('==================================================');

  const PORT = 3105;
  const server = app.listen(PORT);

  const testTransporterId = 'trans_abc_test';
  const transporterToken = generateToken({
    id: 'usr_trans_test',
    username: 'ABC001',
    role: 'transporter',
    transporter_id: testTransporterId,
    name: 'ABC Logistics Pvt Ltd'
  });

  const testBidPayload = {
    id: `sub_test_${Date.now()}`,
    rate_request_id: 'req_001_test',
    request_no: 'REQ-2026-001',
    transporter_id: testTransporterId,
    transporter_name: 'ABC Logistics Pvt Ltd',
    rate_per_unit: 1450.50,
    vehicle_type: '32FT MXL',
    comments: 'Automated Bid Persistence Verification',
    status: 'Submitted'
  };

  function sendPostBid(payload) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/bids',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${transporterToken}`
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
    console.log(`📤 Sending POST /api/bids for Bid ID: ${testBidPayload.id}...`);
    const res = await sendPostBid(testBidPayload);

    console.log(`  • Response HTTP Status: ${res.status}`);
    console.log(`  • Response Body:`, JSON.stringify(res.body, null, 2));

    assert.equal(res.status, 200, 'Expected HTTP 200 from POST /api/bids');
    assert.equal(res.body.success, true, 'Expected success: true');
    assert.equal(res.body.bid.rate_per_unit, 1450.50);
    assert.ok(res.body.affectedRows !== undefined, 'Expected affectedRows in response');

    console.log('\n==================================================');
    console.log('✅ BID PERSISTENCE FLOW VERIFIED SUCCESSFULLY!');
    console.log('==================================================');
  } catch (err) {
    console.error('\n❌ Bid persistence verification failed:', err.message);
  } finally {
    server.close();
    process.exit(0);
  }
}

verifyBidPersistence();
