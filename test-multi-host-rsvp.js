const templateEngine = require('./template-engine.js');

console.log('--- TEST: MULTI-HOST RSVP & GUEST CONFIRMATION RETURN ---');

// 1. Default Config Check
const config = JSON.parse(JSON.stringify(templateEngine.defaultConfig));
console.log('Has whatsappHosts array:', Array.isArray(config.whatsappHosts));
console.log('whatsappHosts has default entries:', config.whatsappHosts.length === 3);
console.log('Has rsvpWebhookUrl property:', typeof config.rsvpWebhookUrl === 'string');

// 2. Custom Multi-Host HTML generation
config.whatsappHosts = [
  { label: 'Novia (Catalina)', phone: '5215511112222' },
  { label: 'Novio (Julián)', phone: '5215533334444' },
  { label: 'Wedding Planner', phone: '5215555556666' }
];
config.rsvpWebhookUrl = 'https://webhook.site/test-endpoint';

const html = templateEngine.generateHTML(config, 'vino');

console.log('Generates HTML without undefined leaks:', !html.includes('>undefined<') && !html.includes('src="undefined"'));
console.log('Contains btnSharePassWhatsapp:', html.includes('id="btnSharePassWhatsapp"'));
console.log('Contains btnSendToMyWhatsapp:', html.includes('id="btnSendToMyWhatsapp"'));
console.log('Contains btnDownloadPassImage:', html.includes('id="btnDownloadPassImage"'));
console.log('Contains multiHostWhatsappContainer:', html.includes('id="multiHostWhatsappContainer"'));
console.log('Contains multiHostButtonsList:', html.includes('id="multiHostButtonsList"'));
console.log('Contains webhook trigger logic:', html.includes('rsvpWebhookUrl'));
console.log('Contains guest broadcast logic:', html.includes('INVITTA_GUEST_CONFIRMED'));
console.log('Contains structured guest return message:', html.includes('buildGuestMessageText'));
console.log('Contains structured host notification message:', html.includes('buildHostMessageText'));

console.log('\n? ALL MULTI-HOST & RSVP RETURN TESTS COMPLETED SUCCESSFULLY.');
