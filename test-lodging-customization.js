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

console.log("\n?? Testing Lodging / Hotel Suggestions Section...");

// Test 1: Default config renders 2 hotel options
const configDefault = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig));
const htmlDefault = TemplateEngine.generateHTML(configDefault);

assert(htmlDefault.includes('id="hospedaje"'), 'Lodging section is present');
assert(htmlDefault.includes('Sugerencias de Hospedaje'), 'Lodging default title is present');
assert(htmlDefault.includes('Hotel Quinta Real'), 'Default hotel 1 name is present');
assert(htmlDefault.includes('Av. Principal 100, Zona Hotelera'), 'Default hotel 1 address is present');
assert(htmlDefault.includes('Grand Fiesta Americana'), 'Default hotel 2 name is present');
assert(htmlDefault.includes('Boulevard del Parque 250, Centro'), 'Default hotel 2 address is present');
assert(htmlDefault.includes('https://maps.google.com/?q=Hotel+Quinta+Real'), 'Default hotel 1 Google Maps URL is present');
assert(htmlDefault.includes('https://maps.google.com/?q=Grand+Fiesta+Americana'), 'Default hotel 2 Google Maps URL is present');
assert(htmlDefault.includes('Ver en Google Maps'), 'Google Maps button is present');

// Test 2: Custom lodging with custom hotels and agreement codes
const configCustom = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig));
configCustom.lodging = {
  enabled: true,
  title: 'Hospedaje Recomendado',
  subtitle: 'Para nuestros invitados foráneos',
  description: 'Tarifas especiales mencionando nuestro evento.',
  hotels: [
    {
      name: 'Hotel Boutique Casa Real',
      address: 'Calle Hidalgo 45, Centro Histórico',
      mapsUrl: 'https://maps.google.com/?q=Hotel+Boutique+Casa+Real',
      phone: '+52 33 1122 3344',
      code: 'BODA-CATALINA'
    },
    {
      name: 'City Express Plus',
      address: 'Calzada Independencia 800',
      mapsUrl: 'https://maps.google.com/?q=City+Express+Plus',
      phone: '+52 33 9988 7766',
      code: 'BODA-CATALINA'
    }
  ]
};

const htmlCustom = TemplateEngine.generateHTML(configCustom);
assert(htmlCustom.includes('Hospedaje Recomendado'), 'Custom title renders');
assert(htmlCustom.includes('Para nuestros invitados foráneos'), 'Custom subtitle renders');
assert(htmlCustom.includes('Hotel Boutique Casa Real'), 'Custom hotel 1 name renders');
assert(htmlCustom.includes('Calle Hidalgo 45, Centro Histórico'), 'Custom hotel 1 address renders');
assert(htmlCustom.includes('https://maps.google.com/?q=Hotel+Boutique+Casa+Real'), 'Custom hotel 1 Google Maps URL renders');
assert(htmlCustom.includes('BODA-CATALINA'), 'Special agreement code renders');
assert(htmlCustom.includes('tel:+523311223344'), 'Phone tel link renders');

// Test 3: Disabling lodging hides section cleanly
const configDisabled = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig));
configDisabled.lodging.enabled = false;
const htmlDisabled = TemplateEngine.generateHTML(configDisabled);
assert(htmlDisabled.includes('id="hospedaje"') && htmlDisabled.match(/<section[^>]*id="hospedaje"[^>]*class="[^"]*\bhidden\b/), 'Disabled lodging section has hidden class');

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
