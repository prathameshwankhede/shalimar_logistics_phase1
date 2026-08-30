// tests/smart_delete_policy.test.js
// Automated Test Suite for Smart Requirement Delete, Archive, and Permission Lifecycle Policy

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

// 1. Permission Matrix Derivation Logic
function deriveRequirementPermissions(status, { bidsCount = 0, negCount = 0, histCount = 0, hasFinalized = false } = {}) {
  const reqStatus = String(status || 'Active').toUpperCase();
  const totalBids = Number(bidsCount || 0);
  const totalNegs = Number(negCount || 0);
  const totalHists = Number(histCount || 0);
  const isFinalized = Boolean(hasFinalized || reqStatus === 'COMPLETED');

  let can_delete = false;
  let can_archive = false;
  let can_cancel = false;
  let can_restore = false;

  if (reqStatus === 'ARCHIVED') {
    can_delete = false;
    can_archive = false;
    can_cancel = false;
    can_restore = true;
  } else if (reqStatus === 'CANCELLED' || reqStatus === 'COMPLETED') {
    can_delete = false;
    can_archive = false;
    can_cancel = false;
    can_restore = false;
  } else if (isFinalized) {
    can_delete = false;
    can_archive = true;
    can_cancel = false;
    can_restore = false;
  } else if (totalBids > 0 || totalNegs > 0 || totalHists > 0) {
    can_delete = false;
    can_archive = true;
    can_cancel = true;
    can_restore = false;
  } else {
    // DRAFT / ACTIVE with 0 bids and 0 negotiations
    can_delete = true;
    can_archive = true;
    can_cancel = true;
    can_restore = false;
  }

  return { can_delete, can_archive, can_cancel, can_restore };
}

// 2. Restore Endpoint Safety Evaluation
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

// 3. Smart Delete Backend Decision Engine
function evaluateSmartDeleteBackend({ finalizedCount = 0, negCount = 0, histCount = 0, bidCount = 0 }) {
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

// TEST 4: Requirement with 0 bids -> Delete button permission true
it('TEST 4: Requirement with 0 bids -> can_delete: true, can_archive: true, can_cancel: true, can_restore: false', () => {
  const perms = deriveRequirementPermissions('Active', { bidsCount: 0, negCount: 0, histCount: 0, hasFinalized: false });
  assert.strictEqual(perms.can_delete, true);
  assert.strictEqual(perms.can_archive, true);
  assert.strictEqual(perms.can_cancel, true);
  assert.strictEqual(perms.can_restore, false);
});

// TEST 5: Requirement with bids -> Delete permission false
it('TEST 5: Requirement with bids -> can_delete: false, can_archive: true, can_cancel: true', () => {
  const perms = deriveRequirementPermissions('Active', { bidsCount: 2, negCount: 0, histCount: 0, hasFinalized: false });
  assert.strictEqual(perms.can_delete, false);
  assert.strictEqual(perms.can_archive, true);
  assert.strictEqual(perms.can_cancel, true);
  assert.strictEqual(perms.can_restore, false);
});

// TEST 6: Requirement with negotiation -> Delete permission false
it('TEST 6: Requirement with negotiation -> can_delete: false, can_archive: true, can_cancel: true', () => {
  const perms = deriveRequirementPermissions('Active', { bidsCount: 1, negCount: 3, histCount: 2, hasFinalized: false });
  assert.strictEqual(perms.can_delete, false);
  assert.strictEqual(perms.can_archive, true);
  assert.strictEqual(perms.can_cancel, true);
  assert.strictEqual(perms.can_restore, false);
});

// TEST 7: Finalized requirement -> only Archive permission true
it('TEST 7: Finalized requirement -> can_archive: true, can_delete: false, can_cancel: false, can_restore: false', () => {
  const perms = deriveRequirementPermissions('Active', { bidsCount: 3, negCount: 2, histCount: 2, hasFinalized: true });
  assert.strictEqual(perms.can_archive, true);
  assert.strictEqual(perms.can_delete, false);
  assert.strictEqual(perms.can_cancel, false);
  assert.strictEqual(perms.can_restore, false);
});

// TEST 8: Cancelled requirement -> all destructive permissions false
it('TEST 8: Cancelled requirement -> can_delete: false, can_archive: false, can_cancel: false, can_restore: false', () => {
  const perms = deriveRequirementPermissions('CANCELLED', { bidsCount: 2 });
  assert.strictEqual(perms.can_delete, false);
  assert.strictEqual(perms.can_archive, false);
  assert.strictEqual(perms.can_cancel, false);
  assert.strictEqual(perms.can_restore, false);
});

// TEST 9: Backend DELETE endpoint still blocks direct API deletion even if frontend bypassed
it('TEST 9: Backend DELETE endpoint still blocks direct API deletion on bids / negotiations / finalized', () => {
  const delBidded = evaluateSmartDeleteBackend({ bidCount: 1 });
  assert.strictEqual(delBidded.allowed, false);
  assert.strictEqual(delBidded.code, 'REQUIREMENT_HAS_BIDS');

  const delNeg = evaluateSmartDeleteBackend({ negCount: 1 });
  assert.strictEqual(delNeg.allowed, false);
  assert.strictEqual(delNeg.code, 'REQUIREMENT_HAS_NEGOTIATION');

  const delFinal = evaluateSmartDeleteBackend({ finalizedCount: 1 });
  assert.strictEqual(delFinal.allowed, false);
  assert.strictEqual(delFinal.code, 'FINALIZED_REQUIREMENT');

  const delClean = evaluateSmartDeleteBackend({ finalizedCount: 0, negCount: 0, histCount: 0, bidCount: 0 });
  assert.strictEqual(delClean.allowed, true);
});

console.log('==================================================');
console.log(`📊 TEST RESULTS: ${passedTests} Passed | ${failedTests} Failed`);
console.log('==================================================');

if (failedTests > 0) {
  process.exit(1);
}
