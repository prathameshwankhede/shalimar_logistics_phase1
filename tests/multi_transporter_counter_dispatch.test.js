// ============================================================================
// MULTI-TRANSPORTER COLLABORATIVE COUNTER DISPATCH TEST SUITE 🚚⚡
// ============================================================================

import assert from 'assert';

console.log('================================================================');
console.log('🧪 RUNNING MULTI-TRANSPORTER COLLABORATIVE COUNTER DISPATCH SUITE');
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

// DTO Builder replicating TransporterPortal.jsx openRateRequests logic
function buildOpenRequirements(parentReq, dbState, transporter) {
  const openRateRequests = [];
  const transMatchIds = [transporter?.id, transporter?.code, transporter?.username].filter(Boolean).map(String);

  const childItems = parentReq.items || [];
  childItems.forEach((item, idx) => {
    const subIdxStr = (idx + 1).toString().padStart(2, '0');
    const parentReqNo = parentReq.req_no || parentReq.request_no || parentReq.id;
    const subIndentNo = item.sub_indent_no || `${parentReqNo}/${subIdxStr}`;

    const dispatches = (dbState.truck_dispatches || []).filter((d) => {
      return (String(d.requirement_id) === String(parentReq.id) || String(d.requirement_id) === String(parentReqNo)) &&
             (String(d.requirement_item_id) === String(item.id) || String(d.requirement_item_id) === String(subIndentNo));
    });

    const totalDispatched = dispatches.reduce((acc, curr) => acc + (parseFloat(curr.loaded_quantity_mt) || 0), 0);
    const allocatedQty = parseFloat(item.quantity_mt || item.required_qty || 0);
    const remQty = Math.max(0, parseFloat((allocatedQty - totalDispatched).toFixed(3)));

    let fixedRate = null;
    let winningTransporterId = null;

    if (dispatches.length > 0 && Number(dispatches[0]?.finalized_rate) > 0) {
      fixedRate = Number(dispatches[0].finalized_rate);
      winningTransporterId = dispatches[0].transporter_id;
    }

    const myExistingBid = (dbState.rate_submissions || []).find((s) => {
      const sReq = String(s.requirement_id) === String(parentReq.id);
      const sItem = String(s.item_id) === String(item.id) || String(s.item_id) === String(subIndentNo);
      const sTrans = transMatchIds.includes(String(s.transporter_id));
      return sReq && sItem && sTrans;
    });

    const itemCounterRate = Number(item.counter_offer_rate || item.remaining_finalized_rate || 0);
    const myCounterRate = Number(myExistingBid?.counter_offer_rate || 0);
    const activeCounterRate = itemCounterRate > 0 ? itemCounterRate : (myCounterRate > 0 ? myCounterRate : null);
    const isOpenCounterDispatch = Boolean(activeCounterRate && activeCounterRate > 0 && remQty > 0);

    if (fixedRate === null && activeCounterRate) {
      fixedRate = activeCounterRate;
    }

    let canDispatch = false;
    if (isOpenCounterDispatch && Boolean(myExistingBid)) {
      canDispatch = remQty > 0;
    }

    if (remQty <= 0) {
      return; // Fully dispatched, move to history
    }

    openRateRequests.push({
      item_id: item.id,
      sub_indent_no: subIndentNo,
      total_quantity_mt: allocatedQty,
      dispatched_quantity_mt: totalDispatched,
      remaining_quantity_mt: remQty,
      fixed_rate: fixedRate,
      can_dispatch: canDispatch,
      is_open_counter_dispatch: isOpenCounterDispatch
    });
  });

  return openRateRequests;
}

// Server Dispatch Simulator replicating handleCreateTruckDispatch
function simulateServerDispatch(dbState, reqId, itemId, transporterId, loadedQty, truckNo) {
  const req = dbState.requirements.find(r => r.id === reqId);
  const item = req.items.find(i => i.id === itemId);

  const dispatches = dbState.truck_dispatches.filter(d => d.requirement_id === reqId && d.requirement_item_id === itemId);
  const alreadyDispatched = dispatches.reduce((acc, d) => acc + d.loaded_quantity_mt, 0);
  const totalQty = item.quantity_mt;
  const currentRem = totalQty - alreadyDispatched;

  if (loadedQty > currentRem) {
    throw new Error(`OVER_DISPATCH_REJECTED: Requested ${loadedQty} MT exceeds remaining ${currentRem} MT.`);
  }

  const finalizedRate = item.counter_offer_rate || 50;

  dbState.truck_dispatches.push({
    id: `disp_${Date.now()}_${Math.random()}`,
    requirement_id: reqId,
    requirement_item_id: itemId,
    transporter_id: transporterId,
    truck_number: truckNo,
    loaded_quantity_mt: loadedQty,
    finalized_rate: finalizedRate,
    dispatched_at: new Date()
  });

  const newTotalDisp = alreadyDispatched + loadedQty;
  const newRem = totalQty - newTotalDisp;
  item.dispatched_quantity_mt = newTotalDisp;
  item.remaining_quantity_mt = newRem;
  item.dispatch_status = newRem <= 0 ? 'FULLY_DISPATCHED' : 'PARTIALLY_DISPATCHED';

  return { newTotalDisp, newRem, dispatchStatus: item.dispatch_status };
}

// ============================================================================
// TEST CASES
// ============================================================================

const state = {
  requirements: [{
    id: 'req_001',
    req_no: 'SNPL/26-27/REQ-0001',
    items: [{
      id: 'item_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      quantity_mt: 55,
      dispatched_quantity_mt: 0,
      remaining_quantity_mt: 55,
      counter_offer_rate: null
    }]
  }],
  rate_submissions: [
    { id: 'sub_s001', requirement_id: 'req_001', item_id: 'item_01', transporter_id: 'S001', rate_per_mt: 55, counter_offer_rate: null },
    { id: 'sub_m001', requirement_id: 'req_001', item_id: 'item_01', transporter_id: 'M001', rate_per_mt: 58, counter_offer_rate: null }
  ],
  truck_dispatches: []
};

it('TEST 1: Initially with no counter offer, neither transporter has dispatch enabled', () => {
  const reqsS = buildOpenRequirements(state.requirements[0], state, { id: 'S001', code: 'S001' });
  const reqsM = buildOpenRequirements(state.requirements[0], state, { id: 'M001', code: 'M001' });

  assert.strictEqual(reqsS[0].can_dispatch, false);
  assert.strictEqual(reqsM[0].can_dispatch, false);
});

it('TEST 2: Admin issues Counter Rate ₹50/MT -> BOTH S001 and M001 immediately receive Dispatch Truck button', () => {
  // Simulate Admin Counter Rate ₹50 to all
  state.requirements[0].items[0].counter_offer_rate = 50;
  state.rate_submissions.forEach(s => s.counter_offer_rate = 50);

  const reqsS = buildOpenRequirements(state.requirements[0], state, { id: 'S001', code: 'S001' });
  const reqsM = buildOpenRequirements(state.requirements[0], state, { id: 'M001', code: 'M001' });

  assert.strictEqual(reqsS[0].can_dispatch, true, 'S001 must have can_dispatch = true');
  assert.strictEqual(reqsS[0].fixed_rate, 50, 'S001 locked rate must be ₹50/MT');
  assert.strictEqual(reqsS[0].remaining_quantity_mt, 55, 'Initial remaining must be 55 MT');

  assert.strictEqual(reqsM[0].can_dispatch, true, 'M001 must have can_dispatch = true');
  assert.strictEqual(reqsM[0].fixed_rate, 50, 'M001 locked rate must be ₹50/MT');
  assert.strictEqual(reqsM[0].remaining_quantity_mt, 55, 'Initial remaining must be 55 MT');
});

it('TEST 3: S001 dispatches 20 MT -> M001 automatically sees remaining balance updated to 35 MT', () => {
  const res = simulateServerDispatch(state, 'req_001', 'item_01', 'S001', 20, 'MH31FC1111');
  assert.strictEqual(res.newRem, 35);
  assert.strictEqual(res.dispatchStatus, 'PARTIALLY_DISPATCHED');

  // M001 refreshes view
  const reqsM = buildOpenRequirements(state.requirements[0], state, { id: 'M001', code: 'M001' });
  assert.strictEqual(reqsM[0].can_dispatch, true, 'M001 can still dispatch');
  assert.strictEqual(reqsM[0].dispatched_quantity_mt, 20, 'Dispatched should be 20 MT');
  assert.strictEqual(reqsM[0].remaining_quantity_mt, 35, 'Remaining should now be 35 MT');
});

it('TEST 4: Over-dispatch rejection: S001 attempts to dispatch 40 MT when only 35 MT remains -> rejected', () => {
  assert.throws(() => {
    simulateServerDispatch(state, 'req_001', 'item_01', 'S001', 40, 'MH31FC9999');
  }, /OVER_DISPATCH_REJECTED/);
});

it('TEST 5: M001 dispatches remaining 35 MT -> requirement hits 55 MT and automatically marks FULLY_DISPATCHED', () => {
  const res = simulateServerDispatch(state, 'req_001', 'item_01', 'M001', 35, 'MH31FC2222');
  assert.strictEqual(res.newTotalDisp, 55);
  assert.strictEqual(res.newRem, 0);
  assert.strictEqual(res.dispatchStatus, 'FULLY_DISPATCHED');
});

it('TEST 6: After remaining hits 0 MT, requirement is automatically closed and removed from Open Requirements for all transporters', () => {
  const reqsS = buildOpenRequirements(state.requirements[0], state, { id: 'S001', code: 'S001' });
  const reqsM = buildOpenRequirements(state.requirements[0], state, { id: 'M001', code: 'M001' });

  assert.strictEqual(reqsS.length, 0, 'S001 open list must be empty (completed)');
  assert.strictEqual(reqsM.length, 0, 'M001 open list must be empty (completed)');
});

console.log('================================================================');
console.log(`🎉 TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('================================================================');

if (failedTests > 0) process.exit(1);
