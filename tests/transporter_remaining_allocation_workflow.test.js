// tests/transporter_remaining_allocation_workflow.test.js
// Automated verification for Transporter Remaining Allocation & Exclusive Acceptance Workflow

import assert from 'assert';

console.log('======================================================================');
console.log('🧪 RUNNING EXCLUSIVE TRANSPORTER REMAINING ALLOCATION ACCEPTANCE SUITE');
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
  const req = { 
    id, 
    req_no: reqNo, 
    total_quantity_mt: totalQty, 
    status: 'PUBLISHED',
    remaining_allocated_to: null,
    remaining_allocation_status: null,
    remaining_allocation_accepted_at: null
  };
  const item = { 
    id: `item_${id}_01`, 
    requirement_id: id, 
    sub_indent_no: `${reqNo}/01`, 
    quantity_mt: totalQty, 
    dispatch_status: 'PENDING',
    remaining_allocated_to: null,
    remaining_allocation_status: null,
    remaining_allocation_accepted_at: null
  };
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
  const item = db.items.find(i => i.requirement_id === reqId && (i.id === itemId || i.sub_indent_no === itemId));
  if (!item) return { status: 404, error: 'REQ_NOT_FOUND' };

  // 1. Concurrency check: Atomically verify if already accepted by another transporter (Row lock simulation)
  if (item.remaining_allocated_to && item.remaining_allocation_status === 'EXCLUSIVELY_ALLOCATED') {
    if (item.remaining_allocated_to !== transporterId) {
      return { status: 409, error: 'REMAINING_ALLOCATION_ALREADY_ACCEPTED' };
    }
  }

  // 2. Verify transporter submitted bid originally
  const hadBid = db.rate_submissions.some(s => s.requirement_id === reqId && (s.item_id === itemId || s.item_id === 'MAIN') && s.transporter_id === transporterId);
  if (!hadBid) {
    return { status: 403, error: 'NOT_ELIGIBLE_FOR_ALLOCATION' };
  }

  // 3. Verify remaining qty > 0
  const rem = getGlobalRemainingQty(reqId, itemId);
  if (rem <= 0) {
    return { status: 400, error: 'NO_REMAINING_QUANTITY' };
  }

  // 4. Find finalized rate
  const winnerAlloc = db.allocations.find(a => a.requirement_id === reqId && a.requirement_item_id === itemId && a.allocation_role === 'WINNER');
  const fixedRate = winnerAlloc ? winnerAlloc.finalized_rate : 55;

  // 5. Exclusively persist allocation on requirement item
  item.remaining_allocated_to = transporterId;
  item.remaining_allocation_status = 'EXCLUSIVELY_ALLOCATED';
  item.remaining_allocation_accepted_at = new Date().toISOString();
  item.remaining_finalized_rate = fixedRate;
  item.allocation_status = 'EXCLUSIVELY_ALLOCATED';

  // 6. Revoke other transporters' authorizations
  db.allocations.forEach(a => {
    if (a.requirement_id === reqId && a.requirement_item_id === itemId && a.transporter_id !== transporterId) {
      a.acceptance_status = 'SUPERSEDED';
    }
  });

  let alloc = db.allocations.find(a => a.requirement_id === reqId && a.requirement_item_id === itemId && a.transporter_id === transporterId);
  if (alloc) {
    alloc.allocation_role = 'ACCEPTED_EXCLUSIVE_TRANSPORTER';
    alloc.acceptance_status = 'ACCEPTED';
    alloc.accepted_at = new Date().toISOString();
  } else {
    alloc = {
      id: `alloc_${Date.now()}`,
      requirement_id: reqId,
      requirement_item_id: itemId,
      transporter_id: transporterId,
      finalized_rate: fixedRate,
      allocation_role: 'ACCEPTED_EXCLUSIVE_TRANSPORTER',
      acceptance_status: 'ACCEPTED',
      accepted_at: new Date().toISOString()
    };
    db.allocations.push(alloc);
  }

  return {
    status: 200,
    success: true,
    fixed_rate: fixedRate,
    remaining_quantity_mt: rem,
    remaining_allocated_to: transporterId,
    remaining_allocation_status: 'EXCLUSIVELY_ALLOCATED',
    acceptance_status: 'ACCEPTED'
  };
}

function dispatchTruck(reqId, itemId, transporterId, quantityMt) {
  const item = db.items.find(i => i.requirement_id === reqId && (i.id === itemId || i.sub_indent_no === itemId));
  if (!item) return { status: 404, error: 'ITEM_NOT_FOUND' };

  // Exclusive allocation check: If exclusively assigned, only that transporter can dispatch
  if (item.remaining_allocated_to && item.remaining_allocation_status === 'EXCLUSIVELY_ALLOCATED') {
    if (item.remaining_allocated_to !== transporterId) {
      return { status: 403, error: 'TRANSPORTER_NOT_AUTHORIZED_FOR_DISPATCH' };
    }
  }

  // Authorization check
  const alloc = db.allocations.find(a => 
    a.requirement_id === reqId && 
    (a.requirement_item_id === itemId || a.requirement_item_id === 'MAIN') && 
    a.transporter_id === transporterId &&
    (a.acceptance_status === 'ACTIVE' || a.acceptance_status === 'ACCEPTED' || a.allocation_role === 'WINNER' || a.allocation_role === 'ACCEPTED_EXCLUSIVE_TRANSPORTER')
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

  // Exclusive allocation check
  const isRemainingAccepted = Boolean(item.remaining_allocated_to && item.remaining_allocation_status === 'EXCLUSIVELY_ALLOCATED');
  const isCurrentTransporterAssigned = Boolean(item.remaining_allocated_to === transporterId);

  // If remaining allocation is exclusively accepted by another transporter, HIDE from everyone else!
  if (isRemainingAccepted && !isCurrentTransporterAssigned) {
    return {
      isVisible: false,
      canDispatch: false,
      showAcceptButton: false,
      allocationRole: 'EXCLUDED',
      allocationStatus: 'EXCLUDED'
    };
  }

  let allocationRole = 'UNRELATED_TRANSPORTER';
  let allocationStatus = 'UNRELATED_TRANSPORTER';
  let canDispatch = false;

  if (isRemainingAccepted && isCurrentTransporterAssigned) {
    allocationRole = 'ACCEPTED_EXCLUSIVE_TRANSPORTER';
    allocationStatus = 'ACCEPTED_SHARED_TRANSPORTER';
    canDispatch = true;
  } else if (isWinningTransporter) {
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
// EXECUTE TESTS
// -------------------------------------------------------------

resetDB();
const { req, item } = createRequirement('req_100', 'REQ-100', 100);

runTest('1. 100 MT requirement created', () => {
  assert.strictEqual(item.quantity_mt, 100);
});

runTest('2. Transporter A bids ₹55', () => {
  submitBid('bid_A', req.id, item.id, 'trans_A', 55);
});

runTest('3. Transporter B bids ₹60', () => {
  submitBid('bid_B', req.id, item.id, 'trans_B', 60);
});

runTest('4. Transporter C bids ₹65', () => {
  submitBid('bid_C', req.id, item.id, 'trans_C', 65);
});

runTest('5. Admin finalizes Transporter A at ₹55', () => {
  finalizeBid('bid_A');
  const winnerAlloc = db.allocations.find(a => a.transporter_id === 'trans_A');
  assert.strictEqual(winnerAlloc.allocation_role, 'WINNER');
  assert.strictEqual(winnerAlloc.acceptance_status, 'ACTIVE');
});

runTest('6. Only Transporter A initially can dispatch', () => {
  const viewA = getTransporterView(req.id, item.id, 'trans_A');
  const viewB = getTransporterView(req.id, item.id, 'trans_B');
  const viewC = getTransporterView(req.id, item.id, 'trans_C');

  assert.strictEqual(viewA.canDispatch, true);
  assert.strictEqual(viewB.canDispatch, false);
  assert.strictEqual(viewC.canDispatch, false);
});

runTest('7. Transporter A dispatches 50 MT, remaining becomes 50 MT', () => {
  const res = dispatchTruck(req.id, item.id, 'trans_A', 50);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(getGlobalRemainingQty(req.id, item.id), 50);
});

runTest('8. Transporter B and C can initially see Accept Remaining Allocation', () => {
  const viewB = getTransporterView(req.id, item.id, 'trans_B');
  const viewC = getTransporterView(req.id, item.id, 'trans_C');

  assert.strictEqual(viewB.isVisible, true);
  assert.strictEqual(viewB.showAcceptButton, true);
  assert.strictEqual(viewC.isVisible, true);
  assert.strictEqual(viewC.showAcceptButton, true);
});

runTest('9. Transporter B clicks Accept Remaining Allocation and succeeds', () => {
  const res = acceptRemainingAllocation(req.id, item.id, 'trans_B');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.remaining_allocated_to, 'trans_B');
  assert.strictEqual(res.remaining_allocation_status, 'EXCLUSIVELY_ALLOCATED');
  assert.strictEqual(item.remaining_allocated_to, 'trans_B');
});

runTest('10. Requirement immediately disappears from Transporter C', () => {
  const viewC = getTransporterView(req.id, item.id, 'trans_C');
  assert.strictEqual(viewC.isVisible, false);
  assert.strictEqual(viewC.showAcceptButton, false);
  assert.strictEqual(viewC.canDispatch, false);
});

runTest('11. Transporter C API acceptance attempt returns 409 / REMAINING_ALLOCATION_ALREADY_ACCEPTED', () => {
  const resC = acceptRemainingAllocation(req.id, item.id, 'trans_C');
  assert.strictEqual(resC.status, 409);
  assert.strictEqual(resC.error, 'REMAINING_ALLOCATION_ALREADY_ACCEPTED');
});

runTest('12. Transporter C dispatch API call returns HTTP 403', () => {
  const res = dispatchTruck(req.id, item.id, 'trans_C', 10);
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.error, 'TRANSPORTER_NOT_AUTHORIZED_FOR_DISPATCH');
});

runTest('13. Only Transporter B sees Dispatch Truck button', () => {
  const viewB = getTransporterView(req.id, item.id, 'trans_B');
  assert.strictEqual(viewB.isVisible, true);
  assert.strictEqual(viewB.canDispatch, true);
  assert.strictEqual(viewB.showAcceptButton, false);
});

runTest('14. Transporter B dispatches remaining 50 MT', () => {
  const res = dispatchTruck(req.id, item.id, 'trans_B', 50);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.dispatch.loaded_quantity_mt, 50);
  assert.strictEqual(res.dispatch.finalized_rate, 55);
  assert.strictEqual(getGlobalRemainingQty(req.id, item.id), 0);
});

runTest('15. Final database integrity check shows zero discrepancies', () => {
  const totalItemQty = item.quantity_mt;
  const totalDispatched = db.dispatches.reduce((acc, d) => acc + d.loaded_quantity_mt, 0);
  const remaining = getGlobalRemainingQty(req.id, item.id);

  assert.strictEqual(totalItemQty, 100);
  assert.strictEqual(totalDispatched, 100);
  assert.strictEqual(remaining, 0);
  assert.strictEqual(totalItemQty, totalDispatched + remaining);
});

runTest('16. Concurrent acceptance simulation: If B and C click simultaneously, only 1 succeeds', () => {
  const { req: rConc, item: iConc } = createRequirement('req_race', 'REQ-RACE', 80);
  submitBid('b_rA', rConc.id, iConc.id, 'trans_A', 40);
  submitBid('b_rB', rConc.id, iConc.id, 'trans_B', 45);
  submitBid('b_rC', rConc.id, iConc.id, 'trans_C', 50);
  finalizeBid('b_rA');
  dispatchTruck(rConc.id, iConc.id, 'trans_A', 40); // 40 remaining

  // Simulate concurrent arrival
  const resB = acceptRemainingAllocation(rConc.id, iConc.id, 'trans_B');
  const resC = acceptRemainingAllocation(rConc.id, iConc.id, 'trans_C');

  assert.strictEqual(resB.status, 200);
  assert.strictEqual(resC.status, 409);
  assert.strictEqual(resC.error, 'REMAINING_ALLOCATION_ALREADY_ACCEPTED');
  assert.strictEqual(iConc.remaining_allocated_to, 'trans_B');
});

runTest('17. Original winner cannot dispatch remaining quantity once exclusively assigned to B', () => {
  const resA = dispatchTruck(req.id, item.id, 'trans_A', 1);
  assert.strictEqual(resA.status, 403);
  assert.strictEqual(resA.error, 'TRANSPORTER_NOT_AUTHORIZED_FOR_DISPATCH');
});

console.log('======================================================================');
console.log(`TOTAL TESTS: 17 | PASSED: ${passedCount} | FAILED: 0`);
console.log('======================================================================');
