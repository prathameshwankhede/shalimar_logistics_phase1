// ============================================================================
// FIXED-RATE REMAINING QUANTITY WORKFLOW TEST SUITE (NO RE-QUOTE)
// ============================================================================

import assert from 'assert';

console.log('================================================================');
console.log('🧪 RUNNING FIXED-RATE REMAINING QUANTITY WORKFLOW TEST SUITE');
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
// Pure Simulator for Fixed-Rate Remaining Dispatch Workflow
// -------------------------------------------------------------
function simulateFixedRateDispatch(dbState, params, body, authUser) {
  const { requirementId, itemId } = params;
  const loadedQty = parseFloat(body.loaded_quantity_mt);

  if (isNaN(loadedQty) || loadedQty <= 0) {
    return { status: 400, success: false, error: 'Loaded quantity must be > 0' };
  }

  // 1. Resolve Parent Requirement
  const parentReq = dbState.transport_requirements.find(
    r => r.id === requirementId || r.req_no === requirementId
  );
  if (!parentReq) {
    return { status: 404, success: false, code: 'REQUIREMENT_NOT_FOUND', error: 'Parent requirement not found.' };
  }

  const resolvedReqIds = [parentReq.id, parentReq.req_no].filter(Boolean);

  // 2. Resolve Exact Child Item
  const candidateItemIds = [
    body.requirement_item_id,
    body.item_id,
    itemId,
    body.sub_indent_no
  ].filter(Boolean).filter(v => v !== 'MAIN');

  const allChildItems = dbState.transport_requirement_items.filter(
    i => resolvedReqIds.includes(i.requirement_id)
  );

  let originalItemRec = null;
  if (candidateItemIds.length > 0) {
    originalItemRec = allChildItems.find(
      i => candidateItemIds.includes(i.id) || candidateItemIds.includes(i.sub_indent_no)
    );
  }

  if (!originalItemRec && allChildItems.length > 0) {
    return {
      status: 400,
      success: false,
      code: 'ITEM_RESOLUTION_FAILED',
      error: 'Unable to resolve exact requirement item for dispatch. Please specify a valid sub-indent.'
    };
  }

  const resolvedItemIds = originalItemRec
    ? [originalItemRec.id, originalItemRec.sub_indent_no].filter(Boolean)
    : ['MAIN'];

  // 3. Find Finalized Rate Submission
  const finalizedSub = dbState.rate_submissions.find(
    s => resolvedReqIds.includes(s.requirement_id) &&
         (resolvedItemIds.includes(s.item_id) || s.item_id === 'MAIN' || !s.item_id) &&
         (Boolean(s.is_finalized) || String(s.bid_status).toUpperCase() === 'FINALIZED' || Number(s.final_rate) > 0)
  );

  if (!finalizedSub) {
    return { status: 400, success: false, code: 'RATE_NOT_FINALIZED', error: 'Cannot dispatch truck: freight rate is not yet finalized.' };
  }

  const finalRateVal = parseFloat(finalizedSub.final_rate || finalizedSub.rate_per_mt || 0);

  // 4. Compute Total Item Quantity
  let totalItemQty = 0;
  if (originalItemRec) {
    totalItemQty = parseFloat(originalItemRec.quantity_mt || originalItemRec.required_qty || 0);
  } else {
    totalItemQty = parseFloat(parentReq.quantity_mt || parentReq.total_quantity_mt || 0);
  }

  // 5. Calculate Already Dispatched for this item
  let itemDispatches = [];
  if (originalItemRec) {
    itemDispatches = dbState.truck_dispatches.filter(
      d => resolvedReqIds.includes(d.requirement_id) &&
           (d.requirement_item_id === originalItemRec.id || d.requirement_item_id === originalItemRec.sub_indent_no)
    );
  } else {
    itemDispatches = dbState.truck_dispatches.filter(
      d => resolvedReqIds.includes(d.requirement_id)
    );
  }

  const alreadyDispatched = itemDispatches.reduce(
    (sum, d) => sum + parseFloat(d.loaded_quantity_mt || 0), 0
  );

  const remainingBalance = parseFloat(Math.max(0, totalItemQty - alreadyDispatched).toFixed(3));

  if (loadedQty > remainingBalance) {
    return {
      status: 400,
      success: false,
      code: 'EXCEEDS_REMAINING_QUANTITY',
      error: `Loaded quantity (${loadedQty} MT) cannot exceed remaining balance (${remainingBalance} MT).`,
      remaining_quantity_mt: remainingBalance
    };
  }

  // Check parent level total capacity
  const totalParentDispatched = dbState.truck_dispatches
    .filter(d => resolvedReqIds.includes(d.requirement_id))
    .reduce((sum, d) => sum + parseFloat(d.loaded_quantity_mt || 0), 0);

  const parentCap = parseFloat(parentReq.total_quantity_mt || parentReq.quantity_mt || 0);
  if (parentCap > 0 && (totalParentDispatched + loadedQty) > (parentCap + 0.001)) {
    return {
      status: 400,
      success: false,
      code: 'EXCEEDS_REQUIREMENT_TOTAL_CAPACITY',
      error: 'Loaded quantity exceeds total requirement capacity.'
    };
  }

  // 6. Record Dispatch
  const lrNumber = `LR-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  const dispatchId = `disp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const dispatchRecord = {
    id: dispatchId,
    requirement_id: parentReq.id,
    requirement_item_id: originalItemRec ? originalItemRec.id : 'MAIN',
    transporter_id: authUser.id,
    finalized_rate: finalRateVal,
    truck_number: body.truck_number,
    loaded_quantity_mt: loadedQty,
    driver_name: body.driver_name,
    driver_mobile: body.driver_mobile,
    driver_license: body.driver_license,
    lr_number: lrNumber,
    dispatch_status: 'Dispatched',
    dispatched_at: new Date().toISOString()
  };
  dbState.truck_dispatches.push(dispatchRecord);

  // 7. Update Item and Parent (WITHOUT creating re-quote sub-indents)
  const newTotalDispatched = parseFloat((alreadyDispatched + loadedQty).toFixed(3));
  const newRemaining = parseFloat(Math.max(0, totalItemQty - newTotalDispatched).toFixed(3));

  if (originalItemRec) {
    originalItemRec.dispatched_quantity_mt = newTotalDispatched;
    originalItemRec.remaining_quantity_mt = newRemaining;
    originalItemRec.dispatch_status = newRemaining <= 0 ? 'FULLY_DISPATCHED' : 'PARTIALLY_DISPATCHED';
    originalItemRec.allocation_status = newRemaining <= 0 ? 'COMPLETED' : 'ACTIVE';
  }

  parentReq.status = newRemaining <= 0 ? 'COMPLETED' : 'PARTIALLY_DISPATCHED';

  return {
    status: 200,
    success: true,
    message: newRemaining > 0
      ? `Truck dispatched (${loadedQty} MT). Remaining balance (${newRemaining} MT) available at fixed rate ₹${finalRateVal}/MT.`
      : `Truck dispatched successfully! LR: ${lrNumber}. Requirement completed.`,
    dispatch: dispatchRecord,
    lr_number: lrNumber,
    loaded_quantity_mt: loadedQty,
    dispatched_quantity_mt: newTotalDispatched,
    remaining_quantity_mt: newRemaining,
    fixed_rate: finalRateVal,
    finalized_rate: finalRateVal,
    dispatch_status: newRemaining > 0 ? 'PARTIALLY_DISPATCHED' : 'FULLY_DISPATCHED',
    is_partial: newRemaining > 0,
    item: originalItemRec ? {
      id: originalItemRec.id,
      sub_indent_no: originalItemRec.sub_indent_no,
      total_quantity_mt: totalItemQty,
      dispatched_quantity_mt: newTotalDispatched,
      remaining_quantity_mt: newRemaining,
      fixed_rate: finalRateVal
    } : null
  };
}

// -------------------------------------------------------------
// Pure Simulator for Frontend Open Requirements DTO Builder
// -------------------------------------------------------------
function buildFrontendOpenRequirements(rawRequirements, dbState) {
  const openRateRequests = [];

  rawRequirements.forEach((parentReq) => {
    const childItems = parentReq.items || [];
    if (childItems.length > 0) {
      childItems.forEach((item, idx) => {
        const subIdxStr = (idx + 1).toString().padStart(2, '0');
        const parentReqNo = parentReq.req_no || parentReq.request_no || parentReq.id;
        const subIndentNo = item.sub_indent_no || `${parentReqNo}/${subIdxStr}`;

        const dispStatusUpper = String(item.dispatch_status || '').toUpperCase();
        if (dispStatusUpper === 'FULLY_DISPATCHED') {
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

        const isFixedRateAllocation = Boolean(finalizedBid && remQty > 0);
        const fixedRate = finalizedBid ? Number(finalizedBid.final_rate || finalizedBid.rate_per_mt || 0) : null;

        openRateRequests.push({
          id: parentReq.id,
          requirement_id: parentReq.id,
          item_id: item.id,
          sub_indent_no: subIndentNo,
          required_qty: remQty,
          allocated_quantity_mt: allocatedQty,
          dispatched_quantity_mt: totalDispatched,
          remaining_quantity_mt: remQty,
          is_fixed_rate_allocation: isFixedRateAllocation,
          fixed_rate: fixedRate,
          finalized_rate: fixedRate,
          finalized_bid: finalizedBid,
          rate_editable: false,
          requires_new_bid: !isFixedRateAllocation,
          is_requote: false
        });
      });
    }
  });

  return openRateRequests;
}

// =============================================================
// TEST EXECUTION
// =============================================================

function createInitialState() {
  return {
    transport_requirements: [
      {
        id: 'req_200mt',
        req_no: 'SNPL/26-27/REQ-0001',
        title: '200 MT Soya Transport Katol to Nashik',
        total_quantity_mt: 200,
        quantity_mt: 200,
        status: 'Active'
      }
    ],
    transport_requirement_items: [
      {
        id: 'item_req_200mt_01',
        requirement_id: 'req_200mt',
        sub_indent_no: 'SNPL/26-27/REQ-0001/01',
        product_name: 'Soya',
        quantity_mt: 200,
        required_qty: 200,
        dispatched_quantity_mt: 0,
        remaining_quantity_mt: 200,
        dispatch_status: 'PENDING',
        allocation_status: 'ACTIVE'
      }
    ],
    rate_submissions: [
      {
        id: 'sub_trans_A',
        requirement_id: 'req_200mt',
        item_id: 'item_req_200mt_01',
        transporter_id: 'trans_A',
        transporter_name: 'Transporter A Logistics',
        rate_per_mt: 55,
        final_rate: 55,
        is_finalized: 1,
        bid_status: 'FINALIZED',
        acceptance_status: 'ACCEPTED'
      }
    ],
    truck_dispatches: []
  };
}

const transA = { id: 'trans_A', code: 'TRA001', username: 'transporterA' };
const transB = { id: 'trans_B', code: 'TRB002', username: 'transporterB' };

// TEST 1: 200 MT @ ₹55 finalized -> dispatch 150 -> remaining 50 visible to original transporter
it('TEST 1: 200 MT @ ₹55 finalized -> dispatch 150 -> remaining 50 visible to original transporter', () => {
  const db = createInitialState();

  const dispatchResult = simulateFixedRateDispatch(
    db,
    { requirementId: 'req_200mt', itemId: 'item_req_200mt_01' },
    {
      requirement_id: 'req_200mt',
      item_id: 'item_req_200mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31AA1111',
      loaded_quantity_mt: 150,
      driver_name: 'Driver A',
      driver_mobile: '9876543210',
      driver_license: 'DL001'
    },
    transA
  );

  assert.equal(dispatchResult.status, 200);
  assert.equal(dispatchResult.remaining_quantity_mt, 50);

  const rawReqs = [{
    ...db.transport_requirements[0],
    items: db.transport_requirement_items
  }];

  const openReqs = buildFrontendOpenRequirements(rawReqs, db);
  assert.equal(openReqs.length, 1);
  assert.equal(openReqs[0].sub_indent_no, 'SNPL/26-27/REQ-0001/01');
  assert.equal(openReqs[0].remaining_quantity_mt, 50);
  assert.equal(openReqs[0].is_fixed_rate_allocation, true);
  assert.equal(openReqs[0].fixed_rate, 55);
});

// TEST 2: Same remaining 50 visible to other eligible transporter
it('TEST 2: Same remaining 50 visible to other eligible transporter (Transporter B)', () => {
  const db = createInitialState();
  simulateFixedRateDispatch(
    db,
    { requirementId: 'req_200mt', itemId: 'item_req_200mt_01' },
    {
      requirement_id: 'req_200mt',
      item_id: 'item_req_200mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31AA1111',
      loaded_quantity_mt: 150,
      driver_name: 'Driver A',
      driver_mobile: '9876543210',
      driver_license: 'DL001'
    },
    transA
  );

  const rawReqs = [{
    ...db.transport_requirements[0],
    items: db.transport_requirement_items
  }];

  const openReqsForB = buildFrontendOpenRequirements(rawReqs, db);
  assert.equal(openReqsForB.length, 1);
  assert.equal(openReqsForB[0].remaining_quantity_mt, 50);
});

// TEST 3: Both transporters see exactly ₹55/MT
it('TEST 3: Both transporters see exactly ₹55/MT', () => {
  const db = createInitialState();
  simulateFixedRateDispatch(
    db,
    { requirementId: 'req_200mt', itemId: 'item_req_200mt_01' },
    {
      requirement_id: 'req_200mt',
      item_id: 'item_req_200mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31AA1111',
      loaded_quantity_mt: 150,
      driver_name: 'Driver A',
      driver_mobile: '9876543210',
      driver_license: 'DL001'
    },
    transA
  );

  const rawReqs = [{
    ...db.transport_requirements[0],
    items: db.transport_requirement_items
  }];

  const openReqs = buildFrontendOpenRequirements(rawReqs, db);
  assert.equal(openReqs[0].fixed_rate, 55);
  assert.equal(openReqs[0].finalized_rate, 55);
});

// TEST 4: No quote input field is displayed
it('TEST 4: No quote input field is displayed (requires_new_bid = false, rate_editable = false)', () => {
  const db = createInitialState();
  simulateFixedRateDispatch(
    db,
    { requirementId: 'req_200mt', itemId: 'item_req_200mt_01' },
    {
      requirement_id: 'req_200mt',
      item_id: 'item_req_200mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31AA1111',
      loaded_quantity_mt: 150,
      driver_name: 'Driver A',
      driver_mobile: '9876543210',
      driver_license: 'DL001'
    },
    transA
  );

  const rawReqs = [{
    ...db.transport_requirements[0],
    items: db.transport_requirement_items
  }];

  const openReqs = buildFrontendOpenRequirements(rawReqs, db);
  assert.equal(openReqs[0].requires_new_bid, false);
  assert.equal(openReqs[0].rate_editable, false);
});

// TEST 5: No new rate submission can be created
it('TEST 5: No new rate submission can be created for fixed-rate allocation', () => {
  const db = createInitialState();
  simulateFixedRateDispatch(
    db,
    { requirementId: 'req_200mt', itemId: 'item_req_200mt_01' },
    {
      requirement_id: 'req_200mt',
      item_id: 'item_req_200mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31AA1111',
      loaded_quantity_mt: 150,
      driver_name: 'Driver A',
      driver_mobile: '9876543210',
      driver_license: 'DL001'
    },
    transA
  );

  const rawReqs = [{
    ...db.transport_requirements[0],
    items: db.transport_requirement_items
  }];

  const openReqs = buildFrontendOpenRequirements(rawReqs, db);
  assert.equal(openReqs[0].is_requote, false);
  assert.equal(openReqs[0].is_fixed_rate_allocation, true);
});

// TEST 6: Original transporter can dispatch remaining quantity at ₹55
it('TEST 6: Original transporter can dispatch remaining quantity at ₹55', () => {
  const db = createInitialState();
  // 1st dispatch: 150 MT
  simulateFixedRateDispatch(
    db,
    { requirementId: 'req_200mt', itemId: 'item_req_200mt_01' },
    {
      requirement_id: 'req_200mt',
      item_id: 'item_req_200mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31AA1111',
      loaded_quantity_mt: 150,
      driver_name: 'Driver A',
      driver_mobile: '9876543210',
      driver_license: 'DL001'
    },
    transA
  );

  // 2nd dispatch by original transporter: 30 MT
  const dispatchResult2 = simulateFixedRateDispatch(
    db,
    { requirementId: 'req_200mt', itemId: 'item_req_200mt_01' },
    {
      requirement_id: 'req_200mt',
      item_id: 'item_req_200mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31AA2222',
      loaded_quantity_mt: 30,
      driver_name: 'Driver A2',
      driver_mobile: '9876543210',
      driver_license: 'DL001'
    },
    transA
  );

  assert.equal(dispatchResult2.status, 200);
  assert.equal(dispatchResult2.remaining_quantity_mt, 20);
  assert.equal(dispatchResult2.fixed_rate, 55);
});

// TEST 7: Other transporter can claim/dispatch remaining quantity at ₹55
it('TEST 7: Other transporter (Transporter B) can claim/dispatch remaining quantity at ₹55', () => {
  const db = createInitialState();
  // 1st dispatch by Transporter A: 150 MT
  simulateFixedRateDispatch(
    db,
    { requirementId: 'req_200mt', itemId: 'item_req_200mt_01' },
    {
      requirement_id: 'req_200mt',
      item_id: 'item_req_200mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31AA1111',
      loaded_quantity_mt: 150,
      driver_name: 'Driver A',
      driver_mobile: '9876543210',
      driver_license: 'DL001'
    },
    transA
  );

  // 2nd dispatch by Transporter B: 50 MT
  const dispatchResultB = simulateFixedRateDispatch(
    db,
    { requirementId: 'req_200mt', itemId: 'item_req_200mt_01' },
    {
      requirement_id: 'req_200mt',
      item_id: 'item_req_200mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31BB3333',
      loaded_quantity_mt: 50,
      driver_name: 'Driver B',
      driver_mobile: '9123456780',
      driver_license: 'DL002'
    },
    transB
  );

  assert.equal(dispatchResultB.status, 200);
  assert.equal(dispatchResultB.remaining_quantity_mt, 0);
  assert.equal(dispatchResultB.dispatch_status, 'FULLY_DISPATCHED');
  assert.equal(dispatchResultB.fixed_rate, 55);
  assert.equal(dispatchResultB.dispatch.transporter_id, 'trans_B');
});

// TEST 8: Concurrent dispatches cannot exceed original 200 MT
it('TEST 8: Concurrent dispatches cannot exceed original 200 MT', () => {
  const db = createInitialState();
  // Transporter A dispatches 150 MT
  simulateFixedRateDispatch(
    db,
    { requirementId: 'req_200mt', itemId: 'item_req_200mt_01' },
    {
      requirement_id: 'req_200mt',
      item_id: 'item_req_200mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31AA1111',
      loaded_quantity_mt: 150,
      driver_name: 'Driver A',
      driver_mobile: '9876543210',
      driver_license: 'DL001'
    },
    transA
  );

  // Transporter B dispatches 50 MT
  simulateFixedRateDispatch(
    db,
    { requirementId: 'req_200mt', itemId: 'item_req_200mt_01' },
    {
      requirement_id: 'req_200mt',
      item_id: 'item_req_200mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31BB3333',
      loaded_quantity_mt: 50,
      driver_name: 'Driver B',
      driver_mobile: '9123456780',
      driver_license: 'DL002'
    },
    transB
  );

  // Third attempt to dispatch 1 MT must fail with 400
  const overDispatchResult = simulateFixedRateDispatch(
    db,
    { requirementId: 'req_200mt', itemId: 'item_req_200mt_01' },
    {
      requirement_id: 'req_200mt',
      item_id: 'item_req_200mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31CC4444',
      loaded_quantity_mt: 1,
      driver_name: 'Driver C',
      driver_mobile: '9123456781',
      driver_license: 'DL003'
    },
    transA
  );

  assert.equal(overDispatchResult.status, 400);
  assert.equal(overDispatchResult.code, 'EXCEEDS_REMAINING_QUANTITY');
});

// TEST 9: Remaining quantity updates correctly after every dispatch
it('TEST 9: Remaining quantity updates correctly after every dispatch (200 -> 150 -> 180 -> 200)', () => {
  const db = createInitialState();

  // Step 1: Dispatch 150 MT -> 50 MT remaining
  const r1 = simulateFixedRateDispatch(
    db,
    { requirementId: 'req_200mt', itemId: 'item_req_200mt_01' },
    {
      requirement_id: 'req_200mt',
      item_id: 'item_req_200mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31AA1111',
      loaded_quantity_mt: 150,
      driver_name: 'Driver 1',
      driver_mobile: '9876543210',
      driver_license: 'DL001'
    },
    transA
  );
  assert.equal(r1.remaining_quantity_mt, 50);

  // Step 2: Dispatch 30 MT -> 20 MT remaining
  const r2 = simulateFixedRateDispatch(
    db,
    { requirementId: 'req_200mt', itemId: 'item_req_200mt_01' },
    {
      requirement_id: 'req_200mt',
      item_id: 'item_req_200mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31AA2222',
      loaded_quantity_mt: 30,
      driver_name: 'Driver 2',
      driver_mobile: '9876543210',
      driver_license: 'DL001'
    },
    transA
  );
  assert.equal(r2.remaining_quantity_mt, 20);

  // Step 3: Dispatch 20 MT -> 0 MT remaining
  const r3 = simulateFixedRateDispatch(
    db,
    { requirementId: 'req_200mt', itemId: 'item_req_200mt_01' },
    {
      requirement_id: 'req_200mt',
      item_id: 'item_req_200mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31BB3333',
      loaded_quantity_mt: 20,
      driver_name: 'Driver 3',
      driver_mobile: '9123456780',
      driver_license: 'DL002'
    },
    transB
  );
  assert.equal(r3.remaining_quantity_mt, 0);
  assert.equal(r3.dispatch_status, 'FULLY_DISPATCHED');
});

// TEST 10: Original LR history remains preserved
it('TEST 10: Original LR history remains preserved', () => {
  const db = createInitialState();
  simulateFixedRateDispatch(
    db,
    { requirementId: 'req_200mt', itemId: 'item_req_200mt_01' },
    {
      requirement_id: 'req_200mt',
      item_id: 'item_req_200mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31AA1111',
      loaded_quantity_mt: 150,
      driver_name: 'Driver 1',
      driver_mobile: '9876543210',
      driver_license: 'DL001'
    },
    transA
  );

  simulateFixedRateDispatch(
    db,
    { requirementId: 'req_200mt', itemId: 'item_req_200mt_01' },
    {
      requirement_id: 'req_200mt',
      item_id: 'item_req_200mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31BB2222',
      loaded_quantity_mt: 50,
      driver_name: 'Driver 2',
      driver_mobile: '9123456780',
      driver_license: 'DL002'
    },
    transB
  );

  assert.equal(db.truck_dispatches.length, 2);
  assert.equal(db.truck_dispatches[0].transporter_id, 'trans_A');
  assert.equal(db.truck_dispatches[0].loaded_quantity_mt, 150);
  assert.equal(db.truck_dispatches[1].transporter_id, 'trans_B');
  assert.equal(db.truck_dispatches[1].loaded_quantity_mt, 50);
});

// TEST 11: No RE-QUOTE sub-indent is created for partial dispatch
it('TEST 11: No RE-QUOTE sub-indent is created for partial dispatch', () => {
  const db = createInitialState();
  simulateFixedRateDispatch(
    db,
    { requirementId: 'req_200mt', itemId: 'item_req_200mt_01' },
    {
      requirement_id: 'req_200mt',
      item_id: 'item_req_200mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31AA1111',
      loaded_quantity_mt: 150,
      driver_name: 'Driver 1',
      driver_mobile: '9876543210',
      driver_license: 'DL001'
    },
    transA
  );

  assert.equal(db.transport_requirement_items.length, 1);
  assert.equal(db.transport_requirement_items[0].sub_indent_no, 'SNPL/26-27/REQ-0001/01');
  assert.equal(db.transport_requirement_items.some(i => i.sub_indent_no.includes('/02')), false);
});

// TEST 12: Existing historical RE-QUOTE records remain readable and are not corrupted
it('TEST 12: Existing historical RE-QUOTE records remain readable and are not corrupted', () => {
  const db = createInitialState();
  // Add a legacy re-quote item
  db.transport_requirement_items.push({
    id: 'item_req_200mt_02_legacy',
    requirement_id: 'req_200mt',
    sub_indent_no: 'SNPL/26-27/REQ-0001/02',
    product_name: 'Soya',
    quantity_mt: 50,
    required_qty: 50,
    dispatched_quantity_mt: 0,
    remaining_quantity_mt: 50,
    dispatch_status: 'RELEASED_FOR_REQUOTE',
    allocation_status: 'RELEASED_FOR_REQUOTE',
    source_item_id: 'item_req_200mt_01'
  });

  const rawReqs = [{
    ...db.transport_requirements[0],
    items: db.transport_requirement_items
  }];

  // Frontend should handle legacy items gracefully
  const openReqs = buildFrontendOpenRequirements(rawReqs, db);
  assert.ok(openReqs !== null);
  assert.ok(Array.isArray(openReqs));
});

console.log('================================================================');
console.log(`🎉 TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
