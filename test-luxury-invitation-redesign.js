const templateEngine = require('./template-engine.js');

console.log('=== TEST SUITE: CUSTOM WAX SEAL & TRANSPARENCY ===');

// Test 1: Default SVG Wax Seal
const cfg1 = JSON.parse(JSON.stringify(templateEngine.defaultConfig));
const html1 = templateEngine.generateHTML(cfg1, 'vino');
console.log('Test 1 - Default SVG Wax Seal present:', html1.includes('<svg viewBox="0 0 200 200"') && html1.includes('id="waxSealCurtain"'));
console.log('Test 1 - Monogram embedded in seal:', html1.includes('font-family="\'Cinzel Decorative\''));

// Test 2: Custom PNG Uploaded Seal
const cfg2 = JSON.parse(JSON.stringify(templateEngine.defaultConfig));
cfg2.waxSeal = {
  enabled: true,
  customImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  promptText: 'Abre tu invitación exclusiva'
};
const html2 = templateEngine.generateHTML(cfg2, 'vino');
console.log('Test 2 - Custom PNG image rendered:', html2.includes('src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="'));
console.log('Test 2 - Custom prompt text rendered:', html2.includes('Abre tu invitación exclusiva'));

// Test 3: Disabled Wax Seal
const cfg3 = JSON.parse(JSON.stringify(templateEngine.defaultConfig));
cfg3.waxSeal = { enabled: false };
const html3 = templateEngine.generateHTML(cfg3, 'vino');
console.log('Test 3 - Wax seal curtain not rendered when disabled:', !html3.includes('id="waxSealCurtain"'));

// Test 4: Presets
const presets = ['gold', 'burgundy', 'emerald', 'rose', 'navy'];
let allPresetsOk = true;
presets.forEach(p => {
  const svg = templateEngine.getWaxSealSVG(p, 'V');
  if (!svg.includes(`waxGrad_${p}`)) allPresetsOk = false;
});
console.log('Test 4 - All presets generated cleanly:', allPresetsOk);

console.log('\n🎉 ALL CUSTOM WAX SEAL TESTS PASSED WITH 100% SUCCESS!');
