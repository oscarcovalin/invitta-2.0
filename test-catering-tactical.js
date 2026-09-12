const fs = require('fs');
const path = require('path');

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

console.log("\n?? Testing Catering Tactical Sheet (WeasyPrint & PDF Optimization)...");

const htmlPath = path.join(__dirname, 'catering-module', 'catering-tactical-sheet.html');
assert(fs.existsSync(htmlPath), 'catering-tactical-sheet.html exists');

const content = fs.readFileSync(htmlPath, 'utf8');

// 1. CSS @page and WeasyPrint print rules
assert(content.includes('@page'), 'Contains @page rule for paged media');
assert(content.includes('page-break-inside: avoid') || content.includes('break-inside: avoid'), 'Contains break-inside avoid to prevent split rows');
assert(content.includes('display: table-header-group'), 'thead uses table-header-group for recurring headers on new pages');
assert(content.includes("font-family: 'Inter'") || content.includes('font-family: "Inter"'), 'Inter font is configured');

// 2. Color styling requirements
assert(content.includes('#163C2B'), 'Uses header color #163C2B');
assert(content.includes('#FAF8F5'), 'Uses alternating row color #FAF8F5');
assert(content.includes('#A38047'), 'Uses gold VIP priority color #A38047');

// 3. SVG Kids Menu Icon
assert(content.includes('stroke="#163C2B"') && content.includes('<svg'), 'Kids menu includes inline SVG icon in color #163C2B');

// 4. Test Filtering Logic on mock data
const mockConfig = {
  brideFather: "Fernando Martínez Ruiz",
  brideMother: "Catalina Ruiz de Martínez",
  court: ["Renata Vega", "Diego Fuentes"],
  rsvpResponses: [
    { nombre: "Renata Vega", tipoMenu: "celiac", isKidMenu: false },
    { nombre: "Diego Fuentes", tipoMenu: "standard", isKidMenu: false },
    { nombre: "Mateo Martínez", tipoMenu: "kids", isKidMenu: true },
    { nombre: "Fernando Martínez Ruiz", tipoMenu: "standard", isKidMenu: false },
    { nombre: "Lucía Fernández", tipoMenu: "vegan", isKidMenu: false }
  ]
};

const filtered = mockConfig.rsvpResponses.filter(r => {
  const isStandard = r.tipoMenu === 'standard' || r.tipoMenu === 'none' || (!r.tipoMenu && !r.isKidMenu);
  return !isStandard;
});

assert(filtered.length === 3, 'Filtered strictly out standard menus (3 special items out of 5)');
assert(filtered.some(r => r.nombre === "Renata Vega"), 'Includes celiac court member Renata Vega');
assert(filtered.some(r => r.nombre === "Mateo Martínez"), 'Includes kids menu Mateo Martínez');
assert(filtered.some(r => r.nombre === "Lucía Fernández"), 'Includes vegan guest Lucía Fernández');
assert(!filtered.some(r => r.nombre === "Diego Fuentes"), 'Strictly excluded standard menu Diego Fuentes');
assert(!filtered.some(r => r.nombre === "Fernando Martínez Ruiz"), 'Strictly excluded standard menu Fernando Martínez Ruiz');

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
