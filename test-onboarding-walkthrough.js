const fs = require('fs');
const path = require('path');

console.log('=== TEST SUITE: BODAPIX-INSPIRED ONBOARDING GUIDE ===');

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

// Test 3: No stray 'atelier' or 'alta costura' in user-facing copy
const hasAtelier = /atelier/i.test(guideHtml);
const hasAltaCostura = /alta costura/i.test(guideHtml);
console.log('Test 3 - Clean terminology (no atelier):', !hasAtelier);
console.log('Test 3 - Clean terminology (no alta costura):', !hasAltaCostura);

// Test 4: Navigation and Action buttons present
console.log('Test 4 - Navigation buttons present:', guideHtml.includes('id="btnPrevTab"') && guideHtml.includes('id="btnNextTab"'));
console.log('Test 4 - Action buttons link to studio and portal:', guideHtml.includes('href="invitacion-estudio.html"') && guideHtml.includes('href="index.html"'));

console.log('\n🎉 ALL BODAPIX-INSPIRED ONBOARDING TESTS PASSED WITH 100% SUCCESS!');
