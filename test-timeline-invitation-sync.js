const fs = require('fs');
const path = require('path');
const TemplateEngine = require('./template-engine.js');

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

console.log("\n🧪 Testing Timeline & Invitation Program Alignment...");

// 1. Check default itinerary in TemplateEngine
const defaultItinerary = TemplateEngine.defaultConfig.itinerary;
assert(Array.isArray(defaultItinerary) && defaultItinerary.length === 6, 'TemplateEngine has 6 default timeline events');
assert(defaultItinerary[0].time.includes('18:00') && defaultItinerary[0].label === 'Ceremonia Religiosa', 'Event 1 is 18:00 Ceremonia Religiosa');
assert(defaultItinerary[1].time.includes('19:00') && defaultItinerary[1].label === 'Boda Civil', 'Event 2 is 19:00 Boda Civil');
assert(defaultItinerary[2].time.includes('20:00') && defaultItinerary[2].label === 'Recepción', 'Event 3 is 20:00 Recepción');
assert(defaultItinerary[3].time.includes('20:30') && defaultItinerary[3].label === 'Cena', 'Event 4 is 20:30 Cena');
assert(defaultItinerary[4].time.includes('21:30') && defaultItinerary[4].label === 'Todo mundo a bailar', 'Event 5 is 21:30 Todo mundo a bailar');
assert(defaultItinerary[5].time.includes('2:00') && defaultItinerary[5].label === 'Fin del evento', 'Event 6 is 02:00 Fin del evento');

// 2. Check portal.html modalTimeline contains all 6 events with exact times and labels
const indexHtml = fs.readFileSync(path.join(__dirname, 'portal.html'), 'utf8');
assert(indexHtml.includes('18:00 HRS') && indexHtml.includes('Ceremonia Religiosa'), 'portal.html modal contains 18:00 HRS Ceremonia Religiosa');
assert(indexHtml.includes('19:00 HRS') && indexHtml.includes('Boda Civil'), 'portal.html modal contains 19:00 HRS Boda Civil');
assert(indexHtml.includes('20:00 HRS') && indexHtml.includes('Recepción'), 'portal.html modal contains 20:00 HRS Recepción');
assert(indexHtml.includes('20:30 HRS') && indexHtml.includes('Cena'), 'portal.html modal contains 20:30 HRS Cena');
assert(indexHtml.includes('21:30 HRS') && indexHtml.includes('Todo mundo a bailar'), 'portal.html modal contains 21:30 HRS Todo mundo a bailar');
assert(indexHtml.includes('02:00 HRS') && indexHtml.includes('Fin del Evento'), 'portal.html modal contains 02:00 HRS Fin del Evento');

// 3. Check seating-module/portal.html modalTimeline contains all 6 events
const seatingHtml = fs.readFileSync(path.join(__dirname, 'seating-module/portal.html'), 'utf8');
assert(seatingHtml.includes('18:00 HRS') && seatingHtml.includes('Ceremonia Religiosa'), 'seating-module/portal.html modal contains 18:00 HRS Ceremonia Religiosa');
assert(seatingHtml.includes('19:00 HRS') && seatingHtml.includes('Boda Civil'), 'seating-module/portal.html modal contains 19:00 HRS Boda Civil');
assert(seatingHtml.includes('20:00 HRS') && seatingHtml.includes('Recepción'), 'seating-module/portal.html modal contains 20:00 HRS Recepción');
assert(seatingHtml.includes('20:30 HRS') && seatingHtml.includes('Cena'), 'seating-module/portal.html modal contains 20:30 HRS Cena');
assert(seatingHtml.includes('21:30 HRS') && seatingHtml.includes('Todo mundo a bailar'), 'seating-module/portal.html modal contains 21:30 HRS Todo mundo a bailar');
assert(seatingHtml.includes('02:00 HRS') && seatingHtml.includes('Fin del Evento'), 'seating-module/portal.html modal contains 02:00 HRS Fin del Evento');

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
