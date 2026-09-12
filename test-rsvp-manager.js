const RsvpManager = require('./rsvp-module/rsvp-manager.js');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ? PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ? FAIL: ${message}`);
    failed++;
  }
}

console.log("\n?? Testing Modular RsvpManager with Catalina & Julián JSON...");

// Mock Catalina & Julián invitation JSON
const mockConfig = {
  brideDisplayName: "Catalina",
  groomDisplayName: "Julián",
  court: ["Camila Ortiz", "Renata Vega", "Diego Fuentes", "Emiliano Cruz", "Ximena Paredes"]
};

// 1. Instantiation initializes rsvpResponses array
const manager = new RsvpManager(mockConfig);
assert(Array.isArray(mockConfig.rsvpResponses), 'Node rsvpResponses is initialized as an array');
assert(mockConfig.rsvpResponses.length === 0, 'rsvpResponses starts clean');

// 2. Test Court Member Detection
assert(manager.isCourtMember("Camila Ortiz"), 'Detects exact court member');
assert(manager.isCourtMember("camila ortiz"), 'Detects lowercase court member');
assert(manager.isCourtMember("CAMILA ORTIZ"), 'Detects uppercase court member');
assert(manager.isCourtMember("Diego Fuentes"), 'Detects Diego Fuentes as court member');
assert(!manager.isCourtMember("Roberto Morales"), 'Does NOT flag general guest as court member');

// 3. Test Manual Injection & Priority Sorting
const response1 = {
  id: "rsvp_1",
  nombre: "Roberto Morales",
  esCorteDeHonor: false,
  prioridad: 2,
  timestamp: "2026-08-26T10:00:00.000Z"
};
const response2 = {
  id: "rsvp_2",
  nombre: "Renata Vega",
  esCorteDeHonor: true,
  prioridad: 1,
  timestamp: "2026-08-26T10:05:00.000Z"
};
const response3 = {
  id: "rsvp_3",
  nombre: "Ana Martínez",
  esCorteDeHonor: false,
  prioridad: 2,
  timestamp: "2026-08-26T10:10:00.000Z"
};

mockConfig.rsvpResponses.push(response1, response2, response3);
manager.sortResponses();

assert(mockConfig.rsvpResponses[0].nombre === "Renata Vega", 'Court member Renata Vega is prioritized at index 0');
assert(mockConfig.rsvpResponses[0].esCorteDeHonor === true, 'Top member has esCorteDeHonor = true');
assert(mockConfig.rsvpResponses[1].nombre === "Ana Martínez", 'Most recent general guest is at index 1');
assert(mockConfig.rsvpResponses[2].nombre === "Roberto Morales", 'Older general guest is at index 2');

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
