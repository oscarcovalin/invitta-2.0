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

console.log("\n?? Testing Footer Closing & Footer Text Customization...");

// Test 1: Default footer closing is "Con amor,"
const defaultHtml = TemplateEngine.generateHTML(TemplateEngine.defaultConfig);
assert(defaultHtml.includes('Con amor,'), 'Default HTML includes "Con amor,"');

// Test 2: Custom footer closing
const customConfig = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig));
customConfig.footerClosing = '¡Los esperamos con los brazos abiertos!';
const customHtml = TemplateEngine.generateHTML(customConfig);
assert(customHtml.includes('¡Los esperamos con los brazos abiertos!'), 'Custom footer closing renders correctly');

// Test 3: Empty footer closing omits the element cleanly
const emptyClosingConfig = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig));
emptyClosingConfig.footerClosing = '';
const emptyClosingHtml = TemplateEngine.generateHTML(emptyClosingConfig);
assert(!emptyClosingHtml.includes('id="footerClosing"'), 'Empty footer closing omits closing element');

// Test 4: Custom footerText renders when provided
const customFooterTextConfig = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig));
customFooterTextConfig.footerText = '#BodaCatalinayJulian';
const customFooterTextHtml = TemplateEngine.generateHTML(customFooterTextConfig);
assert(customFooterTextHtml.includes('#BodaCatalinayJulian'), 'Custom footerText renders correctly');
assert(customFooterTextHtml.includes('id="footerCustomText"'), 'footerCustomText element present when text is provided');

// Test 5: Empty footerText does not render redundant element
const emptyFooterTextConfig = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig));
emptyFooterTextConfig.footerText = '';
const emptyFooterTextHtml = TemplateEngine.generateHTML(emptyFooterTextConfig);
assert(!emptyFooterTextHtml.includes('id="footerCustomText"'), 'Empty footerText omits duplicate/redundant element');

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
