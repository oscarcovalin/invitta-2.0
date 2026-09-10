// test-bulk-importer.js - TDD Suite for Bulk Employee/Guest List Importer
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

console.log('\n🧪 Testing Bulk Employee & Guest List Importer Engine...\n');

// 1. Test parsing simple pasted lines of names
test('parseBulkText parses simple line-separated employee names', () => {
  const gm = new GuestManager();
  const raw = `Ing. Carlos Mendoza
Lic. Patricia Saldaña
Dr. Alejandro Treviño
Mariana Gómez`;

  const parsed = gm.parseBulkText(raw);
  assert.strictEqual(parsed.length, 4, 'Should parse 4 employees');
  assert.strictEqual(parsed[0].name, 'Ing. Carlos Mendoza');
  assert.strictEqual(parsed[0].passes, 1, 'Default passes should be 1');
  assert.strictEqual(parsed[1].name, 'Lic. Patricia Saldaña');
});

// 2. Test parsing CSV / Excel tab-separated content with headers
test('parseBulkText parses CSV/TSV with columns (Nombre, Pases, Telefono, Mesa, Dieta)', () => {
  const gm = new GuestManager();
  const csv = `Nombre,Pases,Telefono,Mesa,Dieta
Carlos Mendoza,2,+528112345678,Mesa 01,Vegetariano
Patricia Saldaña,1,+525598765432,Mesa 02,Sin Gluten
Alejandro Treviño,3,+528187654321,Mesa 01,none`;

  const parsed = gm.parseBulkText(csv);
  assert.strictEqual(parsed.length, 3, 'Should parse 3 rows');
  assert.strictEqual(parsed[0].name, 'Carlos Mendoza');
  assert.strictEqual(parsed[0].passes, 2);
  assert.strictEqual(parsed[0].phone, '+528112345678');
  assert.strictEqual(parsed[0].diet, 'Vegetariano');
});

// 3. Test bulk import into GuestManager state (append vs replace)
test('importBulkGuests adds parsed records to state and auto-generates folios', () => {
  const gm = new GuestManager();
  gm.state.guests = [];

  const raw = `Ing. Roberto Garza, 2, +528112345678, MIMP
Lic. Sofia Valdés, 1, +525598765432, M02`;

  const result = gm.importBulkGuests(raw, { mode: 'replace' });
  assert(result.success, 'Import should succeed');
  assert.strictEqual(result.importedCount, 2, 'Should import 2 guests');
  assert.strictEqual(gm.state.guests.length, 2, 'State should have 2 guests');
  
  const g1 = gm.state.guests[0];
  assert(g1.folio, 'Must auto-generate folio');
  assert(g1.folio.includes('GARZA'), 'Folio must contain surname');
});

// 4. Test generateCsvTemplate
test('getCsvTemplate generates valid CSV structure for download', () => {
  const gm = new GuestManager();
  const template = gm.getCsvTemplate();
  assert(template.includes('Nombre,Pases,Telefono,Email,Mesa,Dieta,Rol'), 'Template must have standard headers');
});

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
