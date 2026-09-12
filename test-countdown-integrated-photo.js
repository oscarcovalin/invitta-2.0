const TemplateEngine = require('./template-engine.js');

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

console.log("\n?? Testing Integrated Countdown Photo Mode (Photo as Full-Bleed Section Background)...");

// Test 1: Without countdown photo, renders original editorial layout
const configNoPhoto = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig));
configNoPhoto.countdownPhoto = '';
const htmlNoPhoto = TemplateEngine.generateHTML(configNoPhoto);
assert(!htmlNoPhoto.includes('id="countdownPhotoBlock"'), 'Editorial layout has no countdownPhotoBlock');
assert(htmlNoPhoto.includes('id="heroDateBlock"'), 'Editorial layout includes heroDateBlock');
assert(htmlNoPhoto.includes('id="countdownWrapper"'), 'Editorial layout includes countdownWrapper');
assert(htmlNoPhoto.includes('id="days"'), 'Editorial layout includes days counter');
assert(htmlNoPhoto.includes('id="seconds"'), 'Editorial layout includes seconds counter');

// Test 2: With countdown photo, renders full-bleed integrated mode
const configWithPhoto = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig));
configWithPhoto.countdownPhoto = 'https://example.com/quinceanera.jpg';
configWithPhoto.countdownPhotoEnabled = true;
configWithPhoto.countdownPhrase = 'Te espero el día';
const htmlWithPhoto = TemplateEngine.generateHTML(configWithPhoto);

assert(htmlWithPhoto.includes('id="countdownPhotoBlock"'), 'Integrated mode has countdownPhotoBlock container');
assert(htmlWithPhoto.includes('id="countdownPhotoImg"'), 'Integrated mode has countdownPhotoImg element');
assert(htmlWithPhoto.includes('src="https://example.com/quinceanera.jpg"'), 'Integrated mode renders photo URL');
assert(htmlWithPhoto.includes('object-fit:cover'), 'Integrated mode photo uses object-fit:cover');
assert(htmlWithPhoto.includes('Te espero el día'), 'Integrated mode renders custom eyebrow / phrase');
assert(htmlWithPhoto.includes('Faltan:'), 'Integrated mode renders Faltan label');
assert(htmlWithPhoto.includes('id="heroDateBlock"'), 'Integrated mode floating date block is present');
assert(htmlWithPhoto.includes('id="countdownWrapper"'), 'Integrated mode floating counter is present');
assert(htmlWithPhoto.includes('id="days"'), 'Integrated mode has days counter');
assert(htmlWithPhoto.includes('id="hours"'), 'Integrated mode has hours counter');
assert(htmlWithPhoto.includes('id="minutes"'), 'Integrated mode has minutes counter');
assert(htmlWithPhoto.includes('id="seconds"'), 'Integrated mode has seconds counter');
assert(htmlWithPhoto.includes('id="btnGoogleCalendar"'), 'Integrated mode has Google Calendar button');
assert(htmlWithPhoto.includes('id="btnCalendar"'), 'Integrated mode has Apple/ics Calendar button');

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
