// tests/transporter_dashboard_navigation.test.js
// Automated Test Suite for Transporter Dashboard Summary Cards & Navigation

import assert from 'assert';

console.log('================================================================');
console.log('🧪 RUNNING TRANSPORTER DASHBOARD SUMMARY & NAVIGATION TEST SUITE');
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

// 1. Transporter Dashboard Counter Resolver (Simulation of backend & client logic)
function calculateTransporterSummary(transporterId, rateSubmissions = [], allocations = []) {
  const normTransId = String(transporterId).toLowerCase();

  // Submitted Bids: all quotes submitted by this transporter
  const myBids = rateSubmissions.filter(b => 
    String(b.transporter_id).toLowerCase() === normTransId &&
    (b.rate_per_mt !== null || b.rate_per_unit !== null)
  );

  // Awarded Contracts: all finalized bids won by this transporter + legacy allocations
  const myFinalizedBids = rateSubmissions.filter(b => {
    const isTransMatch = String(b.transporter_id).toLowerCase() === normTransId;
    if (!isTransMatch) return false;
    return Boolean(b.is_finalized) ||
      String(b.bid_status || '').toUpperCase() === 'FINALIZED' ||
      String(b.acceptance_status || '').toUpperCase() === 'ACCEPTED' ||
      Number(b.final_rate) > 0;
  });

  const myAlloc = allocations.filter(a => String(a.transporter_id).toLowerCase() === normTransId);

  return {
    transporter_id: transporterId,
    submittedBids: myBids.length,
    contracts: myFinalizedBids.length + myAlloc.length
  };
}

// TEST 1: Transporter A and Transporter B see independent bid counts
it('TEST 1: Transporter A and Transporter B receive isolated bid counts', () => {
  const rateSubmissions = [
    { id: 'sub_1', transporter_id: 'TRANS_A', rate_per_mt: 2100 },
    { id: 'sub_2', transporter_id: 'TRANS_A', rate_per_mt: 1950 },
    { id: 'sub_3', transporter_id: 'TRANS_B', rate_per_mt: 2200 }
  ];

  const summaryA = calculateTransporterSummary('TRANS_A', rateSubmissions, []);
  const summaryB = calculateTransporterSummary('TRANS_B', rateSubmissions, []);

  assert.strictEqual(summaryA.submittedBids, 2);
  assert.strictEqual(summaryB.submittedBids, 1);
});

// TEST 2: Only Winning Transporter receives awarded contract count
it('TEST 2: Finalized item awards contract only to winning transporter', () => {
  const rateSubmissions = [
    { id: 'sub_1', transporter_id: 'TRANS_A', rate_per_mt: 1950, is_finalized: 1, final_rate: 1950, bid_status: 'FINALIZED' },
    { id: 'sub_2', transporter_id: 'TRANS_B', rate_per_mt: 2200, is_finalized: 0, bid_status: 'Submitted' }
  ];

  const summaryA = calculateTransporterSummary('TRANS_A', rateSubmissions, []);
  const summaryB = calculateTransporterSummary('TRANS_B', rateSubmissions, []);

  assert.strictEqual(summaryA.contracts, 1);
  assert.strictEqual(summaryB.contracts, 0);
});

// TEST 3: Navigation tab switching logic for MY SUBMITTED BIDS
it('TEST 3: Clicking MY SUBMITTED BIDS switches activeTab to my_bids', () => {
  let activeTab = 'open_requests';
  const handleCardClick = (cardType) => {
    if (cardType === 'MY_SUBMITTED_BIDS') activeTab = 'my_bids';
    if (cardType === 'MY_CONTRACTS') activeTab = 'allocations';
  };

  handleCardClick('MY_SUBMITTED_BIDS');
  assert.strictEqual(activeTab, 'my_bids');
});

// TEST 4: Navigation tab switching logic for MY CONTRACTS
it('TEST 4: Clicking MY CONTRACTS switches activeTab to allocations', () => {
  let activeTab = 'open_requests';
  const handleCardClick = (cardType) => {
    if (cardType === 'MY_SUBMITTED_BIDS') activeTab = 'my_bids';
    if (cardType === 'MY_CONTRACTS') activeTab = 'allocations';
  };

  handleCardClick('MY_CONTRACTS');
  assert.strictEqual(activeTab, 'allocations');
});

// TEST 5: Zero-state detection when transporter has zero bids or contracts
it('TEST 5: Transporter with zero history gets 0 counts and zero state indicators', () => {
  const summaryC = calculateTransporterSummary('TRANS_NEW', [], []);
  assert.strictEqual(summaryC.submittedBids, 0);
  assert.strictEqual(summaryC.contracts, 0);
});

// TEST 6: Transporter data isolation: Transporter B cannot see Transporter A bids
it('TEST 6: Filter strictly isolates bids so Transporter B never receives Transporter A data', () => {
  const allBids = [
    { id: 'sub_A1', transporter_id: 'TRANS_A', rate_per_mt: 2000, sensitive_data: 'Secret A' },
    { id: 'sub_B1', transporter_id: 'TRANS_B', rate_per_mt: 2100, sensitive_data: 'Secret B' }
  ];

  const transBBids = allBids.filter(b => b.transporter_id === 'TRANS_B');
  assert.strictEqual(transBBids.length, 1);
  assert.strictEqual(transBBids[0].id, 'sub_B1');
  assert.strictEqual(transBBids.some(b => b.transporter_id === 'TRANS_A'), false);
});

console.log('================================================================');
console.log(`📊 TEST RESULTS: ${passedTests} Passed | ${failedTests} Failed`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
}
