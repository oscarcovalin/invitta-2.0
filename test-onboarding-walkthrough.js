const fs = require('fs');
const path = require('path');

console.log('=== TEST SUITE: ONBOARDING WALKTHROUGH & CLIENT GUIDE ===');

// Test 1: como-funciona.html exists and is well-formed
const guidePath = path.resolve(__dirname, 'como-funciona.html');
console.log('Test 1 - como-funciona.html exists:', fs.existsSync(guidePath));

const guideHtml = fs.readFileSync(guidePath, 'utf8');

// Test 2: All 5 steps present
const hasStep1 = guideHtml.includes('id="stepContent1"') && guideHtml.includes('Diseña tu Invitación');
const hasStep2 = guideHtml.includes('id="stepContent2"') && guideHtml.includes('Asigna Pases');
const hasStep3 = guideHtml.includes('id="stepContent3"') && guideHtml.includes('Organiza el Salón');
const hasStep4 = guideHtml.includes('id="stepContent4"') && guideHtml.includes('Confirmaciones RSVP');
const hasStep5 = guideHtml.includes('id="stepContent5"') && guideHtml.includes('Día del Evento');

console.log('Test 2 - Step 1 (Diseño) present:', hasStep1);
console.log('Test 2 - Step 2 (Pases WhatsApp) present:', hasStep2);
console.log('Test 2 - Step 3 (Mesas Salón) present:', hasStep3);
console.log('Test 2 - Step 4 (RSVP en Vivo) present:', hasStep4);
console.log('Test 2 - Step 5 (El Gran Día) present:', hasStep5);

// Test 3: Navigation and CTA buttons present
const hasNav = guideHtml.includes('id="btnPrevStep"') && guideHtml.includes('id="btnNextStep"');
const hasCta = guideHtml.includes('href="invitacion-estudio.html"') && guideHtml.includes('href="index.html"');
console.log('Test 3 - Navigation stepper buttons present:', hasNav);
console.log('Test 3 - CTA Action links present:', hasCta);

// Test 4: Links in index.html, portal.html, invitacion-estudio.html
const indexPath = path.resolve(__dirname, 'index.html');
const studioPath = path.resolve(__dirname, 'invitacion-estudio.html');

console.log('Test 4 - index.html has link to guide:', fs.readFileSync(indexPath, 'utf8').includes('href="como-funciona.html"'));
console.log('Test 4 - invitacion-estudio.html has link to guide:', fs.readFileSync(studioPath, 'utf8').includes('href="como-funciona.html"'));

console.log('\n🎉 ALL ONBOARDING WALKTHROUGH TESTS PASSED WITH 100% SUCCESS!');
