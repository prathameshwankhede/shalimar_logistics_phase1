// tests/release_remaining_requote.test.js
// Automated Test Suite for "Release Remaining Quantity for Re-Quote" Workflow 🔄🛡️

import assert from 'assert';

console.log('================================================================');
console.log('🧪 RUNNING RELEASE REMAINING QUANTITY FOR RE-QUOTE TEST SUITE');
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

// In-memory simulator for the Release for Re-Quote and Dispatch Workflow
function createInitialState() {
  return {
    requirements: [
      {
        id: 'req_001',
        req_no: 'SNPL/26-27/REQ-0001',
        status: 'Active',
        total_quantity_mt: 55
      }
    ],
    items: [
      {
        id: 'item_01',
        requirement_id: 'req_001',
        sub_indent_no: 'SNPL/26-27/REQ-0001/01',
        product_name: 'HI-PRO SOYA',
        quantity_mt: 55,
        dispatched_quantity_mt: 0,
        remaining_quantity_mt: 55,
        dispatch_status: 'ACCEPTED',
        allocation_status: 'ACTIVE',
        target_date: '2026-09-15'
      }
    ],
    rate_submissions: [
      {
        id: 'sub_ram_01',
        requirement_id: 'req_001',
        item_id: 'item_01',
        transporter_id: 'trans_ram',
        rate_per_mt: 11,
        final_rate: 11,
        is_finalized: 1,
        acceptance_status: 'ACCEPTED'
      }
    ],
    truck_dispatches: [],
    security_audit_logs: []
  };
}

function simulateDispatch(state, { user, reqId, itemId, loadedQty, truckNumber = 'MH-40-AZ-1234' }) {
  if (!user || user.role !== 'transporter') {
    return { success: false, status: 403, code: 'FORBIDDEN_TRANSPORTER_ONLY' };
  }
  const item = state.items.find(i => i.id === itemId || i.sub_indent_no === itemId);
  if (!item) return { success: false, status: 404, error: 'Item not found' };

  if (item.dispatch_status === 'RELEASED_FOR_REQUOTE' || item.allocation_status === 'RELEASED_FOR_REQUOTE') {
    return {
      success: false,
      status: 409,
      code: 'ALLOCATION_RELEASED_FOR_REQUOTE',
      message: 'Remaining quantity has been released for fresh quotation and cannot be dispatched under the previous contract.'
    };
  }

  const winningSub = state.rate_submissions.find(s => s.item_id === item.id && s.is_finalized === 1);
  if (!winningSub || (winningSub.transporter_id !== user.id && winningSub.transporter_id !== user.transporter_id)) {
    return { success: false, status: 403, code: 'FORBIDDEN_NOT_WINNING_TRANSPORTER' };
  }

  if (winningSub.acceptance_status !== 'ACCEPTED') {
    return { success: false, status: 400, code: 'AWAITING_TRANSPORTER_ACCEPTANCE' };
  }

  const currentDispatched = state.truck_dispatches
    .filter(d => d.requirement_item_id === item.id)
    .reduce((acc, d) => acc + d.loaded_quantity_mt, 0);

  const remaining = Math.max(0, item.quantity_mt - currentDispatched);
  if (loadedQty > remaining) {
    return { success: false, status: 400, code: 'EXCEEDS_REMAINING_QUANTITY' };
  }

  const dispatchId = `disp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  state.truck_dispatches.push({
    id: dispatchId,
    requirement_id: reqId,
    requirement_item_id: item.id,
    transporter_id: user.id || user.transporter_id,
    loaded_quantity_mt: loadedQty,
    truck_number: truckNumber,
    lr_number: `LR-SNPL-2026-${String(state.truck_dispatches.length + 1).padStart(5, '0')}`,
    dispatched_at: new Date().toISOString()
  });

  const newTotalDispatched = currentDispatched + loadedQty;
  const newRemaining = Math.max(0, item.quantity_mt - newTotalDispatched);
  item.dispatched_quantity_mt = newTotalDispatched;
  item.remaining_quantity_mt = newRemaining;
  item.dispatch_status = newRemaining <= 0 ? 'FULLY_DISPATCHED' : 'PARTIALLY_DISPATCHED';

  const parentReq = state.requirements.find(r => r.id === reqId || r.req_no === reqId);
  if (parentReq) {
    const allItems = state.items.filter(i => i.requirement_id === parentReq.id);
    const allDone = allItems.every(i => i.dispatch_status === 'FULLY_DISPATCHED');
    parentReq.status = allDone ? 'COMPLETED' : 'PARTIALLY_DISPATCHED';
  }

  return { success: true, dispatchId, remaining: newRemaining };
}

function simulateReleaseRemainingForRequote(state, { user, reqId, itemId, reason = '' }) {
  // 1. RBAC
  if (!user || user.role !== 'admin') {
    return { success: false, status: 403, code: 'FORBIDDEN_ADMIN_ONLY' };
  }

  // 2. Resolve parent & item
  const parentReq = state.requirements.find(r => r.id === reqId || r.req_no === reqId);
  if (!parentReq) return { success: false, status: 404, error: 'Parent requirement not found' };

  const item = state.items.find(i => i.requirement_id === parentReq.id && (i.id === itemId || i.sub_indent_no === itemId));
  if (!item) return { success: false, status: 404, error: 'Item not found' };

  // 3. Guard already released
  if (item.dispatch_status === 'RELEASED_FOR_REQUOTE' || item.allocation_status === 'RELEASED_FOR_REQUOTE') {
    return { success: false, status: 409, code: 'ALREADY_RELEASED_FOR_REQUOTE' };
  }

  // 4. Calculate actual dispatched & remaining
  const actualDispatched = state.truck_dispatches
    .filter(d => d.requirement_item_id === item.id)
    .reduce((acc, d) => acc + d.loaded_quantity_mt, 0);

  const remainingQty = Math.max(0, item.quantity_mt - actualDispatched);
  if (remainingQty <= 0) {
    return { success: false, status: 400, code: 'NO_REMAINING_QUANTITY' };
  }

  // 5. Generate sequence
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
  const newSubIndentNo = `${parentReqNo}/${nextSeqStr}`;
  const replacementItemId = `item_${parentReq.id}_${nextSeqStr}`;

  // 6. Update Original Item
  item.dispatch_status = 'RELEASED_FOR_REQUOTE';
  item.allocation_status = 'RELEASED_FOR_REQUOTE';
  item.remaining_action = 'REQUOTE';
  item.dispatched_quantity_mt = actualDispatched;
  item.remaining_quantity_mt = 0;
  item.released_for_requote_at = new Date().toISOString();
  item.released_for_requote_by = user.username || 'admin';
  item.released_for_requote_reason = reason;
  item.replacement_item_id = replacementItemId;

  // 7. Insert Replacement Item
  const replacementItem = {
    id: replacementItemId,
    requirement_id: parentReq.id,
    sub_indent_no: newSubIndentNo,
    product_name: item.product_name,
    quantity_mt: remainingQty,
    dispatched_quantity_mt: 0,
    remaining_quantity_mt: remainingQty,
    dispatch_status: 'PENDING',
    allocation_status: 'ACTIVE',
    source_item_id: item.id,
    target_date: item.target_date
  };
  state.items.push(replacementItem);

  // 8. Parent stays active (PARTIALLY_DISPATCHED / IN_PROGRESS)
  parentReq.status = 'PARTIALLY_DISPATCHED';

  // 9. Audit Log
  state.security_audit_logs.push({
    action: `REMAINING_QUANTITY_RELEASED_FOR_REQUOTE (Orig: ${item.sub_indent_no}, Released: ${remainingQty} MT -> New: ${newSubIndentNo})`,
    username: user.username || 'admin',
    timestamp: new Date().toISOString()
  });

  return {
    success: true,
    original_item_id: item.id,
    original_sub_indent_no: item.sub_indent_no,
    dispatched_quantity_mt: actualDispatched,
    released_quantity_mt: remainingQty,
    replacement_item_id: replacementItemId,
    replacement_sub_indent_no: newSubIndentNo
  };
}

// TEST 1: Partial dispatch calculates remaining quantity correctly
it('TEST 1: Partial dispatch calculates remaining quantity correctly', () => {
  const state = createInitialState();
  const userTrans = { id: 'trans_ram', transporter_id: 'trans_ram', role: 'transporter' };

  // Dispatch 15 MT out of 55 MT
  const res = simulateDispatch(state, { user: userTrans, reqId: 'req_001', itemId: 'item_01', loadedQty: 15 });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.remaining, 40);

  const item = state.items[0];
  assert.strictEqual(item.dispatched_quantity_mt, 15);
  assert.strictEqual(item.remaining_quantity_mt, 40);
  assert.strictEqual(item.dispatch_status, 'PARTIALLY_DISPATCHED');
});

// TEST 2: Admin can release remaining quantity for re-quote
it('TEST 2: Admin can release remaining quantity for re-quote', () => {
  const state = createInitialState();
  const userTrans = { id: 'trans_ram', transporter_id: 'trans_ram', role: 'transporter' };
  const userAdmin = { username: 'admin', role: 'admin' };

  simulateDispatch(state, { user: userTrans, reqId: 'req_001', itemId: 'item_01', loadedQty: 15 });

  const releaseRes = simulateReleaseRemainingForRequote(state, {
    user: userAdmin,
    reqId: 'req_001',
    itemId: 'item_01',
    reason: 'Transporter vehicle breakdown'
  });

  assert.strictEqual(releaseRes.success, true);
  assert.strictEqual(releaseRes.dispatched_quantity_mt, 15);
  assert.strictEqual(releaseRes.released_quantity_mt, 40);
  assert.strictEqual(releaseRes.replacement_sub_indent_no, 'SNPL/26-27/REQ-0001/02');
});

// TEST 3: Non-admin receives 403
it('TEST 3: Non-admin receives 403', () => {
  const state = createInitialState();
  const userTrans = { id: 'trans_ram', transporter_id: 'trans_ram', role: 'transporter' };

  simulateDispatch(state, { user: userTrans, reqId: 'req_001', itemId: 'item_01', loadedQty: 15 });

  const res = simulateReleaseRemainingForRequote(state, {
    user: userTrans,
    reqId: 'req_001',
    itemId: 'item_01'
  });

  assert.strictEqual(res.success, false);
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.code, 'FORBIDDEN_ADMIN_ONLY');
});

// TEST 4: Cannot release if remaining quantity = 0
it('TEST 4: Cannot release if remaining quantity = 0', () => {
  const state = createInitialState();
  const userTrans = { id: 'trans_ram', transporter_id: 'trans_ram', role: 'transporter' };
  const userAdmin = { username: 'admin', role: 'admin' };

  // Dispatch full 55 MT
  simulateDispatch(state, { user: userTrans, reqId: 'req_001', itemId: 'item_01', loadedQty: 55 });

  const res = simulateReleaseRemainingForRequote(state, {
    user: userAdmin,
    reqId: 'req_001',
    itemId: 'item_01'
  });

  assert.strictEqual(res.success, false);
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.code, 'NO_REMAINING_QUANTITY');
});

// TEST 5: Cannot release same item twice
it('TEST 5: Cannot release same item twice', () => {
  const state = createInitialState();
  const userTrans = { id: 'trans_ram', transporter_id: 'trans_ram', role: 'transporter' };
  const userAdmin = { username: 'admin', role: 'admin' };

  simulateDispatch(state, { user: userTrans, reqId: 'req_001', itemId: 'item_01', loadedQty: 15 });

  // First release succeeds
  const res1 = simulateReleaseRemainingForRequote(state, { user: userAdmin, reqId: 'req_001', itemId: 'item_01' });
  assert.strictEqual(res1.success, true);

  // Second release is rejected with 409
  const res2 = simulateReleaseRemainingForRequote(state, { user: userAdmin, reqId: 'req_001', itemId: 'item_01' });
  assert.strictEqual(res2.success, false);
  assert.strictEqual(res2.status, 409);
  assert.strictEqual(res2.code, 'ALREADY_RELEASED_FOR_REQUOTE');
});

// TEST 6: Original truck dispatch history remains unchanged
it('TEST 6: Original truck dispatch history remains unchanged', () => {
  const state = createInitialState();
  const userTrans = { id: 'trans_ram', transporter_id: 'trans_ram', role: 'transporter' };
  const userAdmin = { username: 'admin', role: 'admin' };

  simulateDispatch(state, { user: userTrans, reqId: 'req_001', itemId: 'item_01', loadedQty: 15, truckNumber: 'MH-40-AZ-1234' });

  assert.strictEqual(state.truck_dispatches.length, 1);
  const originalLr = state.truck_dispatches[0].lr_number;

  simulateReleaseRemainingForRequote(state, { user: userAdmin, reqId: 'req_001', itemId: 'item_01' });

  assert.strictEqual(state.truck_dispatches.length, 1);
  assert.strictEqual(state.truck_dispatches[0].truck_number, 'MH-40-AZ-1234');
  assert.strictEqual(state.truck_dispatches[0].loaded_quantity_mt, 15);
  assert.strictEqual(state.truck_dispatches[0].lr_number, originalLr);
});

// TEST 7: New sub-indent quantity equals exact remaining quantity
it('TEST 7: New sub-indent quantity equals exact remaining quantity', () => {
  const state = createInitialState();
  const userTrans = { id: 'trans_ram', transporter_id: 'trans_ram', role: 'transporter' };
  const userAdmin = { username: 'admin', role: 'admin' };

  // Dispatch 18.5 MT out of 55 MT -> Remaining = 36.5 MT
  simulateDispatch(state, { user: userTrans, reqId: 'req_001', itemId: 'item_01', loadedQty: 18.5 });

  const releaseRes = simulateReleaseRemainingForRequote(state, { user: userAdmin, reqId: 'req_001', itemId: 'item_01' });
  assert.strictEqual(releaseRes.success, true);
  assert.strictEqual(releaseRes.released_quantity_mt, 36.5);

  const replacementItem = state.items.find(i => i.id === releaseRes.replacement_item_id);
  assert.strictEqual(replacementItem.quantity_mt, 36.5);
  assert.strictEqual(replacementItem.remaining_quantity_mt, 36.5);
  assert.strictEqual(replacementItem.source_item_id, 'item_01');
});

// TEST 8: New sub-indent receives next correct sequence number
it('TEST 8: New sub-indent receives next correct sequence number', () => {
  const state = createInitialState();
  const userTrans = { id: 'trans_ram', transporter_id: 'trans_ram', role: 'transporter' };
  const userAdmin = { username: 'admin', role: 'admin' };

  // 1st partial dispatch & release -> creates /02
  simulateDispatch(state, { user: userTrans, reqId: 'req_001', itemId: 'item_01', loadedQty: 15 });
  const res1 = simulateReleaseRemainingForRequote(state, { user: userAdmin, reqId: 'req_001', itemId: 'item_01' });
  assert.strictEqual(res1.replacement_sub_indent_no, 'SNPL/26-27/REQ-0001/02');

  // Let Transporter B win /02 and dispatch 10 MT
  state.rate_submissions.push({
    id: 'sub_shyam_02',
    requirement_id: 'req_001',
    item_id: res1.replacement_item_id,
    transporter_id: 'trans_shyam',
    rate_per_mt: 12,
    final_rate: 12,
    is_finalized: 1,
    acceptance_status: 'ACCEPTED'
  });
  const userShyam = { id: 'trans_shyam', transporter_id: 'trans_shyam', role: 'transporter' };
  simulateDispatch(state, { user: userShyam, reqId: 'req_001', itemId: res1.replacement_item_id, loadedQty: 10 });

  // 2nd release on /02 -> must create /03
  const res2 = simulateReleaseRemainingForRequote(state, { user: userAdmin, reqId: 'req_001', itemId: res1.replacement_item_id });
  assert.strictEqual(res2.replacement_sub_indent_no, 'SNPL/26-27/REQ-0001/03');
  assert.strictEqual(res2.released_quantity_mt, 30);
});

// TEST 9: Old transporter cannot dispatch released quantity
it('TEST 9: Old transporter cannot dispatch released quantity', () => {
  const state = createInitialState();
  const userTrans = { id: 'trans_ram', transporter_id: 'trans_ram', role: 'transporter' };
  const userAdmin = { username: 'admin', role: 'admin' };

  simulateDispatch(state, { user: userTrans, reqId: 'req_001', itemId: 'item_01', loadedQty: 15 });
  simulateReleaseRemainingForRequote(state, { user: userAdmin, reqId: 'req_001', itemId: 'item_01' });

  // Attempting to dispatch more under old item_01
  const dispatchAttempt = simulateDispatch(state, { user: userTrans, reqId: 'req_001', itemId: 'item_01', loadedQty: 10 });
  assert.strictEqual(dispatchAttempt.success, false);
  assert.strictEqual(dispatchAttempt.status, 409);
  assert.strictEqual(dispatchAttempt.code, 'ALLOCATION_RELEASED_FOR_REQUOTE');
});

// TEST 10: New item becomes visible for fresh bidding
it('TEST 10: New item becomes visible for fresh bidding', () => {
  const state = createInitialState();
  const userTrans = { id: 'trans_ram', transporter_id: 'trans_ram', role: 'transporter' };
  const userAdmin = { username: 'admin', role: 'admin' };

  simulateDispatch(state, { user: userTrans, reqId: 'req_001', itemId: 'item_01', loadedQty: 15 });
  const releaseRes = simulateReleaseRemainingForRequote(state, { user: userAdmin, reqId: 'req_001', itemId: 'item_01' });

  const newItem = state.items.find(i => i.id === releaseRes.replacement_item_id);
  assert.strictEqual(newItem.dispatch_status, 'PENDING');
  assert.strictEqual(newItem.allocation_status, 'ACTIVE');
  assert.strictEqual(newItem.quantity_mt, 40);

  // Active open indents filter in portal includes this item
  const isOpenForBids = newItem.dispatch_status === 'PENDING' && newItem.allocation_status === 'ACTIVE';
  assert.strictEqual(isOpenForBids, true);
});

// TEST 11: Old finalized rate does not automatically apply to replacement item
it('TEST 11: Old finalized rate does not automatically apply to replacement item', () => {
  const state = createInitialState();
  const userTrans = { id: 'trans_ram', transporter_id: 'trans_ram', role: 'transporter' };
  const userAdmin = { username: 'admin', role: 'admin' };

  simulateDispatch(state, { user: userTrans, reqId: 'req_001', itemId: 'item_01', loadedQty: 15 });
  const releaseRes = simulateReleaseRemainingForRequote(state, { user: userAdmin, reqId: 'req_001', itemId: 'item_01' });

  // Check submissions for the new replacement item
  const bidsForNewItem = state.rate_submissions.filter(s => s.item_id === releaseRes.replacement_item_id);
  assert.strictEqual(bidsForNewItem.length, 0);

  // Old submission is strictly linked to original item_01
  const oldBid = state.rate_submissions.find(s => s.id === 'sub_ram_01');
  assert.strictEqual(oldBid.item_id, 'item_01');
});

// TEST 12: Parent requirement is not incorrectly marked completed
it('TEST 12: Parent requirement is not incorrectly marked completed', () => {
  const state = createInitialState();
  const userTrans = { id: 'trans_ram', transporter_id: 'trans_ram', role: 'transporter' };
  const userAdmin = { username: 'admin', role: 'admin' };

  simulateDispatch(state, { user: userTrans, reqId: 'req_001', itemId: 'item_01', loadedQty: 15 });
  simulateReleaseRemainingForRequote(state, { user: userAdmin, reqId: 'req_001', itemId: 'item_01' });

  const parentReq = state.requirements.find(r => r.id === 'req_001');
  assert.notStrictEqual(parentReq.status, 'COMPLETED');
  assert.strictEqual(parentReq.status, 'PARTIALLY_DISPATCHED');
});

// TEST 13: Audit log is created
it('TEST 13: Audit log is created', () => {
  const state = createInitialState();
  const userTrans = { id: 'trans_ram', transporter_id: 'trans_ram', role: 'transporter' };
  const userAdmin = { username: 'admin', role: 'admin' };

  simulateDispatch(state, { user: userTrans, reqId: 'req_001', itemId: 'item_01', loadedQty: 15 });
  simulateReleaseRemainingForRequote(state, { user: userAdmin, reqId: 'req_001', itemId: 'item_01' });

  assert.strictEqual(state.security_audit_logs.length, 1);
  assert.strictEqual(state.security_audit_logs[0].action.includes('REMAINING_QUANTITY_RELEASED_FOR_REQUOTE'), true);
  assert.strictEqual(state.security_audit_logs[0].username, 'admin');
});

// TEST 14: Concurrent release requests do not create duplicate replacement items
it('TEST 14: Concurrent release requests do not create duplicate replacement items', () => {
  const state = createInitialState();
  const userTrans = { id: 'trans_ram', transporter_id: 'trans_ram', role: 'transporter' };
  const userAdmin = { username: 'admin', role: 'admin' };

  simulateDispatch(state, { user: userTrans, reqId: 'req_001', itemId: 'item_01', loadedQty: 15 });

  // Simulate two concurrent invocations
  const res1 = simulateReleaseRemainingForRequote(state, { user: userAdmin, reqId: 'req_001', itemId: 'item_01' });
  const res2 = simulateReleaseRemainingForRequote(state, { user: userAdmin, reqId: 'req_001', itemId: 'item_01' });

  assert.strictEqual(res1.success, true);
  assert.strictEqual(res2.success, false);
  assert.strictEqual(res2.code, 'ALREADY_RELEASED_FOR_REQUOTE');

  // Verify only 1 replacement item was created (total items = 2: item_01 and item_02)
  const itemsForReq = state.items.filter(i => i.requirement_id === 'req_001');
  assert.strictEqual(itemsForReq.length, 2);
});

// TEST 15: Continue With Same Transporter keeps current dispatch capability
it('TEST 15: Continue With Same Transporter keeps current dispatch capability', () => {
  const state = createInitialState();
  const userTrans = { id: 'trans_ram', transporter_id: 'trans_ram', role: 'transporter' };

  // 1st truck: 15 MT
  const res1 = simulateDispatch(state, { user: userTrans, reqId: 'req_001', itemId: 'item_01', loadedQty: 15, truckNumber: 'MH-40-A-1001' });
  assert.strictEqual(res1.success, true);
  assert.strictEqual(res1.remaining, 40);

  // Admin chooses "Continue With Same Transporter" -> item stays in PARTIALLY_DISPATCHED
  const item = state.items[0];
  assert.strictEqual(item.dispatch_status, 'PARTIALLY_DISPATCHED');

  // 2nd truck: 20 MT
  const res2 = simulateDispatch(state, { user: userTrans, reqId: 'req_001', itemId: 'item_01', loadedQty: 20, truckNumber: 'MH-40-A-1002' });
  assert.strictEqual(res2.success, true);
  assert.strictEqual(res2.remaining, 20);

  // 3rd truck: 20 MT (completes 55 MT)
  const res3 = simulateDispatch(state, { user: userTrans, reqId: 'req_001', itemId: 'item_01', loadedQty: 20, truckNumber: 'MH-40-A-1003' });
  assert.strictEqual(res3.success, true);
  assert.strictEqual(res3.remaining, 0);
  assert.strictEqual(item.dispatch_status, 'FULLY_DISPATCHED');

  const parentReq = state.requirements.find(r => r.id === 'req_001');
  assert.strictEqual(parentReq.status, 'COMPLETED');
});

console.log('================================================================');
console.log(`📊 TEST RESULTS: ${passedTests} Passed | ${failedTests} Failed`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
}
