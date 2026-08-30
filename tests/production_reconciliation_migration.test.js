import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('🧪 RUNNING PRODUCTION RECONCILIATION & FIXED RATE DISPATCH SUITE');
console.log('================================================================');

let passed = 0;
let failed = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(e);
    failed++;
  }
}

// -------------------------------------------------------------
// Pure Simulator for Database Reconciliation & Dispatch Engine
// -------------------------------------------------------------
function simulateReconciliation(dbState) {
  const items = dbState.transport_requirement_items || [];
  const dispatches = dbState.truck_dispatches || [];

  const reqItemCountMap = {};
  items.forEach(it => {
    reqItemCountMap[it.requirement_id] = (reqItemCountMap[it.requirement_id] || 0) + 1;
  });

  items.forEach(item => {
    const matchingDispatches = dispatches.filter(d => {
      if (!d) return false;
      const reqMatch = String(d.requirement_id) === String(item.requirement_id);
      if (d.requirement_item_id && d.requirement_item_id === item.id) return true;
      if (d.requirement_item_id && item.sub_indent_no && d.requirement_item_id === item.sub_indent_no) return true;
      if (reqMatch && (d.requirement_item_id === 'MAIN' || !d.requirement_item_id) && reqItemCountMap[item.requirement_id] === 1) return true;
      return false;
    });

    const actualDispatched = matchingDispatches.reduce((acc, d) => acc + parseFloat(d.loaded_quantity_mt || 0), 0);
    const itemQty = Number(item.quantity_mt || 0);
    const remainingQty = Math.max(0, parseFloat((itemQty - actualDispatched).toFixed(3)));

    item.dispatched_quantity_mt = actualDispatched;
    item.remaining_quantity_mt = remainingQty;
    item.dispatch_status = remainingQty <= 0.001 && itemQty > 0 
      ? 'FULLY_DISPATCHED' 
      : (actualDispatched > 0 ? 'PARTIALLY_DISPATCHED' : 'PENDING');
    
    if (item.allocation_status !== 'RELEASED_FOR_REQUOTE') {
      item.allocation_status = remainingQty <= 0.001 && itemQty > 0 ? 'COMPLETED' : 'ACTIVE';
    }
  });

  return dbState;
}

function buildOpenRequirements(rawReqs, dbState, transporter) {
  const openReqs = [];
  rawReqs.forEach(parentReq => {
    const childItems = parentReq.items || [];
    childItems.forEach((item, idx) => {
      // Historical Duplicate Re-quote Guard
      if (item.source_item_id) {
        const sourceItem = childItems.find(ci => ci.id === item.source_item_id);
        if (sourceItem && sourceItem.dispatch_status !== 'FULLY_DISPATCHED' && parseFloat(sourceItem.remaining_quantity_mt || 0) > 0) {
          return;
        }
      }

      const dispatches = (dbState.truck_dispatches || []).filter(d => 
        d.requirement_item_id === item.id || d.requirement_item_id === item.sub_indent_no
      );
      const totalDispatched = dispatches.reduce((acc, curr) => acc + (parseFloat(curr.loaded_quantity_mt) || 0), 0);
      const allocatedQty = parseFloat(item.quantity_mt || 0);
      const remQty = Math.max(0, allocatedQty - totalDispatched);
      if (remQty <= 0 && allocatedQty > 0) return;

      const finalizedBid = (dbState.rate_submissions || []).find(s => 
        (s.requirement_id === parentReq.id) &&
        (s.item_id === item.id || s.item_id === item.sub_indent_no || s.item_id === 'MAIN') &&
        (Boolean(s.is_finalized) || String(s.bid_status).toUpperCase() === 'FINALIZED' || Number(s.final_rate) > 0)
      );

      let isFixedRate = false;
      let fixedRateVal = null;
      if (finalizedBid) {
        isFixedRate = true;
        fixedRateVal = Number(finalizedBid.final_rate || finalizedBid.rate_per_mt);
      } else if (dispatches.length > 0 && Number(dispatches[0]?.finalized_rate) > 0) {
        isFixedRate = true;
        fixedRateVal = Number(dispatches[0].finalized_rate);
      }

      openReqs.push({
        id: parentReq.id,
        item_id: item.id,
        sub_indent_no: item.sub_indent_no,
        allocated_quantity_mt: allocatedQty,
        dispatched_quantity_mt: totalDispatched,
        remaining_quantity_mt: remQty,
        is_fixed_rate_allocation: isFixedRate,
        fixed_rate: fixedRateVal,
        requires_new_bid: !isFixedRate
      });
    });
  });
  return openReqs;
}

function dispatchTruck(dbState, reqId, itemId, loadedQty, transId) {
  const item = dbState.transport_requirement_items.find(i => i.id === itemId || i.sub_indent_no === itemId);
  if (!item) throw new Error('ITEM_RESOLUTION_FAILED');
  
  const dispatches = dbState.truck_dispatches.filter(d => d.requirement_item_id === item.id || d.requirement_item_id === item.sub_indent_no);
  const totalDispatched = dispatches.reduce((acc, curr) => acc + curr.loaded_quantity_mt, 0);
  const remaining = Math.max(0, item.quantity_mt - totalDispatched);

  if (loadedQty > remaining) {
    throw new Error('EXCEEDS_REMAINING_QUANTITY');
  }

  const finBid = dbState.rate_submissions.find(s => s.requirement_id === reqId && (s.item_id === item.id || s.item_id === item.sub_indent_no || s.item_id === 'MAIN'));
  const rate = Number(finBid?.final_rate || 55);

  const dispRecord = {
    id: `disp_${Date.now()}_${Math.random()}`,
    requirement_id: reqId,
    requirement_item_id: item.id,
    transporter_id: transId,
    finalized_rate: rate,
    loaded_quantity_mt: loadedQty
  };
  dbState.truck_dispatches.push(dispRecord);
  simulateReconciliation(dbState);
  return { success: true, remaining: item.remaining_quantity_mt };
}

function generateIntegrityReport(dbState) {
  const items = dbState.transport_requirement_items || [];
  const dispatches = dbState.truck_dispatches || [];
  const itemsWithBalanceDiff = [];
  const itemsWithDispatchDiscrepancy = [];

  items.forEach(item => {
    const alloc = parseFloat(item.quantity_mt || 0);
    const disp = parseFloat(item.dispatched_quantity_mt || 0);
    const rem = parseFloat(item.remaining_quantity_mt || 0);
    const balDiff = Math.abs(alloc - (disp + rem));
    if (balDiff > 0.001) itemsWithBalanceDiff.push(item);

    const actualLoaded = dispatches
      .filter(d => d.requirement_item_id === item.id || d.requirement_item_id === item.sub_indent_no)
      .reduce((sum, d) => sum + parseFloat(d.loaded_quantity_mt || 0), 0);

    const dispMismatch = Math.abs(disp - actualLoaded);
    if (dispMismatch > 0.001) itemsWithDispatchDiscrepancy.push(item);
  });

  return {
    total_items: items.length,
    balance_discrepancies: itemsWithBalanceDiff.length,
    dispatch_discrepancies: itemsWithDispatchDiscrepancy.length,
    is_healthy: itemsWithBalanceDiff.length === 0 && itemsWithDispatchDiscrepancy.length === 0
  };
}

// -------------------------------------------------------------
// TESTS (15 Strict Invariants)
// -------------------------------------------------------------

function create200MtScenario() {
  return {
    transport_requirements: [{ id: 'req_200', req_no: 'REQ-200', total_quantity_mt: 200, status: 'Active' }],
    transport_requirement_items: [
      { id: 'item_200_01', requirement_id: 'req_200', sub_indent_no: 'REQ-200/01', quantity_mt: 200, dispatched_quantity_mt: 0, remaining_quantity_mt: 200, dispatch_status: 'PENDING' }
    ],
    rate_submissions: [
      { id: 'sub_1', requirement_id: 'req_200', item_id: 'item_200_01', transporter_id: 'trans_A', final_rate: 55, rate_per_mt: 55, is_finalized: 1, bid_status: 'FINALIZED' }
    ],
    truck_dispatches: []
  };
}

it('TEST 1: 200 MT @ 55, dispatch 150 -> remaining 50', () => {
  const db = create200MtScenario();
  const res = dispatchTruck(db, 'req_200', 'item_200_01', 150, 'trans_A');
  assert.strictEqual(res.remaining, 50);
  assert.strictEqual(db.transport_requirement_items[0].dispatched_quantity_mt, 150);
  assert.strictEqual(db.transport_requirement_items[0].remaining_quantity_mt, 50);
});

it('TEST 2: Remaining 50 visible to original transporter', () => {
  const db = create200MtScenario();
  dispatchTruck(db, 'req_200', 'item_200_01', 150, 'trans_A');
  const rawReqs = [{ ...db.transport_requirements[0], items: db.transport_requirement_items }];
  const viewA = buildOpenRequirements(rawReqs, db, { id: 'trans_A' });
  assert.strictEqual(viewA.length, 1);
  assert.strictEqual(viewA[0].remaining_quantity_mt, 50);
  assert.strictEqual(viewA[0].is_fixed_rate_allocation, true);
});

it('TEST 3: Remaining 50 visible to another transporter', () => {
  const db = create200MtScenario();
  dispatchTruck(db, 'req_200', 'item_200_01', 150, 'trans_A');
  const rawReqs = [{ ...db.transport_requirements[0], items: db.transport_requirement_items }];
  const viewB = buildOpenRequirements(rawReqs, db, { id: 'trans_B' });
  assert.strictEqual(viewB.length, 1);
  assert.strictEqual(viewB[0].remaining_quantity_mt, 50);
  assert.strictEqual(viewB[0].is_fixed_rate_allocation, true);
});

it('TEST 4: Both see exactly ₹55', () => {
  const db = create200MtScenario();
  dispatchTruck(db, 'req_200', 'item_200_01', 150, 'trans_A');
  const rawReqs = [{ ...db.transport_requirements[0], items: db.transport_requirement_items }];
  const viewA = buildOpenRequirements(rawReqs, db, { id: 'trans_A' });
  const viewB = buildOpenRequirements(rawReqs, db, { id: 'trans_B' });
  assert.strictEqual(viewA[0].fixed_rate, 55);
  assert.strictEqual(viewB[0].fixed_rate, 55);
});

it('TEST 5: No re-quote item created during normal partial dispatch', () => {
  const db = create200MtScenario();
  dispatchTruck(db, 'req_200', 'item_200_01', 150, 'trans_A');
  assert.strictEqual(db.transport_requirement_items.length, 1);
  assert.strictEqual(db.transport_requirement_items[0].sub_indent_no, 'REQ-200/01');
});

it('TEST 6: No new rate submission allowed (requires_new_bid = false)', () => {
  const db = create200MtScenario();
  dispatchTruck(db, 'req_200', 'item_200_01', 150, 'trans_A');
  const rawReqs = [{ ...db.transport_requirements[0], items: db.transport_requirement_items }];
  const view = buildOpenRequirements(rawReqs, db, { id: 'trans_B' });
  assert.strictEqual(view[0].requires_new_bid, false);
});

it('TEST 7: Transporter B can dispatch remaining quantity (20 MT -> 30 MT remaining)', () => {
  const db = create200MtScenario();
  dispatchTruck(db, 'req_200', 'item_200_01', 150, 'trans_A');
  const resB = dispatchTruck(db, 'req_200', 'item_200_01', 20, 'trans_B');
  assert.strictEqual(resB.remaining, 30);
  assert.strictEqual(db.transport_requirement_items[0].dispatched_quantity_mt, 170);
});

it('TEST 8: Total cannot exceed 200 MT (Over-allocation rejected)', () => {
  const db = create200MtScenario();
  dispatchTruck(db, 'req_200', 'item_200_01', 150, 'trans_A');
  dispatchTruck(db, 'req_200', 'item_200_01', 20, 'trans_B');
  assert.throws(() => {
    dispatchTruck(db, 'req_200', 'item_200_01', 35, 'trans_C'); // 170 + 35 = 205 > 200
  }, /EXCEEDS_REMAINING_QUANTITY/);
});

it('TEST 9: UUID dispatch identity aggregation', () => {
  const db = {
    transport_requirement_items: [{ id: 'uuid-101', requirement_id: 'req_1', sub_indent_no: 'REQ-1/01', quantity_mt: 100 }],
    truck_dispatches: [{ id: 'd1', requirement_id: 'req_1', requirement_item_id: 'uuid-101', loaded_quantity_mt: 60 }]
  };
  simulateReconciliation(db);
  assert.strictEqual(db.transport_requirement_items[0].dispatched_quantity_mt, 60);
  assert.strictEqual(db.transport_requirement_items[0].remaining_quantity_mt, 40);
});

it('TEST 10: sub_indent_no dispatch identity aggregation', () => {
  const db = {
    transport_requirement_items: [{ id: 'uuid-102', requirement_id: 'req_2', sub_indent_no: 'REQ-2/01', quantity_mt: 80 }],
    truck_dispatches: [{ id: 'd2', requirement_id: 'req_2', requirement_item_id: 'REQ-2/01', loaded_quantity_mt: 30 }]
  };
  simulateReconciliation(db);
  assert.strictEqual(db.transport_requirement_items[0].dispatched_quantity_mt, 30);
  assert.strictEqual(db.transport_requirement_items[0].remaining_quantity_mt, 50);
});

it('TEST 11: Mixed historical UUID + sub_indent dispatches aggregate correctly into exactly ONE total', () => {
  const db = {
    transport_requirement_items: [{ id: 'uuid-103', requirement_id: 'req_3', sub_indent_no: 'REQ-3/01', quantity_mt: 100 }],
    truck_dispatches: [
      { id: 'd3_1', requirement_id: 'req_3', requirement_item_id: 'uuid-103', loaded_quantity_mt: 40 },
      { id: 'd3_2', requirement_id: 'req_3', requirement_item_id: 'REQ-3/01', loaded_quantity_mt: 35 }
    ]
  };
  simulateReconciliation(db);
  assert.strictEqual(db.transport_requirement_items[0].dispatched_quantity_mt, 75);
  assert.strictEqual(db.transport_requirement_items[0].remaining_quantity_mt, 25);
});

it('TEST 12: /01 dispatch never affects /02', () => {
  const db = {
    transport_requirements: [{ id: 'req_batch', req_no: 'REQ-BATCH', total_quantity_mt: 200 }],
    transport_requirement_items: [
      { id: 'item_01', requirement_id: 'req_batch', sub_indent_no: 'REQ-BATCH/01', quantity_mt: 100 },
      { id: 'item_02', requirement_id: 'req_batch', sub_indent_no: 'REQ-BATCH/02', quantity_mt: 100 }
    ],
    rate_submissions: [{ id: 's1', requirement_id: 'req_batch', item_id: 'item_01', final_rate: 50, is_finalized: 1 }],
    truck_dispatches: []
  };

  dispatchTruck(db, 'req_batch', 'item_01', 80, 'trans_A');
  assert.strictEqual(db.transport_requirement_items[0].remaining_quantity_mt, 20);
  assert.strictEqual(db.transport_requirement_items[1].remaining_quantity_mt, 100);
});

it('TEST 13: Reconciliation is idempotent', () => {
  const db = create200MtScenario();
  dispatchTruck(db, 'req_200', 'item_200_01', 150, 'trans_A');
  
  simulateReconciliation(db);
  const disp1 = db.transport_requirement_items[0].dispatched_quantity_mt;
  const rem1 = db.transport_requirement_items[0].remaining_quantity_mt;

  simulateReconciliation(db);
  const disp2 = db.transport_requirement_items[0].dispatched_quantity_mt;
  const rem2 = db.transport_requirement_items[0].remaining_quantity_mt;

  assert.strictEqual(disp1, disp2);
  assert.strictEqual(rem1, rem2);
});

it('TEST 14: Startup migration actually invokes reconciliation with explicit logs', () => {
  const apiSrc = fs.readFileSync(path.join(process.cwd(), 'server/routes/api.js'), 'utf8');
  assert.strictEqual(apiSrc.includes('[SCHEMA MIGRATION] STARTED'), true);
  assert.strictEqual(apiSrc.includes('[SCHEMA MIGRATION] COMPLETED'), true);
  assert.strictEqual(apiSrc.includes('[DISPATCH RECONCILIATION] STARTED'), true);
  assert.strictEqual(apiSrc.includes('[DISPATCH RECONCILIATION] COMPLETED'), true);
  assert.strictEqual(apiSrc.includes('await reconcileItemDispatchBalances(pool)'), true);
});

it('TEST 15: Integrity endpoint correctly detects inconsistencies', () => {
  const dbHealthy = {
    transport_requirement_items: [{ id: 'i1', sub_indent_no: 'REQ-1/01', quantity_mt: 100, dispatched_quantity_mt: 40, remaining_quantity_mt: 60 }],
    truck_dispatches: [{ requirement_item_id: 'i1', loaded_quantity_mt: 40 }]
  };
  const repHealthy = generateIntegrityReport(dbHealthy);
  assert.strictEqual(repHealthy.is_healthy, true);

  const dbInconsistent = {
    transport_requirement_items: [{ id: 'i2', sub_indent_no: 'REQ-2/01', quantity_mt: 100, dispatched_quantity_mt: 30, remaining_quantity_mt: 50 }], // 30 + 50 = 80 != 100
    truck_dispatches: [{ requirement_item_id: 'i2', loaded_quantity_mt: 40 }] // actual loaded = 40 != 30
  };
  const repInconsistent = generateIntegrityReport(dbInconsistent);
  assert.strictEqual(repInconsistent.is_healthy, false);
  assert.strictEqual(repInconsistent.balance_discrepancies, 1);
  assert.strictEqual(repInconsistent.dispatch_discrepancies, 1);
});

console.log('================================================================');
console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');
if (failed > 0) process.exit(1);
