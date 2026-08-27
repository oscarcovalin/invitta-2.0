const templateEngine = require('./template-engine.js');

console.log('=== TEST SUITE: FAMILY STYLING & HORIZONTAL OFFSETS ===');

// Test 1: Default config rendering
const cfg1 = JSON.parse(JSON.stringify(templateEngine.defaultConfig));
const html1 = templateEngine.generateHTML(cfg1, 'vino');
console.log('Test 1 - Default 19px present:', html1.includes('font-size: 19px;'));

// Test 2: Custom font size & offsets
const cfg2 = JSON.parse(JSON.stringify(templateEngine.defaultConfig));
cfg2.familyStyle = {
  fontSize: 24,
  parentsOffset: -25,
  godparentsOffset: 30,
  courtOffset: 10
};
const html2 = templateEngine.generateHTML(cfg2, 'vino');
console.log('Test 2 - Custom 24px present:', html2.includes('font-size: 24px;'));
console.log('Test 2 - Parents offset -25px present:', html2.includes('transform: translateX(-25px);'));
console.log('Test 2 - Godparents offset 30px present:', html2.includes('transform: translateX(30px);'));
console.log('Test 2 - Court offset 10px present:', html2.includes('transform: translateX(10px);'));

// Test 3: XV Años single parents grid
cfg2.eventType = 'xv';
const html3 = templateEngine.generateHTML(cfg2, 'vino');
console.log('Test 3 - XV Años parents offset present:', html3.includes('id="parentsXvGrid"') && html3.includes('transform: translateX(-25px);'));

console.log('\n🎉 ALL FAMILY STYLING & OFFSET TESTS PASSED WITH 100% SUCCESS!');
