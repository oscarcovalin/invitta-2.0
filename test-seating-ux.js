// test-seating-ux.js - TDD Suite for Simplified Seating Logic & Auto-Seater
const assert = require('assert');

// Mock localStorage and window
if (typeof window === 'undefined') {
  global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
  };
}

const GuestManager = require('./guest-manager.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

console.log('\n🧪 Testing Seating UX Logic, Auto-Seater & Printable Sheet Engine...\n');

// 1. Test autoSeatByFamily algorithm
test('autoSeatByFamily groups families together and respects table capacities', () => {
  const gm = new GuestManager();
  
  // Create test unassigned guests
  gm.state.guests = [
    { id: 'g1', name: 'Roberto Martínez', passes: 2, isCourt: true, tableId: null, vip: true },
    { id: 'g2', name: 'Elena de Martínez', passes: 2, isCourt: true, tableId: null, vip: true },
    { id: 'g3', name: 'Dr. Fernando Ruiz', passes: 4, isCourt: false, tableId: null, vip: false },
    { id: 'g4', name: 'Sra. Carmen Ruiz', passes: 2, isCourt: false, tableId: null, vip: false },
    { id: 'g5', name: 'Lic. Javier Garza', passes: 3, isCourt: false, tableId: null, vip: false }
  ];

  // Set tables: tbl_imperial (cap: 10), tbl_2 (cap: 8), tbl_3 (cap: 8)
  gm.state.tables = [
    { id: 'tbl_imperial', name: 'Mesa Imperial', capacity: 10, type: 'imperial' },
    { id: 'tbl_2', name: 'Mesa 02', capacity: 8, type: 'circular' },
    { id: 'tbl_3', name: 'Mesa 03', capacity: 8, type: 'circular' }
  ];

  const result = gm.autoDistributeGuests();
  assert(result.success, 'Auto-distribution should succeed');
  assert.strictEqual(result.unassignedCount, 0, 'All guests should be assigned');

  // VIP / Court guests should be placed in imperial table
  const imperialGuests = gm.state.guests.filter(g => g.tableId === 'tbl_imperial');
  assert(imperialGuests.some(g => g.id === 'g1'), 'Roberto Martínez should be in Imperial');
  assert(imperialGuests.some(g => g.id === 'g2'), 'Elena de Martínez should be in Imperial');

  // Ruiz family (4 + 2 = 6 pax) should be in the same table (tbl_2)
  const g3 = gm.getGuest('g3');
  const g4 = gm.getGuest('g4');
  assert.strictEqual(g3.tableId, g4.tableId, 'Ruiz family members must be assigned to the same table');
});

// 2. Test Catering & Waiter Printable Summary
test('getWaiterSheetData produces structured table report with dietary breakdown', () => {
  const gm = new GuestManager();
  
  gm.state.tables = [
    { id: 'tbl_1', name: 'Mesa 01', capacity: 10, type: 'circular' }
  ];

  gm.state.guests = [
    { id: 'g1', tableId: 'tbl_1', name: 'Juan Pérez', passes: 2, diet: 'Vegetariano (1 pax)', confirmedPasses: 2, status: 'CONFIRMED' },
    { id: 'g2', tableId: 'tbl_1', name: 'María Gómez', passes: 2, diet: 'Sin Gluten (1 pax)', confirmedPasses: 2, status: 'CONFIRMED' }
  ];

  const summary = gm.getWaiterSheetData();
  assert(summary && summary.tables, 'Summary must have tables');
  assert.strictEqual(summary.tables.length, 1, 'Must have 1 table');
  
  const t1 = summary.tables[0];
  assert.strictEqual(t1.totalPax, 4, 'Total pax must be 4');
  assert(t1.specialDiets.includes('Vegetariano (1 pax)'), 'Must include vegetarian diet');
  assert(t1.specialDiets.includes('Sin Gluten (1 pax)'), 'Must include gluten-free diet');
});

// 3. Test Search & Filter Helper
test('searchGuestsAndTables finds matches accurately', () => {
  const gm = new GuestManager();
  gm.state.guests = [
    { id: 'g1', name: 'Sofía Valenzuela', contactName: 'Sofía', tableId: 'tbl_2', passes: 2, folio: 'M02-VALENZUELA-2P' }
  ];
  gm.state.tables = [
    { id: 'tbl_2', name: 'Mesa Diamante', capacity: 10 }
  ];

  const match1 = gm.searchGuestsAndTables('Valenzuela');
  assert(match1.length > 0, 'Should find guest by surname');
  assert.strictEqual(match1[0].tableName, 'Mesa Diamante');

  const match2 = gm.searchGuestsAndTables('Diamante');
  assert(match2.length > 0, 'Should find by table name');
});

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
