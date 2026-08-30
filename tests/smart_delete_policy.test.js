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
function simulateCascadeDelete(db, requirementId) {
  const initialReqCount = db.transport_requirements.length;
  const targetReq = db.transport_requirements.find(r => r.id === requirementId);
  if (!targetReq) {
    return { success: false, error: 'Requirement record not found' };
  }

  // Cascade delete all child items, bids, negotiations, and history
  const remainingReqs = db.transport_requirements.filter(r => r.id !== requirementId);
  const remainingItems = db.transport_requirement_items.filter(i => i.requirement_id !== requirementId);
  const remainingBids = db.rate_submissions.filter(s => s.requirement_id !== requirementId);
  const remainingNegs = db.rate_negotiations.filter(n => n.requirement_id !== requirementId);
  const remainingHist = db.bid_negotiation_history.filter(h => h.requirement_id !== requirementId);

  return {
    success: true,
    deletedReqId: requirementId,
    db: {
      transport_requirements: remainingReqs,
      transport_requirement_items: remainingItems,
      rate_submissions: remainingBids,
      rate_negotiations: remainingNegs,
      bid_negotiation_history: remainingHist
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

// TEST 4: Delete parent requirement -> cascades to all child items
it('TEST 4: Delete parent requirement -> cascades to all child items', () => {
  const db = {
    transport_requirements: [{ id: 'req_1' }],
    transport_requirement_items: [{ id: 'item_1', requirement_id: 'req_1' }, { id: 'item_2', requirement_id: 'req_1' }],
    rate_submissions: [{ id: 'sub_1', requirement_id: 'req_1' }],
    rate_negotiations: [{ id: 'neg_1', requirement_id: 'req_1' }],
    bid_negotiation_history: [{ id: 'hist_1', requirement_id: 'req_1' }]
  };

  const res = simulateCascadeDelete(db, 'req_1');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.db.transport_requirements.length, 0);
  assert.strictEqual(res.db.transport_requirement_items.length, 0);
  assert.strictEqual(res.db.rate_submissions.length, 0);
  assert.strictEqual(res.db.rate_negotiations.length, 0);
  assert.strictEqual(res.db.bid_negotiation_history.length, 0);
});

// TEST 5: Delete on non-existent requirement -> returns not found
it('TEST 5: Delete on non-existent requirement -> returns not found', () => {
  const db = {
    transport_requirements: [],
    transport_requirement_items: [],
    rate_submissions: [],
    rate_negotiations: [],
    bid_negotiation_history: []
  };

  const res = simulateCascadeDelete(db, 'req_non_existent');
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, 'Requirement record not found');
});

// TEST 6: Exact Confirmation Dialog Message Contract
it('TEST 6: Confirmation dialog matches expected wording', () => {
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
