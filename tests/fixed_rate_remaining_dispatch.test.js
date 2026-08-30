// ============================================================================
// WINNING LOW-RATE TRANSPORTER FIXED FORMAT & ISOLATION TEST SUITE
// ============================================================================

import assert from 'assert';

console.log('================================================================');
console.log('🧪 RUNNING WINNING LOW-RATE TRANSPORTER FIXED FORMAT TEST SUITE');
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

        if (finalizedBid) {
          isFixedRateAllocation = true;
          fixedRate = Number(finalizedBid.final_rate || finalizedBid.rate_per_mt || 0);
          myWinningBid = finalizedBid;
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
          fixed_rate: fixedRate,
          finalized_rate: fixedRate,
          finalized_bid: myWinningBid,
          rate_editable: false,
          requires_new_bid: !isFixedRateAllocation,
          is_requote: false
        });
      });
    }
  });

  return openRateRequests;
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

  const parentReq = dbState.transport_requirements.find(
    r => r.id === requirementId || r.req_no === requirementId
  );
  if (!parentReq) {
    return { status: 404, success: false, code: 'REQUIREMENT_NOT_FOUND', error: 'Parent requirement not found.' };
  }

  const resolvedReqIds = [parentReq.id, parentReq.req_no].filter(Boolean);

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
      error: 'Unable to resolve exact requirement item for dispatch.'
    };
  }

  const resolvedItemIds = originalItemRec
    ? [originalItemRec.id, originalItemRec.sub_indent_no].filter(Boolean)
    : ['MAIN'];

  const finalizedSub = dbState.rate_submissions.find(
    s => resolvedReqIds.includes(s.requirement_id) &&
         (resolvedItemIds.includes(s.item_id) || s.item_id === 'MAIN' || !s.item_id) &&
         (Boolean(s.is_finalized) || String(s.bid_status).toUpperCase() === 'FINALIZED' || Number(s.final_rate) > 0)
  );

  if (!finalizedSub) {
    return { status: 400, success: false, code: 'RATE_NOT_FINALIZED', error: 'Rate not finalized.' };
  }

  if (!authUser || !authUser.id) {
    return {
      status: 403,
      success: false,
      code: 'UNAUTHORIZED_TRANSPORTER',
      error: 'Access denied. Valid transporter authentication required.'
    };
  }

  const finalRateVal = parseFloat(finalizedSub.final_rate || finalizedSub.rate_per_mt || 0);
  const totalItemQty = parseFloat(originalItemRec.quantity_mt || originalItemRec.required_qty || 0);

  const itemDispatches = dbState.truck_dispatches.filter(
    d => resolvedReqIds.includes(d.requirement_id) &&
         (d.requirement_item_id === originalItemRec.id || d.requirement_item_id === originalItemRec.sub_indent_no)
  );

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

  const lrNumber = `LR-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  const dispatchRecord = {
    id: `disp_${Date.now()}`,
    requirement_id: parentReq.id,
    requirement_item_id: originalItemRec.id,
    transporter_id: authUser.id,
    finalized_rate: finalRateVal,
    truck_number: body.truck_number,
    loaded_quantity_mt: loadedQty,
    lr_number: lrNumber
  };
  dbState.truck_dispatches.push(dispatchRecord);

  const newTotalDispatched = parseFloat((alreadyDispatched + loadedQty).toFixed(3));
  const newRemaining = parseFloat(Math.max(0, totalItemQty - newTotalDispatched).toFixed(3));

  originalItemRec.dispatched_quantity_mt = newTotalDispatched;
  originalItemRec.remaining_quantity_mt = newRemaining;
  originalItemRec.dispatch_status = newRemaining <= 0 ? 'FULLY_DISPATCHED' : 'PARTIALLY_DISPATCHED';

  return {
    status: 200,
    success: true,
    lr_number: lrNumber,
    loaded_quantity_mt: loadedQty,
    dispatched_quantity_mt: newTotalDispatched,
    remaining_quantity_mt: newRemaining,
    fixed_rate: finalRateVal,
    dispatch_status: newRemaining > 0 ? 'PARTIALLY_DISPATCHED' : 'FULLY_DISPATCHED'
  };
}

// =============================================================
// TEST EXECUTION
// =============================================================

function createInitialState() {
  return {
    transport_requirements: [
      {
        id: 'req_44mt',
        req_no: 'SNPL/26-27/REQ-0001',
        title: '44 MT Soya Transport Nagpur (MIDC) to nagpur',
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
        transporter_name: 'Winning Low Rate Transporter A',
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
        transporter_name: 'Losing Transporter B',
        rate_per_mt: 55,
        final_rate: null,
        is_finalized: 0,
        bid_status: 'SUBMITTED',
        acceptance_status: null
      }
    ],
    truck_dispatches: []
  };
}

const transA = { id: 'trans_A', code: 'TRA001', username: 'transporterA' };
const transB = { id: 'trans_B', code: 'TRB002', username: 'transporterB' };

it('TEST 1: Transporter A sees the request in the exact required format with ₹44/MT (Fixed) & Dispatch Truck', () => {
  const db = createInitialState();
  const rawReqs = [{ ...db.transport_requirements[0], items: db.transport_requirement_items }];

  const openReqsA = buildFrontendOpenRequirements(rawReqs, db, transA);
  assert.equal(openReqsA.length, 1, 'Transporter A sees the item');
  assert.equal(openReqsA[0].sub_indent_no, 'SNPL/26-27/REQ-0001/01');
  assert.equal(openReqsA[0].is_fixed_rate_allocation, true);
  assert.equal(openReqsA[0].fixed_rate, 44);
  assert.equal(openReqsA[0].requires_new_bid, false);
});

it('TEST 2: Transporter B also sees the remaining quantity at the same exact fixed rate (₹44/MT) with dispatch enabled', () => {
  const db = createInitialState();
  const rawReqs = [{ ...db.transport_requirements[0], items: db.transport_requirement_items }];

  const openReqsB = buildFrontendOpenRequirements(rawReqs, db, transB);
  assert.equal(openReqsB.length, 1, 'Transporter B sees the finalized item at fixed rate');
  assert.equal(openReqsB[0].is_fixed_rate_allocation, true);
  assert.equal(openReqsB[0].fixed_rate, 44);
  assert.equal(openReqsB[0].requires_new_bid, false);
});

it('TEST 3: Transporter A dispatches 40 MT -> remaining balance becomes 4 MT', () => {
  const db = createInitialState();
  const res = simulateDispatch(
    db,
    { requirementId: 'req_44mt', itemId: 'item_req_44mt_01' },
    {
      requirement_id: 'req_44mt',
      item_id: 'item_req_44mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31AA1111',
      loaded_quantity_mt: 40
    },
    transA
  );

  assert.equal(res.status, 200);
  assert.equal(res.remaining_quantity_mt, 4);
  assert.equal(res.dispatch_status, 'PARTIALLY_DISPATCHED');
});

it('TEST 4: Transporter B dispatches remaining 4 MT at the same fixed rate (₹44/MT) -> item becomes FULLY_DISPATCHED', () => {
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
      loaded_quantity_mt: 40
    },
    transA
  );

  // Transporter B dispatches remaining 4 MT
  const resB = simulateDispatch(
    db,
    { requirementId: 'req_44mt', itemId: 'item_req_44mt_01' },
    {
      requirement_id: 'req_44mt',
      item_id: 'item_req_44mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31BB2222',
      loaded_quantity_mt: 4
    },
    transB
  );

  assert.equal(resB.status, 200);
  assert.equal(resB.remaining_quantity_mt, 0);
  assert.equal(resB.dispatched_quantity_mt, 44);
  assert.equal(resB.dispatch_status, 'FULLY_DISPATCHED');
  assert.equal(db.truck_dispatches.length, 2);
  assert.equal(db.truck_dispatches[0].transporter_id, 'trans_A');
  assert.equal(db.truck_dispatches[1].transporter_id, 'trans_B');
});

it('TEST 5: Attempting to dispatch more than remaining balance is rejected for all transporters', () => {
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
      loaded_quantity_mt: 40
    },
    transA
  );

  // Transporter B attempts to dispatch 5 MT (when only 4 MT is left)
  const resB = simulateDispatch(
    db,
    { requirementId: 'req_44mt', itemId: 'item_req_44mt_01' },
    {
      requirement_id: 'req_44mt',
      item_id: 'item_req_44mt_01',
      sub_indent_no: 'SNPL/26-27/REQ-0001/01',
      truck_number: 'MH31BB2222',
      loaded_quantity_mt: 5
    },
    transB
  );

  assert.equal(resB.status, 400);
  assert.equal(resB.code, 'EXCEEDS_REMAINING_QUANTITY');
});

console.log('================================================================');
console.log(`🎉 TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
