// test-audit-fixes.js - TDD Suite for Audit Fixes
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock localStorage and window for testing environment if needed
if (typeof window === 'undefined') {
  global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
  };
  global.sessionStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
  };
  global.window = {
    location: {
      href: 'http://localhost:3000/portal.html',
      search: ''
    }
  };
}

const GuestManager = require('./guest-manager.js');
const BackupManager = require('./backup-manager.js');

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

console.log('\n🧪 Testing Audit Fixes (TDD Suite for guest-manager.js & backup-manager.js)...\n');

// 1. Test empty / whitespace / punctuation query in checkInGuest
test('checkInGuest rejects empty or whitespace/symbol query and does not check in first guest', () => {
  localStorage.clear();
  const gm = new GuestManager();
  const firstGuest = gm.state.guests[0];
  const initialStatus = firstGuest.status;

  const res1 = gm.checkInGuest('   ');
  assert.strictEqual(res1.success, false, 'Should fail for whitespace query');
  assert.strictEqual(gm.state.guests[0].status, initialStatus, 'First guest should not be modified');

  const res2 = gm.checkInGuest('---');
  assert.strictEqual(res2.success, false, 'Should fail for punctuation query');
  assert.strictEqual(gm.state.guests[0].status, initialStatus, 'First guest should not be modified');

  const res3 = gm.checkInGuest('***');
  assert.strictEqual(res3.success, false, 'Should fail for asterisk query');
});

// 2. Test lookup by stored folio after partial check-in
test('checkInGuest finds guest by stored g.folio even when different from recalculated full folio', () => {
  localStorage.clear();
  const gm = new GuestManager();
  const guest = gm.state.guests[0]; // e.g. 4 passes
  
  // Set a specific folio representing partial passes on guest
  guest.folio = 'MIMP-MARTINEZ-2P';
  gm.saveState();

  const res = gm.checkInGuest('MIMP-MARTINEZ-2P');
  assert.strictEqual(res.success, true, 'Should find guest by exact stored folio');
  assert.strictEqual(res.guest.id, guest.id, 'Should match the correct guest');
});

// 3. Test recordRsvpResponse handles omitted confirmedPasses without NaN
test('recordRsvpResponse defaults passes properly and prevents NaN', () => {
  localStorage.clear();
  const gm = new GuestManager();
  const guest = gm.state.guests[0]; // passes = 4

  const updated = gm.recordRsvpResponse(guest.id, { confirmed: true });
  assert.strictEqual(updated.confirmedPasses, 4, 'Should default to guest passes when confirmedPasses omitted');
  assert(!Number.isNaN(updated.confirmedPasses), 'confirmedPasses must not be NaN');

  const metrics = gm.getMetrics();
  assert(!Number.isNaN(metrics.confirmedPasses), 'metrics.confirmedPasses must not be NaN');
  assert(!Number.isNaN(metrics.confirmedPercent), 'metrics.confirmedPercent must not be NaN');
});

// 4. Test importDataJson schema validation
test('importDataJson validates that guests and tables are arrays and rejects malformed schemas', () => {
  localStorage.clear();
  const gm = new GuestManager();
  const initialCount = gm.state.guests.length;

  const malformed1 = JSON.stringify({ guests: 'not-an-array', tables: [] });
  assert.strictEqual(gm.importDataJson(malformed1), false, 'Should reject non-array guests');
  assert.strictEqual(gm.state.guests.length, initialCount, 'State should remain intact');

  const malformed2 = JSON.stringify({ guests: [], tables: 'not-an-array' });
  assert.strictEqual(gm.importDataJson(malformed2), false, 'Should reject non-array tables');

  const malformed3 = 'invalid json {';
  assert.strictEqual(gm.importDataJson(malformed3), false, 'Should handle JSON parse errors gracefully');
});

// 5. Test backup-manager CORE_FILES completeness
test('backup-manager CORE_FILES includes guest-manager.js and essential components', () => {
  const bm = new BackupManager();
  assert(bm.coreFiles.includes('guest-manager.js'), 'CORE_FILES must include guest-manager.js');
  assert(bm.coreFiles.includes('scanner-acceso.html'), 'CORE_FILES must include scanner-acceso.html');
  assert(bm.coreFiles.includes('generador-emergencia.html'), 'CORE_FILES must include generador-emergencia.html');
});

// 6. Test backup-manager sanitizes labels against command injection
test('backup-manager safely handles special characters in snapshot labels', () => {
  const bm = new BackupManager();
  // Safe label test with quotes, semicolons, dollar signs
  const specialLabel = 'test "label"; echo injection $(calc)';
  const snapshot = bm.createSnapshot(specialLabel);
  assert(snapshot, 'Should create snapshot successfully');
  assert(snapshot.id, 'Snapshot should have an ID');
  assert(!snapshot.id.includes(';'), 'Snapshot ID should be sanitized');
  assert(!snapshot.id.includes('"'), 'Snapshot ID should not contain quotes');
});

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  process.exit(1);
}
