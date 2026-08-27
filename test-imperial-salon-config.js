const fs = require('fs');
const path = require('path');
const SeatingPlanner = require('./seating-module/seating-planner.js');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log("\n🧪 Testing Salon Configuration with Imperial Table Capacity & Bilateral Distribution...");

// 1. Check HTML elements in organizador-mesas.html
const seatingMasterHtml = fs.readFileSync(path.join(__dirname, 'organizador-mesas.html'), 'utf-8');
assert(seatingMasterHtml.includes('id="inputImperialGuests"'), 'organizador-mesas.html contains inputImperialGuests');
assert(seatingMasterHtml.includes('id="badgeImperialRatio"'), 'organizador-mesas.html contains badgeImperialRatio');
assert(seatingMasterHtml.includes('id="labelRemainingGuests"'), 'organizador-mesas.html contains labelRemainingGuests');
assert(seatingMasterHtml.includes('btn-quick-imperial'), 'organizador-mesas.html contains btn-quick-imperial quick buttons');

// 2. Check HTML elements in seating-module/index.html
const seatingHtml = fs.readFileSync(path.join(__dirname, 'seating-module', 'index.html'), 'utf-8');
assert(seatingHtml.includes('id="inputImperialGuests"'), 'seating-module/index.html contains inputImperialGuests');
assert(seatingHtml.includes('id="badgeImperialRatio"'), 'seating-module/index.html contains badgeImperialRatio');
assert(seatingHtml.includes('id="labelRemainingGuests"'), 'seating-module/index.html contains labelRemainingGuests');
assert(seatingHtml.includes('btn-quick-imperial'), 'seating-module/index.html contains btn-quick-imperial quick buttons');

// 3. Test SeatingPlanner configureSalonAndDistribute logic
const planner = new SeatingPlanner();

// Scenario A: 120 guests, 10 in Imperial, 10 per circular table
const resA = planner.configureSalonAndDistribute({
  totalGuests: 120,
  imperialCapacity: 10,
  circularCapacity: 10
});

assert(resA.totalGuests === 120, 'Scenario A total guests is 120');
assert(resA.imperialCapacity === 10, 'Scenario A imperial capacity is 10');
assert(resA.circularTablesCount === 11, 'Scenario A circular tables is 11 (ceil(110/10))');
assert(resA.leftWingCount === 6, 'Scenario A left wing has 6 tables');
assert(resA.rightWingCount === 5, 'Scenario A right wing has 5 tables');
assert(resA.totalCapacity === 120, 'Scenario A total capacity is 120');
assert(resA.freeSeats === 0, 'Scenario A free seats is 0');

// Scenario B: 150 guests, 12 in Imperial, 8 per circular table
const resB = planner.configureSalonAndDistribute({
  totalGuests: 150,
  imperialCapacity: 12,
  circularCapacity: 8
});

assert(resB.circularTablesCount === 18, 'Scenario B circular tables is 18 (ceil(138/8))');
assert(resB.leftWingCount === 9, 'Scenario B left wing has 9 tables');
assert(resB.rightWingCount === 9, 'Scenario B right wing has 9 tables');
assert(resB.totalCapacity === 12 + (18 * 8), `Scenario B total capacity is 156 (got ${resB.totalCapacity})`);
assert(resB.freeSeats === 6, 'Scenario B free seats is 6');

// 4. Test table structure and VIP allocation
const imperialTbl = planner.state.tables.find(t => t.id === 'tbl_imperial');
assert(!!imperialTbl, 'Imperial table tbl_imperial exists');
assert(imperialTbl.capacity === 12, 'Imperial table has configured capacity of 12');

const vipsInImperial = planner.state.guests.filter(g => g.tableId === 'tbl_imperial');
assert(vipsInImperial.length > 0, `VIPs successfully seated at Imperial Table (seated ${vipsInImperial.length})`);

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
