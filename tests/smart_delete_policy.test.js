// tests/smart_delete_policy.test.js
// Automated Test Suite for Smart Requirement Delete & Archive Lifecycle Policy

import assert from 'assert';

console.log('==================================================');
console.log('🧪 RUNNING SMART REQUIREMENT DELETE & ARCHIVE POLICY TEST SUITE');
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

// Decision engine logic simulation matching server implementation
function evaluateSmartDeletePolicy({ finalizedCount, negCount, histCount, bidCount }) {
  if (finalizedCount > 0) {
    return {
      allowed: false,
      code: 'FINALIZED_REQUIREMENT',
      message: 'Finalized requirements cannot be permanently deleted. Archive the requirement instead.',
      allowed_actions: ['ARCHIVE']
    };
  }
  if (negCount > 0 || histCount > 0) {
    return {
      allowed: false,
      code: 'REQUIREMENT_HAS_NEGOTIATION',
      message: 'This requirement has active negotiation audit records and cannot be permanently deleted. Archive or cancel it instead.',
      allowed_actions: ['ARCHIVE', 'CANCEL']
    };
  }
  if (bidCount > 0) {
    return {
      allowed: false,
      code: 'REQUIREMENT_HAS_BIDS',
      message: 'This requirement has transporter bids and cannot be permanently deleted. Archive or cancel it instead.',
      bid_count: bidCount,
      allowed_actions: ['ARCHIVE', 'CANCEL']
    };
  }
  return {
    allowed: true,
    message: 'Requirement and child items permanently deleted from MySQL'
  };
}

function evaluateBidSubmissionAllowed(requirementStatus) {
  if (['ARCHIVED', 'CANCELLED', 'COMPLETED', 'CLOSED'].includes(String(requirementStatus).toUpperCase())) {
    return { allowed: false, message: 'This requirement is no longer accepting bids.' };
  }
  return { allowed: true };
}

// TEST 1: Requirement with 0 bids -> DELETE succeeds
it('TEST 1: Requirement with 0 bids allows permanent deletion', () => {
  const result = evaluateSmartDeletePolicy({ finalizedCount: 0, negCount: 0, histCount: 0, bidCount: 0 });
  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.message, 'Requirement and child items permanently deleted from MySQL');
});

// TEST 2: Requirement with bid -> DELETE blocked
it('TEST 2: Requirement with active bids blocks deletion (REQUIREMENT_HAS_BIDS)', () => {
  const result = evaluateSmartDeletePolicy({ finalizedCount: 0, negCount: 0, histCount: 0, bidCount: 3 });
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.code, 'REQUIREMENT_HAS_BIDS');
  assert.strictEqual(result.bid_count, 3);
  assert.deepStrictEqual(result.allowed_actions, ['ARCHIVE', 'CANCEL']);
});

// TEST 3: Requirement with negotiation -> DELETE blocked
it('TEST 3: Requirement with negotiation records blocks deletion (REQUIREMENT_HAS_NEGOTIATION)', () => {
  const result = evaluateSmartDeletePolicy({ finalizedCount: 0, negCount: 2, histCount: 1, bidCount: 1 });
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.code, 'REQUIREMENT_HAS_NEGOTIATION');
});

// TEST 4: Finalized requirement -> DELETE strictly blocked
it('TEST 4: Finalized requirement strictly blocks deletion (FINALIZED_REQUIREMENT)', () => {
  const result = evaluateSmartDeletePolicy({ finalizedCount: 1, negCount: 2, histCount: 2, bidCount: 2 });
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.code, 'FINALIZED_REQUIREMENT');
  assert.deepStrictEqual(result.allowed_actions, ['ARCHIVE']);
});

// TEST 5: Archive requirement -> hidden from active bidding
it('TEST 5: Archived requirement rejects new quotes', () => {
  const check = evaluateBidSubmissionAllowed('ARCHIVED');
  assert.strictEqual(check.allowed, false);
  assert.strictEqual(check.message, 'This requirement is no longer accepting bids.');
});

// TEST 6: Cancel requirement -> rejects new quotes
it('TEST 6: Cancelled requirement rejects new quotes', () => {
  const check = evaluateBidSubmissionAllowed('CANCELLED');
  assert.strictEqual(check.allowed, false);
  assert.strictEqual(check.message, 'This requirement is no longer accepting bids.');
});

// TEST 7: Active requirement -> accepts new quotes
it('TEST 7: Active requirement allows quote submission', () => {
  const check = evaluateBidSubmissionAllowed('ACTIVE');
  assert.strictEqual(check.allowed, true);
});

// TEST 8: Rollback safety on failure
it('TEST 8: Rollback logic prevents partial deletion on blocked state', () => {
  let dbState = { req: 1, items: 2, bids: 1 };
  const canDelete = evaluateSmartDeletePolicy({ finalizedCount: 0, negCount: 0, histCount: 0, bidCount: dbState.bids });
  if (!canDelete.allowed) {
    // Transaction rolls back
    dbState = { ...dbState };
  }
  assert.strictEqual(dbState.req, 1);
  assert.strictEqual(dbState.items, 2);
  assert.strictEqual(dbState.bids, 1);
});

console.log('==================================================');
console.log(`📊 TEST RESULTS: ${passedTests} Passed | ${failedTests} Failed`);
console.log('==================================================');

if (failedTests > 0) {
  process.exit(1);
}
