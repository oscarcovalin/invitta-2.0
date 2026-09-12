const templateEngine = require('./template-engine.js');

const bodaConfig = JSON.parse(JSON.stringify(templateEngine.defaultConfig));
bodaConfig.eventType = 'boda';
bodaConfig.court = ['Camila Ortiz', 'Renata Vega', 'Diego Fuentes', 'Emiliano Cruz', 'Ximena Paredes'];

const html = templateEngine.generateHTML(bodaConfig, 'vino');

let passed = true;

if (!html.includes('font-display-lg') || !html.includes('Camila Ortiz')) {
  console.error('? FAIL: Court names do not contain font-display-lg');
  passed = false;
}

if (html.includes('courtBlock') && html.includes('font-body-lg font-normal">')) {
  console.error('? FAIL: Court section still contains generic font-body-lg');
  passed = false;
}

if (passed) {
  console.log('? PASS: Court section uses luxury font-display-lg typography coherent with wedding styling.');
} else {
  process.exit(1);
}
