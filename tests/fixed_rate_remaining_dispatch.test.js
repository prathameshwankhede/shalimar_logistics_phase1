// ============================================================================
// WINNING LOW-RATE TRANSPORTER ISOLATION & AWARDED CONTRACT TEST SUITE
// ============================================================================

import assert from 'assert';

console.log('================================================================');
console.log('🧪 RUNNING WINNING LOW-RATE TRANSPORTER AWARDED CONTRACT TEST SUITE');
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
// Pure Simulator for Backend Dispatch Resolution
// -------------------------------------------------------------
function simulateDispatch(dbState, params, body, authUser) {
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

  // Strict verification: ONLY the winning transporter who quoted the low finalized rate can dispatch!
  const transMatchIds = [authUser.id, authUser.code, authUser.username].filter(Boolean);
  const isWinningTransporter = transMatchIds.some(id => String(id) === String(finalizedSub.transporter_id));
  if (!isWinningTransporter) {
    return {
      status: 403,
      success: false,
      code: 'FORBIDDEN_NOT_WINNING_TRANSPORTER',
      error: 'Access denied. You are not the finalized winning transporter for this requirement.'
    };
  }

  const finalRateVal = parseFloat(finalizedSub.final_rate || finalizedSub.rate_per_mt || 0);

  // 4. Compute Total Item Quantity
  let totalItemQty = 0;
  if (originalItemRec) {
    totalItemQty = parseFloat(originalItemRec.quantity_mt || originalItemRec.required_qty || 0);
  } else {
    totalItemQty = parseFloat(parentReq.quantity_mt || parentReq.total_quantity_mt || 0);
  }

  // 5. Calculate Already Dispatched
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

  // 7. Update Item and Parent
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
    message: `Truck dispatched successfully! LR: ${lrNumber}.`,
    dispatch: dispatchRecord,
    lr_number: lrNumber,
    loaded_quantity_mt: loadedQty,
    dispatched_quantity_mt: newTotalDispatched,
    remaining_quantity_mt: newRemaining,
    fixed_rate: finalRateVal,
    finalized_rate: finalRateVal,
    dispatch_status: newRemaining > 0 ? 'PARTIALLY_DISPATCHED' : 'FULLY_DISPATCHED',
    is_partial: newRemaining > 0
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
        if (dispStatusUpper === 'FULLY_DISPATCHED' || dispStatusUpper === 'COMPLETED') {
          return;
        }

        // Finalized check: Finalized items MUST NOT appear in open bidding
        const itemAcceptedByAnyone = (dbState.rate_submissions || []).some((s) => {
          if (!s) return false;
          const sReqMatch = String(s.requirement_id) === String(parentReq.id) || String(s.rate_request_id) === String(parentReq.id) || String(s.rate_request_id) === String(parentReqNo);
          const sItemMatch = String(s.item_id) === String(item.id) || String(s.item_id) === String(subIndentNo);
          return sReqMatch && sItemMatch && (Boolean(s.is_finalized) || String(s.bid_status).toUpperCase() === 'FINALIZED' || Number(s.final_rate) > 0);
        });

        if (itemAcceptedByAnyone) {
          return; // Finalized items go ONLY to the winning low-rate transporter under Awarded Contracts
        }

        openRateRequests.push({
          id: parentReq.id,
          requirement_id: parentReq.id,
          item_id: item.id,
          sub_indent_no: subIndentNo,
          required_qty: item.quantity_mt
        });
      });
    }
  });

  return openRateRequests;
}

// -------------------------------------------------------------
// Pure Simulator for Awarded Contracts DTO Builder
// -------------------------------------------------------------
function buildFrontendAwardedContracts(rawRequirements, dbState, transporter) {
  const awardedContracts = [];
  const transMatchIds = [transporter.id, transporter.code, transporter.username].filter(Boolean);

  rawRequirements.forEach((parentReq) => {
    const childItems = parentReq.items || [];
    childItems.forEach((child) => {
      const myBid = (dbState.rate_submissions || []).find((s) => {
        const reqMatch = String(s.requirement_id) === String(parentReq.id) || String(s.rate_request_id) === String(parentReq.id);
        const itemMatch = String(s.item_id) === String(child.id) || String(s.item_id) === String(child.sub_indent_no);
        const transMatch = transMatchIds.includes(s.transporter_id);
        const isFin = Boolean(s.is_finalized) || String(s.bid_status).toUpperCase() === 'FINALIZED' || Number(s.final_rate) > 0;
        return reqMatch && itemMatch && transMatch && isFin;
      });

      if (myBid) {
        awardedContracts.push({
          parentReq,
          item: child,
          myBid
        });
      }
    });
  });

  return awardedContracts;
}

// =============================================================
// TEST SUITE EXECUTION
// =============================================================

function createInitialState() {
  return {
    transport_requirements: [
      {
        id: 'req_44mt',
        req_no: 'SNPL/26-27/REQ-0001',
        title: '44 MT Soya Transport Katol to Nashik',
        total_quantity_mt: 44,
        quantity_mt: 44,
        status: 'Active'
      }
    ],
    transport_requirement_items: [
      {
        id: 'item_req_44mt_01',
        requirement_id: 'req_44mt',
        sub_indent_no: 'SNPL/26-27/REQ-0001/01',
        product_name: 'soya',
        quantity_mt: 44,
        required_qty: 44,
        dispatched_quantity_mt: 0,
        remaining_quantity_mt: 44,
        dispatch_status: 'PENDING',
        allocation_status: 'ACTIVE'
      }
    ],
    rate_submissions: [
      {
        id: 'sub_trans_A',
        requirement_id: 'req_44mt',
        item_id: 'item_req_44mt_01',
        transporter_id: 'trans_A',
        transporter_name: 'Lowest Rate Transporter A',
        rate_per_mt: 44,
        final_rate: 44,
        is_finalized: 1,
        bid_status: 'FINALIZED',
        acceptance_status: 'ACCEPTED'
      },
      {
        id: 'sub_trans_B',
        requirement_id: 'req_44mt',
        item_id: 'item_req_44mt_01',
        transporter_id: 'trans_B',
        transporter_name: 'Higher Rate Transporter B',
        rate_per_mt: 50,
        final_rate: null,
        is_finalized: 0,
        bid_status: 'SUBMITTED',
        acceptance_status: null
      }
    ],
    truck_dispatches: []
  };
}

const transA = { id: 'trans_A', code: 'TRA001', username: 'transporterA' }; // WINNING LOW-RATE TRANSPORTER
const transB = { id: 'trans_B', code: 'TRB002', username: 'transporterB' }; // LOSING / OTHER TRANSPORTER

it('TEST 1: Finalized requirement disappears from "Available Freight Requirements for Bidding"', () => {
  const db = createInitialState();
  const rawReqs = [{ ...db.transport_requirements[0], items: db.transport_requirement_items }];

  const openReqs = buildFrontendOpenRequirements(rawReqs, db);
  assert.equal(openReqs.length, 0, 'Finalized requirement is NOT shown in open bidding for anyone');
});

it('TEST 2: ONLY winning low-rate Transporter A sees the contract in "Awarded Contracts & Dispatch"', () => {
  const db = createInitialState();
  const rawReqs = [{ ...db.transport_requirements[0], items: db.transport_requirement_items }];

  const awardedA = buildFrontendAwardedContracts(rawReqs, db, transA);
  assert.equal(awardedA.length, 1, 'Winning Transporter A sees the awarded contract');
  assert.equal(awardedA[0].item.sub_indent_no, 'SNPL/26-27/REQ-0001/01');
  assert.equal(awardedA[0].myBid.final_rate, 44);
});

it('TEST 3: Other / losing Transporter B does NOT see the contract in "Awarded Contracts & Dispatch"', () => {
  const db = createInitialState();
  const rawReqs = [{ ...db.transport_requirements[0], items: db.transport_requirement_items }];

  const awardedB = buildFrontendAwardedContracts(rawReqs, db, transB);
  assert.equal(awardedB.length, 0, 'Losing Transporter B does NOT see the awarded contract');
});

it('TEST 4: Winning Transporter A can successfully dispatch truck at finalized ₹44/MT', () => {
  const db = createInitialState();
  const dispatchRes = simulateDispatch(
    db,
    { requirementId: 'req_44mt', itemId: 'item_req_44mt_01' },
    {
      requirement_id: 'req_44mt',
      item_id: 'item_req_44mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31AA1111',
      loaded_quantity_mt: 40,
      driver_name: 'Driver 1',
      driver_mobile: '9876543210',
      driver_license: 'DL12345'
    },
    transA
  );

  assert.equal(dispatchRes.status, 200);
  assert.equal(dispatchRes.remaining_quantity_mt, 4);
  assert.equal(dispatchRes.fixed_rate, 44);
});

it('TEST 5: Other Transporter B is strictly BLOCKED with 403 FORBIDDEN_NOT_WINNING_TRANSPORTER', () => {
  const db = createInitialState();
  const dispatchRes = simulateDispatch(
    db,
    { requirementId: 'req_44mt', itemId: 'item_req_44mt_01' },
    {
      requirement_id: 'req_44mt',
      item_id: 'item_req_44mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31BB2222',
      loaded_quantity_mt: 40,
      driver_name: 'Driver 2',
      driver_mobile: '9876543211',
      driver_license: 'DL67890'
    },
    transB
  );

  assert.equal(dispatchRes.status, 403);
  assert.equal(dispatchRes.code, 'FORBIDDEN_NOT_WINNING_TRANSPORTER');
});

it('TEST 6: After partial dispatch (40 MT of 44 MT), remaining 4 MT remains exclusively with Transporter A', () => {
  const db = createInitialState();
  // Transporter A dispatches 40 MT
  simulateDispatch(
    db,
    { requirementId: 'req_44mt', itemId: 'item_req_44mt_01' },
    {
      requirement_id: 'req_44mt',
      item_id: 'item_req_44mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31AA1111',
      loaded_quantity_mt: 40,
      driver_name: 'Driver 1',
      driver_mobile: '9876543210',
      driver_license: 'DL12345'
    },
    transA
  );

  const rawReqs = [{ ...db.transport_requirements[0], items: db.transport_requirement_items }];

  // 1. Not in open bidding for anyone
  const openReqs = buildFrontendOpenRequirements(rawReqs, db);
  assert.equal(openReqs.length, 0);

  // 2. Transporter A sees remaining 4 MT under Awarded Contracts
  const awardedA = buildFrontendAwardedContracts(rawReqs, db, transA);
  assert.equal(awardedA.length, 1);
  assert.equal(awardedA[0].item.remaining_quantity_mt, 4);

  // 3. Transporter A dispatches the remaining 4 MT
  const dispatchRes2 = simulateDispatch(
    db,
    { requirementId: 'req_44mt', itemId: 'item_req_44mt_01' },
    {
      requirement_id: 'req_44mt',
      item_id: 'item_req_44mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31AA2222',
      loaded_quantity_mt: 4,
      driver_name: 'Driver 1B',
      driver_mobile: '9876543210',
      driver_license: 'DL12345'
    },
    transA
  );
  assert.equal(dispatchRes2.status, 200);
  assert.equal(dispatchRes2.remaining_quantity_mt, 0);
  assert.equal(dispatchRes2.dispatch_status, 'FULLY_DISPATCHED');
});

console.log('================================================================');
console.log(`🎉 TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
