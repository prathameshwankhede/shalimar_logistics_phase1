// scratch/verify_live_bid_read_write.mjs
// Final Production Bid Read/Write Verification Script for Shalimar Logistics

import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../server/index.js';
import { generateToken } from '../server/middleware/auth.js';
import { pool } from '../server/config/db.js';

async function runProductionBidVerification() {
  console.log('==================================================');
  console.log('🧪 FINAL PRODUCTION BID READ/WRITE VERIFICATION');
  console.log('==================================================');

  const PORT = 3108;
  const server = app.listen(PORT);

  const testTransporterId = 'trans_abc_001';
  const transporterToken = generateToken({
    id: 'usr_abc_001',
    username: 'ABC001',
    role: 'transporter',
    transporter_id: testTransporterId,
    name: 'ABC Freight Logistics'
  });

  const testRequestId = 'req_delhi_mumbai_001';
  const initialRate = 1850.00;
  const updatedRate = 1780.00;

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

  function getSubmissions() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/rate-submissions',
        method: 'GET',
        headers: {
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
      req.end();
    });
  }

  try {
    // 1. Submit Initial Bid
    console.log(`\n1. Submitting new test bid (Rate: ₹${initialRate}/MT)...`);
    const bidId = `sub_${testTransporterId}_${Date.now()}`;
    const initialPayload = {
      id: bidId,
      rate_request_id: testRequestId,
      request_no: 'REQ-DEL-MUM-01',
      transporter_id: testTransporterId,
      transporter_name: 'ABC Freight Logistics',
      rate_per_unit: initialRate,
      vehicle_type: '32FT Trailer',
      comments: 'Initial Production Test Bid',
      status: 'Submitted'
    };

    const res1 = await sendPostBid(initialPayload);
    console.log(`  • POST /api/bids HTTP Status: ${res1.status}`);
    console.log(`  • API Success Flag: ${res1.body.success}`);
    console.log(`  • Bid ID Returned: ${res1.body.bid_id}`);
    console.log(`  • Affected Rows: ${res1.body.affectedRows}`);

    assert.equal(res1.status, 200, 'Expected HTTP 200 on initial bid submission');
    assert.equal(res1.body.success, true, 'Expected success: true on initial bid submission');

    // 2. Refresh Persistence Check via GET /api/rate-submissions
    console.log(`\n2. Verifying refresh persistence via GET /api/rate-submissions...`);
    const resGet = await getSubmissions();
    console.log(`  • GET /api/rate-submissions HTTP Status: ${resGet.status}`);
    const persistedBid = (resGet.body.rate_submissions || []).find(b => b.id === bidId || b.rate_request_id === testRequestId);
    assert.ok(persistedBid, 'Expected submitted bid to exist in GET /api/rate-submissions response');
    console.log(`  • Persisted Bid Rate in State: ₹${persistedBid.rate_per_unit}/MT`);
    assert.equal(persistedBid.rate_per_unit, initialRate);

    // 3. Duplicate / Update Submission Check (ON DUPLICATE KEY UPDATE)
    console.log(`\n3. Submitting updated bid for same request (Rate: ₹${updatedRate}/MT)...`);
    const updatePayload = {
      ...initialPayload,
      rate_per_unit: updatedRate,
      comments: 'Updated Production Test Rate'
    };

    const res2 = await sendPostBid(updatePayload);
    console.log(`  • POST /api/bids (Update) HTTP Status: ${res2.status}`);
    console.log(`  • API Success Flag: ${res2.body.success}`);
    console.log(`  • Affected Rows: ${res2.body.affectedRows}`);

    assert.equal(res2.status, 200, 'Expected HTTP 200 on bid update');
    assert.equal(res2.body.success, true, 'Expected success: true on bid update');

    // 4. Verify Final State
    const resGet2 = await getSubmissions();
    const updatedPersistedBid = (resGet2.body.rate_submissions || []).find(b => b.id === bidId || b.rate_request_id === testRequestId);
    assert.ok(updatedPersistedBid, 'Expected updated bid to exist');
    assert.equal(updatedPersistedBid.rate_per_unit, updatedRate);
    console.log(`  • Final Persisted Rate after Update: ₹${updatedPersistedBid.rate_per_unit}/MT`);

    console.log('\n==================================================');
    console.log('🎉 ALL FINAL READ/WRITE BID VERIFICATION CHECKS PASSED!');
    console.log('==================================================');
  } catch (err) {
    console.error('\n❌ Production bid verification failed:', err.message);
    process.exit(1);
  } finally {
    server.close();
    process.exit(0);
  }
}

runProductionBidVerification();
