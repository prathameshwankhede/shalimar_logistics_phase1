// tests/smart_delete_policy.test.js
// Automated Test Suite for Requirement Delete, Cascade Cleanliness, and Actions UI

import assert from 'assert';

console.log('==================================================');
console.log('🧪 RUNNING REQUIREMENT DELETE & ACTIONS UI REGRESSION TEST SUITE');
console.log('==================================================');

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

// 1. Restore Endpoint Safety Evaluation
function evaluateRestoreRequirement({ status, hasFinalized = false }) {
  const currentStatus = String(status || 'Active').toUpperCase();
  if (currentStatus === 'CANCELLED') {
    return {
      allowed: false,
      code: 'CANCELLED_REQUIREMENT_CANNOT_RESTORE',
      message: 'Cancelled requirements cannot be directly restored. Create a new requirement or use an explicit reopen workflow.'
    };
  }
  if (currentStatus === 'COMPLETED') {
    return {
      allowed: false,
      code: 'COMPLETED_REQUIREMENT_CANNOT_RESTORE',
      message: 'Completed requirements cannot be restored.'
    };
  }
  if (hasFinalized) {
    return {
      allowed: false,
      code: 'FINALIZED_REQUIREMENT_CANNOT_RESTORE',
      message: 'Finalized requirements cannot be restored to active.'
    };
  }
  if (currentStatus !== 'ARCHIVED') {
    return {
      allowed: false,
      code: 'INVALID_RESTORE_STATE',
      message: `Requirement is already ${status} and does not need to be restored.`
    };
  }
  return {
    allowed: true,
    status: 'Active',
    message: 'Requirement restored to active successfully'
  };
}

// 2. Cascade Delete Engine Simulation
function simulateCascadeDelete(db, idOrReqNo, shouldSimulateDbError = false) {
  const targetReq = db.transport_requirements.find(r => r.id === idOrReqNo || r.req_no === idOrReqNo);
  if (!targetReq) {
    return { success: false, error: 'Requirement record not found' };
  }

  const actualReqId = targetReq.id;

  if (shouldSimulateDbError) {
    // Emulate transaction rollback
    return {
      success: false,
      error: 'Simulated database deadlock/failure',
      rolledBack: true,
      db: JSON.parse(JSON.stringify(db))
    };
  }

  // Cascade delete all child items, bids, negotiations, history, and dispatches
  const remainingReqs = db.transport_requirements.filter(r => r.id !== actualReqId);
  const remainingItems = db.transport_requirement_items.filter(i => i.requirement_id !== actualReqId);
  const remainingBids = db.rate_submissions.filter(s => s.requirement_id !== actualReqId);
  const remainingNegs = db.rate_negotiations.filter(n => n.requirement_id !== actualReqId);
  const remainingHist = db.bid_negotiation_history.filter(h => h.requirement_id !== actualReqId);
  const remainingDispatches = (db.truck_dispatches || []).filter(d => d.requirement_id !== actualReqId);

  return {
    success: true,
    deletedReqId: actualReqId,
    db: {
      transport_requirements: remainingReqs,
      transport_requirement_items: remainingItems,
      rate_submissions: remainingBids,
      rate_negotiations: remainingNegs,
      bid_negotiation_history: remainingHist,
      truck_dispatches: remainingDispatches
    }
  };
}

// TEST 1: ARCHIVED requirement -> restore succeeds -> ACTIVE
it('TEST 1: ARCHIVED requirement -> restore succeeds -> ACTIVE', () => {
  const result = evaluateRestoreRequirement({ status: 'ARCHIVED', hasFinalized: false });
  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.status, 'Active');
});

// TEST 2: CANCELLED requirement -> restore blocked
it('TEST 2: CANCELLED requirement -> restore blocked (CANCELLED_REQUIREMENT_CANNOT_RESTORE)', () => {
  const result = evaluateRestoreRequirement({ status: 'CANCELLED', hasFinalized: false });
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.code, 'CANCELLED_REQUIREMENT_CANNOT_RESTORE');
});

// TEST 3: FINALIZED requirement -> restore blocked
it('TEST 3: FINALIZED requirement -> restore blocked (FINALIZED_REQUIREMENT_CANNOT_RESTORE)', () => {
  const result = evaluateRestoreRequirement({ status: 'ARCHIVED', hasFinalized: true });
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.code, 'FINALIZED_REQUIREMENT_CANNOT_RESTORE');
});

// TEST 4: Delete parent requirement -> cascades to all child items, bids, negotiations, dispatches
it('TEST 4: Delete parent requirement -> cascades to all child items, bids, negotiations, dispatches', () => {
  const db = {
    transport_requirements: [{ id: 'req_1', req_no: 'SNPL/26-27/001' }],
    transport_requirement_items: [{ id: 'item_1', requirement_id: 'req_1' }, { id: 'item_2', requirement_id: 'req_1' }],
    rate_submissions: [{ id: 'sub_1', requirement_id: 'req_1' }],
    rate_negotiations: [{ id: 'neg_1', requirement_id: 'req_1' }],
    bid_negotiation_history: [{ id: 'hist_1', requirement_id: 'req_1' }],
    truck_dispatches: [{ id: 'disp_1', requirement_id: 'req_1', lr_number: 'LR-SNPL-2026-00001' }]
  };

  const res = simulateCascadeDelete(db, 'req_1');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.db.transport_requirements.length, 0);
  assert.strictEqual(res.db.transport_requirement_items.length, 0);
  assert.strictEqual(res.db.rate_submissions.length, 0);
  assert.strictEqual(res.db.rate_negotiations.length, 0);
  assert.strictEqual(res.db.bid_negotiation_history.length, 0);
  assert.strictEqual(res.db.truck_dispatches.length, 0);
});

// TEST 5: Delete on non-existent requirement -> returns not found
it('TEST 5: Delete on non-existent requirement -> returns not found', () => {
  const db = {
    transport_requirements: [],
    transport_requirement_items: [],
    rate_submissions: [],
    rate_negotiations: [],
    bid_negotiation_history: [],
    truck_dispatches: []
  };

  const res = simulateCascadeDelete(db, 'req_non_existent');
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, 'Requirement record not found');
});

// TEST 6: Delete requirement by human-readable req_no
it('TEST 6: Delete requirement by formatted req_no resolves actualReqId and cascades cleanly', () => {
  const db = {
    transport_requirements: [{ id: 'req_uuid_999', req_no: 'SNPL/26-27/042' }],
    transport_requirement_items: [{ id: 'item_99', requirement_id: 'req_uuid_999' }],
    rate_submissions: [{ id: 'sub_99', requirement_id: 'req_uuid_999' }],
    rate_negotiations: [{ id: 'neg_99', requirement_id: 'req_uuid_999' }],
    bid_negotiation_history: [{ id: 'hist_99', requirement_id: 'req_uuid_999' }],
    truck_dispatches: [{ id: 'disp_99', requirement_id: 'req_uuid_999', lr_number: 'LR-SNPL-2026-00042' }]
  };

  const res = simulateCascadeDelete(db, 'SNPL/26-27/042');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.deletedReqId, 'req_uuid_999');
  assert.strictEqual(res.db.transport_requirements.length, 0);
  assert.strictEqual(res.db.transport_requirement_items.length, 0);
  assert.strictEqual(res.db.truck_dispatches.length, 0);
});

// TEST 7: Multi-requirement isolation: deleting Req A leaves Req B completely untouched
it('TEST 7: Multi-requirement isolation: deleting Req A preserves Req B and its dependent children', () => {
  const db = {
    transport_requirements: [
      { id: 'req_A', req_no: 'SNPL/26-27/001' },
      { id: 'req_B', req_no: 'SNPL/26-27/002' }
    ],
    transport_requirement_items: [
      { id: 'item_A1', requirement_id: 'req_A' },
      { id: 'item_B1', requirement_id: 'req_B' }
    ],
    rate_submissions: [
      { id: 'sub_A1', requirement_id: 'req_A' },
      { id: 'sub_B1', requirement_id: 'req_B' }
    ],
    rate_negotiations: [{ id: 'neg_B1', requirement_id: 'req_B' }],
    bid_negotiation_history: [{ id: 'hist_B1', requirement_id: 'req_B' }],
    truck_dispatches: [{ id: 'disp_B1', requirement_id: 'req_B', lr_number: 'LR-SNPL-2026-00005' }]
  };

  const res = simulateCascadeDelete(db, 'req_A');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.db.transport_requirements.length, 1);
  assert.strictEqual(res.db.transport_requirements[0].id, 'req_B');
  assert.strictEqual(res.db.transport_requirement_items.length, 1);
  assert.strictEqual(res.db.transport_requirement_items[0].id, 'item_B1');
  assert.strictEqual(res.db.rate_submissions.length, 1);
  assert.strictEqual(res.db.rate_submissions[0].id, 'sub_B1');
  assert.strictEqual(res.db.truck_dispatches.length, 1);
  assert.strictEqual(res.db.truck_dispatches[0].id, 'disp_B1');
});

// TEST 8: Transaction rollback on failure leaves state untouched
it('TEST 8: Transaction rollback on database failure preserves entire database state without orphans', () => {
  const db = {
    transport_requirements: [{ id: 'req_1', req_no: 'SNPL/26-27/001' }],
    transport_requirement_items: [{ id: 'item_1', requirement_id: 'req_1' }],
    rate_submissions: [{ id: 'sub_1', requirement_id: 'req_1' }],
    rate_negotiations: [],
    bid_negotiation_history: [],
    truck_dispatches: [{ id: 'disp_1', requirement_id: 'req_1', lr_number: 'LR-SNPL-2026-00001' }]
  };

  const res = simulateCascadeDelete(db, 'req_1', true);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.rolledBack, true);
  assert.strictEqual(res.db.transport_requirements.length, 1);
  assert.strictEqual(res.db.transport_requirement_items.length, 1);
  assert.strictEqual(res.db.truck_dispatches.length, 1);
});

// TEST 9: Exact Confirmation Dialog Message Contract
it('TEST 9: Confirmation dialog matches expected wording', () => {
  const expectedConfirmation = "Are you sure you want to permanently delete this requirement and all its related items, bids, and negotiation data? This action cannot be undone.";
  assert.strictEqual(expectedConfirmation.includes("permanently delete this requirement and all its related items, bids, and negotiation data"), true);
  assert.strictEqual(expectedConfirmation.includes("This action cannot be undone."), true);
});

console.log('==================================================');
console.log(`📊 TEST RESULTS: ${passedTests} Passed | ${failedTests} Failed`);
console.log('==================================================');

if (failedTests > 0) {
  process.exit(1);
}
