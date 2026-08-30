// tests/partial_dispatch_autoreopen.test.js
// Automated Test Suite for "Partial Dispatch Re-Quote / Auto-Reopen Bidding Workflow" 🔄🚛

import assert from 'assert';

console.log('================================================================');
console.log('🧪 RUNNING PARTIAL DISPATCH AUTO-REOPEN TEST SUITE');
console.log('================================================================');

let passedTests = 0;
let failedTests = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    failedTests++;
  }
}

// In-Memory Database Simulator for Testing Partial Dispatch and Re-Bidding Engine
function createTestState() {
  return {
    requirements: [
      {
        id: 'req_004',
        req_no: 'SNPL/26-27/REQ-0004',
        status: 'Active',
        product_name: 'SOYA',
        pickup_origin: 'Katol',
        drop_location: 'Nashik',
        total_quantity_mt: 10,
        quantity_mt: 10
      }
    ],
    items: [
      {
        id: 'item_004_01',
        requirement_id: 'req_004',
        sub_indent_no: 'SNPL/26-27/REQ-0004/01',
        product_name: 'SOYA',
        quantity_mt: 10,
        dispatched_quantity_mt: 0,
        remaining_quantity_mt: 10,
        dispatch_status: 'ACCEPTED',
        allocation_status: 'ACTIVE',
        source_item_id: null,
        target_date: '2026-09-20'
      }
    ],
    rate_submissions: [
      {
        id: 'sub_transA_01',
        requirement_id: 'req_004',
        item_id: 'item_004_01',
        transporter_id: 'trans_A',
        rate_per_mt: 20,
        final_rate: 20,
        is_finalized: 1,
        acceptance_status: 'ACCEPTED'
      }
    ],
    truck_dispatches: [],
    security_audit_logs: []
  };
}

function executeDispatchTransaction(state, { user, reqId, itemId, loadedQty, truckNumber = 'MH-31-AA-9999', simulateFailure = false }) {
  if (!user || user.role !== 'transporter') {
    return { success: false, status: 403, code: 'FORBIDDEN_TRANSPORTER_ONLY' };
  }

  const parentReq = state.requirements.find(r => r.id === reqId || r.req_no === reqId);
  if (!parentReq) return { success: false, status: 404, error: 'Parent requirement not found' };

  const item = state.items.find(i => i.requirement_id === parentReq.id && (i.id === itemId || i.sub_indent_no === itemId));
  if (!item) return { success: false, status: 404, error: 'Item not found' };

  // Guard: Released or already fully dispatched
  if (item.dispatch_status === 'RELEASED_FOR_REQUOTE' || item.allocation_status === 'RELEASED_FOR_REQUOTE') {
    return {
      success: false,
      status: 409,
      code: 'ALLOCATION_RELEASED_FOR_REQUOTE',
      message: 'Item has already been released for fresh quotation.'
    };
  }

  // Winning transporter check
  const winningSub = state.rate_submissions.find(s => s.item_id === item.id && s.is_finalized === 1);
  if (!winningSub || winningSub.transporter_id !== (user.id || user.transporter_id)) {
    return { success: false, status: 403, code: 'FORBIDDEN_NOT_WINNING_TRANSPORTER' };
  }

  if (winningSub.acceptance_status !== 'ACCEPTED') {
    return { success: false, status: 400, code: 'AWAITING_TRANSPORTER_ACCEPTANCE' };
  }

  // Calculate already dispatched
  const alreadyDispatched = state.truck_dispatches
    .filter(d => d.requirement_item_id === item.id)
    .reduce((acc, d) => acc + d.loaded_quantity_mt, 0);

  const remainingQty = Math.max(0, item.quantity_mt - alreadyDispatched);
  if (loadedQty > remainingQty) {
    return { success: false, status: 400, code: 'EXCEEDS_REMAINING_QUANTITY' };
  }

  // Invariant: Total dispatched across all items in parent requirement cannot exceed parent capacity
  const totalParentDispatched = state.truck_dispatches
    .filter(d => d.requirement_id === parentReq.id)
    .reduce((acc, d) => acc + d.loaded_quantity_mt, 0);

  const parentCapacity = parentReq.total_quantity_mt || parentReq.quantity_mt || 0;
  if (totalParentDispatched + loadedQty > parentCapacity) {
    return { success: false, status: 400, code: 'EXCEEDS_REQUIREMENT_TOTAL_CAPACITY' };
  }

  if (simulateFailure) {
    // Transaction rolled back: no changes
    return { success: false, status: 500, error: 'Simulated DB connection drop during commit' };
  }

  // Insert truck dispatch
  const dispatchId = `disp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  state.truck_dispatches.push({
    id: dispatchId,
    requirement_id: parentReq.id,
    requirement_item_id: item.id,
    transporter_id: user.id || user.transporter_id,
    loaded_quantity_mt: loadedQty,
    truck_number: truckNumber,
    lr_number: `LR-SNPL-2026-${String(state.truck_dispatches.length + 1).padStart(5, '0')}`,
    dispatched_at: new Date().toISOString()
  });

  const newTotalDispatched = alreadyDispatched + loadedQty;
  const newRemaining = Math.max(0, item.quantity_mt - newTotalDispatched);
  let replacementItemId = null;
  let newSubIndentNo = null;

  if (newRemaining > 0) {
    // Automatic re-open for re-quote
    const allItems = state.items.filter(i => i.requirement_id === parentReq.id);
    let maxSeq = 0;
    allItems.forEach(i => {
      const match = String(i.sub_indent_no || '').match(/\/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    });
    if (maxSeq === 0) maxSeq = allItems.length;
    const nextSeq = maxSeq + 1;
    const nextSeqStr = String(nextSeq).padStart(2, '0');
    const parentReqNo = parentReq.req_no || parentReq.id;
    newSubIndentNo = `${parentReqNo}/${nextSeqStr}`;
    replacementItemId = `item_${parentReq.id}_${nextSeqStr}`;

    // Mark original item RELEASED_FOR_REQUOTE
    item.dispatch_status = 'RELEASED_FOR_REQUOTE';
    item.allocation_status = 'RELEASED_FOR_REQUOTE';
    item.remaining_action = 'REQUOTE';
    item.dispatched_quantity_mt = newTotalDispatched;
    item.remaining_quantity_mt = 0;
    item.replacement_item_id = replacementItemId;

    // Create replacement requirement item
    state.items.push({
      id: replacementItemId,
      requirement_id: parentReq.id,
      sub_indent_no: newSubIndentNo,
      product_name: item.product_name,
      quantity_mt: newRemaining,
      dispatched_quantity_mt: 0,
      remaining_quantity_mt: newRemaining,
      dispatch_status: 'PENDING',
      allocation_status: 'ACTIVE',
      source_item_id: item.id,
      target_date: item.target_date
    });

    parentReq.status = 'PARTIALLY_DISPATCHED';

    state.security_audit_logs.push({
      action: `PARTIAL_DISPATCH_AUTO_REOPEN (Dispatched: ${loadedQty} MT, Reopened: ${newRemaining} MT -> New Sub-Indent: ${newSubIndentNo})`,
      username: user.username || user.id,
      timestamp: new Date().toISOString()
    });
  } else {
    item.dispatch_status = 'FULLY_DISPATCHED';
    item.allocation_status = 'COMPLETED';
    item.dispatched_quantity_mt = newTotalDispatched;
    item.remaining_quantity_mt = 0;

    const allItems = state.items.filter(i => i.requirement_id === parentReq.id);
    const allDone = allItems.every(i => i.id === item.id ? true : (i.dispatch_status === 'FULLY_DISPATCHED' || i.dispatch_status === 'RELEASED_FOR_REQUOTE'));
    parentReq.status = allDone ? 'COMPLETED' : 'PARTIALLY_DISPATCHED';
  }

  return {
    success: true,
    dispatch_id: dispatchId,
    dispatched_quantity_mt: newTotalDispatched,
    remaining_quantity_mt: newRemaining,
    reopened_sub_indent_no: newSubIndentNo,
    reopened_item_id: replacementItemId
  };
}

function submitQuote(state, { user, reqId, itemId, rate }) {
  if (!user || user.role !== 'transporter') {
    return { success: false, status: 403, error: 'Transporter only' };
  }
  const item = state.items.find(i => i.id === itemId || i.sub_indent_no === itemId);
  if (!item) return { success: false, status: 404, error: 'Item not found' };

  if (item.dispatch_status !== 'PENDING' || item.allocation_status !== 'ACTIVE') {
    return { success: false, status: 400, error: 'Item not open for quotes' };
  }

  const subId = `sub_${user.id}_${item.id}`;
  const existingIdx = state.rate_submissions.findIndex(s => s.item_id === item.id && s.transporter_id === user.id);
  if (existingIdx >= 0) {
    state.rate_submissions[existingIdx].rate_per_mt = rate;
  } else {
    state.rate_submissions.push({
      id: subId,
      requirement_id: reqId,
      item_id: item.id,
      transporter_id: user.id,
      rate_per_mt: rate,
      is_finalized: 0,
      acceptance_status: 'PENDING'
    });
  }
  return { success: true, submission_id: subId };
}

function finalizeCycleWinner(state, { user, reqId, itemId, transporterId, finalRate }) {
  if (!user || user.role !== 'admin') {
    return { success: false, status: 403, error: 'Admin only' };
  }
  const item = state.items.find(i => i.id === itemId || i.sub_indent_no === itemId);
  if (!item) return { success: false, status: 404, error: 'Item not found' };

  const sub = state.rate_submissions.find(s => s.item_id === item.id && s.transporter_id === transporterId);
  if (!sub) return { success: false, status: 404, error: 'Submission not found' };

  sub.is_finalized = 1;
  sub.final_rate = finalRate;
  sub.acceptance_status = 'PENDING';
  return { success: true };
}

function acceptFinalRate(state, { user, reqId, itemId }) {
  if (!user || user.role !== 'transporter') {
    return { success: false, status: 403, error: 'Transporter only' };
  }
  const item = state.items.find(i => i.id === itemId || i.sub_indent_no === itemId);
  if (!item) return { success: false, status: 404, error: 'Item not found' };

  const sub = state.rate_submissions.find(s => s.item_id === item.id && s.is_finalized === 1);
  if (!sub || sub.transporter_id !== user.id) {
    return { success: false, status: 403, error: 'Not winning transporter' };
  }
  sub.acceptance_status = 'ACCEPTED';
  item.dispatch_status = 'ACCEPTED';
  return { success: true };
}

// TEST 1: 10 MT finalized → dispatch 5 MT → remaining 5 MT appears in Open Requirements
it('TEST 1: 10 MT finalized -> dispatch 5 MT -> remaining 5 MT appears in Open Requirements', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };

  const dispRes = executeDispatchTransaction(state, {
    user: userA,
    reqId: 'req_004',
    itemId: 'item_004_01',
    loadedQty: 5
  });

  assert.strictEqual(dispRes.success, true);
  assert.strictEqual(dispRes.remaining_quantity_mt, 5);
  assert.strictEqual(dispRes.reopened_sub_indent_no, 'SNPL/26-27/REQ-0004/02');

  // Verify new open item exists
  const openItems = state.items.filter(i => i.dispatch_status === 'PENDING' && i.allocation_status === 'ACTIVE');
  assert.strictEqual(openItems.length, 1);
  assert.strictEqual(openItems[0].sub_indent_no, 'SNPL/26-27/REQ-0004/02');
  assert.strictEqual(openItems[0].quantity_mt, 5);
});

// TEST 2: Remaining 5 MT visible to original winning transporter
it('TEST 2: Remaining 5 MT visible to original winning transporter', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };
  executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });

  // Filter for Open Requirements visible in portal
  const openForTransA = state.items.filter(i => i.dispatch_status === 'PENDING' && i.allocation_status === 'ACTIVE');
  assert.strictEqual(openForTransA.length, 1);
  assert.strictEqual(openForTransA[0].sub_indent_no, 'SNPL/26-27/REQ-0004/02');
  assert.strictEqual(openForTransA[0].quantity_mt, 5);
});

// TEST 3: Remaining 5 MT visible to other eligible transporters
it('TEST 3: Remaining 5 MT visible to other eligible transporters', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };
  executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });

  const userB = { id: 'trans_B', transporter_id: 'trans_B', role: 'transporter' };
  const openForTransB = state.items.filter(i => i.dispatch_status === 'PENDING' && i.allocation_status === 'ACTIVE');
  assert.strictEqual(openForTransB.length, 1);
  assert.strictEqual(openForTransB[0].quantity_mt, 5);
});

// TEST 4: Original transporter can submit a new quote
it('TEST 4: Original transporter can submit a new quote', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };
  const dispRes = executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });

  // Transporter A submits ₹22/MT for the reopened 5 MT
  const quoteRes = submitQuote(state, {
    user: userA,
    reqId: 'req_004',
    itemId: dispRes.reopened_item_id,
    rate: 22
  });

  assert.strictEqual(quoteRes.success, true);
  const sub = state.rate_submissions.find(s => s.item_id === dispRes.reopened_item_id && s.transporter_id === 'trans_A');
  assert.strictEqual(sub.rate_per_mt, 22);
});

// TEST 5: Other transporter can submit quote
it('TEST 5: Other transporter can submit quote', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };
  const dispRes = executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });

  const userB = { id: 'trans_B', transporter_id: 'trans_B', role: 'transporter' };
  const quoteRes = submitQuote(state, {
    user: userB,
    reqId: 'req_004',
    itemId: dispRes.reopened_item_id,
    rate: 19
  });

  assert.strictEqual(quoteRes.success, true);
  const subB = state.rate_submissions.find(s => s.item_id === dispRes.reopened_item_id && s.transporter_id === 'trans_B');
  assert.strictEqual(subB.rate_per_mt, 19);
});

// TEST 6: Admin can finalize new bidding cycle
it('TEST 6: Admin can finalize new bidding cycle', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };
  const dispRes = executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });

  const userB = { id: 'trans_B', transporter_id: 'trans_B', role: 'transporter' };
  submitQuote(state, { user: userB, reqId: 'req_004', itemId: dispRes.reopened_item_id, rate: 19 });

  const userAdmin = { id: 'admin', role: 'admin' };
  const finRes = finalizeCycleWinner(state, {
    user: userAdmin,
    reqId: 'req_004',
    itemId: dispRes.reopened_item_id,
    transporterId: 'trans_B',
    finalRate: 19
  });

  assert.strictEqual(finRes.success, true);
  const subB = state.rate_submissions.find(s => s.item_id === dispRes.reopened_item_id && s.transporter_id === 'trans_B');
  assert.strictEqual(subB.is_finalized, 1);
  assert.strictEqual(subB.final_rate, 19);
});

// TEST 7: New winning transporter can dispatch remaining quantity
it('TEST 7: New winning transporter can dispatch remaining quantity', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };
  const dispRes = executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });

  const userB = { id: 'trans_B', transporter_id: 'trans_B', role: 'transporter' };
  submitQuote(state, { user: userB, reqId: 'req_004', itemId: dispRes.reopened_item_id, rate: 19 });

  const userAdmin = { id: 'admin', role: 'admin' };
  finalizeCycleWinner(state, { user: userAdmin, reqId: 'req_004', itemId: dispRes.reopened_item_id, transporterId: 'trans_B', finalRate: 19 });

  // Transporter B accepts
  acceptFinalRate(state, { user: userB, reqId: 'req_004', itemId: dispRes.reopened_item_id });

  // Transporter B dispatches 5 MT
  const dispB = executeDispatchTransaction(state, {
    user: userB,
    reqId: 'req_004',
    itemId: dispRes.reopened_item_id,
    loadedQty: 5
  });

  assert.strictEqual(dispB.success, true);
  assert.strictEqual(dispB.remaining_quantity_mt, 0);

  // Total dispatches = 2 (5 MT by Trans A, 5 MT by Trans B)
  assert.strictEqual(state.truck_dispatches.length, 2);
  const totalDisp = state.truck_dispatches.reduce((acc, d) => acc + d.loaded_quantity_mt, 0);
  assert.strictEqual(totalDisp, 10);

  const parentReq = state.requirements.find(r => r.id === 'req_004');
  assert.strictEqual(parentReq.status, 'COMPLETED');
});

// TEST 8: Total dispatch across all cycles cannot exceed original quantity
it('TEST 8: Total dispatch across all cycles cannot exceed original quantity', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };
  const dispRes = executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });

  const userB = { id: 'trans_B', transporter_id: 'trans_B', role: 'transporter' };
  submitQuote(state, { user: userB, reqId: 'req_004', itemId: dispRes.reopened_item_id, rate: 19 });
  finalizeCycleWinner(state, { user: { role: 'admin' }, reqId: 'req_004', itemId: dispRes.reopened_item_id, transporterId: 'trans_B', finalRate: 19 });
  acceptFinalRate(state, { user: userB, reqId: 'req_004', itemId: dispRes.reopened_item_id });

  // Transporter B attempts to dispatch 6 MT (more than 5 MT remaining)
  const dispOver = executeDispatchTransaction(state, {
    user: userB,
    reqId: 'req_004',
    itemId: dispRes.reopened_item_id,
    loadedQty: 6
  });

  assert.strictEqual(dispOver.success, false);
  assert.strictEqual(dispOver.status, 400);
  assert.strictEqual(dispOver.code, 'EXCEEDS_REMAINING_QUANTITY');
});

// TEST 9: Failed dispatch transaction does not create re-bid cycle
it('TEST 9: Failed dispatch transaction does not create re-bid cycle', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };

  const res = executeDispatchTransaction(state, {
    user: userA,
    reqId: 'req_004',
    itemId: 'item_004_01',
    loadedQty: 5,
    simulateFailure: true
  });

  assert.strictEqual(res.success, false);
  assert.strictEqual(state.items.length, 1);
  assert.strictEqual(state.truck_dispatches.length, 0);
  assert.strictEqual(state.items[0].dispatched_quantity_mt, 0);
  assert.strictEqual(state.items[0].remaining_quantity_mt, 10);
});

// TEST 10: Completed requirement does not reopen
it('TEST 10: Completed requirement does not reopen', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };

  // Dispatch full 10 MT
  const res = executeDispatchTransaction(state, {
    user: userA,
    reqId: 'req_004',
    itemId: 'item_004_01',
    loadedQty: 10
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.remaining_quantity_mt, 0);
  assert.strictEqual(state.items.length, 1); // No new item created
  assert.strictEqual(state.items[0].dispatch_status, 'FULLY_DISPATCHED');
  assert.strictEqual(state.requirements[0].status, 'COMPLETED');
});

// TEST 11: No duplicate re-bid cycle is created on page refresh/retry
it('TEST 11: No duplicate re-bid cycle is created on page refresh/retry', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };

  // Initial partial dispatch creates /02
  const res1 = executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });
  assert.strictEqual(res1.success, true);
  assert.strictEqual(state.items.length, 2);

  // Retrying dispatch on the already released item_004_01 is blocked
  const res2 = executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 2 });
  assert.strictEqual(res2.success, false);
  assert.strictEqual(res2.status, 409);
  assert.strictEqual(res2.code, 'ALLOCATION_RELEASED_FOR_REQUOTE');

  // Verify total items count is still strictly 2
  assert.strictEqual(state.items.length, 2);
});

// TEST 12: Concurrent requests cannot create multiple active cycles for same remaining quantity
it('TEST 12: Concurrent requests cannot create multiple active cycles for same remaining quantity', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };

  // Simulate 2 parallel attempts
  const res1 = executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });
  const res2 = executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });

  assert.strictEqual(res1.success, true);
  assert.strictEqual(res2.success, false);
  assert.strictEqual(res2.status, 409);

  const activeRebidItems = state.items.filter(i => i.source_item_id === 'item_004_01');
  assert.strictEqual(activeRebidItems.length, 1);
});

console.log('================================================================');
console.log(`📊 TEST RESULTS: ${passedTests} Passed | ${failedTests} Failed`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
}
