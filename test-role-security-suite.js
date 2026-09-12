const rolesModule = require('./role-manager.js');
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log('  ✅ PASS: ' + message);
    passed++;
  } else {
    console.error('  ❌ FAIL: ' + message);
    failed++;
  }
}

console.log('\n🧪 Testing RBAC Roles & Commercial Licensing Suite...\n');

const { ROLES, PERMISSIONS, ROLE_DETAILS, create } = rolesModule;
const rm = create();

// 1. Verify role permissions for PLANNER
assert(rm.hasPermission('tables_management', ROLES.PLANNER) === true, 'PLANNER has tables_management');
assert(rm.hasPermission('invitation_studio', ROLES.PLANNER) === true, 'PLANNER has invitation_studio');
assert(rm.hasPermission('master_pin_config', ROLES.PLANNER) === true, 'PLANNER has master_pin_config');
assert(rm.hasPermission('database_reset', ROLES.PLANNER) === true, 'PLANNER has database_reset');

// 2. Verify role permissions for HOST_PREMIUM
assert(rm.hasPermission('tables_management', ROLES.HOST_PREMIUM) === true, 'HOST_PREMIUM has tables_management');
assert(rm.hasPermission('bulk_import_excel', ROLES.HOST_PREMIUM) === true, 'HOST_PREMIUM has bulk_import_excel');
assert(rm.hasPermission('whatsapp_dispatch', ROLES.HOST_PREMIUM) === true, 'HOST_PREMIUM has whatsapp_dispatch');
assert(rm.hasPermission('waiter_sheet_report', ROLES.HOST_PREMIUM) === true, 'HOST_PREMIUM has waiter_sheet_report');
assert(rm.hasPermission('invitation_studio', ROLES.HOST_PREMIUM) === false, 'HOST_PREMIUM is BLOCKED from invitation_studio');
assert(rm.hasPermission('database_reset', ROLES.HOST_PREMIUM) === false, 'HOST_PREMIUM is BLOCKED from database_reset');
assert(rm.hasPermission('master_pin_config', ROLES.HOST_PREMIUM) === false, 'HOST_PREMIUM is BLOCKED from master_pin_config');

// 3. Verify role permissions for HOST_BASIC
assert(rm.hasPermission('whatsapp_dispatch', ROLES.HOST_BASIC) === true, 'HOST_BASIC has whatsapp_dispatch');
assert(rm.hasPermission('rsvp_monitoring', ROLES.HOST_BASIC) === true, 'HOST_BASIC has rsvp_monitoring');
assert(rm.hasPermission('tables_management', ROLES.HOST_BASIC) === false, 'HOST_BASIC is BLOCKED from tables_management');
assert(rm.hasPermission('invitation_studio', ROLES.HOST_BASIC) === false, 'HOST_BASIC is BLOCKED from invitation_studio');

// 4. Verify Designer & Hostess
assert(rm.hasPermission('invitation_studio', ROLES.DESIGNER) === true, 'DESIGNER has invitation_studio');
assert(rm.hasPermission('tables_management', ROLES.DESIGNER) === false, 'DESIGNER is BLOCKED from tables_management');
assert(rm.hasPermission('door_scanner', ROLES.HOSTESS) === true, 'HOSTESS has door_scanner');

// 5. Magic Link Generator
const linkPremium = rm.generateMagicLink(ROLES.HOST_PREMIUM, 'mesas', 'https://invitta.app');
assert(linkPremium === 'https://invitta.app/mesas?role=host_premium', 'Magic Link generation for Host Premium');

const waAppLink = rm.generateWhatsAppShareUrl(ROLES.HOST_PREMIUM, '+525512345678', 'Boda Catalina & Julián', 'mesas');
assert(waAppLink.includes('wa.me/525512345678'), 'WhatsApp share URL contains clean phone');
assert(waAppLink.includes('role%3Dhost_premium'), 'WhatsApp share URL contains role parameter');

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed.\n');
if (failed > 0) process.exit(1);
