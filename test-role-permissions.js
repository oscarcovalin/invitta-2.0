const fs = require('fs');
const GuestManager = require('./guest-manager.js');

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

console.log("\n🧪 Testing Role-Based Access Control & Planner Permissions in Invitta 2.0...\n");

const gm = new GuestManager();

// 1. PIN Maestro de Seguridad
assert(gm.getMasterPin() === '2027', 'Default Master PIN is 2027');
assert(gm.verifyMasterPin('2027') === true, 'Verifies valid Master PIN 2027');
assert(gm.verifyMasterPin('0000') === false, 'Rejects invalid Master PIN 0000');

assert(gm.setMasterPin('4567') === true, 'Successfully updates Master PIN to 4567');
assert(gm.verifyMasterPin('4567') === true, 'Verifies updated Master PIN 4567');

const generatedPin = gm.generateRandomMasterPin();
assert(typeof generatedPin === 'string' && generatedPin.length === 4, `Generates random 4-digit PIN (${generatedPin})`);
assert(gm.verifyMasterPin(generatedPin) === true, 'Auto-persists and verifies generated random PIN');

gm.setMasterPin('2027'); // Restore default

// 2. Roles y Detección
assert(gm.getCurrentRole('admin') === 'admin', 'Identifies Admin / Novios role');
assert(gm.getCurrentRole('designer') === 'designer', 'Identifies Designer role');
assert(gm.getCurrentRole('planner') === 'planner', 'Identifies Planner / Organizador role');
assert(gm.getCurrentRole('hostess') === 'hostess', 'Identifies Hostess role');
assert(gm.getCurrentRole('catering') === 'catering', 'Identifies Catering role');

// 3. Matriz de Permisos
// Admin
assert(gm.canPerformAction('edit_invitation_design', 'admin') === true, 'Admin CAN edit invitation design');
assert(gm.canPerformAction('reset_database', 'admin') === true, 'Admin CAN reset database');
assert(gm.canPerformAction('manage_tables', 'admin') === true, 'Admin CAN manage tables');
assert(gm.canPerformAction('view_timeline', 'admin') === true, 'Admin CAN view timeline');

// Designer (Diseñador Gráfico de Invitación) - Creativo Aislado
assert(gm.canPerformAction('edit_invitation_design', 'designer') === true, 'Designer CAN edit invitation design');
assert(gm.canPerformAction('export_invitation_html', 'designer') === true, 'Designer CAN export invitation HTML');
assert(gm.canPerformAction('manage_tables', 'designer') === false, 'Designer CANNOT manage floor plan tables (Protected)');
assert(gm.canPerformAction('view_guest_phones', 'designer') === false, 'Designer CANNOT view guest phone numbers (Protected)');
assert(gm.canPerformAction('reset_database', 'designer') === false, 'Designer CANNOT reset database (Protected)');
assert(gm.canPerformAction('scan_access_qr', 'designer') === false, 'Designer CANNOT scan access QR (Protected)');

// Planner (Organizador) - Operativo Estricto (Mesas, Cronograma y Catering)
assert(gm.canPerformAction('manage_tables', 'planner') === true, 'Planner CAN manage tables & layout (Organización)');
assert(gm.canPerformAction('edit_guest_assignment', 'planner') === true, 'Planner CAN edit guest table assignment (Organización)');
assert(gm.canPerformAction('view_timeline', 'planner') === true, 'Planner CAN view and follow timeline (Cronograma)');
assert(gm.canPerformAction('view_catering', 'planner') === true, 'Planner CAN view catering tactical sheet (Catering)');

assert(gm.canPerformAction('edit_invitation_design', 'planner') === false, 'Planner CANNOT edit invitation design (Protected)');
assert(gm.canPerformAction('reset_database', 'planner') === false, 'Planner CANNOT reset database (Protected)');
assert(gm.canPerformAction('dispatch_whatsapp', 'planner') === false, 'Planner CANNOT dispatch bride whatsapp messages (Protected)');
assert(gm.canPerformAction('view_guest_phones', 'planner') === false, 'Planner CANNOT view private guest phone numbers (Protected)');
assert(gm.canPerformAction('scan_access_qr', 'planner') === false, 'Planner CANNOT scan door access QR (Delegated to Hostess)');

// Hostess
assert(gm.canPerformAction('scan_access_qr', 'hostess') === true, 'Hostess CAN scan access QR');
assert(gm.canPerformAction('manage_tables', 'hostess') === false, 'Hostess CANNOT edit floor plan tables');
assert(gm.canPerformAction('edit_invitation_design', 'hostess') === false, 'Hostess CANNOT edit invitation');

// Catering
assert(gm.canPerformAction('view_catering', 'catering') === true, 'Catering CAN view catering tactical sheet');
assert(gm.canPerformAction('manage_tables', 'catering') === false, 'Catering CANNOT edit floor plan');

// 4. Generación de Enlaces de Delegación
const links = gm.getDelegationLinks('http://localhost:3000/');
assert(links.designer.url.includes('role=designer'), `Designer link has ?role=designer (${links.designer.url})`);
assert(links.planner.url.includes('role=planner'), `Planner link has ?role=planner (${links.planner.url})`);
assert(links.hostess.url.includes('scanner-acceso.html'), `Hostess link leads to scanner-acceso.html (${links.hostess.url})`);
assert(links.emergency.url.includes('generador-emergencia.html'), `Emergency link leads to generador-emergencia.html (${links.emergency.url})`);
assert(links.catering.url.includes('catering-tactical-sheet.html'), `Catering link leads to tactical sheet (${links.catering.url})`);

// 5. Integración en organizador-mesas.html, index.html y invitacion-estudio.html
const seatingHtml = fs.readFileSync('./organizador-mesas.html', 'utf-8');
assert(seatingHtml.includes('badgeRoleAdmin'), 'organizador-mesas.html contains badgeRoleAdmin');
assert(seatingHtml.includes('badgeRolePlanner'), 'organizador-mesas.html contains badgeRolePlanner');
assert(seatingHtml.includes('sidebarPrivateBrideLinks'), 'organizador-mesas.html contains sidebarPrivateBrideLinks');
assert(seatingHtml.includes('modalShareAccess'), 'organizador-mesas.html contains modalShareAccess');
assert(seatingHtml.includes('btnGenerateMasterPin'), 'organizador-mesas.html contains btnGenerateMasterPin button');
assert(seatingHtml.includes('btnWaDesigner'), 'organizador-mesas.html contains btnWaDesigner in modalShareAccess');
assert(seatingHtml.includes('modalUnlockAdmin'), 'organizador-mesas.html contains modalUnlockAdmin');
assert(seatingHtml.includes('applyRoleInterface'), 'organizador-mesas.html has applyRoleInterface function');

const studioHtml = fs.readFileSync('./invitacion-estudio.html', 'utf-8');
assert(studioHtml.includes('designerRoleBadge'), 'invitacion-estudio.html contains designerRoleBadge');
assert(studioHtml.includes('adminNavigationLinks'), 'invitacion-estudio.html contains adminNavigationLinks');
assert(studioHtml.includes('role === \'designer\''), 'invitacion-estudio.html contains designer isolation script');

const portalHtml = fs.readFileSync('./index.html', 'utf-8');
assert(portalHtml.includes('organizador-mesas.html?role=planner'), 'index.html contains direct card for Wedding Planner (?role=planner)');
assert(portalHtml.includes('invitacion-estudio.html?role=designer'), 'index.html contains direct card for Designer (?role=designer)');

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
