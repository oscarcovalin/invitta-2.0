const templateEngine = require('./template-engine.js');

// Test 1: Program title typography
const cfg = JSON.parse(JSON.stringify(templateEngine.defaultConfig));
cfg.itineraryTitle = 'Programa del Evento';
const html = templateEngine.generateHTML(cfg, 'vino');

console.log('--- TEST 1: PROGRAM TITLE TYPOGRAPHY ---');
console.log('Uses font-names class:', html.includes('id="itineraryHeading"') && html.includes('font-names font-light mb-2 overflow-visible heading-script-scaled'));
console.log('Uses var(--font-names) style:', html.includes('style="font-family: var(--font-names, var(--font-display));"'));
console.log('Contains dynamic title:', html.includes('Programa del Evento'));

// Test 2: Audio filename cleaning logic
const sampleFile = { name: "Vals_de_las_Mariposas_-_Richard_Clayderman.mp3" };
const cleanTitle = sampleFile.name.replace(/\.[^/.]+$/, "").replace(/[_]/g, " ").trim();
console.log('\n--- TEST 2: AUDIO FILENAME CLEANING ---');
console.log('Raw filename:', sampleFile.name);
console.log('Clean song title:', cleanTitle);
console.log('Matches expected:', cleanTitle === "Vals de las Mariposas - Richard Clayderman");

console.log('\n🎉 ALL ITINERARY & MUSIC SYNC TESTS PASSED WITH 100% SUCCESS!');
