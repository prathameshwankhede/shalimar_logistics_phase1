// ============================================================================
// WINNING TRANSPORTER DISPATCH AUTHORIZATION TEST SUITE
// ============================================================================

import assert from 'assert';

console.log('================================================================');
console.log('🧪 RUNNING WINNING TRANSPORTER DISPATCH AUTHORIZATION TEST SUITE');
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
    console.error(`     Error: ${err.message}`);
    if (err.stack) console.error(`     ${err.stack.split('\n')[1]}`);
    failedTests++;
  }
}

// -------------------------------------------------------------
// Pure Simulator for Frontend Open Requirements DTO Builder
// -------------------------------------------------------------
function buildFrontendOpenRequirements(rawRequirements, dbState, transporter) {
  const openRateRequests = [];
  const transMatchIds = [transporter?.id, transporter?.code, transporter?.username].filter(Boolean).map(String);

  rawRequirements.forEach((parentReq) => {
    const childItems = parentReq.items || [];
    if (childItems.length > 0) {
      childItems.forEach((item, idx) => {
        const subIdxStr = (idx + 1).toString().padStart(2, '0');
        const parentReqNo = parentReq.req_no || parentReq.request_no || parentReq.id;
        const subIndentNo = item.sub_indent_no || `${parentReqNo}/${subIdxStr}`;

        const dispStatusUpper = String(item.dispatch_status || '').toUpperCase();
        if (dispStatusUpper === 'FULLY_DISPATCHED' || dispStatusUpper === 'COMPLETED') {
          return;
        }

        const dispatches = (dbState.truck_dispatches || []).filter((d) => {
          if (item && item.id) {
            return d.requirement_item_id === item.id || d.requirement_item_id === item.sub_indent_no;
          }
          return d.requirement_id === parentReq.id;
        });
        const totalDispatched = dispatches.reduce((acc, curr) => acc + (parseFloat(curr.loaded_quantity_mt || curr.dispatched_qty) || 0), 0);
        const allocatedQty = parseFloat(item.quantity_mt || item.required_qty || 0);
        const remQty = Math.max(0, allocatedQty - totalDispatched);
        if (remQty <= 0 && allocatedQty > 0) {
          return;
        }

        const finalizedBid = (dbState.rate_submissions || []).find((s) => {
          if (!s) return false;
          const sReqMatch = String(s.requirement_id) === String(parentReq.id) || String(s.rate_request_id) === String(parentReq.id) || String(s.rate_request_id) === String(parentReqNo);
          const sItemMatch = String(s.item_id) === String(item.id) || String(s.item_id) === String(subIndentNo);
          return sReqMatch && sItemMatch && (Boolean(s.is_finalized) || String(s.bid_status).toUpperCase() === 'FINALIZED' || Number(s.final_rate) > 0);
        });

        let isFixedRateAllocation = false;
        let fixedRate = null;
        let myWinningBid = null;
        let winningTransporterId = null;

        if (finalizedBid) {
          fixedRate = Number(finalizedBid.final_rate || finalizedBid.rate_per_mt || 0);
          myWinningBid = finalizedBid;
          winningTransporterId = finalizedBid.transporter_id;
        } else if (dispatches.length > 0 && Number(dispatches[0]?.finalized_rate) > 0) {
          fixedRate = Number(dispatches[0].finalized_rate);
          winningTransporterId = dispatches[0].transporter_id;
        }

        const isWinningTransporter = Boolean(
          winningTransporterId &&
          transMatchIds.some(tid => String(tid) === String(winningTransporterId) || String(tid).toLowerCase() === String(winningTransporterId).toLowerCase())
        );

        if (fixedRate !== null) {
          isFixedRateAllocation = isWinningTransporter;
        }

        openRateRequests.push({
          id: parentReq.id,
          requirement_id: parentReq.id,
          item_id: item.id,
          sub_indent_no: subIndentNo,
          required_qty: remQty > 0 ? remQty : allocatedQty,
          allocated_quantity_mt: allocatedQty,
          dispatched_quantity_mt: totalDispatched,
          remaining_quantity_mt: remQty,
          is_fixed_rate_allocation: isFixedRateAllocation,
          can_dispatch: isWinningTransporter,
          is_awarded_to_other: Boolean(fixedRate !== null && !isWinningTransporter),
          winning_transporter_id: winningTransporterId,
          fixed_rate: fixedRate,
          finalized_rate: fixedRate,
          finalized_bid: myWinningBid,
          rate_editable: false,
          requires_new_bid: !isFixedRateAllocation && fixedRate === null,
          is_requote: false
        });
      });
    }
  });

  return openRateRequests;
}

// -------------------------------------------------------------
// Pure Simulator for Backend Dispatch Creation Handler
// -------------------------------------------------------------
function simulateBackendDispatch(dbState, reqId, itemId, payload, authTransporter) {
  const req = dbState.transport_requirements.find(r => r.id === reqId);
  if (!req) throw { status: 404, code: 'REQ_NOT_FOUND' };

  const item = (dbState.transport_requirement_items || []).find(i => (i.id === itemId || i.sub_indent_no === itemId));
  if (!item) throw { status: 400, code: 'ITEM_RESOLUTION_FAILED' };

  const finBid = (dbState.rate_submissions || []).find(s => 
    s.requirement_id === reqId && 
    (s.item_id === item.id || s.item_id === item.sub_indent_no || s.item_id === 'MAIN') &&
    (Boolean(s.is_finalized) || Number(s.final_rate) > 0)
  );

  if (!finBid) throw { status: 400, code: 'RATE_NOT_FINALIZED' };

  // Authorization Check: Must be the winning transporter
  const winningTransporterId = String(finBid.transporter_id);
  const transMatchIds = [authTransporter?.id, authTransporter?.code, authTransporter?.username].filter(Boolean).map(String);
  const isWinner = transMatchIds.some(tid => tid === winningTransporterId || tid.toLowerCase() === winningTransporterId.toLowerCase());

  if (!isWinner) {
    throw { status: 403, code: 'TRANSPORTER_NOT_AUTHORIZED_FOR_DISPATCH', error: 'Only winning transporter is authorized' };
  }

  const dispatches = (dbState.truck_dispatches || []).filter(d => d.requirement_item_id === item.id || d.requirement_item_id === item.sub_indent_no);
  const alreadyDispatched = dispatches.reduce((acc, d) => acc + d.loaded_quantity_mt, 0);
  const remaining = Math.max(0, item.quantity_mt - alreadyDispatched);

  if (payload.loaded_quantity_mt > remaining) {
    throw { status: 400, code: 'EXCEEDS_REMAINING_QUANTITY' };
  }

  const dispRecord = {
    id: `disp_${Date.now()}`,
    requirement_id: reqId,
    requirement_item_id: item.id,
    transporter_id: authTransporter.id,
    finalized_rate: finBid.final_rate,
    loaded_quantity_mt: payload.loaded_quantity_mt,
    lr_number: `LR-${Date.now()}`
  };
  dbState.truck_dispatches.push(dispRecord);

  // Update item
  const newDispatched = alreadyDispatched + payload.loaded_quantity_mt;
  const newRemaining = Math.max(0, item.quantity_mt - newDispatched);
  item.dispatched_quantity_mt = newDispatched;
  item.remaining_quantity_mt = newRemaining;
  item.dispatch_status = newRemaining <= 0.001 ? 'FULLY_DISPATCHED' : 'PARTIALLY_DISPATCHED';

  return { success: true, lr_number: dispRecord.lr_number, remaining_mt: newRemaining };
}

// -------------------------------------------------------------
// TESTS
// -------------------------------------------------------------

function createScenario() {
  return {
    transport_requirements: [{ id: 'req_200', req_no: 'REQ-200', total_quantity_mt: 200, status: 'Active' }],
    transport_requirement_items: [
      { id: 'item_200_01', requirement_id: 'req_200', sub_indent_no: 'REQ-200/01', quantity_mt: 200, dispatched_quantity_mt: 0, remaining_quantity_mt: 200, dispatch_status: 'PENDING' }
    ],
    rate_submissions: [
      { id: 'sub_A', requirement_id: 'req_200', item_id: 'item_200_01', transporter_id: 'trans_A', rate_per_mt: 55, final_rate: 55, is_finalized: 1, bid_status: 'FINALIZED' },
      { id: 'sub_B', requirement_id: 'req_200', item_id: 'item_200_01', transporter_id: 'trans_B', rate_per_mt: 60, is_finalized: 0 }
    ],
    truck_dispatches: []
  };
}

it('TEST 1: Transporter A quotes ₹55 and Transporter B quotes ₹60. Admin finalizes Transporter A. Only Transporter A sees Dispatch Truck button.', () => {
  const db = createScenario();
  const rawReqs = [{ ...db.transport_requirements[0], items: db.transport_requirement_items }];
  
  const viewA = buildFrontendOpenRequirements(rawReqs, db, { id: 'trans_A' });
  assert.strictEqual(viewA[0].is_fixed_rate_allocation, true);
  assert.strictEqual(viewA[0].can_dispatch, true);

  const viewB = buildFrontendOpenRequirements(rawReqs, db, { id: 'trans_B' });
  assert.strictEqual(viewB[0].is_fixed_rate_allocation, false);
  assert.strictEqual(viewB[0].can_dispatch, false);
  assert.strictEqual(viewB[0].is_awarded_to_other, true);
});

it('TEST 2: Transporter A dispatches 150 of 200 MT. Remaining 50 MT stays available ONLY to Transporter A.', () => {
  const db = createScenario();
  const res = simulateBackendDispatch(db, 'req_200', 'item_200_01', { loaded_quantity_mt: 150 }, { id: 'trans_A' });
  assert.strictEqual(res.remaining_mt, 50);

  const rawReqs = [{ ...db.transport_requirements[0], items: db.transport_requirement_items }];
  const viewA = buildFrontendOpenRequirements(rawReqs, db, { id: 'trans_A' });
  assert.strictEqual(viewA[0].remaining_quantity_mt, 50);
  assert.strictEqual(viewA[0].can_dispatch, true);
});

it('TEST 3: Transporter B cannot see the dispatch button after partial dispatch.', () => {
  const db = createScenario();
  simulateBackendDispatch(db, 'req_200', 'item_200_01', { loaded_quantity_mt: 150 }, { id: 'trans_A' });

  const rawReqs = [{ ...db.transport_requirements[0], items: db.transport_requirement_items }];
  const viewB = buildFrontendOpenRequirements(rawReqs, db, { id: 'trans_B' });
  assert.strictEqual(viewB[0].can_dispatch, false);
  assert.strictEqual(viewB[0].is_awarded_to_other, true);
});

it('TEST 4: Transporter B manually calls the dispatch API. Backend returns HTTP 403 TRANSPORTER_NOT_AUTHORIZED_FOR_DISPATCH.', () => {
  const db = createScenario();
  simulateBackendDispatch(db, 'req_200', 'item_200_01', { loaded_quantity_mt: 150 }, { id: 'trans_A' });

  assert.throws(() => {
    simulateBackendDispatch(db, 'req_200', 'item_200_01', { loaded_quantity_mt: 20 }, { id: 'trans_B' });
  }, (err) => {
    return err.status === 403 && err.code === 'TRANSPORTER_NOT_AUTHORIZED_FOR_DISPATCH';
  });
});

it('TEST 5: Transporter A can dispatch remaining quantity successfully (50 MT -> 0 MT).', () => {
  const db = createScenario();
  simulateBackendDispatch(db, 'req_200', 'item_200_01', { loaded_quantity_mt: 150 }, { id: 'trans_A' });
  const resFinal = simulateBackendDispatch(db, 'req_200', 'item_200_01', { loaded_quantity_mt: 50 }, { id: 'trans_A' });
  assert.strictEqual(resFinal.remaining_mt, 0);
  assert.strictEqual(db.transport_requirement_items[0].dispatch_status, 'FULLY_DISPATCHED');
});

it('TEST 6: Fixed rate remains ₹55 throughout the remaining dispatch lifecycle.', () => {
  const db = createScenario();
  simulateBackendDispatch(db, 'req_200', 'item_200_01', { loaded_quantity_mt: 150 }, { id: 'trans_A' });
  assert.strictEqual(db.truck_dispatches[0].finalized_rate, 55);
});

it('TEST 7: No re-quote sub-indent is generated on partial dispatch.', () => {
  const db = createScenario();
  simulateBackendDispatch(db, 'req_200', 'item_200_01', { loaded_quantity_mt: 150 }, { id: 'trans_A' });
  assert.strictEqual(db.transport_requirement_items.length, 1);
  assert.strictEqual(db.transport_requirement_items[0].sub_indent_no, 'REQ-200/01');
});

it('TEST 8: Sibling sub-indent authorization does not leak between /01 and /02.', () => {
  const db = {
    transport_requirements: [{ id: 'req_batch', req_no: 'REQ-BATCH', total_quantity_mt: 200, status: 'Active' }],
    transport_requirement_items: [
      { id: 'item_01', requirement_id: 'req_batch', sub_indent_no: 'REQ-BATCH/01', quantity_mt: 100, dispatched_quantity_mt: 0, remaining_quantity_mt: 100 },
      { id: 'item_02', requirement_id: 'req_batch', sub_indent_no: 'REQ-BATCH/02', quantity_mt: 100, dispatched_quantity_mt: 0, remaining_quantity_mt: 100 }
    ],
    rate_submissions: [
      { id: 'sub_01', requirement_id: 'req_batch', item_id: 'item_01', transporter_id: 'trans_A', final_rate: 50, is_finalized: 1, bid_status: 'FINALIZED' },
      { id: 'sub_02', requirement_id: 'req_batch', item_id: 'item_02', transporter_id: 'trans_B', final_rate: 48, is_finalized: 1, bid_status: 'FINALIZED' }
    ],
    truck_dispatches: []
  };

  const rawReqs = [{ ...db.transport_requirements[0], items: db.transport_requirement_items }];
  
  // Transporter A view: Can dispatch /01, CANNOT dispatch /02
  const viewA = buildFrontendOpenRequirements(rawReqs, db, { id: 'trans_A' });
  const item01A = viewA.find(i => i.item_id === 'item_01');
  const item02A = viewA.find(i => i.item_id === 'item_02');
  assert.strictEqual(item01A.can_dispatch, true);
  assert.strictEqual(item02A.can_dispatch, false);

  // Transporter B view: CANNOT dispatch /01, CAN dispatch /02
  const viewB = buildFrontendOpenRequirements(rawReqs, db, { id: 'trans_B' });
  const item01B = viewB.find(i => i.item_id === 'item_01');
  const item02B = viewB.find(i => i.item_id === 'item_02');
  assert.strictEqual(item01B.can_dispatch, false);
  assert.strictEqual(item02B.can_dispatch, true);
});

console.log('================================================================');
console.log(`📊 TEST RESULTS: ${passedTests} Passed | ${failedTests} Failed`);
console.log('================================================================');

if (failedTests > 0) process.exit(1);
