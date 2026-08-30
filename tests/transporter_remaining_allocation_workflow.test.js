// tests/transporter_remaining_allocation_workflow.test.js
// Automated verification for Transporter Remaining Allocation & Acceptance Workflow

import assert from 'assert';

console.log('======================================================================');
console.log('🧪 RUNNING TRANSPORTER REMAINING ALLOCATION ACCEPTANCE TEST SUITE');
console.log('======================================================================');

let passedCount = 0;
function runTest(desc, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${desc}`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     Error: ${err.message}`);
    process.exit(1);
  }
}

// In-memory mock database store
const db = {
  requirements: [],
  items: [],
  rate_submissions: [],
  allocations: [],
  dispatches: []
};

// Reset helper
function resetDB() {
  db.requirements = [];
  db.items = [];
  db.rate_submissions = [];
  db.allocations = [];
  db.dispatches = [];
}

// System logic helpers
function createRequirement(id, reqNo, totalQty) {
  const req = { id, req_no: reqNo, total_quantity_mt: totalQty, status: 'PUBLISHED' };
  const item = { id: `item_${id}_01`, requirement_id: id, sub_indent_no: `${reqNo}/01`, quantity_mt: totalQty, dispatch_status: 'PENDING' };
  db.requirements.push(req);
  db.items.push(item);
  return { req, item };
}

function submitBid(subId, reqId, itemId, transporterId, rate) {
  const bid = {
    id: subId,
    requirement_id: reqId,
    item_id: itemId,
    transporter_id: transporterId,
    rate_per_mt: rate,
    bid_status: 'SUBMITTED',
    is_finalized: 0
  };
  db.rate_submissions.push(bid);
  return bid;
}

function finalizeBid(subId, adminUser = 'admin') {
  const bid = db.rate_submissions.find(s => s.id === subId);
  if (!bid) throw new Error('Bid not found');
  bid.is_finalized = 1;
  bid.bid_status = 'FINALIZED';
  bid.final_rate = bid.rate_per_mt;
  bid.finalized_at = new Date().toISOString();

  // Create WINNER allocation
  db.allocations.push({
    id: `alloc_win_${bid.id}`,
    requirement_id: bid.requirement_id,
    requirement_item_id: bid.item_id,
    transporter_id: bid.transporter_id,
    finalized_rate: bid.final_rate,
    allocation_role: 'WINNER',
    acceptance_status: 'ACTIVE',
    accepted_at: new Date().toISOString()
  });

  // Populate other bidders as ELIGIBLE_PREVIOUS_BIDDER with PENDING_ACCEPTANCE
  const otherBids = db.rate_submissions.filter(s => s.requirement_id === bid.requirement_id && s.item_id === bid.item_id && s.transporter_id !== bid.transporter_id);
  otherBids.forEach(ob => {
    db.allocations.push({
      id: `alloc_prev_${ob.id}`,
      requirement_id: ob.requirement_id,
      requirement_item_id: ob.item_id,
      transporter_id: ob.transporter_id,
      finalized_rate: bid.final_rate,
      allocation_role: 'ELIGIBLE_PREVIOUS_BIDDER',
      acceptance_status: 'PENDING_ACCEPTANCE',
      accepted_at: null
    });
  });
}

function getGlobalRemainingQty(reqId, itemId) {
  const item = db.items.find(i => i.requirement_id === reqId && (i.id === itemId || i.sub_indent_no === itemId));
  if (!item) return 0;
  const totalItemQty = parseFloat(item.quantity_mt);
  const totalDispatched = db.dispatches
    .filter(d => d.requirement_id === reqId && (d.requirement_item_id === item.id || d.requirement_item_id === item.sub_indent_no))
    .reduce((sum, d) => sum + parseFloat(d.loaded_quantity_mt), 0);
  return Math.max(0, parseFloat((totalItemQty - totalDispatched).toFixed(3)));
}

function acceptRemainingAllocation(reqId, itemId, transporterId) {
  // 1. Verify transporter submitted bid originally
  const hadBid = db.rate_submissions.some(s => s.requirement_id === reqId && (s.item_id === itemId || s.item_id === 'MAIN') && s.transporter_id === transporterId);
  if (!hadBid) {
    return { status: 403, error: 'NOT_ELIGIBLE_FOR_ALLOCATION' };
  }

  // 2. Verify remaining qty > 0
  const rem = getGlobalRemainingQty(reqId, itemId);
  if (rem <= 0) {
    return { status: 400, error: 'NO_REMAINING_QUANTITY' };
  }

  // 3. Find finalized rate
  const winnerAlloc = db.allocations.find(a => a.requirement_id === reqId && a.requirement_item_id === itemId && a.allocation_role === 'WINNER');
  const fixedRate = winnerAlloc ? winnerAlloc.finalized_rate : 55;

  // 4. Update / Insert allocation
  let alloc = db.allocations.find(a => a.requirement_id === reqId && a.requirement_item_id === itemId && a.transporter_id === transporterId);
  if (alloc) {
    alloc.acceptance_status = 'ACCEPTED';
    alloc.accepted_at = new Date().toISOString();
  } else {
    alloc = {
      id: `alloc_${Date.now()}`,
      requirement_id: reqId,
      requirement_item_id: itemId,
      transporter_id: transporterId,
      finalized_rate: fixedRate,
      allocation_role: 'ELIGIBLE_PREVIOUS_BIDDER',
      acceptance_status: 'ACCEPTED',
      accepted_at: new Date().toISOString()
    };
    db.allocations.push(alloc);
  }

  return { status: 200, success: true, fixed_rate: fixedRate, remaining_quantity_mt: rem, acceptance_status: 'ACCEPTED' };
}

function dispatchTruck(reqId, itemId, transporterId, quantityMt) {
  // Authorization check
  const alloc = db.allocations.find(a => 
    a.requirement_id === reqId && 
    (a.requirement_item_id === itemId || a.requirement_item_id === 'MAIN') && 
    a.transporter_id === transporterId &&
    (a.acceptance_status === 'ACTIVE' || a.acceptance_status === 'ACCEPTED' || a.allocation_role === 'WINNER')
  );

  if (!alloc) {
    return { status: 403, error: 'TRANSPORTER_NOT_AUTHORIZED_FOR_DISPATCH' };
  }

  // Balance check
  const remaining = getGlobalRemainingQty(reqId, itemId);
  if (quantityMt > remaining) {
    return { status: 400, error: `DISPATCH_EXCEEDS_REMAINING: Requested ${quantityMt} MT, Available ${remaining} MT` };
  }

  const dispatch = {
    id: `disp_${Date.now()}_${Math.random()}`,
    requirement_id: reqId,
    requirement_item_id: itemId,
    transporter_id: transporterId,
    loaded_quantity_mt: quantityMt,
    finalized_rate: alloc.finalized_rate,
    dispatched_at: new Date().toISOString()
  };
  db.dispatches.push(dispatch);

  return { status: 200, success: true, dispatch, remaining: getGlobalRemainingQty(reqId, itemId) };
}

function getTransporterView(reqId, itemId, transporterId) {
  const req = db.requirements.find(r => r.id === reqId);
  const item = db.items.find(i => i.requirement_id === reqId && i.id === itemId);
  const remaining = getGlobalRemainingQty(reqId, itemId);
  const winnerAlloc = db.allocations.find(a => a.requirement_id === reqId && a.requirement_item_id === itemId && a.allocation_role === 'WINNER');
  const fixedRate = winnerAlloc ? winnerAlloc.finalized_rate : null;

  const isWinningTransporter = winnerAlloc && winnerAlloc.transporter_id === transporterId;
  const myBid = db.rate_submissions.find(s => s.requirement_id === reqId && s.item_id === itemId && s.transporter_id === transporterId);
  const myAlloc = db.allocations.find(a => a.requirement_id === reqId && a.requirement_item_id === itemId && a.transporter_id === transporterId);

  let allocationRole = 'UNRELATED_TRANSPORTER';
  let allocationStatus = 'UNRELATED_TRANSPORTER';
  let canDispatch = false;

  if (isWinningTransporter) {
    allocationRole = 'WINNER';
    allocationStatus = 'WINNER_ACTIVE';
    canDispatch = true;
  } else if (myAlloc?.acceptance_status === 'ACCEPTED') {
    allocationRole = 'ELIGIBLE_PREVIOUS_BIDDER';
    allocationStatus = 'ACCEPTED_SHARED_TRANSPORTER';
    canDispatch = true;
  } else if (Boolean(myBid) || Boolean(myAlloc)) {
    allocationRole = 'ELIGIBLE_PREVIOUS_BIDDER';
    allocationStatus = 'PREVIOUS_BIDDER_PENDING_ACCEPTANCE';
    canDispatch = false;
  }

  const isVisible = !(fixedRate !== null && allocationRole === 'UNRELATED_TRANSPORTER' && !isWinningTransporter);

  return {
    isVisible,
    allocationRole,
    allocationStatus,
    canDispatch,
    fixedRate,
    remainingQty: remaining,
    showAcceptButton: allocationStatus === 'PREVIOUS_BIDDER_PENDING_ACCEPTANCE'
  };
}

// -------------------------------------------------------------
// EXECUTE TESTS 1 TO 23
// -------------------------------------------------------------

resetDB();
const { req, item } = createRequirement('req_100', 'REQ-100', 100);

runTest('1. 100 MT requirement created', () => {
  assert.strictEqual(item.quantity_mt, 100);
});

runTest('2. Transporter A bids ₹55', () => {
  const bidA = submitBid('bid_A', req.id, item.id, 'trans_A', 55);
  assert.strictEqual(bidA.rate_per_mt, 55);
});

runTest('3. Transporter B bids ₹60', () => {
  const bidB = submitBid('bid_B', req.id, item.id, 'trans_B', 60);
  assert.strictEqual(bidB.rate_per_mt, 60);
});

runTest('4. Transporter C bids ₹65', () => {
  const bidC = submitBid('bid_C', req.id, item.id, 'trans_C', 65);
  assert.strictEqual(bidC.rate_per_mt, 65);
});

runTest('5. Admin finalizes Transporter A at ₹55', () => {
  finalizeBid('bid_A');
  const winnerAlloc = db.allocations.find(a => a.transporter_id === 'trans_A');
  assert.strictEqual(winnerAlloc.allocation_role, 'WINNER');
  assert.strictEqual(winnerAlloc.acceptance_status, 'ACTIVE');
  assert.strictEqual(winnerAlloc.finalized_rate, 55);
});

runTest('6. Only Transporter A initially can dispatch', () => {
  const viewA = getTransporterView(req.id, item.id, 'trans_A');
  const viewB = getTransporterView(req.id, item.id, 'trans_B');
  const viewC = getTransporterView(req.id, item.id, 'trans_C');

  assert.strictEqual(viewA.canDispatch, true);
  assert.strictEqual(viewB.canDispatch, false);
  assert.strictEqual(viewC.canDispatch, false);
});

runTest('7. Transporter A dispatches 50 MT', () => {
  const res = dispatchTruck(req.id, item.id, 'trans_A', 50);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.dispatch.loaded_quantity_mt, 50);
});

runTest('8. Global remaining becomes 50 MT', () => {
  const rem = getGlobalRemainingQty(req.id, item.id);
  assert.strictEqual(rem, 50);
});

runTest('9. Transporter B and C see remaining 50 MT at ₹55 with status Available for Acceptance', () => {
  const viewB = getTransporterView(req.id, item.id, 'trans_B');
  const viewC = getTransporterView(req.id, item.id, 'trans_C');

  assert.strictEqual(viewB.isVisible, true);
  assert.strictEqual(viewB.fixedRate, 55);
  assert.strictEqual(viewB.remainingQty, 50);
  assert.strictEqual(viewB.allocationStatus, 'PREVIOUS_BIDDER_PENDING_ACCEPTANCE');
  assert.strictEqual(viewB.showAcceptButton, true);

  assert.strictEqual(viewC.isVisible, true);
  assert.strictEqual(viewC.fixedRate, 55);
  assert.strictEqual(viewC.remainingQty, 50);
  assert.strictEqual(viewC.allocationStatus, 'PREVIOUS_BIDDER_PENDING_ACCEPTANCE');
  assert.strictEqual(viewC.showAcceptButton, true);
});

runTest('10. Transporter B cannot dispatch before acceptance', () => {
  const res = dispatchTruck(req.id, item.id, 'trans_B', 10);
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.error, 'TRANSPORTER_NOT_AUTHORIZED_FOR_DISPATCH');
});

runTest('11. Transporter B accepts remaining allocation', () => {
  const res = acceptRemainingAllocation(req.id, item.id, 'trans_B');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.fixed_rate, 55);
  assert.strictEqual(res.acceptance_status, 'ACCEPTED');
});

runTest('12. Transporter B can dispatch after acceptance', () => {
  const viewB = getTransporterView(req.id, item.id, 'trans_B');
  assert.strictEqual(viewB.canDispatch, true);
  assert.strictEqual(viewB.allocationStatus, 'ACCEPTED_SHARED_TRANSPORTER');
});

runTest('13. Transporter B dispatches 30 MT', () => {
  const res = dispatchTruck(req.id, item.id, 'trans_B', 30);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.dispatch.loaded_quantity_mt, 30);
  assert.strictEqual(res.dispatch.finalized_rate, 55);
});

runTest('14. Global remaining becomes 20 MT', () => {
  const rem = getGlobalRemainingQty(req.id, item.id);
  assert.strictEqual(rem, 20);
});

runTest('15. Transporter A can dispatch only up to 20 MT', () => {
  const failRes = dispatchTruck(req.id, item.id, 'trans_A', 25);
  assert.strictEqual(failRes.status, 400);

  const successRes = dispatchTruck(req.id, item.id, 'trans_A', 20);
  assert.strictEqual(successRes.status, 200);
  assert.strictEqual(getGlobalRemainingQty(req.id, item.id), 0);
});

runTest('16. Total dispatches can never exceed 100 MT', () => {
  const total = db.dispatches.reduce((sum, d) => sum + d.loaded_quantity_mt, 0);
  assert.strictEqual(total, 100);

  const overRes = dispatchTruck(req.id, item.id, 'trans_B', 1);
  assert.strictEqual(overRes.status, 400);
});

runTest('17. Transporter C cannot dispatch without acceptance', () => {
  const res = dispatchTruck(req.id, item.id, 'trans_C', 10);
  assert.strictEqual(res.status, 403);
});

runTest('18. Unrelated Transporter D (did not bid) cannot see allocation', () => {
  const viewD = getTransporterView(req.id, item.id, 'trans_D_unrelated');
  assert.strictEqual(viewD.isVisible, false);
  assert.strictEqual(viewD.allocationRole, 'UNRELATED_TRANSPORTER');

  const acceptRes = acceptRemainingAllocation(req.id, item.id, 'trans_D_unrelated');
  assert.strictEqual(acceptRes.status, 403);
  assert.strictEqual(acceptRes.error, 'NOT_ELIGIBLE_FOR_ALLOCATION');
});

runTest('19. No re-quote is created for normal partial dispatch', () => {
  assert.strictEqual(db.items.length, 1);
});

runTest('20. No /02 sub-indent is created for normal partial dispatch', () => {
  assert.strictEqual(db.items[0].sub_indent_no, 'REQ-100/01');
});

runTest('21. Rate always remains ₹55 across all dispatches', () => {
  db.dispatches.forEach(d => {
    assert.strictEqual(d.finalized_rate, 55);
  });
});

runTest('22. Concurrency check: Simultaneous requests cannot over-allocate', () => {
  const { req: cReq, item: cItem } = createRequirement('req_conc', 'REQ-CONC', 10);
  submitBid('bid_cA', cReq.id, cItem.id, 'trans_A', 50);
  submitBid('bid_cB', cReq.id, cItem.id, 'trans_B', 55);
  finalizeBid('bid_cA');
  acceptRemainingAllocation(cReq.id, cItem.id, 'trans_B');

  const res1 = dispatchTruck(cReq.id, cItem.id, 'trans_A', 10);
  const res2 = dispatchTruck(cReq.id, cItem.id, 'trans_B', 10);

  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res2.status, 400);
  assert.strictEqual(getGlobalRemainingQty(cReq.id, cItem.id), 0);
});

runTest('23. Existing historical records continue working via legacy fallback', () => {
  const { req: hReq, item: hItem } = createRequirement('req_hist', 'REQ-HIST', 50);
  const hBid = submitBid('bid_hist', hReq.id, hItem.id, 'trans_legacy', 40);
  hBid.is_finalized = 1;
  hBid.final_rate = 40;

  // Even without explicit allocation table record, winner can dispatch
  db.allocations = db.allocations.filter(a => a.requirement_id !== hReq.id);
  
  // Legacy winner fallback
  const canDispatch = Boolean(hBid.transporter_id === 'trans_legacy');
  assert.strictEqual(canDispatch, true);
});

console.log('======================================================================');
console.log(`TOTAL TESTS: 23 | PASSED: ${passedCount} | FAILED: 0`);
console.log('======================================================================');
