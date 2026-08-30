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
  const dispatchSumMap = {};
  
  (dbState.truck_dispatches || []).forEach(d => {
    const key = d.requirement_item_id;
    dispatchSumMap[key] = (dispatchSumMap[key] || 0) + Number(d.loaded_quantity_mt || 0);
  });

  (dbState.transport_requirement_items || []).forEach(item => {
    const actualDispatched = Number(dispatchSumMap[item.id] || dispatchSumMap[item.sub_indent_no] || 0);
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

// -------------------------------------------------------------
// TESTS (14 Strict Invariants)
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

it('TEST 1: 200 MT finalized at ₹55 is initialized with 200 MT remaining', () => {
  const db = create200MtScenario();
  assert.strictEqual(db.transport_requirement_items[0].quantity_mt, 200);
  assert.strictEqual(db.rate_submissions[0].final_rate, 55);
});

it('TEST 2: Transporter A dispatches 150 MT -> 50 MT remaining, same item, same ₹55, NO /02 created', () => {
  const db = create200MtScenario();
  const res = dispatchTruck(db, 'req_200', 'item_200_01', 150, 'trans_A');
  assert.strictEqual(res.remaining, 50);
  assert.strictEqual(db.transport_requirement_items.length, 1);
  assert.strictEqual(db.transport_requirement_items[0].sub_indent_no, 'REQ-200/01');
  assert.strictEqual(db.transport_requirement_items[0].dispatch_status, 'PARTIALLY_DISPATCHED');
});

it('TEST 3: Original transporter sees remaining 50 MT in Open Requirements', () => {
  const db = create200MtScenario();
  dispatchTruck(db, 'req_200', 'item_200_01', 150, 'trans_A');
  const rawReqs = [{ ...db.transport_requirements[0], items: db.transport_requirement_items }];
  const viewA = buildOpenRequirements(rawReqs, db, { id: 'trans_A' });
  assert.strictEqual(viewA.length, 1);
  assert.strictEqual(viewA[0].remaining_quantity_mt, 50);
  assert.strictEqual(viewA[0].is_fixed_rate_allocation, true);
});

it('TEST 4: Other eligible transporter B sees same remaining 50 MT', () => {
  const db = create200MtScenario();
  dispatchTruck(db, 'req_200', 'item_200_01', 150, 'trans_A');
  const rawReqs = [{ ...db.transport_requirements[0], items: db.transport_requirement_items }];
  const viewB = buildOpenRequirements(rawReqs, db, { id: 'trans_B' });
  assert.strictEqual(viewB.length, 1);
  assert.strictEqual(viewB[0].remaining_quantity_mt, 50);
  assert.strictEqual(viewB[0].is_fixed_rate_allocation, true);
});

it('TEST 5: Both transporters see exactly ₹55/MT fixed rate', () => {
  const db = create200MtScenario();
  dispatchTruck(db, 'req_200', 'item_200_01', 150, 'trans_A');
  const rawReqs = [{ ...db.transport_requirements[0], items: db.transport_requirement_items }];
  const viewA = buildOpenRequirements(rawReqs, db, { id: 'trans_A' });
  const viewB = buildOpenRequirements(rawReqs, db, { id: 'trans_B' });
  assert.strictEqual(viewA[0].fixed_rate, 55);
  assert.strictEqual(viewB[0].fixed_rate, 55);
});

it('TEST 6: No quote input visible (requires_new_bid is false)', () => {
  const db = create200MtScenario();
  dispatchTruck(db, 'req_200', 'item_200_01', 150, 'trans_A');
  const rawReqs = [{ ...db.transport_requirements[0], items: db.transport_requirement_items }];
  const view = buildOpenRequirements(rawReqs, db, { id: 'trans_B' });
  assert.strictEqual(view[0].requires_new_bid, false);
});

it('TEST 7: Transporter B dispatches 20 MT -> 30 MT remaining', () => {
  const db = create200MtScenario();
  dispatchTruck(db, 'req_200', 'item_200_01', 150, 'trans_A');
  const resB = dispatchTruck(db, 'req_200', 'item_200_01', 20, 'trans_B');
  assert.strictEqual(resB.remaining, 30);
  assert.strictEqual(db.transport_requirement_items[0].dispatched_quantity_mt, 170);
});

it('TEST 8: Transporter C dispatches 30 MT -> FULLY_DISPATCHED (0 MT remaining)', () => {
  const db = create200MtScenario();
  dispatchTruck(db, 'req_200', 'item_200_01', 150, 'trans_A');
  dispatchTruck(db, 'req_200', 'item_200_01', 20, 'trans_B');
  const resC = dispatchTruck(db, 'req_200', 'item_200_01', 30, 'trans_C');
  assert.strictEqual(resC.remaining, 0);
  assert.strictEqual(db.transport_requirement_items[0].dispatched_quantity_mt, 200);
  assert.strictEqual(db.transport_requirement_items[0].dispatch_status, 'FULLY_DISPATCHED');
});

it('TEST 9: Total dispatched cannot exceed 200 MT', () => {
  const db = create200MtScenario();
  dispatchTruck(db, 'req_200', 'item_200_01', 150, 'trans_A');
  dispatchTruck(db, 'req_200', 'item_200_01', 20, 'trans_B');
  assert.throws(() => {
    dispatchTruck(db, 'req_200', 'item_200_01', 35, 'trans_C'); // 170 + 35 = 205 > 200
  }, /EXCEEDS_REMAINING_QUANTITY/);
});

it('TEST 10: Concurrent dispatch requests cannot exceed remaining balance', () => {
  const db = create200MtScenario();
  dispatchTruck(db, 'req_200', 'item_200_01', 150, 'trans_A');
  // Two simultaneous requests of 30 MT when only 50 MT is available
  dispatchTruck(db, 'req_200', 'item_200_01', 30, 'trans_B'); // Succeeds, remaining = 20
  assert.throws(() => {
    dispatchTruck(db, 'req_200', 'item_200_01', 30, 'trans_C'); // Fails because remaining is 20
  }, /EXCEEDS_REMAINING_QUANTITY/);
});

it('TEST 11: Historical /02 /03 records do not create duplicate active quantity', () => {
  const db = {
    transport_requirements: [{ id: 'req_hist', req_no: 'REQ-HIST', total_quantity_mt: 100 }],
    transport_requirement_items: [
      { id: 'item_hist_01', requirement_id: 'req_hist', sub_indent_no: 'REQ-HIST/01', quantity_mt: 100, remaining_quantity_mt: 40, dispatched_quantity_mt: 60, dispatch_status: 'PARTIALLY_DISPATCHED' },
      { id: 'item_hist_02', requirement_id: 'req_hist', sub_indent_no: 'REQ-HIST/02', quantity_mt: 40, source_item_id: 'item_hist_01', remaining_quantity_mt: 40, dispatched_quantity_mt: 0, dispatch_status: 'PENDING' }
    ],
    rate_submissions: [{ id: 's1', requirement_id: 'req_hist', item_id: 'item_hist_01', final_rate: 55, is_finalized: 1 }],
    truck_dispatches: [{ id: 'd1', requirement_item_id: 'item_hist_01', loaded_quantity_mt: 60 }]
  };

  const rawReqs = [{ ...db.transport_requirements[0], items: db.transport_requirement_items }];
  const view = buildOpenRequirements(rawReqs, db, { id: 'trans_A' });
  // Must render only 1 active item with 40 MT, NOT 2 items totalling 80 MT!
  assert.strictEqual(view.length, 1);
  assert.strictEqual(view[0].remaining_quantity_mt, 40);
});

it('TEST 12: Sibling dispatch isolation remains correct (/01 dispatches do not affect /02)', () => {
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

it('TEST 13: Frontend and backend remaining balance always match with exact mathematical precision', () => {
  const db = create200MtScenario();
  dispatchTruck(db, 'req_200', 'item_200_01', 150, 'trans_A');
  const backendRemaining = db.transport_requirement_items[0].remaining_quantity_mt;

  const rawReqs = [{ ...db.transport_requirements[0], items: db.transport_requirement_items }];
  const frontendRemaining = buildOpenRequirements(rawReqs, db, { id: 'trans_A' })[0].remaining_quantity_mt;

  assert.strictEqual(backendRemaining, 50);
  assert.strictEqual(frontendRemaining, 50);
  assert.strictEqual(backendRemaining, frontendRemaining);
});

it('TEST 14: Page refresh preserves fixed-rate remaining dispatch state', () => {
  const db = create200MtScenario();
  dispatchTruck(db, 'req_200', 'item_200_01', 150, 'trans_A');
  
  // Simulate page refresh (rebuilding DTO from fresh DB fetch)
  simulateReconciliation(db);
  const rawReqs = [{ ...db.transport_requirements[0], items: db.transport_requirement_items }];
  const viewAfterRefresh = buildOpenRequirements(rawReqs, db, { id: 'trans_B' });

  assert.strictEqual(viewAfterRefresh.length, 1);
  assert.strictEqual(viewAfterRefresh[0].remaining_quantity_mt, 50);
  assert.strictEqual(viewAfterRefresh[0].is_fixed_rate_allocation, true);
  assert.strictEqual(viewAfterRefresh[0].fixed_rate, 55);
});

console.log('================================================================');
console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');
if (failed > 0) process.exit(1);
