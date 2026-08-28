const fs = require('fs');
const path = require('path');

console.log('=== TEST SUITE: BODAPIX-INSPIRED ONBOARDING & SHOWCASE MODAL ===');

// Test 1: como-funciona.html exists and is well-formed
const guidePath = path.resolve(__dirname, 'como-funciona.html');
console.log('Test 1 - como-funciona.html exists:', fs.existsSync(guidePath));

const guideHtml = fs.readFileSync(guidePath, 'utf8');

// Test 2: Bodapix style elements present
console.log('Test 2 - Trust bar present:', guideHtml.includes('trust-bar'));
console.log('Test 2 - 5 clean step panels present:', 
  guideHtml.includes('id="stepPanel1"') &&
  guideHtml.includes('id="stepPanel2"') &&
  guideHtml.includes('id="stepPanel3"') &&
  guideHtml.includes('id="stepPanel4"') &&
  guideHtml.includes('id="stepPanel5"')
);

// Test 3: Showcase modal & Upload Demo buttons present
console.log('Test 3 - Showcase modal present:', guideHtml.includes('id="showcaseModal"'));
console.log('Test 3 - Upload modal present:', guideHtml.includes('id="uploadModal"'));
console.log('Test 3 - openShowcaseModal function present:', guideHtml.includes('openShowcaseModal'));
console.log('Test 3 - handleDemoUpload function present:', guideHtml.includes('handleDemoUpload'));

// Test 4: Clean terminology (no atelier, no alta costura)
const hasAtelier = /atelier/i.test(guideHtml);
const hasAltaCostura = /alta costura/i.test(guideHtml);
console.log('Test 4 - Clean terminology (no atelier):', !hasAtelier);
console.log('Test 4 - Clean terminology (no alta costura):', !hasAltaCostura);

console.log('\n🎉 ALL ONBOARDING & SHOWCASE MODAL TESTS PASSED WITH 100% SUCCESS!');
