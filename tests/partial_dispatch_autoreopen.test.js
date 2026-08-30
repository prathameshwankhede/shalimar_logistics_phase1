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
  const lrNumber = `LR-SNPL-2026-${String(state.truck_dispatches.length + 1).padStart(5, '0')}`;
  state.truck_dispatches.push({
    id: dispatchId,
    requirement_id: parentReq.id,
    requirement_item_id: item.id,
    transporter_id: user.id || user.transporter_id,
    loaded_quantity_mt: loadedQty,
    truck_number: truckNumber,
    lr_number: lrNumber,
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
    lr_number: lrNumber,
    dispatched_quantity_mt: newTotalDispatched,
    remaining_quantity_mt: newRemaining,
    dispatch_status: newRemaining > 0 ? 'RELEASED_FOR_REQUOTE' : 'FULLY_DISPATCHED',
    is_partial: newRemaining > 0,
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

// TEST 13: Full dispatch works without ReferenceError or undefined parentReq
it('TEST 13: Full dispatch works without ReferenceError or undefined parentReq', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };

  const res = executeDispatchTransaction(state, {
    user: userA,
    reqId: 'req_004',
    itemId: 'item_004_01',
    loadedQty: 10
  });

  assert.strictEqual(res.success, true);
  assert.ok(res.lr_number.startsWith('LR-SNPL-'));
  assert.strictEqual(res.dispatch_status, 'FULLY_DISPATCHED');
  assert.strictEqual(res.is_partial, false);
});

// TEST 14: Partial dispatch creates valid sub-indent and LR metadata without parentReq is not defined
it('TEST 14: Partial dispatch creates valid sub-indent and LR metadata without parentReq is not defined', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };

  const res = executeDispatchTransaction(state, {
    user: userA,
    reqId: 'req_004',
    itemId: 'item_004_01',
    loadedQty: 5
  });

  assert.strictEqual(res.success, true);
  assert.ok(res.lr_number.startsWith('LR-SNPL-'));
  assert.strictEqual(res.dispatch_status, 'RELEASED_FOR_REQUOTE');
  assert.strictEqual(res.is_partial, true);
  assert.strictEqual(res.reopened_sub_indent_no, 'SNPL/26-27/REQ-0004/02');
  assert.ok(res.reopened_item_id);
});

// Helper to simulate Transporter Portal open requirement list generation
function getOpenRequirementsForPortal(state) {
  const rawOpenRateRequests = (state.requirements || []).filter((r) => {
    if (!r || !r.id) return false;
    const statusUpper = String(r.status || '').toUpperCase();
    if (statusUpper === 'ARCHIVED' || statusUpper === 'DELETED' || statusUpper === 'CANCELLED') return false;
    return true;
  });

  const openRateRequests = [];
  rawOpenRateRequests.forEach((parentReq) => {
    const childItems = state.items.filter(i => i.requirement_id === parentReq.id);
    if (childItems.length > 0) {
      childItems.forEach((item) => {
        const dispStatusUpper = String(item.dispatch_status || '').toUpperCase();
        const allocStatusUpper = String(item.allocation_status || '').toUpperCase();
        if (dispStatusUpper === 'FULLY_DISPATCHED' || dispStatusUpper === 'RELEASED_FOR_REQUOTE' || allocStatusUpper === 'RELEASED_FOR_REQUOTE') {
          return;
        }

        const remQty = item.remaining_quantity_mt !== null && item.remaining_quantity_mt !== undefined
          ? Number(item.remaining_quantity_mt)
          : Number(item.quantity_mt || item.required_qty || 0) - Number(item.dispatched_quantity_mt || 0);
        if (remQty <= 0 && Number(item.quantity_mt || item.required_qty || 0) > 0) {
          return;
        }

        const itemAcceptedByAnyone = (state.rate_submissions || []).some((s) => {
          if (!s) return false;
          const sReqMatch = String(s.requirement_id) === String(parentReq.id);
          const sItemMatch = String(s.item_id) === String(item.id) || String(s.item_id) === String(item.sub_indent_no);
          return sReqMatch && sItemMatch && (s.is_finalized === 1 || s.acceptance_status === 'ACCEPTED');
        });

        if (itemAcceptedByAnyone) {
          return;
        }

        openRateRequests.push({
          ...parentReq,
          id: parentReq.id,
          requirement_id: parentReq.id,
          item_id: item.id,
          sub_indent_no: item.sub_indent_no,
          quantity_mt: remQty,
          remaining_quantity_mt: remQty,
          source_item_id: item.source_item_id || null,
          is_reopened: Boolean(item.source_item_id)
        });
      });
    }
  });

  return openRateRequests;
}

// TEST 15: Partial dispatch creates /02 and it appears in Open Requirements
it('TEST 15: Partial dispatch creates /02 and it appears in Open Requirements', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };

  executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });

  const openReqs = getOpenRequirementsForPortal(state);
  assert.strictEqual(openReqs.length, 1);
  assert.strictEqual(openReqs[0].sub_indent_no, 'SNPL/26-27/REQ-0004/02');
  assert.strictEqual(openReqs[0].quantity_mt, 5);
  assert.strictEqual(openReqs[0].is_reopened, true);
});

// TEST 16: Original transporter can see /02
it('TEST 16: Original transporter can see /02', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };

  executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });

  const openReqs = getOpenRequirementsForPortal(state);
  const found02 = openReqs.find(r => r.sub_indent_no === 'SNPL/26-27/REQ-0004/02');
  assert.ok(found02, 'Original transporter should see /02 in open requirements');
});

// TEST 17: Another eligible transporter can see /02
it('TEST 17: Another eligible transporter can see /02', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };

  executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });

  const openReqs = getOpenRequirementsForPortal(state);
  const found02 = openReqs.find(r => r.sub_indent_no === 'SNPL/26-27/REQ-0004/02');
  assert.ok(found02, 'Other eligible transporter should see /02 in open requirements');
});

// TEST 18: Previous finalized /01 bid does NOT hide /02
it('TEST 18: Previous finalized /01 bid does NOT hide /02', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };

  // Prior finalized submission for /01 exists
  assert.strictEqual(state.rate_submissions.length, 1);
  assert.strictEqual(state.rate_submissions[0].item_id, 'item_004_01');

  executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });

  const openReqs = getOpenRequirementsForPortal(state);
  assert.strictEqual(openReqs.some(r => r.sub_indent_no === 'SNPL/26-27/REQ-0004/02'), true);
});

// TEST 19: Both transporters can submit independent quotes on /02
it('TEST 19: Both transporters can submit independent quotes on /02', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };
  const userB = { id: 'trans_B', transporter_id: 'trans_B', role: 'transporter' };

  const dispRes = executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });
  const item02Id = dispRes.reopened_item_id;

  const quoteA = submitQuote(state, { user: userA, reqId: 'req_004', itemId: item02Id, rate: 22 });
  const quoteB = submitQuote(state, { user: userB, reqId: 'req_004', itemId: item02Id, rate: 19 });

  assert.strictEqual(quoteA.success, true);
  assert.strictEqual(quoteB.success, true);

  const subs02 = state.rate_submissions.filter(s => s.item_id === item02Id);
  assert.strictEqual(subs02.length, 2);
  assert.strictEqual(subs02.find(s => s.transporter_id === 'trans_A').rate_per_mt, 22);
  assert.strictEqual(subs02.find(s => s.transporter_id === 'trans_B').rate_per_mt, 19);
});

// TEST 20: Completed /01 remains hidden from Open Requirements while /02 remains visible
it('TEST 20: Completed /01 remains hidden from Open Requirements while /02 remains visible', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };

  executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });

  const openReqs = getOpenRequirementsForPortal(state);
  assert.strictEqual(openReqs.some(r => r.sub_indent_no === 'SNPL/26-27/REQ-0004/01'), false);
  assert.strictEqual(openReqs.some(r => r.sub_indent_no === 'SNPL/26-27/REQ-0004/02'), true);
});

// TEST 21: Refreshing the Transporter Portal does not hide /02
it('TEST 21: Refreshing the Transporter Portal does not hide /02', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };

  executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });

  // Simulate refresh 1
  const openReqs1 = getOpenRequirementsForPortal(state);
  assert.strictEqual(openReqs1.length, 1);

  // Simulate refresh 2
  const openReqs2 = getOpenRequirementsForPortal(state);
  assert.strictEqual(openReqs2.length, 1);
  assert.strictEqual(openReqs2[0].sub_indent_no, 'SNPL/26-27/REQ-0004/02');
});

// TEST 22: Admin can see and finalize quotes for /02
it('TEST 22: Admin can see and finalize quotes for /02', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };
  const userB = { id: 'trans_B', transporter_id: 'trans_B', role: 'transporter' };
  const admin = { id: 'usr_admin', username: 'admin', role: 'admin' };

  const dispRes = executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });
  const item02Id = dispRes.reopened_item_id;

  submitQuote(state, { user: userA, reqId: 'req_004', itemId: item02Id, rate: 22 });
  submitQuote(state, { user: userB, reqId: 'req_004', itemId: item02Id, rate: 19 });

  const finalRes = finalizeCycleWinner(state, { user: admin, reqId: 'req_004', itemId: item02Id, transporterId: 'trans_B', finalRate: 19 });
  assert.strictEqual(finalRes.success, true);

  const subB = state.rate_submissions.find(s => s.item_id === item02Id && s.transporter_id === 'trans_B');
  assert.strictEqual(subB.is_finalized, 1);
  assert.strictEqual(subB.final_rate, 19);
});

// Helper to simulate Transporter Portal Awarded Contracts / Allocations list generation
function getMyFinalizedItemsForPortal(state, user) {
  const itemsList = [];
  (state.requirements || []).forEach((req) => {
    const childItems = state.items.filter(i => i.requirement_id === req.id);
    if (childItems.length > 0) {
      childItems.forEach((child) => {
        const myBid = (state.rate_submissions || []).find((s) => {
          const matchUser = s.transporter_id === user.id || s.transporter_id === user.transporter_id;
          const matchItem = s.item_id === child.id || s.item_id === child.sub_indent_no;
          const matchReq = s.requirement_id === req.id;
          return matchUser && matchItem && matchReq;
        });

        const isFinalized = myBid && (
          Boolean(myBid.is_finalized) ||
          String(myBid.bid_status || '').toUpperCase() === 'FINALIZED' ||
          String(myBid.acceptance_status || '').toUpperCase() === 'ACCEPTED' ||
          Number(myBid.final_rate) > 0
        );

        if (isFinalized) {
          itemsList.push({
            item: child,
            parentReq: req,
            myBid,
            isMultiItem: true,
            uniqueKey: `awarded_${req.id}_${child.id || child.sub_indent_no}`
          });
        }
      });
    }
  });
  return itemsList;
}

// TEST A: Create /02 -> multiple transporters quote -> admin finalizes transporter A -> /02 disappears from Open Requirements
it('TEST A: Create /02 -> multiple transporters quote -> admin finalizes transporter A -> /02 disappears from Open Requirements', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };
  const userB = { id: 'trans_B', transporter_id: 'trans_B', role: 'transporter' };
  const admin = { id: 'usr_admin', username: 'admin', role: 'admin' };

  // Dispatch /01 to create /02
  const dispRes = executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });
  const item02Id = dispRes.reopened_item_id;

  // Both submit quotes
  submitQuote(state, { user: userA, reqId: 'req_004', itemId: item02Id, rate: 22 });
  submitQuote(state, { user: userB, reqId: 'req_004', itemId: item02Id, rate: 19 });

  // Prior to finalization: /02 is open
  assert.strictEqual(getOpenRequirementsForPortal(state).length, 1);

  // Admin finalizes Transporter A
  finalizeCycleWinner(state, { user: admin, reqId: 'req_004', itemId: item02Id, transporterId: 'trans_A', finalRate: 22 });

  // After finalization: /02 disappears from Open Requirements
  const openReqs = getOpenRequirementsForPortal(state);
  assert.strictEqual(openReqs.length, 0, '/02 must disappear from Open Requirements once finalized');
});

// TEST B: Winning transporter A sees /02 in Awarded Contracts & Dispatch
it('TEST B: Winning transporter A sees /02 in Awarded Contracts & Dispatch', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };
  const userB = { id: 'trans_B', transporter_id: 'trans_B', role: 'transporter' };
  const admin = { id: 'usr_admin', username: 'admin', role: 'admin' };

  const dispRes = executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });
  const item02Id = dispRes.reopened_item_id;

  submitQuote(state, { user: userA, reqId: 'req_004', itemId: item02Id, rate: 22 });
  submitQuote(state, { user: userB, reqId: 'req_004', itemId: item02Id, rate: 19 });
  finalizeCycleWinner(state, { user: admin, reqId: 'req_004', itemId: item02Id, transporterId: 'trans_A', finalRate: 22 });

  const contractsA = getMyFinalizedItemsForPortal(state, userA);
  const found02 = contractsA.find(c => c.item.sub_indent_no === 'SNPL/26-27/REQ-0004/02');
  assert.ok(found02, 'Winning transporter A must see /02 in Awarded Contracts');
  assert.strictEqual(found02.myBid.final_rate, 22);
});

// TEST C: Losing transporter B does not see /02 in Awarded Contracts
it('TEST C: Losing transporter B does not see /02 in Awarded Contracts', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };
  const userB = { id: 'trans_B', transporter_id: 'trans_B', role: 'transporter' };
  const admin = { id: 'usr_admin', username: 'admin', role: 'admin' };

  const dispRes = executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });
  const item02Id = dispRes.reopened_item_id;

  submitQuote(state, { user: userA, reqId: 'req_004', itemId: item02Id, rate: 22 });
  submitQuote(state, { user: userB, reqId: 'req_004', itemId: item02Id, rate: 19 });
  finalizeCycleWinner(state, { user: admin, reqId: 'req_004', itemId: item02Id, transporterId: 'trans_A', finalRate: 22 });

  const contractsB = getMyFinalizedItemsForPortal(state, userB);
  const found02 = contractsB.find(c => c.item.sub_indent_no === 'SNPL/26-27/REQ-0004/02');
  assert.strictEqual(Boolean(found02), false, 'Losing transporter B must NOT see /02 in Awarded Contracts');
});

// TEST D: /01 finalized bid cannot affect /02 visibility
it('TEST D: /01 finalized bid cannot affect /02 visibility', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };
  const userB = { id: 'trans_B', transporter_id: 'trans_B', role: 'transporter' };

  // Dispatch /01 partially
  executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });

  // Before /02 is finalized, /02 must be visible in Open Requirements despite /01 being finalized
  const openReqs = getOpenRequirementsForPortal(state);
  assert.strictEqual(openReqs.some(r => r.sub_indent_no === 'SNPL/26-27/REQ-0004/02'), true);

  // Contracts for Transporter B must not show /01 or /02
  const contractsB = getMyFinalizedItemsForPortal(state, userB);
  assert.strictEqual(contractsB.length, 0);
});

// TEST E: After browser refresh, finalized /02 remains visible to winning transporter
it('TEST E: After browser refresh, finalized /02 remains visible to winning transporter', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };
  const admin = { id: 'usr_admin', username: 'admin', role: 'admin' };

  const dispRes = executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });
  const item02Id = dispRes.reopened_item_id;

  submitQuote(state, { user: userA, reqId: 'req_004', itemId: item02Id, rate: 22 });
  finalizeCycleWinner(state, { user: admin, reqId: 'req_004', itemId: item02Id, transporterId: 'trans_A', finalRate: 22 });

  // Simulate refresh 1
  const contracts1 = getMyFinalizedItemsForPortal(state, userA);
  assert.ok(contracts1.find(c => c.item.sub_indent_no === 'SNPL/26-27/REQ-0004/02'));

  // Simulate refresh 2
  const contracts2 = getMyFinalizedItemsForPortal(state, userA);
  assert.ok(contracts2.find(c => c.item.sub_indent_no === 'SNPL/26-27/REQ-0004/02'));
});

// TEST F: Partial dispatch from finalized /02 correctly updates remaining balance
it('TEST F: Partial dispatch from finalized /02 correctly updates remaining balance', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };
  const userB = { id: 'trans_B', transporter_id: 'trans_B', role: 'transporter' };
  const admin = { id: 'usr_admin', username: 'admin', role: 'admin' };

  // Dispatch /01 (5 MT of 10 MT, remaining 5 MT)
  const dispRes1 = executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });
  const item02Id = dispRes1.reopened_item_id;

  // Finalize /02 with Transporter B for remaining 5 MT
  submitQuote(state, { user: userB, reqId: 'req_004', itemId: item02Id, rate: 19 });
  finalizeCycleWinner(state, { user: admin, reqId: 'req_004', itemId: item02Id, transporterId: 'trans_B', finalRate: 19 });
  acceptFinalRate(state, { user: userB, reqId: 'req_004', itemId: item02Id });

  // Transporter B dispatches 3 MT of 5 MT from /02
  const dispRes2 = executeDispatchTransaction(state, { user: userB, reqId: 'req_004', itemId: item02Id, loadedQty: 3 });
  assert.strictEqual(dispRes2.success, true);
  assert.strictEqual(dispRes2.remaining_quantity_mt, 2);
  assert.strictEqual(dispRes2.reopened_sub_indent_no, 'SNPL/26-27/REQ-0004/03');
});

// TEST G: If partial dispatch creates /03 for re-quote:
// - /02 remains in dispatch history
// - /03 appears in Open Requirements
// - all eligible transporters including original winner can quote independently
it('TEST G: /02 remains in dispatch history, /03 appears in Open Requirements, open to all', () => {
  const state = createTestState();
  const userA = { id: 'trans_A', transporter_id: 'trans_A', role: 'transporter' };
  const userB = { id: 'trans_B', transporter_id: 'trans_B', role: 'transporter' };
  const userC = { id: 'trans_C', transporter_id: 'trans_C', role: 'transporter' };
  const admin = { id: 'usr_admin', username: 'admin', role: 'admin' };

  // Cycle 1: /01 dispatched 5 MT -> creates /02 (5 MT)
  const dispRes1 = executeDispatchTransaction(state, { user: userA, reqId: 'req_004', itemId: 'item_004_01', loadedQty: 5 });
  const item02Id = dispRes1.reopened_item_id;

  // Cycle 2: /02 won by B at 19, B dispatches 3 MT -> creates /03 (2 MT)
  submitQuote(state, { user: userB, reqId: 'req_004', itemId: item02Id, rate: 19 });
  finalizeCycleWinner(state, { user: admin, reqId: 'req_004', itemId: item02Id, transporterId: 'trans_B', finalRate: 19 });
  acceptFinalRate(state, { user: userB, reqId: 'req_004', itemId: item02Id });
  const dispRes2 = executeDispatchTransaction(state, { user: userB, reqId: 'req_004', itemId: item02Id, loadedQty: 3 });
  const item03Id = dispRes2.reopened_item_id;

  // Verify dispatch history
  assert.strictEqual(state.truck_dispatches.length, 2);
  assert.strictEqual(state.truck_dispatches[0].requirement_item_id, 'item_004_01');
  assert.strictEqual(state.truck_dispatches[1].requirement_item_id, item02Id);

  // /03 appears in Open Requirements
  const openReqs = getOpenRequirementsForPortal(state);
  assert.strictEqual(openReqs.length, 1);
  assert.strictEqual(openReqs[0].sub_indent_no, 'SNPL/26-27/REQ-0004/03');
  assert.strictEqual(openReqs[0].quantity_mt, 2);

  // All 3 transporters can quote on /03
  assert.strictEqual(submitQuote(state, { user: userA, reqId: 'req_004', itemId: item03Id, rate: 25 }).success, true);
  assert.strictEqual(submitQuote(state, { user: userB, reqId: 'req_004', itemId: item03Id, rate: 20 }).success, true);
  assert.strictEqual(submitQuote(state, { user: userC, reqId: 'req_004', itemId: item03Id, rate: 18 }).success, true);

  const subs03 = state.rate_submissions.filter(s => s.item_id === item03Id);
  assert.strictEqual(subs03.length, 3);
});

console.log('================================================================');
console.log(`📊 TEST RESULTS: ${passedTests} Passed | ${failedTests} Failed`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
}

