const fs = require('fs');
const path = require('path');
const GuestManager = require('./guest-manager.js');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log("\n🧪 Testing Invitation Creator Module & Cross-Ecosystem Integration...");

// 1. Check invitacion-estudio.html (Original Studio Invitation Generator) exists
const studioHtml = fs.readFileSync(path.join(__dirname, 'invitacion-estudio.html'), 'utf8');
assert(studioHtml.includes('Invitta Studio'), 'invitacion-estudio.html contains main title');
assert(studioHtml.includes('template-engine.js') && studioHtml.includes('app.js'), 'Connects to template-engine.js and app.js');
assert(studioHtml.includes('selectEventType'), 'Contains event type switcher');
assert(studioHtml.includes('groupWeddingNames'), 'Contains dual names for wedding');
assert(studioHtml.includes('btnExportHtml'), 'Contains export HTML button');

// 2. Check portal.html contains link to invitacion-estudio.html
const portalHtml = fs.readFileSync(path.join(__dirname, 'portal.html'), 'utf8');
assert(portalHtml.includes('invitacion-estudio.html'), 'portal.html links to invitacion-estudio.html');
assert(portalHtml.includes('Estudio de Invitación Digital'), 'portal.html contains original studio card');

// 3. Check portal.html contains link to invitacion-estudio.html
const indexHtml = fs.readFileSync(path.join(__dirname, 'portal.html'), 'utf8');
assert(indexHtml.includes('invitacion-estudio.html'), 'portal.html sidebar links to invitacion-estudio.html');

// 4. Check invitacion.html (Real Live Digital Webpage) exists
const liveHtml = fs.readFileSync(path.join(__dirname, 'invitacion.html'), 'utf8');
assert(liveHtml.includes('Catalina & Julián') || liveHtml.includes('Nuestra Boda'), 'invitacion.html contains full wedding invitation content');
assert(liveHtml.includes('id="vipBanner"'), 'invitacion.html includes VIP banner personalization');
assert(liveHtml.includes('id="itinerario"'), 'invitacion.html includes full itinerary program');
assert(indexHtml.includes('href="invitacion.html"'), 'portal.html links to invitacion.html for Ver Invitación Real');
assert(portalHtml.includes('href="invitacion.html"'), 'portal.html links to invitacion.html for Invitación Real');

// 5. Test GuestManager with custom invitation config
const manager = new GuestManager();
assert(typeof manager.getWhatsAppLink === 'function', 'GuestManager generates WhatsApp link');
const guest = manager.state.guests[0];
const waLink = manager.getWhatsAppLink(guest);
assert((waLink.includes('wa.me') || waLink.includes('whatsapp.com')) && waLink.includes('text='), 'WhatsApp link generated with invitation data');
assert(waLink.includes('invitacion.html'), 'WhatsApp link points to invitacion.html');

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
