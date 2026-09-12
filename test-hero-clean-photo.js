const TemplateEngine = require('./template-engine');

console.log("\n=== RUNNING CLEAN HERO PHOTO TESTS ===\n");

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

// 1. Con Fotografía Principal
const configWithPhoto = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig));
configWithPhoto.photos = { hero: 'https://images.unsplash.com/photo-1519741497674-611481863552' };
const htmlWithPhoto = TemplateEngine.generateHTML(configWithPhoto, 'classicGold');

assert(htmlWithPhoto.includes('id="heroPhotoFrame"'), 'Contains clean heroPhotoFrame container');
assert(htmlWithPhoto.includes('id="heroPhotoImg"'), 'Contains clean heroPhotoImg element');

const photoFrameIdx = htmlWithPhoto.indexOf('id="heroPhotoFrame"');
const brideNameIdx = htmlWithPhoto.indexOf('id="heroBrideName"');
const quoteIdx = htmlWithPhoto.indexOf('id="welcomeQuote"');
const welcomeMsgIdx = htmlWithPhoto.indexOf('id="welcomeMessage"');

assert(photoFrameIdx !== -1, 'Photo frame is present');
assert(brideNameIdx !== -1, 'Bride name is present');
assert(photoFrameIdx < brideNameIdx, 'Photo frame is placed BEFORE (above) bride name');
assert(brideNameIdx < quoteIdx, 'Bride name is placed BEFORE quote');
assert(quoteIdx < welcomeMsgIdx, 'Quote is placed BEFORE welcome message');

// 2. Sin Fotografía Principal (Fallback al sistema centrado)
const configWithoutPhoto = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig));
configWithoutPhoto.photos = { hero: '' };
const htmlWithoutPhoto = TemplateEngine.generateHTML(configWithoutPhoto, 'classicGold');

assert(!htmlWithoutPhoto.includes('id="heroPhotoFrame"'), 'Does NOT contain heroPhotoFrame when photo is empty');
assert(htmlWithoutPhoto.includes('id="heroBrideName"'), 'Contains heroBrideName in fallback mode');
assert(htmlWithoutPhoto.includes('id="welcomeMessage"'), 'Contains welcomeMessage in fallback mode');

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
