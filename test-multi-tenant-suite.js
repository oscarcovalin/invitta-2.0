const eventVaultModule = require('./event-vault-manager.js');
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

console.log('\n🧪 Testing Multi-Tenant Architecture & Event Vault Isolation...\n');

const { EventVaultManager, create } = eventVaultModule;
const evm = create();

// 1. Initial Default Events
const initialEvents = evm.getAllEvents();
assert(initialEvents.length >= 2, 'Vault has initial demonstration events');
assert(initialEvents[0].slug === 'boda-catalina-julian', 'First event is Boda Catalina & Julián');

// 2. Slug Generation
const slug1 = evm.generateSlug('Boda Andrea & Carlos', '2027');
assert(slug1 === 'boda-andrea-carlos-2027', 'Generates correct slug for Boda Andrea & Carlos: ' + slug1);

const slug2 = evm.generateSlug('XV Años Ximena García', '2026');
assert(slug2 === 'xv-anos-ximena-garcia-2026', 'Generates sanitized slug without accents: ' + slug2);

// 3. Create New Client Event
const newEvent = evm.createEvent({
  name: 'Boda Sofía & Mateo',
  type: 'boda',
  dateLabel: '15 de Noviembre, 2027',
  dateISO: '2027-11-15T19:00',
  venue: 'Terraza Bellavista',
  capacity: 180,
  packageType: 'host_premium'
});

assert(newEvent.slug === 'boda-sofia-mateo-2027', 'New event created with slug boda-sofia-mateo-2027');
assert(newEvent.token.startsWith('tok_'), 'New event receives unique cryptographic token');
assert(evm.getActiveEvent().slug === 'boda-sofia-mateo-2027', 'Newly created event becomes active');

// 4. Storage Key Partitioning (Multi-Tenant Isolation)
const seatingKey1 = evm.getPartitionedStorageKey('invitta_seating_state', 'boda-catalina-julian');
const seatingKey2 = evm.getPartitionedStorageKey('invitta_seating_state', 'boda-sofia-mateo-2027');
assert(seatingKey1 !== seatingKey2, 'Storage keys for different clients are strictly separated');
assert(seatingKey1 === 'invitta_seating_state_boda-catalina-julian', 'Partitioned key 1 format is exact');
assert(seatingKey2 === 'invitta_seating_state_boda-sofia-mateo-2027', 'Partitioned key 2 format is exact');

// 5. Magic Link with Event Context
const magicLinkHost = evm.generateEventMagicLink('host_premium', 'boda-sofia-mateo-2027', 'mesas', 'https://invitta.app');
assert(magicLinkHost.includes('event=boda-sofia-mateo-2027'), 'Magic link includes event slug parameter');
assert(magicLinkHost.includes('role=host_premium'), 'Magic link includes role parameter');
assert(magicLinkHost.includes('token=' + newEvent.token), 'Magic link includes unique token');

const waLink = evm.generateEventWhatsAppUrl('host_premium', 'boda-sofia-mateo-2027', '+525511223344', 'mesas');
assert(waLink.includes('wa.me/525511223344'), 'WhatsApp link includes clean phone');
assert(waLink.includes(encodeURIComponent(newEvent.name)), 'WhatsApp text mentions specific event name');

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed.\n');
if (failed > 0) process.exit(1);
