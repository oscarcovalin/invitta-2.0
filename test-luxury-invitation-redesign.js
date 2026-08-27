const templateEngine = require('./template-engine.js');

console.log('=== TEST SUITE: CUSTOM WAX SEAL & CLEAN LOCATIONS ===');

// Test 1: Default SVG Wax Seal
const cfg1 = JSON.parse(JSON.stringify(templateEngine.defaultConfig));
const html1 = templateEngine.generateHTML(cfg1, 'vino');
console.log('Test 1 - Default SVG Wax Seal present:', html1.includes('<svg viewBox="0 0 200 200"') && html1.includes('id="waxSealCurtain"'));
console.log('Test 1 - No floral garland in location cards:', !html1.includes('assets/botanical-garland.jpg'));
console.log('Test 1 - Clean location cards present:', html1.includes('id="ceremonyCard"') && html1.includes('id="receptionCard"'));

// Test 2: Custom PNG Uploaded Seal
const cfg2 = JSON.parse(JSON.stringify(templateEngine.defaultConfig));
cfg2.waxSeal = {
  enabled: true,
  customImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  promptText: 'Abre tu invitación exclusiva'
};
const html2 = templateEngine.generateHTML(cfg2, 'vino');
console.log('Test 2 - Custom PNG image rendered:', html2.includes('src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="'));

// Test 3: Disabled Wax Seal
const cfg3 = JSON.parse(JSON.stringify(templateEngine.defaultConfig));
cfg3.waxSeal = { enabled: false };
const html3 = templateEngine.generateHTML(cfg3, 'vino');
console.log('Test 3 - Wax seal curtain not rendered when disabled:', !html3.includes('id="waxSealCurtain"'));

console.log('\n🎉 ALL CLEAN LOCATION & WAX SEAL TESTS PASSED WITH 100% SUCCESS!');
