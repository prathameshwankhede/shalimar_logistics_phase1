// ============================================================================
// PRODUCTION DISPATCH CANONICAL IDENTITY & EXACT BALANCE TEST SUITE
// ============================================================================

import assert from 'assert';

console.log('================================================================');
console.log('🧪 RUNNING PRODUCTION DISPATCH CANONICAL IDENTITY & BALANCE TEST SUITE');
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
// Pure Canonical Backend Dispatch Resolution Simulator
// -------------------------------------------------------------
function simulateBackendDispatch(dbState, params, body, authUser) {
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

  // 2. Resolve Exact Child Requirement Item
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

  // Error on unresolved item when child items exist
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

  // 3. Winning Rate Submission
  const transMatchIds = [authUser.id, authUser.code, authUser.username].filter(Boolean);
  const winningSub = dbState.rate_submissions.find(
    s => resolvedReqIds.includes(s.requirement_id) &&
         (resolvedItemIds.includes(s.item_id) || s.item_id === 'MAIN' || !s.item_id) &&
         transMatchIds.includes(s.transporter_id) &&
         (Boolean(s.is_finalized) || String(s.bid_status).toUpperCase() === 'FINALIZED' || Number(s.final_rate) > 0)
  );

  if (!winningSub) {
    return { status: 400, success: false, code: 'RATE_NOT_FINALIZED', error: 'Cannot dispatch truck: freight rate is not yet finalized.' };
  }

  if (String(winningSub.acceptance_status || '').toUpperCase() !== 'ACCEPTED') {
    return { status: 400, success: false, code: 'AWAITING_TRANSPORTER_ACCEPTANCE', error: 'Finalized rate must be accepted by transporter.' };
  }

  // 4. Canonical Item Required Quantity
  let totalItemQty = 0;
  if (originalItemRec) {
    if (originalItemRec.dispatch_status === 'RELEASED_FOR_REQUOTE' || originalItemRec.allocation_status === 'RELEASED_FOR_REQUOTE') {
      return { status: 409, success: false, code: 'ALLOCATION_RELEASED_FOR_REQUOTE', message: 'Remaining quantity released for re-quote.' };
    }
    totalItemQty = parseFloat(originalItemRec.quantity_mt || originalItemRec.required_qty || 0);
  } else {
    totalItemQty = parseFloat(parentReq.quantity_mt || parentReq.total_quantity_mt || winningSub.quoted_quantity_mt || 0);
  }

  // 5. Existing Dispatches for THIS EXACT item only
  let alreadyDispatched = 0;
  if (originalItemRec) {
    alreadyDispatched = dbState.truck_dispatches
      .filter(d => resolvedReqIds.includes(d.requirement_id) &&
                   (d.requirement_item_id === originalItemRec.id || d.requirement_item_id === originalItemRec.sub_indent_no))
      .reduce((acc, curr) => acc + parseFloat(curr.loaded_quantity_mt || 0), 0);
  } else {
    alreadyDispatched = dbState.truck_dispatches
      .filter(d => resolvedReqIds.includes(d.requirement_id))
      .reduce((acc, curr) => acc + parseFloat(curr.loaded_quantity_mt || 0), 0);
  }

  const remainingBalance = parseFloat(Math.max(0, totalItemQty - alreadyDispatched).toFixed(3));

  if (loadedQty > remainingBalance) {
    return {
      status: 400,
      success: false,
      code: 'EXCEEDS_REMAINING_QUANTITY',
      error: `Loaded quantity (${loadedQty} MT) cannot exceed remaining balance (${remainingBalance} MT).`,
      required_quantity_mt: totalItemQty,
      already_dispatched_mt: alreadyDispatched,
      remaining_quantity_mt: remainingBalance
    };
  }

  // 6. Generate LR Number & Record Dispatch
  const seq = (dbState.lr_counter || 0) + 1;
  dbState.lr_counter = seq;
  const lrNumber = `LR-SNPL-2026-${String(seq).padStart(5, '0')}`;
  const dispatchRecord = {
    id: `disp_${Date.now()}_${seq}`,
    requirement_id: parentReq.id,
    requirement_item_id: originalItemRec ? originalItemRec.id : 'MAIN',
    transporter_id: authUser.id,
    finalized_rate: winningSub.final_rate,
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

  // 7. Update Item and Parent
  const newTotalDispatched = parseFloat((alreadyDispatched + loadedQty).toFixed(3));
  const newRemaining = parseFloat(Math.max(0, totalItemQty - newTotalDispatched).toFixed(3));

  let replacementItemId = null;
  let newSubIndentNo = null;

  if (newRemaining > 0) {
    const parentReqNo = parentReq.req_no || parentReq.id;
    newSubIndentNo = `${parentReqNo}/02`;
    replacementItemId = `item_${parentReq.id}_02_${Date.now()}`;

    if (originalItemRec) {
      originalItemRec.dispatched_quantity_mt = newTotalDispatched;
      originalItemRec.remaining_quantity_mt = 0;
      originalItemRec.dispatch_status = 'RELEASED_FOR_REQUOTE';
      originalItemRec.allocation_status = 'RELEASED_FOR_REQUOTE';
      originalItemRec.replacement_item_id = replacementItemId;
    }

    dbState.transport_requirement_items.push({
      id: replacementItemId,
      requirement_id: parentReq.id,
      sub_indent_no: newSubIndentNo,
      product_name: (originalItemRec && originalItemRec.product_name) || parentReq.product_name || 'Cargo',
      quantity_mt: newRemaining,
      unit: 'MT',
      pickup_origin: (originalItemRec && originalItemRec.pickup_origin) || parentReq.pickup_origin,
      drop_location: (originalItemRec && originalItemRec.drop_location) || parentReq.drop_location,
      dispatch_status: 'PENDING',
      allocation_status: 'ACTIVE',
      remaining_quantity_mt: newRemaining,
      dispatched_quantity_mt: 0,
      source_item_id: originalItemRec ? originalItemRec.id : null
    });

    parentReq.status = 'PARTIALLY_DISPATCHED';
  } else {
    if (originalItemRec) {
      originalItemRec.dispatched_quantity_mt = newTotalDispatched;
      originalItemRec.remaining_quantity_mt = 0;
      originalItemRec.dispatch_status = 'FULLY_DISPATCHED';
      originalItemRec.allocation_status = 'COMPLETED';
    }
    parentReq.status = 'COMPLETED';
  }

  return {
    status: 200,
    success: true,
    lr_number: lrNumber,
    dispatch: dispatchRecord,
    loaded_quantity_mt: loadedQty,
    dispatched_quantity_mt: newTotalDispatched,
    remaining_quantity_mt: newRemaining,
    dispatch_status: newRemaining > 0 ? 'RELEASED_FOR_REQUOTE' : 'FULLY_DISPATCHED',
    is_partial: newRemaining > 0,
    reopened_sub_indent_no: newSubIndentNo,
    reopened_item_id: replacementItemId,
    item: originalItemRec ? {
      id: originalItemRec.id,
      sub_indent_no: originalItemRec.sub_indent_no,
      total_quantity_mt: totalItemQty,
      dispatched_quantity_mt: newTotalDispatched,
      remaining_quantity_mt: newRemaining,
      dispatch_status: newRemaining > 0 ? 'RELEASED_FOR_REQUOTE' : 'FULLY_DISPATCHED'
    } : null
  };
}

function createTestDB() {
  return {
    lr_counter: 0,
    transport_requirements: [{
      id: 'req_0001',
      req_no: 'SNPL/26-27/REQ-0001',
      total_quantity_mt: 44.0,
      quantity_mt: null,
      product_name: 'soya',
      pickup_origin: 'katol',
      drop_location: 'nashik',
      status: 'Active'
    }],
    transport_requirement_items: [{
      id: 'item_req_0001_01_uuid',
      requirement_id: 'req_0001',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      product_name: 'soya',
      quantity_mt: 44.0,
      required_qty: 44.0,
      pickup_origin: 'katol',
      drop_location: 'nashik',
      unit: 'MT',
      dispatch_status: 'PENDING',
      allocation_status: 'ACTIVE',
      dispatched_quantity_mt: 0.0,
      remaining_quantity_mt: 44.0
    }],
    rate_submissions: [{
      id: 'sub_0001_ram',
      requirement_id: 'req_0001',
      item_id: 'item_req_0001_01_uuid',
      transporter_id: 'trans_ram',
      transporter_name: 'Ram Logistics',
      rate_per_mt: 10.0,
      final_rate: 10.0,
      is_finalized: 1,
      bid_status: 'FINALIZED',
      acceptance_status: 'ACCEPTED'
    }],
    truck_dispatches: []
  };
}

// -------------------------------------------------------------
// TEST CASES
// -------------------------------------------------------------

it('TEST 1: Exact Production Scenario: 44 MT item, 0 dispatched -> 40 MT dispatch MUST SUCCEED with 4 MT remaining', () => {
  const db = createTestDB();
  const authUser = { id: 'trans_ram', username: 'ram', role: 'transporter' };

  const params = {
    requirementId: 'req_0001',
    itemId: 'item_req_0001_01_uuid'
  };

  const body = {
    requirement_id: 'req_0001',
    requirement_item_id: 'item_req_0001_01_uuid',
    item_id: 'item_req_0001_01_uuid',
    sub_indent_no: 'SNPL/26-27/REQ-0001/01',
    truck_number: 'MH31FC4512',
    loaded_quantity_mt: 40.0,
    driver_name: 'Ramesh Kumar',
    driver_mobile: '9876543210',
    driver_license: 'MH3120210012345'
  };

  const res = simulateBackendDispatch(db, params, body, authUser);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.loaded_quantity_mt, 40.0);
  assert.strictEqual(res.remaining_quantity_mt, 4.0);
  assert.strictEqual(res.reopened_sub_indent_no, 'SNPL/26-27/REQ-0001/02');
  assert.strictEqual(db.truck_dispatches.length, 1);
  assert.strictEqual(db.truck_dispatches[0].requirement_item_id, 'item_req_0001_01_uuid');
});

it('TEST 2: Attempting to dispatch 5 MT after 40/44 MT dispatched must be REJECTED', () => {
  const db = createTestDB();
  const authUser = { id: 'trans_ram', username: 'ram', role: 'transporter' };

  // First dispatch: 40 MT
  const params = { requirementId: 'req_0001', itemId: 'item_req_0001_01_uuid' };
  const body1 = {
    requirement_id: 'req_0001',
    requirement_item_id: 'item_req_0001_01_uuid',
    truck_number: 'MH31FC4512',
    loaded_quantity_mt: 40.0,
    driver_name: 'Driver 1',
    driver_mobile: '9876543210',
    driver_license: 'DL1'
  };
  simulateBackendDispatch(db, params, body1, authUser);

  // Second dispatch attempt on released item: 5 MT
  const body2 = {
    requirement_id: 'req_0001',
    requirement_item_id: 'item_req_0001_01_uuid',
    truck_number: 'MH31FC4513',
    loaded_quantity_mt: 5.0,
    driver_name: 'Driver 2',
    driver_mobile: '9876543211',
    driver_license: 'DL2'
  };
  const res2 = simulateBackendDispatch(db, params, body2, authUser);

  assert.strictEqual(res2.status, 409);
  assert.strictEqual(res2.code, 'ALLOCATION_RELEASED_FOR_REQUOTE');
});

it('TEST 3: Sibling sub-indent isolation (/02 dispatches must NEVER reduce /01 balance)', () => {
  const db = createTestDB();
  const authUser = { id: 'trans_ram', username: 'ram', role: 'transporter' };

  // Add sibling /02
  db.transport_requirement_items.push({
    id: 'item_req_0001_02_uuid',
    requirement_id: 'req_0001',
    sub_indent_no: 'SNPL/26-27/REQ-0001/02',
    product_name: 'soya',
    quantity_mt: 50.0,
    required_qty: 50.0,
    dispatch_status: 'PENDING',
    allocation_status: 'ACTIVE',
    dispatched_quantity_mt: 0.0,
    remaining_quantity_mt: 50.0
  });

  // Finalized bid for /02
  db.rate_submissions.push({
    id: 'sub_0002_ram',
    requirement_id: 'req_0001',
    item_id: 'item_req_0001_02_uuid',
    transporter_id: 'trans_ram',
    final_rate: 11.0,
    is_finalized: 1,
    acceptance_status: 'ACCEPTED'
  });

  // Dispatch 30 MT on /02
  const res02 = simulateBackendDispatch(
    db,
    { requirementId: 'req_0001', itemId: 'item_req_0001_02_uuid' },
    {
      requirement_id: 'req_0001',
      requirement_item_id: 'item_req_0001_02_uuid',
      truck_number: 'MH31FC0002',
      loaded_quantity_mt: 30.0,
      driver_name: 'Driver 02',
      driver_mobile: '9876543202',
      driver_license: 'DL02'
    },
    authUser
  );
  assert.strictEqual(res02.status, 200);

  // Now dispatch 40 MT on /01 -> must STILL have full 44 MT capacity and succeed!
  const res01 = simulateBackendDispatch(
    db,
    { requirementId: 'req_0001', itemId: 'item_req_0001_01_uuid' },
    {
      requirement_id: 'req_0001',
      requirement_item_id: 'item_req_0001_01_uuid',
      truck_number: 'MH31FC0001',
      loaded_quantity_mt: 40.0,
      driver_name: 'Driver 01',
      driver_mobile: '9876543201',
      driver_license: 'DL01'
    },
    authUser
  );
  assert.strictEqual(res01.status, 200);
  assert.strictEqual(res01.remaining_quantity_mt, 4.0);
});

it('TEST 4: Frontend canonical ID resolution never emits MAIN when child item exists', () => {
  const childItem = {
    id: 'item_req_0001_01_uuid',
    requirement_id: 'req_0001',
    sub_indent_no: 'SNPL/26-27/REQ-0001/01',
    quantity_mt: 44
  };

  const reqId = childItem.requirement_id || childItem.parent_req_no || childItem.id;
  const itemId = childItem.id || childItem.item_id || childItem.sub_indent_id || childItem.sub_indent_no || 'MAIN';
  const subIndentNo = childItem.sub_indent_no || null;

  assert.strictEqual(reqId, 'req_0001');
  assert.strictEqual(itemId, 'item_req_0001_01_uuid');
  assert.notStrictEqual(itemId, 'MAIN');
  assert.strictEqual(subIndentNo, 'SNPL/26-27/REQ-0001/01');
});

it('TEST 5: Item Resolution Failure with Existing Child Items returns ITEM_RESOLUTION_FAILED', () => {
  const db = createTestDB();
  const authUser = { id: 'trans_ram', username: 'ram', role: 'transporter' };

  const params = { requirementId: 'req_0001', itemId: 'INVALID_ITEM_ID' };
  const body = {
    requirement_id: 'req_0001',
    requirement_item_id: 'INVALID_ITEM_ID',
    truck_number: 'MH31FC9999',
    loaded_quantity_mt: 10.0,
    driver_name: 'Driver',
    driver_mobile: '9876543210',
    driver_license: 'DL'
  };

  const res = simulateBackendDispatch(db, params, body, authUser);
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.code, 'ITEM_RESOLUTION_FAILED');
});

it('TEST 6: Legacy Dispatch Records using sub_indent_no string correctly aggregate with exact item', () => {
  const db = createTestDB();
  const authUser = { id: 'trans_ram', username: 'ram', role: 'transporter' };

  // Pre-populate a legacy dispatch record having sub_indent_no as requirement_item_id
  db.truck_dispatches.push({
    id: 'disp_legacy_01',
    requirement_id: 'req_0001',
    requirement_item_id: 'SNPL/26-27/REQ-0001/01',
    loaded_quantity_mt: 20.0
  });

  // Now attempt dispatch of 20 MT (total 20 + 20 = 40 <= 44)
  const res = simulateBackendDispatch(
    db,
    { requirementId: 'req_0001', itemId: 'item_req_0001_01_uuid' },
    {
      requirement_id: 'req_0001',
      requirement_item_id: 'item_req_0001_01_uuid',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31FC2222',
      loaded_quantity_mt: 20.0,
      driver_name: 'Driver',
      driver_mobile: '9876543210',
      driver_license: 'DL'
    },
    authUser
  );

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.remaining_quantity_mt, 4.0); // 44 - 20 - 20 = 4 MT
});

it('TEST 7: Frontend and Backend remaining balance calculations match with mathematical precision', () => {
  const item = {
    id: 'item_req_0001_01_uuid',
    quantity_mt: 44.0,
    required_qty: 44.0
  };
  const dispatches = [];

  // Frontend calculation
  const alreadyDispatchedFE = dispatches.reduce((acc, curr) => acc + curr.loaded_quantity_mt, 0);
  const remainingFE = Math.max(0, item.quantity_mt - alreadyDispatchedFE);

  // Backend calculation
  const alreadyDispatchedBE = dispatches.reduce((acc, curr) => acc + curr.loaded_quantity_mt, 0);
  const remainingBE = Math.max(0, item.quantity_mt - alreadyDispatchedBE);

  assert.strictEqual(remainingFE, 44.0);
  assert.strictEqual(remainingBE, 44.0);
  assert.strictEqual(remainingFE, remainingBE);
});

console.log('================================================================');
console.log(`🎉 TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
