const fs = require('fs');
const GuestManager = require('./guest-manager.js');
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

console.log("\n🧪 Testing Offline Access Control, QR Scanner, 4-Color Floor Plan & Emergency Generator...\n");

// ============================================================================
// 1. TEST GUEST MANAGER & CHECK-IN LOGISTICS
// ============================================================================
const gm = new GuestManager();

// Test Folio Generation
const guest1 = gm.getGuest('g_martinez');
const folio1 = gm.generateFolio(guest1, 4);
assert(folio1.includes('MARTINEZ-4P'), `Generates Option B Logistical Folio for Familia Martínez (got ${folio1})`);

// Test Partial Check-In (2 out of 4 passes)
const checkinResult = gm.checkInGuest('g_martinez', 2);
assert(checkinResult.success === true, 'Successfully checks in guest by ID');
assert(checkinResult.admittedPasses === 2, 'Records partial admitted passes (2 of 4)');
assert(checkinResult.guest.status === 'CHECKED_IN', 'Updates guest status to CHECKED_IN (🟢 Verde)');
assert(checkinResult.guest.checkedInAt !== null, 'Records check-in timestamp');

// Test Check-In by Logistical Folio String
const guestCamila = gm.getGuest('g_camila');
const folioCamila = gm.generateFolio(guestCamila, 2);
const checkinCamila = gm.checkInGuest(folioCamila, 2);
assert(checkinCamila.success === true, `Successfully checks in guest by Folio: ${folioCamila}`);
assert(checkinCamila.guest.name === 'Camila Ortiz', 'Identifies Camila Ortiz from Folio string');

// Test Emergency Guest Creation with Auto Check-In
const emergResult = gm.createEmergencyGuest({
  name: 'Lic. Roberto Garza',
  phone: '8112345678',
  passes: 3,
  tableId: 'tbl_3',
  autoCheckIn: true,
  notes: 'Pase de emergencia emitido en recepción'
});
assert(emergResult.success === true, 'Successfully creates emergency guest');
assert(emergResult.guest.isEmergency === true, 'Flags guest as isEmergency (🔵 Azul)');
assert(emergResult.guest.status === 'CHECKED_IN', 'Auto-checks in emergency guest (🟢/🔵)');
assert(emergResult.guest.admittedPasses === 3, 'Allocates all 3 passes as admitted on emergency auto-checkin');
assert(emergResult.folio.includes('GARZA-3P'), `Generates valid Folio for emergency guest (got ${emergResult.folio})`);

// Test 4-Color Access Metrics
const accessMetrics = gm.getAccessMetrics();
assert(accessMetrics.inSalon.count >= 3, `Tracks in-salon count (got ${accessMetrics.inSalon.count})`);
assert(accessMetrics.inSalon.passes >= 7, `Tracks in-salon admitted passes (got ${accessMetrics.inSalon.passes})`);
assert(accessMetrics.emergency.count >= 1, `Tracks emergency guest count (got ${accessMetrics.emergency.count})`);
assert(typeof accessMetrics.occupancyRate === 'string', `Calculates real-time occupancy rate: ${accessMetrics.occupancyRate}%`);

// Test Personalized URL with phone and table
const urlMart = gm.getPersonalizedUrl(guest1);
assert(urlMart.includes('guest=') && urlMart.includes('passes=4'), 'URL contains guest and passes');
assert(urlMart.includes('phone=') || urlMart.includes('mesa='), 'URL contains phone/mesa parameters');

// ============================================================================
// 2. TEST SEATING PLANNER 4-COLOR STATUS SYSTEM
// ============================================================================
const planner = new SeatingPlanner();

const stChecked = planner.getGuestStatusClasses({ status: 'CHECKED_IN' });
assert(stChecked.pill.includes('emerald'), 'CHECKED_IN maps to Emerald (🟢 Verde)');
assert(stChecked.label.includes('Ingresó'), 'Label shows Ingresó');

const stConfirmed = planner.getGuestStatusClasses({ status: 'CONFIRMED' });
assert(stConfirmed.pill.includes('amber'), 'CONFIRMED maps to Amber (🟡 Amarillo)');
assert(stConfirmed.label.includes('Confirmado'), 'Label shows Confirmado');

const stPending = planner.getGuestStatusClasses({ status: 'PENDING' });
assert(stPending.pill.includes('rose'), 'PENDING maps to Rose (🔴 Rojo)');
assert(stPending.label.includes('Pendiente'), 'Label shows Pendiente');

const stEmerg = planner.getGuestStatusClasses({ isEmergency: true });
assert(stEmerg.pill.includes('blue'), 'isEmergency maps to Blue (🔵 Azul)');
assert(stEmerg.label.includes('Emergencia'), 'Label shows Emergencia');

// ============================================================================
// 3. TEST SCANNER-ACCESO.HTML & GENERADOR-EMERGENCIA.HTML FILES
// ============================================================================
assert(fs.existsSync('./scanner-acceso.html'), 'scanner-acceso.html exists in workspace');
const scannerHtml = fs.readFileSync('./scanner-acceso.html', 'utf-8');
assert(scannerHtml.includes('jsqr') || scannerHtml.includes('jsQR'), 'scanner-acceso.html includes offline QR decoding engine');
assert(scannerHtml.includes('checkinModal'), 'scanner-acceso.html includes checkin modal');
assert(scannerHtml.includes('modalAdmittedCount'), 'scanner-acceso.html includes partial pass admitted stepper');
assert(scannerHtml.includes('playBeep'), 'scanner-acceso.html includes Web Audio API audio synthesizer');
assert(scannerHtml.includes('inputManualSearch'), 'scanner-acceso.html includes rapid manual search');

assert(fs.existsSync('./generador-emergencia.html'), 'generador-emergencia.html exists in workspace');
const emergHtml = fs.readFileSync('./generador-emergencia.html', 'utf-8');
assert(emergHtml.includes('inputEmergName'), 'generador-emergencia.html has guest name input');
assert(emergHtml.includes('selectEmergTable'), 'generador-emergencia.html has table selector');
assert(emergHtml.includes('checkAutoCheckin'), 'generador-emergencia.html has auto-checkin toggle');
assert(emergHtml.includes('resultQrContainer'), 'generador-emergencia.html has instant QR generator');
assert(emergHtml.includes('btnShareWhatsApp'), 'generador-emergencia.html has direct WhatsApp share button');

// ============================================================================
// 4. TEST ORGANIZADOR-MESAS & PORTAL INTEGRATION
// ============================================================================
const seatingHtml = fs.readFileSync('./organizador-mesas.html', 'utf-8');
assert(seatingHtml.includes('scanner-acceso.html'), 'organizador-mesas.html links to scanner-acceso.html');
assert(seatingHtml.includes('generador-emergencia.html'), 'organizador-mesas.html links to generador-emergencia.html');
assert(seatingHtml.includes('statInSalonPax'), 'organizador-mesas.html contains 🟢 statInSalonPax counter');
assert(seatingHtml.includes('statInTransitPax'), 'organizador-mesas.html contains 🟡 statInTransitPax counter');
assert(seatingHtml.includes('statPendingPax'), 'organizador-mesas.html contains 🔴 statPendingPax counter');
assert(seatingHtml.includes('statEmergencyPax'), 'organizador-mesas.html contains 🔵 statEmergencyPax counter');

const portalHtml = fs.readFileSync('./index.html', 'utf-8');
assert(portalHtml.includes('scanner-acceso.html'), 'index.html contains Escáner de Acceso card');
assert(portalHtml.includes('generador-emergencia.html'), 'index.html contains Generador de Emergencia card');

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
