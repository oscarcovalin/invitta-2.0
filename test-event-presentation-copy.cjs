const assert = require('node:assert/strict');
const TemplateEngine = require('./template-engine.js');

function render(eventType, overrides = {}) {
  const config = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig));
  Object.assign(config, {
    eventType, name: 'Celebrante de prueba', brideName: 'Novia de prueba', groomName: 'Novio de prueba',
    stardust: { enabled: true, time: '21:30' }, sharedAlbum: { enabled: true },
    music: { enabled: true, url: 'assets/musica-boda-custom.mp3' },
  }, overrides);
  return TemplateEngine.generateHTML(config);
}

const xv = render('xv');
assert.match(xv, /21:30 · Vals Principal/);
assert.match(xv, /iluminar mi vals principal/);
assert.match(xv, /Dedicatoria o mensaje para la quinceañera/);
assert.match(xv, /Galería Privada de la Quinceañera/);
assert.match(xv, /Canción de la Quinceañera/);
assert.match(xv, /¡Ilumina sus XV años!/);

const wedding = render('boda');
assert.match(wedding, /21:30 · Primer Baile/);
assert.match(wedding, /iluminar nuestro primer baile/);
assert.match(wedding, /Dedicatoria o mensaje para los novios/);
assert.match(wedding, /Galería Privada de Novios/);
assert.match(wedding, /Canción de los Novios/);

for (const eventType of ['other', 'social']) {
  const other = render(eventType);
  assert.match(other, /21:30 · Momento Mágico/);
  assert.match(other, /celebrar este momento inolvidable/);
  assert.match(other, /Dedicatoria o mensaje para los anfitriones/);
  assert.match(other, /Galería Privada de los Anfitriones/);
  assert.match(other, /Música del Evento/);
  assert.match(other, /¡Ilumina la celebración!/);
}

const custom = render('xv', {
  stardust: { enabled: true, text: 'Una sorpresa escrita por la familia', time: '20:00' },
  sharedAlbum: { enabled: true, description: 'Nuestros recuerdos personalizados' },
  music: { enabled: true, title: 'Canción elegida por el cliente' },
});
assert.match(custom, /Una sorpresa escrita por la familia/);
assert.match(custom, /Nuestros recuerdos personalizados/);
assert.match(custom, /Canción elegida por el cliente/);
assert.match(custom, /INVITTA_PUBLIC_RSVP_SUBMIT/);
assert.match(custom, /activeSubmissionId/);
assert.doesNotMatch(custom, /mode: 'no-cors'/);
assert.doesNotMatch(custom, /Auto-trigger WhatsApp/);

console.log('Event-specific fallback copy preserves customization and the confirmed RSVP flow.');
