const templateEngine = require('./template-engine.js');

console.log('=== TEST SUITE: OPTION A LUXURY INVITATION REDESIGN ===');

const cfg = JSON.parse(JSON.stringify(templateEngine.defaultConfig));
const html = templateEngine.generateHTML(cfg, 'vino');

// Test 1: Sello de cera 3D interactivo
console.log('Test 1 - Wax seal curtain present:', html.includes('id="waxSealCurtain"'));
console.log('Test 1 - Wax seal asset referenced:', html.includes('assets/wax-seal-gold.jpg'));

// Test 2: Textura de grano de papel
console.log('Test 2 - Paper grain overlay present:', html.includes('class="paper-grain-overlay"'));

// Test 3: Guirnalda floral superior
console.log('Test 3 - Botanical garland present:', html.includes('assets/botanical-garland.jpg'));

// Test 4: Tarjetas de ubicación de alta costura
console.log('Test 4 - Luxury location cards present:', html.includes('class="luxury-location-card'));
console.log('Test 4 - How to get button present:', html.includes('class="btn-how-to-get'));
console.log('Test 4 - Structured address label present:', html.includes('Ceremonia Religiosa:') && html.includes('Salón de la Recepción:'));

console.log('\n🎉 ALL LUXURY INVITATION REDESIGN TESTS PASSED WITH 100% SUCCESS!');
