// ============================================================================
// MULTI-TRANSPORTER FIXED-RATE DISPATCH ACCESS & APPROVAL WORKFLOW TEST SUITE
// ============================================================================

import assert from 'assert';

console.log('======================================================================');
console.log('🧪 RUNNING MULTI-TRANSPORTER FIXED-RATE DISPATCH ACCESS TEST SUITE');
console.log('======================================================================');

let passedTests = 0;
let failedTests = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    if (err.stack) console.error(`     ${err.stack.split('\n')[1]}`);
    failedTests++;
  }
}

// -------------------------------------------------------------
// 1. Simulation Engine for Backend Authorization & State
// -------------------------------------------------------------

class MockDatabase {
  constructor() {
    this.requirements = [];
    this.requirement_items = [];
    this.rate_submissions = [];
    this.requirement_dispatch_authorizations = [];
    this.truck_dispatches = [];
  }

  createRequirementWithItem(reqData, itemData) {
    this.requirements.push(reqData);
    this.requirement_items.push(itemData);
  }

  submitBid(bidData) {
    this.rate_submissions.push(bidData);
  }

  finalizeBid(bidId, finalizedRate, adminUser = 'admin') {
    const bid = this.rate_submissions.find(b => b.id === bidId);
    if (!bid) throw new Error('Bid not found');
    bid.is_finalized = 1;
    bid.bid_status = 'FINALIZED';
    bid.final_rate = finalizedRate;
    bid.rate_per_mt = finalizedRate;
    bid.finalized_at = new Date().toISOString();
    bid.finalized_by = adminUser;

    // Automatically upsert WINNER authorization
    const authId = `auth_win_${bidId}`;
    const existing = this.requirement_dispatch_authorizations.find(
      a => a.requirement_id === bid.requirement_id && a.requirement_item_id === (bid.item_id || 'MAIN') && a.transporter_id === bid.transporter_id
    );
    if (existing) {
      existing.authorization_status = 'WINNER';
      existing.fixed_rate = finalizedRate;
      existing.approved_at = new Date().toISOString();
      existing.approved_by = adminUser;
    } else {
      this.requirement_dispatch_authorizations.push({
        id: authId,
        requirement_id: bid.requirement_id,
        requirement_item_id: bid.item_id || 'MAIN',
        sub_indent_no: null,
        transporter_id: bid.transporter_id,
        fixed_rate: finalizedRate,
        authorization_status: 'WINNER',
        requested_at: null,
        requested_by: null,
        approved_at: new Date().toISOString(),
        approved_by: adminUser,
        rejected_at: null,
        rejected_by: null,
        created_at: new Date().toISOString()
      });
    }
  }

  requestDispatchAccess(reqId, itemId, transporterId, username) {
    const item = this.requirement_items.find(i => i.requirement_id === reqId && (i.id === itemId || i.sub_indent_no === itemId));
    const actualItemId = item ? item.id : itemId;

    // Resolve fixed rate
    const finBid = this.rate_submissions.find(
      s => s.requirement_id === reqId && (s.item_id === actualItemId || s.item_id === item?.sub_indent_no || s.item_id === 'MAIN') &&
      (s.is_finalized === 1 || s.bid_status === 'FINALIZED' || s.final_rate > 0)
    );
    if (!finBid) {
      return { success: false, status: 400, code: 'RATE_NOT_FINALIZED', error: 'No fixed finalized rate exists' };
    }
    const fixedRate = finBid.final_rate || finBid.rate_per_mt;

    const existingAuth = this.requirement_dispatch_authorizations.find(
      a => a.requirement_id === reqId && a.requirement_item_id === actualItemId && a.transporter_id === transporterId
    );

    if (existingAuth) {
      if (existingAuth.authorization_status === 'WINNER' || existingAuth.authorization_status === 'APPROVED') {
        return { success: false, status: 400, code: 'ALREADY_AUTHORIZED', error: 'Already authorized' };
      }
      if (existingAuth.authorization_status === 'PENDING') {
        return { success: false, status: 400, code: 'REQUEST_ALREADY_PENDING', error: 'Request already pending' };
      }
      // Re-apply if rejected
      existingAuth.authorization_status = 'PENDING';
      existingAuth.fixed_rate = fixedRate;
      existingAuth.requested_at = new Date().toISOString();
      existingAuth.requested_by = username || transporterId;
      existingAuth.rejected_at = null;
      existingAuth.rejected_by = null;
      return { success: true, data: existingAuth };
    }

    const newAuth = {
      id: `auth_req_${Date.now()}_${Math.random().toString(36).substring(2,6)}`,
      requirement_id: reqId,
      requirement_item_id: actualItemId,
      sub_indent_no: item?.sub_indent_no || null,
      transporter_id: transporterId,
      fixed_rate: fixedRate,
      authorization_status: 'PENDING',
      requested_at: new Date().toISOString(),
      requested_by: username || transporterId,
      approved_at: null,
      approved_by: null,
      rejected_at: null,
      rejected_by: null,
      created_at: new Date().toISOString()
    };
    this.requirement_dispatch_authorizations.push(newAuth);
    return { success: true, data: newAuth };
  }

  adminApproveDispatchAccess(authId, adminUser = 'admin') {
    const auth = this.requirement_dispatch_authorizations.find(a => a.id === authId);
    if (!auth) return { success: false, status: 404, error: 'Not found' };
    auth.authorization_status = 'APPROVED';
    auth.approved_at = new Date().toISOString();
    auth.approved_by = adminUser;
    return { success: true, data: auth };
  }

  adminRejectDispatchAccess(authId, remarks = 'Rejected by Admin', adminUser = 'admin') {
    const auth = this.requirement_dispatch_authorizations.find(a => a.id === authId);
    if (!auth) return { success: false, status: 404, error: 'Not found' };
    auth.authorization_status = 'REJECTED';
    auth.rejected_at = new Date().toISOString();
    auth.rejected_by = adminUser;
    auth.remarks = remarks;
    return { success: true, data: auth };
  }

  createTruckDispatch(reqId, itemId, transporterId, loadedQty, truckNo = 'MH-12-AB-1234', userRole = 'transporter') {
    const item = this.requirement_items.find(i => i.requirement_id === reqId && (i.id === itemId || i.sub_indent_no === itemId));
    if (!item) return { success: false, status: 404, error: 'Item not found' };

    // Check fixed rate
    const finBid = this.rate_submissions.find(
      s => s.requirement_id === reqId && (s.item_id === item.id || s.item_id === item.sub_indent_no || s.item_id === 'MAIN') &&
      (s.is_finalized === 1 || s.bid_status === 'FINALIZED' || s.final_rate > 0)
    );
    if (!finBid) return { success: false, status: 400, code: 'RATE_NOT_FINALIZED', error: 'Freight rate is not finalized' };

    const fixedRate = finBid.final_rate || finBid.rate_per_mt;

    // Check Server-side authorization in requirement_dispatch_authorizations
    if (userRole !== 'admin') {
      const auth = this.requirement_dispatch_authorizations.find(
        a => a.requirement_id === reqId &&
             (a.requirement_item_id === item.id || a.requirement_item_id === item.sub_indent_no || a.requirement_item_id === 'MAIN') &&
             a.transporter_id === transporterId &&
             (a.authorization_status === 'WINNER' || a.authorization_status === 'APPROVED')
      );

      // Fallback check against finalized bid for legacy records
      const isLegacyWinner = (finBid.transporter_id === transporterId);

      if (!auth && !isLegacyWinner) {
        return {
          success: false,
          status: 403,
          code: 'TRANSPORTER_NOT_AUTHORIZED_FOR_DISPATCH',
          error: 'You are not authorized to dispatch against this allocation.'
        };
      }
    }

    // Global Remaining Balance check
    const currentDispatches = this.truck_dispatches.filter(d => d.requirement_id === reqId && (d.requirement_item_id === item.id || d.requirement_item_id === item.sub_indent_no));
    const alreadyDispatched = currentDispatches.reduce((sum, d) => sum + d.loaded_quantity_mt, 0);
    const totalItemQty = item.quantity_mt;
    const currentRemaining = Math.max(0, totalItemQty - alreadyDispatched);

    if (loadedQty > currentRemaining + 0.001) {
      return {
        success: false,
        status: 400,
        code: 'DISPATCH_EXCEEDS_REMAINING_QUANTITY',
        error: `Loaded quantity (${loadedQty} MT) exceeds remaining quantity (${currentRemaining} MT).`
      };
    }

    // Create dispatch
    const disp = {
      id: `disp_${Date.now()}_${Math.random().toString(36).substring(2,6)}`,
      requirement_id: reqId,
      requirement_item_id: item.id,
      transporter_id: transporterId,
      finalized_rate: fixedRate,
      truck_number: truckNo,
      loaded_quantity_mt: loadedQty,
      dispatched_at: new Date().toISOString()
    };
    this.truck_dispatches.push(disp);

    // Update item balances
    const newDispatched = alreadyDispatched + loadedQty;
    const newRemaining = Math.max(0, totalItemQty - newDispatched);
    item.dispatched_quantity_mt = newDispatched;
    item.remaining_quantity_mt = newRemaining;
    item.dispatch_status = newRemaining <= 0 ? 'FULLY_DISPATCHED' : 'PARTIALLY_DISPATCHED';

    return {
      success: true,
      dispatch: disp,
      newDispatched,
      newRemaining
    };
  }

  buildTransporterView(transporterId) {
    const openList = [];
    for (const req of this.requirements) {
      const items = this.requirement_items.filter(i => i.requirement_id === req.id);
      for (const item of items) {
        const dispatches = this.truck_dispatches.filter(d => d.requirement_id === req.id && (d.requirement_item_id === item.id || d.requirement_item_id === item.sub_indent_no));
        const totalDispatched = dispatches.reduce((sum, d) => sum + d.loaded_quantity_mt, 0);
        const remQty = Math.max(0, item.quantity_mt - totalDispatched);
        if (remQty <= 0) continue;

        const finBid = this.rate_submissions.find(
          s => s.requirement_id === req.id && (s.item_id === item.id || s.item_id === item.sub_indent_no || s.item_id === 'MAIN') &&
          (s.is_finalized === 1 || s.bid_status === 'FINALIZED' || s.final_rate > 0)
        );

        let fixedRate = finBid ? (finBid.final_rate || finBid.rate_per_mt) : null;
        let winningTransporterId = finBid ? finBid.transporter_id : null;
        const isWinningTransporter = Boolean(winningTransporterId && winningTransporterId === transporterId);

        const myAuth = this.requirement_dispatch_authorizations.find(
          a => a.requirement_id === req.id &&
               (a.requirement_item_id === item.id || a.requirement_item_id === item.sub_indent_no || a.requirement_item_id === 'MAIN') &&
               a.transporter_id === transporterId
        );

        let authStatus = null;
        if (isWinningTransporter) {
          authStatus = 'WINNER';
        } else if (myAuth) {
          authStatus = myAuth.authorization_status;
        }

        const canDispatch = authStatus === 'WINNER' || authStatus === 'APPROVED';
        const isFixedRateAllocation = fixedRate !== null;

        openList.push({
          requirement_id: req.id,
          req_no: req.req_no,
          item_id: item.id,
          sub_indent_no: item.sub_indent_no,
          total_qty: item.quantity_mt,
          dispatched_qty: totalDispatched,
          remaining_qty: remQty,
          fixed_rate: fixedRate,
          is_fixed_rate_allocation: isFixedRateAllocation,
          can_dispatch: canDispatch,
          auth_status: authStatus,
          is_winning_transporter: isWinningTransporter,
          requires_new_bid: !isFixedRateAllocation && fixedRate === null
        });
      }
    }
    return openList;
  }
}

// -------------------------------------------------------------
// EXECUTE THE 16 TEST SCENARIOS
// -------------------------------------------------------------

const db = new MockDatabase();

// Setup Requirement: 100 MT
db.createRequirementWithItem(
  { id: 'req_100', req_no: 'REQ-0100', status: 'OPEN' },
  { id: 'item_100_1', requirement_id: 'req_100', sub_indent_no: 'REQ-0100/01', quantity_mt: 100, dispatched_quantity_mt: 0, remaining_quantity_mt: 100, dispatch_status: 'PENDING' }
);

// Transporters submit bids
db.submitBid({ id: 'bid_A', requirement_id: 'req_100', item_id: 'item_100_1', transporter_id: 'trans_A', rate_per_mt: 50 });
db.submitBid({ id: 'bid_B', requirement_id: 'req_100', item_id: 'item_100_1', transporter_id: 'trans_B', rate_per_mt: 55 });
db.submitBid({ id: 'bid_C', requirement_id: 'req_100', item_id: 'item_100_1', transporter_id: 'trans_C', rate_per_mt: 60 });

// TEST 1: Admin finalizes Transporter A at ₹50. Only A initially authorized.
it('TEST 1: Admin finalizes Transporter A at ₹50. Only A is initially authorized for dispatch.', () => {
  db.finalizeBid('bid_A', 50);

  const viewA = db.buildTransporterView('trans_A')[0];
  const viewB = db.buildTransporterView('trans_B')[0];
  const viewC = db.buildTransporterView('trans_C')[0];

  assert.strictEqual(viewA.auth_status, 'WINNER');
  assert.strictEqual(viewA.can_dispatch, true);
  assert.strictEqual(viewA.is_fixed_rate_allocation, true);

  assert.strictEqual(viewB.auth_status, null);
  assert.strictEqual(viewB.can_dispatch, false);

  assert.strictEqual(viewC.auth_status, null);
  assert.strictEqual(viewC.can_dispatch, false);
});

// TEST 2: A dispatches 50 MT. Remaining = 50. A still sees dispatch.
it('TEST 2: Transporter A dispatches 50 MT. Remaining becomes 50 MT. Transporter A still has Dispatch enabled.', () => {
  const dispRes = db.createTruckDispatch('req_100', 'item_100_1', 'trans_A', 50, 'MH-12-AA-1111');
  assert.strictEqual(dispRes.success, true);
  assert.strictEqual(dispRes.newRemaining, 50);

  const viewA = db.buildTransporterView('trans_A')[0];
  assert.strictEqual(viewA.remaining_qty, 50);
  assert.strictEqual(viewA.can_dispatch, true);
  assert.strictEqual(viewA.fixed_rate, 50);
});

// TEST 3: B and C can see remaining allocation.
it('TEST 3: Transporters B and C can see the remaining 50 MT allocation.', () => {
  const viewB = db.buildTransporterView('trans_B')[0];
  const viewC = db.buildTransporterView('trans_C')[0];

  assert.strictEqual(viewB.remaining_qty, 50);
  assert.strictEqual(viewC.remaining_qty, 50);
});

// TEST 4: B and C see fixed rate ₹50.
it('TEST 4: Transporters B and C see the fixed finalized rate ₹50/MT locked.', () => {
  const viewB = db.buildTransporterView('trans_B')[0];
  const viewC = db.buildTransporterView('trans_C')[0];

  assert.strictEqual(viewB.fixed_rate, 50);
  assert.strictEqual(viewC.fixed_rate, 50);
  assert.strictEqual(viewB.is_fixed_rate_allocation, true);
  assert.strictEqual(viewC.is_fixed_rate_allocation, true);
});

// TEST 5: B and C cannot submit new quote.
it('TEST 5: Transporters B and C cannot submit a new quotation (requires_new_bid is false).', () => {
  const viewB = db.buildTransporterView('trans_B')[0];
  const viewC = db.buildTransporterView('trans_C')[0];

  assert.strictEqual(viewB.requires_new_bid, false);
  assert.strictEqual(viewC.requires_new_bid, false);
});

// TEST 6: B requests dispatch access. Status becomes PENDING.
let reqAuthB = null;
it('TEST 6: Transporter B requests dispatch access. Authorization record is created with status PENDING.', () => {
  const reqRes = db.requestDispatchAccess('req_100', 'item_100_1', 'trans_B', 'transporter_b');
  assert.strictEqual(reqRes.success, true);
  assert.strictEqual(reqRes.data.authorization_status, 'PENDING');
  assert.strictEqual(reqRes.data.fixed_rate, 50);
  reqAuthB = reqRes.data;

  const viewB = db.buildTransporterView('trans_B')[0];
  assert.strictEqual(viewB.auth_status, 'PENDING');
  assert.strictEqual(viewB.can_dispatch, false);
});

// TEST 7: B cannot dispatch while pending. Backend returns HTTP 403.
it('TEST 7: Transporter B cannot dispatch while status is PENDING. Backend returns HTTP 403 TRANSPORTER_NOT_AUTHORIZED_FOR_DISPATCH.', () => {
  const dispRes = db.createTruckDispatch('req_100', 'item_100_1', 'trans_B', 20, 'MH-12-BB-2222');
  assert.strictEqual(dispRes.success, false);
  assert.strictEqual(dispRes.status, 403);
  assert.strictEqual(dispRes.code, 'TRANSPORTER_NOT_AUTHORIZED_FOR_DISPATCH');
});

// TEST 8: Admin approves B. B authorization becomes APPROVED.
it('TEST 8: Admin approves Transporter B request. Authorization status transitions to APPROVED.', () => {
  const appRes = db.adminApproveDispatchAccess(reqAuthB.id, 'admin');
  assert.strictEqual(appRes.success, true);
  assert.strictEqual(appRes.data.authorization_status, 'APPROVED');

  const viewB = db.buildTransporterView('trans_B')[0];
  assert.strictEqual(viewB.auth_status, 'APPROVED');
  assert.strictEqual(viewB.can_dispatch, true);
});

// TEST 9: B can now dispatch.
it('TEST 9: Transporter B can now dispatch trucks against the remaining balance.', () => {
  const dispRes = db.createTruckDispatch('req_100', 'item_100_1', 'trans_B', 20, 'MH-12-BB-2222');
  assert.strictEqual(dispRes.success, true);
  assert.strictEqual(dispRes.newRemaining, 30);
  assert.strictEqual(dispRes.dispatch.finalized_rate, 50);
});

// TEST 10: A remains authorized after B approval.
it('TEST 10: Transporter A (original winner) remains fully authorized after Transporter B approval.', () => {
  const viewA = db.buildTransporterView('trans_A')[0];
  assert.strictEqual(viewA.auth_status, 'WINNER');
  assert.strictEqual(viewA.can_dispatch, true);
  assert.strictEqual(viewA.remaining_qty, 30);
});

// TEST 11: A dispatches 20 and B dispatches 10. Global total = 100. Remaining = 0.
it('TEST 11: Transporter A dispatches 20 MT and Transporter B dispatches 10 MT. Total reaches 100 MT and Remaining becomes 0.', () => {
  const dispA = db.createTruckDispatch('req_100', 'item_100_1', 'trans_A', 20, 'MH-12-AA-3333');
  assert.strictEqual(dispA.success, true);
  assert.strictEqual(dispA.newRemaining, 10);

  const dispB = db.createTruckDispatch('req_100', 'item_100_1', 'trans_B', 10, 'MH-12-BB-4444');
  assert.strictEqual(dispB.success, true);
  assert.strictEqual(dispB.newRemaining, 0);

  // Both views should now see completed/0 remaining (no more open items)
  const openA = db.buildTransporterView('trans_A');
  const openB = db.buildTransporterView('trans_B');
  assert.strictEqual(openA.length, 0);
  assert.strictEqual(openB.length, 0);
});

// TEST 12: No dispatch can exceed global remaining balance.
it('TEST 12: Concurrency check: No dispatch can exceed the global remaining balance.', () => {
  // Create a separate requirement with 50 MT
  db.createRequirementWithItem(
    { id: 'req_bal', req_no: 'REQ-BAL', status: 'OPEN' },
    { id: 'item_bal_1', requirement_id: 'req_bal', sub_indent_no: 'REQ-BAL/01', quantity_mt: 50, dispatched_quantity_mt: 0, remaining_quantity_mt: 50, dispatch_status: 'PENDING' }
  );
  db.submitBid({ id: 'bid_bal_A', requirement_id: 'req_bal', item_id: 'item_bal_1', transporter_id: 'trans_A', rate_per_mt: 50 });
  db.finalizeBid('bid_bal_A', 50);

  // Attempt dispatch 60 MT against 50 MT allocation
  const overRes = db.createTruckDispatch('req_bal', 'item_bal_1', 'trans_A', 60);
  assert.strictEqual(overRes.success, false);
  assert.strictEqual(overRes.code, 'DISPATCH_EXCEEDS_REMAINING_QUANTITY');
});

// TEST 13: Authorization does not leak between /01 and /02.
it('TEST 13: Isolation check: Authorization for /01 does not leak to /02 sub-indent.', () => {
  // Add /02 item to req_bal
  db.createRequirementWithItem(
    { id: 'req_bal_dummy', req_no: 'REQ-BAL-DUMMY' }, // dummy
    { id: 'item_bal_2', requirement_id: 'req_bal', sub_indent_no: 'REQ-BAL/02', quantity_mt: 50, dispatched_quantity_mt: 0, remaining_quantity_mt: 50, dispatch_status: 'PENDING' }
  );
  db.submitBid({ id: 'bid_bal_2_C', requirement_id: 'req_bal', item_id: 'item_bal_2', transporter_id: 'trans_C', rate_per_mt: 45 });
  db.finalizeBid('bid_bal_2_C', 45);

  // Transporter A is WINNER on /01, but NOT authorized on /02
  const dispA_on_item2 = db.createTruckDispatch('req_bal', 'item_bal_2', 'trans_A', 20);
  assert.strictEqual(dispA_on_item2.success, false);
  assert.strictEqual(dispA_on_item2.status, 403);
  assert.strictEqual(dispA_on_item2.code, 'TRANSPORTER_NOT_AUTHORIZED_FOR_DISPATCH');
});

// TEST 14: Same transporter cannot create duplicate pending request.
it('TEST 14: Uniqueness check: Same transporter cannot create duplicate pending requests for the same item.', () => {
  // Transporter B requests access on item_bal_2
  const req1 = db.requestDispatchAccess('req_bal', 'item_bal_2', 'trans_B', 'transporter_b');
  assert.strictEqual(req1.success, true);
  assert.strictEqual(req1.data.authorization_status, 'PENDING');

  // Second attempt
  const req2 = db.requestDispatchAccess('req_bal', 'item_bal_2', 'trans_B', 'transporter_b');
  assert.strictEqual(req2.success, false);
  assert.strictEqual(req2.code, 'REQUEST_ALREADY_PENDING');
});

// TEST 15: Fixed rate remains unchanged across all authorized transporters.
it('TEST 15: Immutability check: Fixed rate remains unchanged at ₹45 across all dispatches.', () => {
  const reqB = db.requirement_dispatch_authorizations.find(a => a.requirement_id === 'req_bal' && a.requirement_item_id === 'item_bal_2' && a.transporter_id === 'trans_B');
  db.adminApproveDispatchAccess(reqB.id);

  const dispB = db.createTruckDispatch('req_bal', 'item_bal_2', 'trans_B', 25, 'MH-12-BB-9999');
  assert.strictEqual(dispB.success, true);
  assert.strictEqual(dispB.dispatch.finalized_rate, 45);

  const dispC = db.createTruckDispatch('req_bal', 'item_bal_2', 'trans_C', 25, 'MH-12-CC-9999');
  assert.strictEqual(dispC.success, true);
  assert.strictEqual(dispC.dispatch.finalized_rate, 45);
});

// TEST 16: Unauthorized transporter cannot bypass frontend using direct API call.
it('TEST 16: Security check: Unauthorized transporter (Transporter A on item_bal_2) cannot bypass with direct API call.', () => {
  const directApiDisp = db.createTruckDispatch('req_bal', 'item_bal_2', 'trans_A', 10, 'MH-12-HACK-01');
  assert.strictEqual(directApiDisp.success, false);
  assert.strictEqual(directApiDisp.status, 403);
  assert.strictEqual(directApiDisp.code, 'TRANSPORTER_NOT_AUTHORIZED_FOR_DISPATCH');
});

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log('======================================================================');
console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('======================================================================');

if (failedTests > 0) {
  process.exit(1);
}
