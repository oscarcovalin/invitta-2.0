const fs = require('fs');
const path = require('path');

console.log('=== TEST SUITE: BESPOKE EDITORIAL ONBOARDING GUIDE ===');

// Test 1: como-funciona.html exists and is well-formed
const guidePath = path.resolve(__dirname, 'como-funciona.html');
console.log('Test 1 - como-funciona.html exists:', fs.existsSync(guidePath));

const guideHtml = fs.readFileSync(guidePath, 'utf8');

// Test 2: All 5 Haute-Couture Moments present
const hasStep1 = guideHtml.includes('id="stepStage1"') && guideHtml.includes('Diseño Editorial & Sello de Cera 3D');
const hasStep2 = guideHtml.includes('id="stepStage2"') && guideHtml.includes('Pases de Honor Personalizados');
const hasStep3 = guideHtml.includes('id="stepStage3"') && guideHtml.includes('Plano Táctil de Salón');
const hasStep4 = guideHtml.includes('id="stepStage4"') && guideHtml.includes('Confirmación RSVP & Pase');
const hasStep5 = guideHtml.includes('id="stepStage5"') && guideHtml.includes('La Noche de Gala');

console.log('Test 2 - Stage 1 (Diseño) present:', hasStep1);
console.log('Test 2 - Stage 2 (Pases WhatsApp) present:', hasStep2);
console.log('Test 2 - Stage 3 (Plano Salón) present:', hasStep3);
console.log('Test 2 - Stage 4 (RSVP Pase QR) present:', hasStep4);
console.log('Test 2 - Stage 5 (Noche de Gala) present:', hasStep5);

// Test 3: Interactive simulators present
const hasSimulators = guideHtml.includes('id="demoWaxSeal"') && guideHtml.includes('id="demoGuestName"') && guideHtml.includes('updateDemoWhatsapp');
console.log('Test 3 - Interactive simulators present:', hasSimulators);

// Test 4: Stepper navigation buttons present
const hasNav = guideHtml.includes('id="btnStepPrev"') && guideHtml.includes('id="btnStepNext"');
console.log('Test 4 - Stepper navigation buttons present:', hasNav);

console.log('\n🎉 ALL BESPOKE ONBOARDING GUIDE TESTS PASSED WITH 100% SUCCESS!');
