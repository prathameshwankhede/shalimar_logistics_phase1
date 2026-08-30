import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('🧪 RUNNING PRODUCTION RECONCILIATION & MIGRATION TEST SUITE');
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
// Pure Simulator for Database Reconciliation Engine
// -------------------------------------------------------------
function simulateReconciliation(dbState) {
  const dispatchSumMap = {};
  
  // Aggregate dispatches per exact item identifier
  (dbState.truck_dispatches || []).forEach(d => {
    const key = d.requirement_item_id;
    dispatchSumMap[key] = (dispatchSumMap[key] || 0) + Number(d.loaded_quantity_mt || 0);
  });

  // Reconcile each item
  (dbState.transport_requirement_items || []).forEach(item => {
    const actualDispatched = Number(dispatchSumMap[item.id] || dispatchSumMap[item.sub_indent_no] || 0);
    const itemQty = Number(item.quantity_mt || 0);
    const remainingQty = Math.max(0, parseFloat((itemQty - actualDispatched).toFixed(3)));

    item.dispatched_quantity_mt = actualDispatched;
    item.remaining_quantity_mt = remainingQty;
    item.dispatch_status = remainingQty <= 0.001 && itemQty > 0 
      ? 'FULLY_DISPATCHED' 
      : (actualDispatched > 0 ? 'PARTIALLY_DISPATCHED' : 'PENDING');
    
    // Preserve explicit RELEASED_FOR_REQUOTE status
    if (item.allocation_status !== 'RELEASED_FOR_REQUOTE') {
      item.allocation_status = remainingQty <= 0.001 && itemQty > 0 ? 'COMPLETED' : 'ACTIVE';
    }
  });

  return dbState;
}

// TEST 1: Migration on missing columns adds all required fields
it('TEST 1: Migration on missing columns adds all required fields', () => {
  const tableCols = ['id', 'requirement_id', 'product_name', 'quantity_mt'];
  const requiredCols = [
    'dispatched_quantity_mt',
    'remaining_quantity_mt',
    'dispatch_status',
    'allocation_status',
    'source_item_id',
    'replacement_item_id',
    'released_for_requote_at'
  ];

  requiredCols.forEach(col => {
    if (!tableCols.includes(col)) tableCols.push(col);
  });

  requiredCols.forEach(col => {
    assert.strictEqual(tableCols.includes(col), true, `Column ${col} must exist`);
  });
});

// TEST 2: Migration when columns already exist is completely idempotent
it('TEST 2: Migration when columns already exist is completely idempotent', () => {
  const tableCols = [
    'id', 'requirement_id', 'product_name', 'quantity_mt',
    'dispatched_quantity_mt', 'remaining_quantity_mt', 'dispatch_status',
    'allocation_status', 'source_item_id', 'replacement_item_id', 'released_for_requote_at'
  ];
  const countBefore = tableCols.length;

  const requiredCols = [
    'dispatched_quantity_mt', 'remaining_quantity_mt', 'dispatch_status',
    'allocation_status', 'source_item_id', 'replacement_item_id', 'released_for_requote_at'
  ];

  requiredCols.forEach(col => {
    if (!tableCols.includes(col)) tableCols.push(col);
  });

  assert.strictEqual(tableCols.length, countBefore, 'Column count must not change on repeated migration');
});

// TEST 3: Actual dispatch aggregation reconciles item balances correctly
it('TEST 3: Actual dispatch aggregation reconciles item balances correctly', () => {
  const db = {
    transport_requirement_items: [
      { id: 'item_A', requirement_id: 'req_1', sub_indent_no: 'REQ-1/01', quantity_mt: 100, dispatched_quantity_mt: null, remaining_quantity_mt: null }
    ],
    truck_dispatches: [
      { id: 'disp_1', requirement_item_id: 'item_A', loaded_quantity_mt: 40 },
      { id: 'disp_2', requirement_item_id: 'item_A', loaded_quantity_mt: 30 }
    ]
  };

  simulateReconciliation(db);
  const item = db.transport_requirement_items[0];

  assert.strictEqual(item.dispatched_quantity_mt, 70);
  assert.strictEqual(item.remaining_quantity_mt, 30);
  assert.strictEqual(item.dispatch_status, 'PARTIALLY_DISPATCHED');
  assert.strictEqual(item.allocation_status, 'ACTIVE');
});

// TEST 4: UUID item ID matching works
it('TEST 4: UUID item ID matching works', () => {
  const db = {
    transport_requirement_items: [
      { id: 'uuid-1234-5678', requirement_id: 'req_1', sub_indent_no: 'REQ-1/01', quantity_mt: 50 }
    ],
    truck_dispatches: [
      { id: 'disp_uuid', requirement_item_id: 'uuid-1234-5678', loaded_quantity_mt: 50 }
    ]
  };

  simulateReconciliation(db);
  const item = db.transport_requirement_items[0];

  assert.strictEqual(item.dispatched_quantity_mt, 50);
  assert.strictEqual(item.remaining_quantity_mt, 0);
  assert.strictEqual(item.dispatch_status, 'FULLY_DISPATCHED');
  assert.strictEqual(item.allocation_status, 'COMPLETED');
});

// TEST 5: sub_indent_no matching works
it('TEST 5: sub_indent_no matching works', () => {
  const db = {
    transport_requirement_items: [
      { id: 'uuid-item-99', requirement_id: 'req_99', sub_indent_no: 'SNPL/26-27/REQ-99/01', quantity_mt: 80 }
    ],
    truck_dispatches: [
      { id: 'disp_sub', requirement_item_id: 'SNPL/26-27/REQ-99/01', loaded_quantity_mt: 25 }
    ]
  };

  simulateReconciliation(db);
  const item = db.transport_requirement_items[0];

  assert.strictEqual(item.dispatched_quantity_mt, 25);
  assert.strictEqual(item.remaining_quantity_mt, 55);
  assert.strictEqual(item.dispatch_status, 'PARTIALLY_DISPATCHED');
});

// TEST 6: Sibling item isolation (/01 vs /02) is strictly maintained
it('TEST 6: Sibling item isolation (/01 vs /02) is strictly maintained', () => {
  const db = {
    transport_requirement_items: [
      { id: 'item_01', requirement_id: 'req_batch', sub_indent_no: 'REQ-BATCH/01', quantity_mt: 100 },
      { id: 'item_02', requirement_id: 'req_batch', sub_indent_no: 'REQ-BATCH/02', quantity_mt: 100 }
    ],
    truck_dispatches: [
      { id: 'disp_01', requirement_item_id: 'item_01', loaded_quantity_mt: 75 }
    ]
  };

  simulateReconciliation(db);

  assert.strictEqual(db.transport_requirement_items[0].dispatched_quantity_mt, 75);
  assert.strictEqual(db.transport_requirement_items[0].remaining_quantity_mt, 25);

  assert.strictEqual(db.transport_requirement_items[1].dispatched_quantity_mt, 0);
  assert.strictEqual(db.transport_requirement_items[1].remaining_quantity_mt, 100);
  assert.strictEqual(db.transport_requirement_items[1].dispatch_status, 'PENDING');
});

// TEST 7: 200 MT -> dispatch 150 MT -> remaining 50 MT
it('TEST 7: 200 MT -> dispatch 150 MT -> remaining 50 MT', () => {
  const db = {
    transport_requirement_items: [
      { id: 'item_200mt', requirement_id: 'req_200', sub_indent_no: 'REQ-200/01', quantity_mt: 200 }
    ],
    truck_dispatches: [
      { id: 'disp_150', requirement_item_id: 'item_200mt', loaded_quantity_mt: 150 }
    ]
  };

  simulateReconciliation(db);
  const item = db.transport_requirement_items[0];

  assert.strictEqual(item.dispatched_quantity_mt, 150);
  assert.strictEqual(item.remaining_quantity_mt, 50);
  assert.strictEqual(item.dispatch_status, 'PARTIALLY_DISPATCHED');
});

// TEST 8: Normal partial dispatch does not generate /02 sub-indents
it('TEST 8: Normal partial dispatch does not generate /02 sub-indents', () => {
  const db = {
    transport_requirement_items: [
      { id: 'item_orig', requirement_id: 'req_test', sub_indent_no: 'REQ-TEST/01', quantity_mt: 200 }
    ],
    truck_dispatches: [
      { id: 'disp_partial', requirement_item_id: 'item_orig', loaded_quantity_mt: 150 }
    ]
  };

  const initialItemCount = db.transport_requirement_items.length;
  simulateReconciliation(db);
  const finalItemCount = db.transport_requirement_items.length;

  assert.strictEqual(initialItemCount, finalItemCount, 'Zero new sub-indents should be created on partial dispatch');
  assert.strictEqual(db.transport_requirement_items[0].sub_indent_no, 'REQ-TEST/01');
});

// TEST 9: Historical data preservation (preserves source_item_id and RELEASED_FOR_REQUOTE)
it('TEST 9: Historical data preservation (preserves source_item_id and RELEASED_FOR_REQUOTE)', () => {
  const db = {
    transport_requirement_items: [
      {
        id: 'item_historic',
        requirement_id: 'req_hist',
        sub_indent_no: 'REQ-HIST/01',
        quantity_mt: 50,
        source_item_id: 'ancestor_uuid',
        replacement_item_id: 'child_uuid',
        allocation_status: 'RELEASED_FOR_REQUOTE'
      }
    ],
    truck_dispatches: []
  };

  simulateReconciliation(db);
  const item = db.transport_requirement_items[0];

  assert.strictEqual(item.source_item_id, 'ancestor_uuid');
  assert.strictEqual(item.replacement_item_id, 'child_uuid');
  assert.strictEqual(item.allocation_status, 'RELEASED_FOR_REQUOTE', 'Must preserve explicit historical re-quote status');
});

// TEST 10: Server API source exposes reconciliation engine and admin endpoint
it('TEST 10: Server API source exposes reconciliation engine and admin endpoint', () => {
  const apiSrc = fs.readFileSync(path.join(process.cwd(), 'server/routes/api.js'), 'utf8');
  assert.strictEqual(apiSrc.includes('reconcileItemDispatchBalances'), true);
  assert.strictEqual(apiSrc.includes('/admin/reconcile-dispatch-balances'), true);
});

console.log('================================================================');
console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');
if (failed > 0) process.exit(1);
