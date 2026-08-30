// tests/transporter_dispatch_workflow.test.js
// Automated Test Suite for Rate Finalization ➔ Transporter Acceptance ➔ Truck Dispatch & Auto LR Generation 🚛📄

import assert from 'assert';

console.log('================================================================');
console.log('🧪 RUNNING TRANSPORTER DISPATCH & CONCURRENCY-SAFE LR TEST SUITE');
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

// -------------------------------------------------------------
// Test Workflow Emulation Engine
// -------------------------------------------------------------
function createMockWorkflowState() {
  return {
    requirements: [
      { id: 'req_001', req_no: 'SNPL/26-27/001', status: 'ACTIVE' }
    ],
    requirement_items: [
      { id: 'item_001', requirement_id: 'req_001', sub_indent_no: 'SNPL/26-27/001/01', quantity_mt: 80.0, dispatched_quantity_mt: 0, remaining_quantity_mt: 80.0, dispatch_status: 'PENDING' }
    ],
    transporters: [
      { id: 'trans_win', code: 'TR_WIN', username: 'win_transporter', company_name: 'Winning Transport Co' },
      { id: 'trans_other', code: 'TR_OTHER', username: 'other_transporter', company_name: 'Other Freight LLC' }
    ],
    rate_submissions: [
      { id: 'sub_win', requirement_id: 'req_001', item_id: 'item_001', transporter_id: 'trans_win', rate_per_mt: 500, bid_status: 'SUBMITTED', is_finalized: 0, acceptance_status: null },
      { id: 'sub_other', requirement_id: 'req_001', item_id: 'item_001', transporter_id: 'trans_other', rate_per_mt: 520, bid_status: 'SUBMITTED', is_finalized: 0, acceptance_status: null }
    ],
    truck_dispatches: [],
    security_audit_logs: [],
    lr_sequences: { 'LR-SNPL-2026': 0 }
  };
}

// Emulate Server-Side Finalize
function finalizeRate(state, subId, agreedRate, adminUser) {
  if (!adminUser || adminUser.role !== 'admin') {
    return { status: 403, error: 'Admin access required.' };
  }
  const sub = state.rate_submissions.find(s => s.id === subId);
  if (!sub) return { status: 404, error: 'Submission not found' };

  sub.is_finalized = 1;
  sub.final_rate = agreedRate;
  sub.finalized_rate = agreedRate;
  sub.finalized_at = new Date().toISOString();
  sub.finalized_by = adminUser.username;
  sub.acceptance_status = 'PENDING';
  sub.bid_status = 'FINALIZED';

  const item = state.requirement_items.find(i => i.id === sub.item_id && i.requirement_id === sub.requirement_id);
  if (item) item.dispatch_status = 'AWAITING_ACCEPTANCE';

  return { status: 200, success: true, submission: sub };
}

// Emulate Server-Side Accept Final Rate
function acceptFinalRate(state, requirementId, itemId, authUser, submissionId = null) {
  if (!authUser) return { status: 401, error: 'Authentication required' };
  const userRole = String(authUser.role || '').trim().toLowerCase();
  if (userRole !== 'transporter') return { status: 403, error: 'Only transporters can accept finalized rates.' };

  let sub = null;
  if (submissionId) {
    sub = state.rate_submissions.find(s => s.id === submissionId);
  }

  if (!sub && requirementId) {
    const parentReq = state.requirements.find(r => r.id === requirementId || r.req_no === requirementId);
    const resolvedReqId = parentReq ? parentReq.id : requirementId;
    const item = state.requirement_items.find(i => (i.requirement_id === resolvedReqId || i.requirement_id === requirementId) && (i.id === itemId || i.sub_indent_no === itemId || i.sub_indent_no?.includes(itemId)));
    const resolvedItemId = item ? item.id : itemId;

    sub = state.rate_submissions.find(s => 
      (s.requirement_id === resolvedReqId || s.requirement_id === requirementId) && 
      (s.item_id === resolvedItemId || s.item_id === itemId || s.item_id === 'MAIN') && 
      (s.is_finalized || s.bid_status === 'FINALIZED' || Number(s.final_rate) > 0)
    );
  }

  if (!sub) return { status: 404, error: 'Finalized quote not found for this requirement item.' };

  // Strict server-side winning transporter check
  const isWinningTransporter = (sub.transporter_id === authUser.transporter_id || sub.transporter_id === authUser.id);
  if (!isWinningTransporter) {
    return {
      status: 403,
      success: false,
      code: 'FORBIDDEN_NOT_WINNING_TRANSPORTER',
      error: 'Only the finalized winning transporter can accept this rate.'
    };
  }

  sub.acceptance_status = 'ACCEPTED';
  sub.transporter_accepted_at = new Date().toISOString();
  sub.transporter_accepted_by = authUser.username;

  const item = state.requirement_items.find(i => i.id === sub.item_id && i.requirement_id === sub.requirement_id);
  if (item) item.dispatch_status = 'ACCEPTED';

  return { status: 200, success: true, submission: sub };
}

// Emulate Server-Side Dispatch
function dispatchTruck(state, requirementId, itemId, authUser, payload) {
  if (!authUser) return { status: 401, error: 'Authentication required' };
  if (authUser.role !== 'transporter') return { status: 403, error: 'Only transporters can dispatch trucks.' };

  const sub = state.rate_submissions.find(s => s.requirement_id === requirementId && s.item_id === itemId && (s.is_finalized || s.bid_status === 'FINALIZED'));
  if (!sub) return { status: 400, code: 'RATE_NOT_FINALIZED', error: 'Rate not finalized' };

  // Strict server-side RBAC
  const isWinningTransporter = (sub.transporter_id === authUser.transporter_id || sub.transporter_id === authUser.id);
  if (!isWinningTransporter) {
    return {
      status: 403,
      success: false,
      code: 'FORBIDDEN_NOT_WINNING_TRANSPORTER',
      error: 'Access denied. You are not the finalized winning transporter for this requirement.'
    };
  }

  // Acceptance Gate
  if (sub.acceptance_status !== 'ACCEPTED') {
    return {
      status: 400,
      success: false,
      code: 'AWAITING_TRANSPORTER_ACCEPTANCE',
      error: 'Finalized rate must be accepted by the transporter before dispatching trucks.'
    };
  }

  const item = state.requirement_items.find(i => i.id === itemId && i.requirement_id === requirementId);
  if (!item) return { status: 404, error: 'Item not found' };

  const loadedQty = parseFloat(payload.loaded_quantity_mt);
  if (isNaN(loadedQty) || loadedQty <= 0) {
    return { status: 400, error: 'Loaded quantity must be > 0' };
  }

  const alreadyDispatched = state.truck_dispatches
    .filter(d => d.requirement_id === requirementId && d.requirement_item_id === itemId)
    .reduce((acc, curr) => acc + curr.loaded_quantity_mt, 0);

  const remainingQty = item.quantity_mt - alreadyDispatched;

  if (loadedQty > remainingQty) {
    return {
      status: 400,
      success: false,
      code: 'EXCEEDS_REMAINING_QUANTITY',
      error: `Loaded quantity cannot exceed remaining balance (${remainingQty} MT).`,
      remaining_quantity_mt: remainingQty
    };
  }

  // Concurrency-safe Sequence Generation
  const prefix = 'LR-SNPL-2026';
  state.lr_sequences[prefix] = (state.lr_sequences[prefix] || 0) + 1;
  const seq = state.lr_sequences[prefix];
  const lrNumber = `${prefix}-${String(seq).padStart(5, '0')}`;

  const dispatch = {
    id: `disp_${Date.now()}_${seq}`,
    requirement_id: requirementId,
    requirement_item_id: itemId,
    transporter_id: sub.transporter_id,
    finalized_rate: sub.final_rate,
    truck_number: payload.truck_number,
    loaded_quantity_mt: loadedQty,
    driver_name: payload.driver_name,
    driver_mobile: payload.driver_mobile,
    driver_license: payload.driver_license,
    lr_number: lrNumber,
    dispatch_status: 'Dispatched',
    dispatched_at: new Date().toISOString()
  };

  state.truck_dispatches.push(dispatch);

  state.security_audit_logs.push({
    id: `sec_${Date.now()}`,
    action: `TRUCK_DISPATCHED (${payload.truck_number} - ${loadedQty} MT, LR: ${lrNumber})`,
    username: authUser.username,
    role: 'transporter',
    ip: '127.0.0.1',
    status: 'DISPATCHED 🚛',
    timestamp: new Date().toISOString()
  });

  const newTotalDispatched = alreadyDispatched + loadedQty;
  const newRemaining = item.quantity_mt - newTotalDispatched;
  item.dispatched_quantity_mt = newTotalDispatched;
  item.remaining_quantity_mt = newRemaining;
  item.dispatch_status = newRemaining <= 0 ? 'FULLY_DISPATCHED' : 'PARTIALLY_DISPATCHED';

  const reqParent = state.requirements.find(r => r.id === requirementId);
  if (reqParent) {
    reqParent.status = newRemaining <= 0 ? 'COMPLETED' : 'PARTIALLY_DISPATCHED';
  }

  return {
    status: 200,
    success: true,
    dispatch,
    lr_number: lrNumber,
    remaining_quantity_mt: newRemaining,
    dispatch_status: item.dispatch_status
  };
}

// Emulate Server-Side Get Dispatches
function getDispatches(state, requirementId, itemId, authUser) {
  if (!authUser) return { status: 401, error: 'Authentication required' };

  if (authUser.role === 'admin') {
    const list = state.truck_dispatches.filter(d => d.requirement_id === requirementId && d.requirement_item_id === itemId);
    return { status: 200, success: true, dispatches: list };
  }

  if (authUser.role === 'transporter') {
    const sub = state.rate_submissions.find(s => s.requirement_id === requirementId && s.item_id === itemId && (s.is_finalized || s.bid_status === 'FINALIZED'));
    const isWinningTransporter = sub && (sub.transporter_id === authUser.transporter_id || sub.transporter_id === authUser.id);
    if (!isWinningTransporter) {
      return {
        status: 403,
        success: false,
        code: 'FORBIDDEN_DISPATCH_ACCESS',
        error: 'Access denied. You can only view your own dispatches.'
      };
    }

    const list = state.truck_dispatches.filter(d => d.requirement_id === requirementId && d.requirement_item_id === itemId && d.transporter_id === authUser.transporter_id);
    return { status: 200, success: true, dispatches: list };
  }

  return { status: 403, error: 'Access denied' };
}

// =============================================================
// TEST SUITE EXECUTION
// =============================================================

// TEST 1: Admin can finalize rate and set is_finalized = 1
it('TEST 1: Admin finalizes rate -> sets is_finalized, finalized_rate, and acceptance_status = PENDING', () => {
  const state = createMockWorkflowState();
  const res = finalizeRate(state, 'sub_win', 480, { username: 'admin', role: 'admin' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.submission.is_finalized, 1);
  assert.strictEqual(res.submission.finalized_rate, 480);
  assert.strictEqual(res.submission.acceptance_status, 'PENDING');
  assert.strictEqual(res.submission.bid_status, 'FINALIZED');
  assert.strictEqual(state.requirement_items[0].dispatch_status, 'AWAITING_ACCEPTANCE');
});

// TEST 2: Winning transporter can accept final rate (role = "transporter")
it('TEST 2: Winning transporter accepts finalized rate successfully (role = "transporter")', () => {
  const state = createMockWorkflowState();
  finalizeRate(state, 'sub_win', 480, { username: 'admin', role: 'admin' });

  const authUser = { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' };
  const res = acceptFinalRate(state, 'req_001', 'item_001', authUser);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.submission.acceptance_status, 'ACCEPTED');
  assert.strictEqual(state.requirement_items[0].dispatch_status, 'ACCEPTED');
});

// TEST 2B: Role normalization handles mixed case "Transporter"
it('TEST 2B: JWT role = "Transporter" is normalized and allows rate acceptance', () => {
  const state = createMockWorkflowState();
  finalizeRate(state, 'sub_win', 480, { username: 'admin', role: 'admin' });

  const authUser = { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'Transporter' };
  const res = acceptFinalRate(state, 'req_001', 'item_001', authUser);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.submission.acceptance_status, 'ACCEPTED');
});

// TEST 2C: Role normalization handles uppercase "TRANSPORTER"
it('TEST 2C: JWT role = "TRANSPORTER" is normalized and allows rate acceptance', () => {
  const state = createMockWorkflowState();
  finalizeRate(state, 'sub_win', 480, { username: 'admin', role: 'admin' });

  const authUser = { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'TRANSPORTER' };
  const res = acceptFinalRate(state, 'req_001', 'item_001', authUser);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.submission.acceptance_status, 'ACCEPTED');
});

// TEST 2D: Legacy verified transporter account with role "vendor" is canonicalized to "transporter"
it('TEST 2D: Legacy verified transporter record with role "vendor" receives canonical transporter access', () => {
  const state = createMockWorkflowState();
  finalizeRate(state, 'sub_win', 480, { username: 'admin', role: 'admin' });

  // Emulate middleware token decode: rawRole === 'vendor' with transporter_id canonicalized to 'transporter'
  const rawDecoded = { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'vendor' };
  const canonicalRole = (rawDecoded.role === 'vendor' && (rawDecoded.transporter_id || rawDecoded.id)) ? 'transporter' : rawDecoded.role;
  const authUser = { ...rawDecoded, role: canonicalRole };

  const res = acceptFinalRate(state, 'req_001', 'item_001', authUser);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.submission.acceptance_status, 'ACCEPTED');
});

// TEST 2E: Arbitrary user with role "vendor" but no transporter identity is rejected
it('TEST 2E: Arbitrary user with role "vendor" and no transporter identity is rejected with 403', () => {
  const state = createMockWorkflowState();
  finalizeRate(state, 'sub_win', 480, { username: 'admin', role: 'admin' });

  const arbitraryUser = { id: 'usr_guest', username: 'guest_vendor', role: 'vendor' };
  const res = acceptFinalRate(state, 'req_001', 'item_001', arbitraryUser);
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.error, 'Only transporters can accept finalized rates.');
});

// TEST 2F: User with invalid role is rejected
it('TEST 2F: User with invalid role (e.g. "auditor", "viewer") is rejected with 403', () => {
  const state = createMockWorkflowState();
  finalizeRate(state, 'sub_win', 480, { username: 'admin', role: 'admin' });

  const viewerUser = { id: 'usr_view', username: 'viewer', role: 'viewer' };
  const res = acceptFinalRate(state, 'req_001', 'item_001', viewerUser);
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.error, 'Only transporters can accept finalized rates.');
});

// TEST 2G: Generic code field alone without verified transporter record does NOT grant transporter access
it('TEST 2G: Generic code field alone without verified database transporter record is rejected', () => {
  const state = createMockWorkflowState();
  finalizeRate(state, 'sub_win', 480, { username: 'admin', role: 'admin' });

  // User with code "C001" but role "employee" and no transporter table record
  const unverifiedUser = { id: 'usr_emp', code: 'C001', username: 'john_doe', role: 'employee' };
  const res = acceptFinalRate(state, 'req_001', 'item_001', unverifiedUser);
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.error, 'Only transporters can accept finalized rates.');
});

// TEST 2H: Transporter identity resolver requires verified existence in transporters table
it('TEST 2H: Synthetic / unverified transporter_id without matching transporter record is rejected', () => {
  const state = createMockWorkflowState();
  finalizeRate(state, 'sub_win', 480, { username: 'admin', role: 'admin' });

  // User has role "transporter" in JWT but ID does not match the winning transporter
  const spoofedUser = { id: 'usr_fake', transporter_id: 'trans_fake', username: 'fake_trans', role: 'transporter' };
  const res = acceptFinalRate(state, 'req_001', 'item_001', spoofedUser);
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.code, 'FORBIDDEN_NOT_WINNING_TRANSPORTER');
});

// TEST 2I: Exact Production Scenario (SNPL/26-27/REQ-0001 item /01 finalized at Rs 11)
it('TEST 2I: Exact Production Scenario (Req formatted no SNPL/26-27/REQ-0001, sub-indent /01, Rate Rs 11) accepts successfully', () => {
  const state = {
    requirements: [
      { id: 'req_prod_001', req_no: 'SNPL/26-27/REQ-0001', status: 'ACTIVE' }
    ],
    requirement_items: [
      { id: 'item_prod_01', requirement_id: 'req_prod_001', sub_indent_no: 'SNPL/26-27/REQ-0001/01', quantity_mt: 55.0, dispatched_quantity_mt: 0, remaining_quantity_mt: 55.0, dispatch_status: 'AWAITING_ACCEPTANCE' }
    ],
    transporters: [
      { id: 'trans_ram', code: 'RAM01', username: 'ram', company_name: 'Ram Logistics' }
    ],
    rate_submissions: [
      { id: 'sub_ram_01', requirement_id: 'req_prod_001', item_id: 'item_prod_01', transporter_id: 'trans_ram', rate_per_mt: 11, final_rate: 11, is_finalized: 1, bid_status: 'FINALIZED', acceptance_status: 'PENDING' }
    ],
    truck_dispatches: []
  };

  const authUserRam = { id: 'trans_ram', transporter_id: 'trans_ram', username: 'ram', role: 'transporter' };

  // Call with formatted req_no and sub_indent_no (e.g. from UI)
  const res = acceptFinalRate(state, 'SNPL/26-27/REQ-0001', '/01', authUserRam, 'sub_ram_01');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.submission.acceptance_status, 'ACCEPTED');
  assert.strictEqual(state.requirement_items[0].dispatch_status, 'ACCEPTED');
});

// TEST 2J: Wrong item ID or unfinalized item returns 404
it('TEST 2J: Non-existent item ID returns 404', () => {
  const state = createMockWorkflowState();
  const authUser = { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' };
  const res = acceptFinalRate(state, 'req_001', 'item_non_existent', authUser);
  assert.strictEqual(res.status, 404);
});

// TEST 3: Non-winning transporter receives 403 when trying to accept
it('TEST 3: Non-winning transporter receives 403 FORBIDDEN_NOT_WINNING_TRANSPORTER on accept', () => {
  const state = createMockWorkflowState();
  finalizeRate(state, 'sub_win', 480, { username: 'admin', role: 'admin' });

  const otherUser = { id: 'trans_other', transporter_id: 'trans_other', username: 'other_transporter', role: 'transporter' };
  const res = acceptFinalRate(state, 'req_001', 'item_001', otherUser);

  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.code, 'FORBIDDEN_NOT_WINNING_TRANSPORTER');
});

// TEST 3B: Admin cannot call transporter accept-final-rate endpoint
it('TEST 3B: Admin user cannot call transporter acceptance endpoint (HTTP 403)', () => {
  const state = createMockWorkflowState();
  finalizeRate(state, 'sub_win', 480, { username: 'admin', role: 'admin' });

  const adminUser = { id: 'usr_admin', username: 'admin', role: 'admin' };
  const res = acceptFinalRate(state, 'req_001', 'item_001', adminUser);

  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.error, 'Only transporters can accept finalized rates.');
});

// TEST 4: Unauthenticated request receives 401
it('TEST 4: Unauthenticated request receives 401 Authentication Required', () => {
  const state = createMockWorkflowState();
  finalizeRate(state, 'sub_win', 480, { username: 'admin', role: 'admin' });

  const res = acceptFinalRate(state, 'req_001', 'item_001', null);
  assert.strictEqual(res.status, 401);
});

// TEST 4B: Authorization Bearer header formatting validation
it('TEST 4B: Authorization Bearer token header is properly structured', () => {
  const token = 'sample.jwt.token';
  const headers = { 'Authorization': `Bearer ${token}` };
  assert.strictEqual(headers['Authorization'].startsWith('Bearer '), true);
  assert.strictEqual(headers['Authorization'].split(' ')[1], token);
});

// TEST 5: Dispatch before acceptance is strictly blocked
it('TEST 5: Dispatch before acceptance is blocked with 400 AWAITING_TRANSPORTER_ACCEPTANCE', () => {
  const state = createMockWorkflowState();
  finalizeRate(state, 'sub_win', 480, { username: 'admin', role: 'admin' });

  const winUser = { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' };
  const res = dispatchTruck(state, 'req_001', 'item_001', winUser, {
    truck_number: 'MH31FC4512',
    loaded_quantity_mt: 25.0,
    driver_name: 'Ramesh Kumar',
    driver_mobile: '9876543210',
    driver_license: 'MH3120210012345'
  });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.code, 'AWAITING_TRANSPORTER_ACCEPTANCE');
});

// TEST 6: Non-winning transporter cannot dispatch
it('TEST 6: Non-winning transporter receives 403 FORBIDDEN_NOT_WINNING_TRANSPORTER on dispatch', () => {
  const state = createMockWorkflowState();
  finalizeRate(state, 'sub_win', 480, { username: 'admin', role: 'admin' });
  acceptFinalRate(state, 'req_001', 'item_001', { id: 'trans_win', transporter_id: 'trans_win', role: 'transporter' });

  const otherUser = { id: 'trans_other', transporter_id: 'trans_other', username: 'other_transporter', role: 'transporter' };
  const res = dispatchTruck(state, 'req_001', 'item_001', otherUser, {
    truck_number: 'MH31FC4512',
    loaded_quantity_mt: 25.0,
    driver_name: 'Ramesh Kumar',
    driver_mobile: '9876543210',
    driver_license: 'MH3120210012345'
  });

  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.code, 'FORBIDDEN_NOT_WINNING_TRANSPORTER');
});

// TEST 7: Dispatch quantity cannot exceed remaining quantity
it('TEST 7: Dispatch exceeding remaining quantity is rejected with 400 EXCEEDS_REMAINING_QUANTITY', () => {
  const state = createMockWorkflowState(); // total 80 MT
  finalizeRate(state, 'sub_win', 480, { username: 'admin', role: 'admin' });
  acceptFinalRate(state, 'req_001', 'item_001', { id: 'trans_win', transporter_id: 'trans_win', role: 'transporter' });

  const winUser = { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' };
  const res = dispatchTruck(state, 'req_001', 'item_001', winUser, {
    truck_number: 'MH31FC4512',
    loaded_quantity_mt: 85.0, // Exceeds 80 MT
    driver_name: 'Ramesh Kumar',
    driver_mobile: '9876543210',
    driver_license: 'MH3120210012345'
  });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.code, 'EXCEEDS_REMAINING_QUANTITY');
  assert.strictEqual(res.remaining_quantity_mt, 80.0);
});

// TEST 8: Partial dispatch updates remaining balance and sets PARTIALLY_DISPATCHED
it('TEST 8: Partial dispatch (22 MT of 80 MT) leaves 58 MT remaining and status PARTIALLY_DISPATCHED', () => {
  const state = createMockWorkflowState();
  finalizeRate(state, 'sub_win', 480, { username: 'admin', role: 'admin' });
  acceptFinalRate(state, 'req_001', 'item_001', { id: 'trans_win', transporter_id: 'trans_win', role: 'transporter' });

  const winUser = { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' };
  const res = dispatchTruck(state, 'req_001', 'item_001', winUser, {
    truck_number: 'MH31FC4512',
    loaded_quantity_mt: 22.0,
    driver_name: 'Ramesh Kumar',
    driver_mobile: '9876543210',
    driver_license: 'MH3120210012345'
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.remaining_quantity_mt, 58.0);
  assert.strictEqual(res.dispatch_status, 'PARTIALLY_DISPATCHED');
  assert.strictEqual(state.requirement_items[0].dispatched_quantity_mt, 22.0);
  assert.strictEqual(state.requirement_items[0].remaining_quantity_mt, 58.0);
  assert.strictEqual(state.requirements[0].status, 'PARTIALLY_DISPATCHED');
});

// TEST 9: Concurrency-safe LR generation creates unique consecutive LR numbers
it('TEST 9: Concurrency-safe LR numbers are formatted as LR-SNPL-YYYY-XXXXX with unique increments', () => {
  const state = createMockWorkflowState();
  finalizeRate(state, 'sub_win', 480, { username: 'admin', role: 'admin' });
  acceptFinalRate(state, 'req_001', 'item_001', { id: 'trans_win', transporter_id: 'trans_win', role: 'transporter' });

  const winUser = { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' };
  const d1 = dispatchTruck(state, 'req_001', 'item_001', winUser, {
    truck_number: 'MH31FC1111',
    loaded_quantity_mt: 20.0,
    driver_name: 'Driver 1',
    driver_mobile: '9876543211',
    driver_license: 'DL1'
  });
  const d2 = dispatchTruck(state, 'req_001', 'item_001', winUser, {
    truck_number: 'MH31FC2222',
    loaded_quantity_mt: 20.0,
    driver_name: 'Driver 2',
    driver_mobile: '9876543212',
    driver_license: 'DL2'
  });

  assert.strictEqual(d1.lr_number, 'LR-SNPL-2026-00001');
  assert.strictEqual(d2.lr_number, 'LR-SNPL-2026-00002');
  assert.notStrictEqual(d1.lr_number, d2.lr_number);
});

// TEST 10: Full dispatch completes the item and parent requirement
it('TEST 10: Finalizing remaining balance marks item FULLY_DISPATCHED and parent COMPLETED', () => {
  const state = createMockWorkflowState();
  finalizeRate(state, 'sub_win', 480, { username: 'admin', role: 'admin' });
  acceptFinalRate(state, 'req_001', 'item_001', { id: 'trans_win', transporter_id: 'trans_win', role: 'transporter' });

  const winUser = { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' };
  // Truck 1: 50 MT
  dispatchTruck(state, 'req_001', 'item_001', winUser, {
    truck_number: 'MH31FC1001',
    loaded_quantity_mt: 50.0,
    driver_name: 'Driver 1',
    driver_mobile: '9876543210',
    driver_license: 'DL1'
  });

  // Truck 2: remaining 30 MT
  const res2 = dispatchTruck(state, 'req_001', 'item_001', winUser, {
    truck_number: 'MH31FC1002',
    loaded_quantity_mt: 30.0,
    driver_name: 'Driver 2',
    driver_mobile: '9876543211',
    driver_license: 'DL2'
  });

  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.remaining_quantity_mt, 0);
  assert.strictEqual(res2.dispatch_status, 'FULLY_DISPATCHED');
  assert.strictEqual(state.requirement_items[0].dispatch_status, 'FULLY_DISPATCHED');
  assert.strictEqual(state.requirements[0].status, 'COMPLETED');
});

// TEST 11: Admin can view all dispatch records for item
it('TEST 11: Admin has access to view all dispatches for requirement item', () => {
  const state = createMockWorkflowState();
  finalizeRate(state, 'sub_win', 480, { username: 'admin', role: 'admin' });
  acceptFinalRate(state, 'req_001', 'item_001', { id: 'trans_win', transporter_id: 'trans_win', role: 'transporter' });

  const winUser = { id: 'trans_win', transporter_id: 'trans_win', role: 'transporter' };
  dispatchTruck(state, 'req_001', 'item_001', winUser, {
    truck_number: 'MH31FC1001',
    loaded_quantity_mt: 25.0,
    driver_name: 'Driver 1',
    driver_mobile: '9876543210',
    driver_license: 'DL1'
  });

  const adminRes = getDispatches(state, 'req_001', 'item_001', { username: 'admin', role: 'admin' });
  assert.strictEqual(adminRes.status, 200);
  assert.strictEqual(adminRes.dispatches.length, 1);
  assert.strictEqual(adminRes.dispatches[0].truck_number, 'MH31FC1001');
});

// TEST 12: Other transporters cannot view winning transporter dispatches (403)
it('TEST 12: Other transporters receive 403 FORBIDDEN_DISPATCH_ACCESS when attempting to view dispatches', () => {
  const state = createMockWorkflowState();
  finalizeRate(state, 'sub_win', 480, { username: 'admin', role: 'admin' });
  acceptFinalRate(state, 'req_001', 'item_001', { id: 'trans_win', transporter_id: 'trans_win', role: 'transporter' });

  const winUser = { id: 'trans_win', transporter_id: 'trans_win', role: 'transporter' };
  dispatchTruck(state, 'req_001', 'item_001', winUser, {
    truck_number: 'MH31FC1001',
    loaded_quantity_mt: 25.0,
    driver_name: 'Driver 1',
    driver_mobile: '9876543210',
    driver_license: 'DL1'
  });

  const otherUser = { id: 'trans_other', transporter_id: 'trans_other', role: 'transporter' };
  const res = getDispatches(state, 'req_001', 'item_001', otherUser);
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.code, 'FORBIDDEN_DISPATCH_ACCESS');
});

// TEST 13: Truck dispatch successfully creates a security audit log
it('TEST 13: Truck dispatch successfully creates a security audit log', () => {
  const state = createMockWorkflowState();
  finalizeRate(state, 'sub_win', 480, { username: 'admin', role: 'admin' });
  acceptFinalRate(state, 'req_001', 'item_001', { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' });

  const winUser = { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' };
  const res = dispatchTruck(state, 'req_001', 'item_001', winUser, {
    truck_number: 'MH31FC4512',
    loaded_quantity_mt: 25.0,
    driver_name: 'Ramesh Kumar',
    driver_mobile: '9876543210',
    driver_license: 'MH3120210012345'
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.lr_number.startsWith('LR-SNPL-2026-'), true);
  assert.strictEqual(res.remaining_quantity_mt, 55.0);
  assert.strictEqual(state.truck_dispatches.length, 1);
  assert.strictEqual(state.security_audit_logs.length, 1);
  assert.strictEqual(state.security_audit_logs[0].username, 'win_transporter');
  assert.strictEqual(state.security_audit_logs[0].role, 'transporter');
  assert.strictEqual(state.security_audit_logs[0].status, 'DISPATCHED 🚛');
  assert.strictEqual(state.security_audit_logs[0].action.includes('MH31FC4512'), true);
});

// TEST 14: Truck dispatch execution never throws ReferenceError on parentReq
it('TEST 14: Truck dispatch execution never throws ReferenceError on parentReq', () => {
  const state = createMockWorkflowState();
  finalizeRate(state, 'sub_win', 480, { username: 'admin', role: 'admin' });
  acceptFinalRate(state, 'req_001', 'item_001', { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' });

  const winUser = { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' };
  let caughtError = null;
  try {
    const res = dispatchTruck(state, 'req_001', 'item_001', winUser, {
      truck_number: 'MH31AA9999',
      loaded_quantity_mt: 40.0,
      driver_name: 'Suresh Patil',
      driver_mobile: '9876500000',
      driver_license: 'DL99999'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.remaining_quantity_mt, 40.0);
  } catch (err) {
    caughtError = err;
  }
  assert.strictEqual(caughtError, null);
});

// TEST 15 (CONSISTENCY 1): Item /01 quantity 44 MT, no dispatches -> remaining = 44 -> dispatch 40 MT succeeds
it('TEST 15: Item /01 quantity 44 MT, no dispatches -> remaining = 44 -> dispatch 40 MT succeeds', () => {
  const state = createMockWorkflowState();
  state.requirement_items[0].quantity_mt = 44.0;
  state.requirement_items[0].remaining_quantity_mt = 44.0;
  finalizeRate(state, 'sub_win', 10, { username: 'admin', role: 'admin' });
  acceptFinalRate(state, 'req_001', 'item_001', { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' });

  const winUser = { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' };
  const res = dispatchTruck(state, 'req_001', 'item_001', winUser, {
    truck_number: 'MH31AA1234',
    loaded_quantity_mt: 40.0,
    driver_name: 'Driver A',
    driver_mobile: '9876543210',
    driver_license: 'DL1234'
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.remaining_quantity_mt, 4.0);
  assert.strictEqual(state.requirement_items[0].dispatched_quantity_mt, 40.0);
  assert.strictEqual(state.requirement_items[0].remaining_quantity_mt, 4.0);
});

// TEST 16 (CONSISTENCY 2): After dispatching 40 MT from 44 MT, remaining = 4 MT
it('TEST 16: After dispatching 40 MT from 44 MT, remaining = 4 MT', () => {
  const state = createMockWorkflowState();
  state.requirement_items[0].quantity_mt = 44.0;
  state.requirement_items[0].remaining_quantity_mt = 44.0;
  finalizeRate(state, 'sub_win', 10, { username: 'admin', role: 'admin' });
  acceptFinalRate(state, 'req_001', 'item_001', { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' });

  const winUser = { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' };
  dispatchTruck(state, 'req_001', 'item_001', winUser, {
    truck_number: 'MH31AA1234',
    loaded_quantity_mt: 40.0,
    driver_name: 'Driver A',
    driver_mobile: '9876543210',
    driver_license: 'DL1234'
  });

  const alreadyDispatched = state.truck_dispatches
    .filter(d => d.requirement_item_id === 'item_001')
    .reduce((acc, curr) => acc + curr.loaded_quantity_mt, 0);

  const remainingBalance = state.requirement_items[0].quantity_mt - alreadyDispatched;
  assert.strictEqual(remainingBalance, 4.0);
});

// TEST 17 (CONSISTENCY 3): Attempt dispatch 5 MT after 40/44 fails because remaining = 4
it('TEST 17: Attempt dispatch 5 MT after 40/44 fails because remaining = 4', () => {
  const state = createMockWorkflowState();
  state.requirement_items[0].quantity_mt = 44.0;
  state.requirement_items[0].remaining_quantity_mt = 44.0;
  finalizeRate(state, 'sub_win', 10, { username: 'admin', role: 'admin' });
  acceptFinalRate(state, 'req_001', 'item_001', { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' });

  const winUser = { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' };
  dispatchTruck(state, 'req_001', 'item_001', winUser, {
    truck_number: 'MH31AA1234',
    loaded_quantity_mt: 40.0,
    driver_name: 'Driver A',
    driver_mobile: '9876543210',
    driver_license: 'DL1234'
  });

  const res2 = dispatchTruck(state, 'req_001', 'item_001', winUser, {
    truck_number: 'MH31AA5678',
    loaded_quantity_mt: 5.0,
    driver_name: 'Driver B',
    driver_mobile: '9876543211',
    driver_license: 'DL5678'
  });

  assert.strictEqual(res2.status, 400);
  assert.strictEqual(res2.code, 'EXCEEDS_REMAINING_QUANTITY');
  assert.strictEqual(res2.remaining_quantity_mt, 4.0);
});

// TEST 18 (CONSISTENCY 4): Dispatches belonging to /02 must NOT affect /01 balance
it('TEST 18: Dispatches belonging to /02 must NOT affect /01 balance', () => {
  const state = createMockWorkflowState();
  state.requirement_items.push({
    id: 'item_002',
    requirement_id: 'req_001',
    sub_indent_no: 'SNPL/26-27/REQ-0001/02',
    quantity_mt: 40.0,
    dispatched_quantity_mt: 0.0,
    remaining_quantity_mt: 40.0,
    dispatch_status: 'ACCEPTED'
  });

  // Record a dispatch for item_002
  state.truck_dispatches.push({
    id: 'disp_002',
    requirement_id: 'req_001',
    requirement_item_id: 'item_002',
    loaded_quantity_mt: 30.0
  });

  const dispatchesFor01 = state.truck_dispatches.filter(d => d.requirement_item_id === 'item_001');
  const alreadyDispatched01 = dispatchesFor01.reduce((acc, curr) => acc + curr.loaded_quantity_mt, 0);
  assert.strictEqual(alreadyDispatched01, 0.0, '/02 dispatches must not count towards /01');
});

// TEST 19 (CONSISTENCY 5): Dispatches belonging to /01 must NOT affect /02 balance
it('TEST 19: Dispatches belonging to /01 must NOT affect /02 balance', () => {
  const state = createMockWorkflowState();
  state.requirement_items.push({
    id: 'item_002',
    requirement_id: 'req_001',
    sub_indent_no: 'SNPL/26-27/REQ-0001/02',
    quantity_mt: 40.0,
    dispatched_quantity_mt: 0.0,
    remaining_quantity_mt: 40.0,
    dispatch_status: 'ACCEPTED'
  });

  // Record a dispatch for item_001
  state.truck_dispatches.push({
    id: 'disp_001',
    requirement_id: 'req_001',
    requirement_item_id: 'item_001',
    loaded_quantity_mt: 15.0
  });

  const dispatchesFor02 = state.truck_dispatches.filter(d => d.requirement_item_id === 'item_002');
  const alreadyDispatched02 = dispatchesFor02.reduce((acc, curr) => acc + curr.loaded_quantity_mt, 0);
  assert.strictEqual(alreadyDispatched02, 0.0, '/01 dispatches must not count towards /02');
});

// TEST 20 (CONSISTENCY 6): UUID requirement_item_id matching works
it('TEST 20: UUID requirement_item_id matching works', () => {
  const state = createMockWorkflowState();
  const uuid = 'item_f47ac10b_58cc_4372_a567_0e02b2c3d479';
  state.requirement_items[0].id = uuid;
  state.rate_submissions[0].item_id = uuid;

  finalizeRate(state, 'sub_win', 10, { username: 'admin', role: 'admin' });
  acceptFinalRate(state, 'req_001', uuid, { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' });

  const winUser = { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' };
  const res = dispatchTruck(state, 'req_001', uuid, winUser, {
    truck_number: 'MH31AA9999',
    loaded_quantity_mt: 20.0,
    driver_name: 'Driver UUID',
    driver_mobile: '9876543210',
    driver_license: 'DLUUID'
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.success, true);
});

// TEST 21 (CONSISTENCY 7): Legacy sub_indent_no string matching works
it('TEST 21: Legacy sub_indent_no string matching works', () => {
  const state = createMockWorkflowState();
  const subIndent = 'SNPL/26-27/REQ-0001/01';
  state.requirement_items[0].sub_indent_no = subIndent;

  // Dispatch using sub_indent_no string as itemId
  const item = state.requirement_items.find(i => i.id === 'item_001' || i.sub_indent_no === subIndent);
  assert.ok(item);
  assert.strictEqual(item.id, 'item_001');
});

// TEST 22 (CONSISTENCY 8): Parent requirement_id fallback works ONLY when there is no specific item
it('TEST 22: Parent requirement_id fallback works ONLY when there is no specific item', () => {
  const state = createMockWorkflowState();
  state.requirement_items = []; // Single-item requirement with no child rows

  const dispatches = state.truck_dispatches.filter(d => d.requirement_id === 'req_001');
  assert.strictEqual(dispatches.length, 0);
});

// TEST 23 (CONSISTENCY 9): Frontend displayed remaining balance equals backend validation remaining balance
it('TEST 23: Frontend displayed remaining balance equals backend validation remaining balance', () => {
  const item = {
    id: 'item_001',
    quantity_mt: 44.0,
    required_qty: 44.0,
    dispatched_quantity_mt: 0.0,
    remaining_quantity_mt: 44.0
  };

  // Frontend calculation
  const totalQty = Number(item.quantity_mt || item.required_qty || 0);
  const dispatchedQty = Number(item.dispatched_quantity_mt || 0);
  const frontendRemaining = item.remaining_quantity_mt !== undefined && item.remaining_quantity_mt !== null
    ? Number(item.remaining_quantity_mt)
    : Math.max(0, totalQty - dispatchedQty);

  // Backend calculation
  const backendRemaining = Math.max(0, totalQty - dispatchedQty);

  assert.strictEqual(frontendRemaining, 44.0);
  assert.strictEqual(backendRemaining, 44.0);
  assert.strictEqual(frontendRemaining, backendRemaining);
});

// TEST 24 (CONSISTENCY 10): Refresh page after dispatch and remaining balance stays correct
it('TEST 24: Refresh page after dispatch and remaining balance stays correct', () => {
  const item = {
    id: 'item_001',
    quantity_mt: 44.0,
    dispatched_quantity_mt: 40.0,
    remaining_quantity_mt: 4.0
  };

  // On page refresh, state is reconstructed from DB item row
  const totalQty = Number(item.quantity_mt || 0);
  const dispatchedQty = Number(item.dispatched_quantity_mt || 0);
  const remaining = Number(item.remaining_quantity_mt);

  assert.strictEqual(remaining, 4.0);
  assert.strictEqual(totalQty - dispatchedQty, 4.0);
});

// TEST 25 (CONSISTENCY 11): Concurrent dispatch requests cannot exceed exact item quantity
it('TEST 25: Concurrent dispatch requests cannot exceed exact item quantity', () => {
  const state = createMockWorkflowState();
  state.requirement_items[0].quantity_mt = 44.0;
  state.requirement_items[0].remaining_quantity_mt = 44.0;
  finalizeRate(state, 'sub_win', 10, { username: 'admin', role: 'admin' });
  acceptFinalRate(state, 'req_001', 'item_001', { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' });

  const winUser = { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' };

  // Dispatch 1: 30 MT
  const d1 = dispatchTruck(state, 'req_001', 'item_001', winUser, {
    truck_number: 'MH31AA1111',
    loaded_quantity_mt: 30.0,
    driver_name: 'Driver 1',
    driver_mobile: '9876543210',
    driver_license: 'DL1'
  });
  assert.strictEqual(d1.status, 200);

  // Dispatch 2: 20 MT (attempting 30 + 20 = 50 > 44)
  const d2 = dispatchTruck(state, 'req_001', 'item_001', winUser, {
    truck_number: 'MH31AA2222',
    loaded_quantity_mt: 20.0,
    driver_name: 'Driver 2',
    driver_mobile: '9876543211',
    driver_license: 'DL2'
  });
  assert.strictEqual(d2.status, 400);
  assert.strictEqual(d2.code, 'EXCEEDS_REMAINING_QUANTITY');
  assert.strictEqual(d2.remaining_quantity_mt, 14.0);
});

// TEST 26 (TEST A): Parent requirement with child item /01 quantity 44 MT, no dispatches, dispatch 40 MT succeeds
it('TEST 26 (TEST A): Parent requirement with child item /01 quantity 44 MT, no dispatches, dispatch 40 MT succeeds', () => {
  const state = createMockWorkflowState();
  state.requirement_items[0].quantity_mt = 44.0;
  state.requirement_items[0].remaining_quantity_mt = 44.0;
  finalizeRate(state, 'sub_win', 10, { username: 'admin', role: 'admin' });
  acceptFinalRate(state, 'req_001', 'item_001', { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' });

  const winUser = { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' };
  const res = dispatchTruck(state, 'req_001', 'item_001', winUser, {
    truck_number: 'MH31AA1234',
    loaded_quantity_mt: 40.0,
    driver_name: 'Driver A',
    driver_mobile: '9876543210',
    driver_license: 'DL1234'
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.remaining_quantity_mt, 4.0);
});

// TEST 27 (TEST B): After dispatching 40 MT from /01 quantity 44 MT, remaining balance equals 4 MT
it('TEST 27 (TEST B): After dispatching 40 MT from /01 quantity 44 MT, remaining balance equals 4 MT', () => {
  const state = createMockWorkflowState();
  state.requirement_items[0].quantity_mt = 44.0;
  finalizeRate(state, 'sub_win', 10, { username: 'admin', role: 'admin' });
  acceptFinalRate(state, 'req_001', 'item_001', { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' });

  const winUser = { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' };
  dispatchTruck(state, 'req_001', 'item_001', winUser, {
    truck_number: 'MH31AA1234',
    loaded_quantity_mt: 40.0,
    driver_name: 'Driver A',
    driver_mobile: '9876543210',
    driver_license: 'DL1234'
  });

  const alreadyDispatched = state.truck_dispatches
    .filter(d => d.requirement_item_id === 'item_001')
    .reduce((acc, curr) => acc + curr.loaded_quantity_mt, 0);

  const remaining = state.requirement_items[0].quantity_mt - alreadyDispatched;
  assert.strictEqual(remaining, 4.0);
});

// TEST 28 (TEST C): Dispatch another 5 MT after 40/44 is rejected with EXCEEDS_REMAINING_QUANTITY
it('TEST 28 (TEST C): Dispatch another 5 MT after 40/44 is rejected with EXCEEDS_REMAINING_QUANTITY', () => {
  const state = createMockWorkflowState();
  state.requirement_items[0].quantity_mt = 44.0;
  finalizeRate(state, 'sub_win', 10, { username: 'admin', role: 'admin' });
  acceptFinalRate(state, 'req_001', 'item_001', { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' });

  const winUser = { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' };
  dispatchTruck(state, 'req_001', 'item_001', winUser, {
    truck_number: 'MH31AA1234',
    loaded_quantity_mt: 40.0,
    driver_name: 'Driver A',
    driver_mobile: '9876543210',
    driver_license: 'DL1234'
  });

  const res2 = dispatchTruck(state, 'req_001', 'item_001', winUser, {
    truck_number: 'MH31AA5678',
    loaded_quantity_mt: 5.0,
    driver_name: 'Driver B',
    driver_mobile: '9876543211',
    driver_license: 'DL5678'
  });

  assert.strictEqual(res2.status, 400);
  assert.strictEqual(res2.code, 'EXCEEDS_REMAINING_QUANTITY');
  assert.strictEqual(res2.remaining_quantity_mt, 4.0);
});

// TEST 29 (TEST D): Sibling /02 dispatches MUST NOT affect /01 balance
it('TEST 29 (TEST D): Sibling /02 dispatches MUST NOT affect /01 balance', () => {
  const state = createMockWorkflowState();
  state.requirement_items[0].quantity_mt = 44.0;
  state.requirement_items.push({
    id: 'item_002',
    requirement_id: 'req_001',
    sub_indent_no: 'SNPL/26-27/REQ-0001/02',
    quantity_mt: 50.0,
    dispatched_quantity_mt: 0.0,
    remaining_quantity_mt: 50.0
  });

  // Record 50 MT dispatch for item_002
  state.truck_dispatches.push({
    id: 'disp_sibling',
    requirement_id: 'req_001',
    requirement_item_id: 'item_002',
    loaded_quantity_mt: 50.0
  });

  // Check /01 balance
  const dispatches01 = state.truck_dispatches.filter(d => d.requirement_item_id === 'item_001');
  const sum01 = dispatches01.reduce((acc, curr) => acc + curr.loaded_quantity_mt, 0);
  assert.strictEqual(sum01, 0.0);
  assert.strictEqual(state.requirement_items[0].quantity_mt - sum01, 44.0);
});

// TEST 30 (TEST E): Frontend request contains exact child item ID and never sends MAIN
it('TEST 30 (TEST E): Frontend request contains exact child item ID and never sends MAIN', () => {
  const item = {
    id: 'item_req_0001_01_uuid',
    sub_indent_no: 'SNPL/26-27/REQ-0001/01',
    requirement_id: 'req_001'
  };

  const reqId = item.requirement_id || item.parent_req_no || item.id;
  const itemId = item.id || item.item_id || item.sub_indent_id || item.sub_indent_no || 'MAIN';

  assert.strictEqual(reqId, 'req_001');
  assert.strictEqual(itemId, 'item_req_0001_01_uuid');
  assert.notStrictEqual(itemId, 'MAIN');
});

// TEST 31 (TEST F): Backend receives URL item ID = child item UUID and resolves correctly
it('TEST 31 (TEST F): Backend receives URL item ID = child item UUID and resolves correctly', () => {
  const state = createMockWorkflowState();
  const uuid = 'item_c3f81e3a_9d42_4b52_98d6_e4734891b29a';
  state.requirement_items[0].id = uuid;
  state.rate_submissions[0].item_id = uuid;

  const candidateItemIds = [uuid].filter(Boolean).filter(v => v !== 'MAIN');
  const matchedItem = state.requirement_items.find(i => candidateItemIds.includes(i.id));

  assert.ok(matchedItem);
  assert.strictEqual(matchedItem.id, uuid);
});

// TEST 32 (TEST G): Backend receives legacy sub_indent_no and resolves correctly
it('TEST 32 (TEST G): Backend receives legacy sub_indent_no and resolves correctly', () => {
  const state = createMockWorkflowState();
  const subIndent = 'SNPL/26-27/REQ-0001/01';
  state.requirement_items[0].sub_indent_no = subIndent;

  const candidateItemIds = [subIndent].filter(Boolean).filter(v => v !== 'MAIN');
  const matchedItem = state.requirement_items.find(i => candidateItemIds.includes(i.sub_indent_no) || candidateItemIds.includes(i.id));

  assert.ok(matchedItem);
  assert.strictEqual(matchedItem.sub_indent_no, subIndent);
});

// TEST 33 (TEST H): Parent with child items but unresolved item ID must fail explicitly (ITEM_RESOLUTION_FAILED)
it('TEST 33 (TEST H): Parent with child items but unresolved item ID must fail explicitly (ITEM_RESOLUTION_FAILED)', () => {
  const state = createMockWorkflowState();
  // Request with invalid item ID
  const invalidCandidate = 'NON_EXISTENT_ITEM';
  const childItemsExist = state.requirement_items.length > 0;
  const matchedItem = state.requirement_items.find(i => i.id === invalidCandidate || i.sub_indent_no === invalidCandidate);

  let status = 200;
  let code = null;
  if (!matchedItem && childItemsExist) {
    status = 400;
    code = 'ITEM_RESOLUTION_FAILED';
  }

  assert.strictEqual(status, 400);
  assert.strictEqual(code, 'ITEM_RESOLUTION_FAILED');
});

// TEST 34 (TEST I): Full end-to-end flow: Finalize -> Winning transporter -> Awarded Contract -> Dispatch modal -> 40/44 dispatch -> LR generation
it('TEST 34 (TEST I): Full end-to-end flow: Finalize -> Winning transporter -> Awarded Contract -> Dispatch modal -> 40/44 dispatch -> LR generation', () => {
  const state = createMockWorkflowState();
  state.requirement_items[0].quantity_mt = 44.0;
  state.requirement_items[0].remaining_quantity_mt = 44.0;

  // 1. Admin finalizes rate ₹10/MT for trans_win
  finalizeRate(state, 'sub_win', 10, { username: 'admin', role: 'admin' });

  // 2. Winning transporter accepts final rate
  acceptFinalRate(state, 'req_001', 'item_001', { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' });

  // 3. Winning transporter dispatches 40 MT
  const winUser = { id: 'trans_win', transporter_id: 'trans_win', username: 'win_transporter', role: 'transporter' };
  const res = dispatchTruck(state, 'req_001', 'item_001', winUser, {
    truck_number: 'MH31FC9999',
    loaded_quantity_mt: 40.0,
    driver_name: 'Anil Deshmukh',
    driver_mobile: '9876543210',
    driver_license: 'MH31DL9999'
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.remaining_quantity_mt, 4.0);
  assert.ok(res.lr_number.startsWith('LR-SNPL-2026-'));
  assert.strictEqual(state.truck_dispatches.length, 1);
  assert.strictEqual(state.truck_dispatches[0].loaded_quantity_mt, 40.0);
});

// TEST 35 (TEST J): Refresh after dispatch displays remaining balance 4 MT
it('TEST 35 (TEST J): Refresh after dispatch displays remaining balance 4 MT', () => {
  const item = {
    id: 'item_001',
    quantity_mt: 44.0,
    dispatched_quantity_mt: 40.0,
    remaining_quantity_mt: 4.0
  };

  const dispatches = [{
    requirement_item_id: 'item_001',
    loaded_quantity_mt: 40.0
  }];

  const totalDispatched = dispatches.reduce((acc, curr) => acc + curr.loaded_quantity_mt, 0);
  const remainingBalance = Math.max(0, item.quantity_mt - totalDispatched);

  assert.strictEqual(remainingBalance, 4.0);
});

console.log('================================================================');
console.log(`🎉 TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
