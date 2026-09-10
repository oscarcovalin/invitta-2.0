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

console.log('\n🧪 Testing Single-Event B2B Planner Isolation Suite...\n');

const { EventVaultManager, create } = eventVaultModule;
const evm = create();

// 1. In Superadmin mode (no query params), all events are visible
assert(evm.isSingleEventMode('?role=superadmin') === false, 'Superadmin mode is NOT single event mode');
assert(evm.getVisibleEvents('?role=superadmin').length >= 2, 'Superadmin sees all registered events');

// 2. In Single-Event Planner mode (?event=boda-catalina-julian&role=planner)
const plannerQuery = '?event=boda-catalina-julian&role=planner&token=tok_cat_9823';
assert(evm.isSingleEventMode(plannerQuery) === true, 'Planner with event parameter activates Single-Event Mode');

evm.setActiveEventSlug('boda-catalina-julian');
const visibleToPlanner = evm.getVisibleEvents(plannerQuery);
assert(visibleToPlanner.length === 1, 'Planner in Single-Event Mode ONLY sees 1 event');
assert(visibleToPlanner[0].slug === 'boda-catalina-julian', 'Planner only sees their assigned event: boda-catalina-julian');

// 3. Verification of another client (e.g. XV Valentina)
const xvQuery = '?event=xv-valentina-2027&role=planner&token=tok_val_1042';
assert(evm.isSingleEventMode(xvQuery) === true, 'XV Planner activates Single-Event Mode');
evm.setActiveEventSlug('xv-valentina-2027');
const visibleToXvPlanner = evm.getVisibleEvents(xvQuery);
assert(visibleToXvPlanner.length === 1, 'XV Planner ONLY sees 1 event');
assert(visibleToXvPlanner[0].name === 'Mis XV Años Valentina', 'XV Planner only sees Mis XV Años Valentina');
assert(visibleToXvPlanner.some(e => e.slug === 'boda-catalina-julian') === false, 'Catalina & Julián is completely HIDDEN from Valentina Planner');

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed.\n');
if (failed > 0) process.exit(1);
