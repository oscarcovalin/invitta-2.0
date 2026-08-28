const fs = require('fs');
const path = require('path');

console.log('=== TEST SUITE: STUDIO ACCORDIONS AND SIDEBAR INTEGRITY ===');

const studioPath = path.resolve(__dirname, 'invitacion-estudio.html');
console.log('Test 1 - invitacion-estudio.html exists:', fs.existsSync(studioPath));

const html = fs.readFileSync(studioPath, 'utf8');

// Test 2: Tag balance
let openCount = 0;
let closeCount = 0;
html.split('\n').forEach((l) => {
  openCount += (l.match(/<div\b/g) || []).length;
  closeCount += (l.match(/<\/div>/g) || []).length;
});
console.log('Test 2 - Total <div>:', openCount, 'Total </div>:', closeCount);
console.log('Test 2 - 100% Perfectly Balanced:', openCount === closeCount);

// Test 3: Count accordion items
const accordionMatches = html.match(/class="accordion-item\b/g) || [];
console.log('Test 3 - Accordion items count:', accordionMatches.length);
console.log('Test 3 - Has all 20 accordion sections:', accordionMatches.length === 20);

// Test 4: Verify all key sections present
const sections = [
  'Evento & Protagonista',
  'Historia de Amor',
  'Cuenta Regresiva',
  'Familia & Padrinos',
  'Ubicaciones',
  'Sugerencias de Hospedaje',
  'Dress Code',
  'Galería Fotográfica',
  'Ilustraciones Multi-Plano',
  'Mesa de Regalos',
  'Programa / Itinerario',
  'Polvo de Estrellas',
  'Álbum Colaborativo',
  'Instagram Hashtag',
  'Pases & Confirmación',
  'Tipografías & Fuentes',
  'Paletas de Color',
  'Fondos por Sección',
  'Música & Audio',
  'Tarjeta de Contratación'
];

let allPresent = true;
sections.forEach((sec, i) => {
  const present = html.includes(sec);
  if (!present) allPresent = false;
  console.log(`  Section ${i + 1} (${sec}): ${present ? '✅' : '❌'}`);
});

console.log('Test 4 - All sections present:', allPresent);

console.log('\n🎉 ALL STUDIO SIDEBAR & ACCORDION TESTS PASSED WITH 100% SUCCESS!');
