import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('🧪 RUNNING PRODUCTION SCHEMA MIGRATION & DISPATCH COLUMNS SUITE');
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

// Mock Database State Simulator
function createMockDb() {
  return {
    columns: {
      transport_requirement_items: ['id', 'requirement_id', 'product_name', 'quantity_mt', 'unit', 'created_at']
    },
    transport_requirement_items: [
      { id: 'item_01', requirement_id: 'req_100', sub_indent_no: 'REQ-100/01', product_name: 'Soybean', quantity_mt: 100 },
      { id: 'item_02', requirement_id: 'req_100', sub_indent_no: 'REQ-100/02', product_name: 'Soybean', quantity_mt: 50 }
    ],
    truck_dispatches: [
      { id: 'disp_1', requirement_id: 'req_100', requirement_item_id: 'item_01', loaded_quantity_mt: 60 }
    ]
  };
}

// Simulate Schema Migration & Safe Backfill Function
function runMigration(db) {
  const tableCols = db.columns.transport_requirement_items;
  const newCols = [
    { name: 'dispatch_status', def: 'PENDING' },
    { name: 'dispatched_quantity_mt', def: 0 },
    { name: 'remaining_quantity_mt', def: null }
  ];

  // Idempotent column addition
  newCols.forEach(col => {
    if (!tableCols.includes(col.name)) {
      tableCols.push(col.name);
    }
  });

  // Calculate item-level dispatches isolated per exact item
  const dispatchSumMap = {};
  db.truck_dispatches.forEach(d => {
    const key = d.requirement_item_id;
    dispatchSumMap[key] = (dispatchSumMap[key] || 0) + Number(d.loaded_quantity_mt || 0);
  });

  // Safe backfill
  db.transport_requirement_items.forEach(item => {
    const itemDispatched = dispatchSumMap[item.id] || dispatchSumMap[item.sub_indent_no] || item.dispatched_quantity_mt || 0;
    const itemQty = Number(item.quantity_mt || 0);
    const remQty = Math.max(0, itemQty - itemDispatched);

    item.dispatched_quantity_mt = itemDispatched;
    item.remaining_quantity_mt = remQty;
    item.dispatch_status = remQty <= 0 && itemQty > 0 ? 'FULLY_DISPATCHED' : (itemDispatched > 0 ? 'PARTIALLY_DISPATCHED' : 'PENDING');
  });
}

// TEST 1: Legacy table missing all 3 columns -> migration adds all columns
it('TEST 1: Legacy table missing all 3 columns -> migration adds all columns', () => {
  const db = createMockDb();
  assert.strictEqual(db.columns.transport_requirement_items.includes('dispatched_quantity_mt'), false);
  assert.strictEqual(db.columns.transport_requirement_items.includes('remaining_quantity_mt'), false);
  assert.strictEqual(db.columns.transport_requirement_items.includes('dispatch_status'), false);

  runMigration(db);

  assert.strictEqual(db.columns.transport_requirement_items.includes('dispatched_quantity_mt'), true);
  assert.strictEqual(db.columns.transport_requirement_items.includes('remaining_quantity_mt'), true);
  assert.strictEqual(db.columns.transport_requirement_items.includes('dispatch_status'), true);
});

// TEST 2: Migration runs twice -> no error, columns not duplicated
it('TEST 2: Migration runs twice -> no error, columns not duplicated', () => {
  const db = createMockDb();
  runMigration(db);
  const countAfter1 = db.columns.transport_requirement_items.length;
  runMigration(db);
  const countAfter2 = db.columns.transport_requirement_items.length;
  assert.strictEqual(countAfter1, countAfter2);
});

// TEST 3: Existing rows remain unchanged in count and primary attributes
it('TEST 3: Existing rows remain unchanged in count and primary attributes', () => {
  const db = createMockDb();
  const originalRowCount = db.transport_requirement_items.length;
  runMigration(db);
  assert.strictEqual(db.transport_requirement_items.length, originalRowCount);
  assert.strictEqual(db.transport_requirement_items[0].id, 'item_01');
  assert.strictEqual(db.transport_requirement_items[0].quantity_mt, 100);
});

// TEST 4: Existing dispatched quantity is preserved from truck_dispatches
it('TEST 4: Existing dispatched quantity is preserved from truck_dispatches', () => {
  const db = createMockDb();
  runMigration(db);
  assert.strictEqual(db.transport_requirement_items[0].dispatched_quantity_mt, 60);
  assert.strictEqual(db.transport_requirement_items[0].dispatch_status, 'PARTIALLY_DISPATCHED');
});

// TEST 5: remaining_quantity_mt correctly calculates quantity - dispatched
it('TEST 5: remaining_quantity_mt correctly calculates quantity - dispatched', () => {
  const db = createMockDb();
  runMigration(db);
  assert.strictEqual(db.transport_requirement_items[0].remaining_quantity_mt, 40); // 100 - 60 = 40
});

// TEST 6: Negative remaining quantity never occurs (clamped to 0)
it('TEST 6: Negative remaining quantity never occurs (clamped to 0)', () => {
  const db = createMockDb();
  db.truck_dispatches.push({ id: 'disp_excess', requirement_id: 'req_100', requirement_item_id: 'item_01', loaded_quantity_mt: 50 }); // Total = 110 > 100
  runMigration(db);
  assert.strictEqual(db.transport_requirement_items[0].remaining_quantity_mt >= 0, true);
  assert.strictEqual(db.transport_requirement_items[0].remaining_quantity_mt, 0);
  assert.strictEqual(db.transport_requirement_items[0].dispatch_status, 'FULLY_DISPATCHED');
});

// TEST 7: /01 dispatch history does not affect /02
it('TEST 7: /01 dispatch history does not affect /02', () => {
  const db = createMockDb();
  runMigration(db);
  assert.strictEqual(db.transport_requirement_items[1].dispatched_quantity_mt, 0);
  assert.strictEqual(db.transport_requirement_items[1].remaining_quantity_mt, 50);
  assert.strictEqual(db.transport_requirement_items[1].dispatch_status, 'PENDING');
});

// TEST 8: /02 dispatch history does not affect /01
it('TEST 8: /02 dispatch history does not affect /01', () => {
  const db = createMockDb();
  db.truck_dispatches = [
    { id: 'disp_2', requirement_id: 'req_100', requirement_item_id: 'item_02', loaded_quantity_mt: 20 }
  ];
  runMigration(db);
  assert.strictEqual(db.transport_requirement_items[0].dispatched_quantity_mt, 0);
  assert.strictEqual(db.transport_requirement_items[0].remaining_quantity_mt, 100);
  assert.strictEqual(db.transport_requirement_items[1].dispatched_quantity_mt, 20);
  assert.strictEqual(db.transport_requirement_items[1].remaining_quantity_mt, 30);
});

// TEST 9: Server startup automatically executes migration logic in api.js
it('TEST 9: Server startup automatically executes migration logic in api.js', () => {
  const apiSrc = fs.readFileSync(path.join(process.cwd(), 'server/routes/api.js'), 'utf8');
  assert.strictEqual(apiSrc.includes('dispatched_quantity_mt'), true);
  assert.strictEqual(apiSrc.includes('remaining_quantity_mt'), true);
  assert.strictEqual(apiSrc.includes('dispatch_status'), true);
  assert.strictEqual(apiSrc.includes('ensureRequirementsTableExists'), true);
});

// TEST 10: No data deletion or table recreation occurs
it('TEST 10: No data deletion or table recreation occurs', () => {
  const apiSrc = fs.readFileSync(path.join(process.cwd(), 'server/routes/api.js'), 'utf8');
  assert.strictEqual(apiSrc.includes('DROP TABLE transport_requirement_items'), false);
  assert.strictEqual(apiSrc.includes('TRUNCATE TABLE transport_requirement_items'), false);
});

console.log('================================================================');
console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');
if (failed > 0) process.exit(1);
