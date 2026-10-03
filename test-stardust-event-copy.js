const assert = require('node:assert/strict');
const TemplateEngine = require('./template-engine.js');

function renderFor(eventType) {
  const config = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig));
  config.eventType = eventType;
  config.name = 'Janna Sharlot';
  config.brideName = 'Janna Sharlot';
  config.groomName = eventType === 'boda' ? 'Luis' : '';
  return TemplateEngine.generateHTML(config, 'vino');
}

const xvHtml = renderFor('xv');
assert.ok(xvHtml.includes('¡Ilumina sus XV años!'), 'XV invitations should use XV-specific stardust copy');
assert.ok(!xvHtml.includes('¡Ilumina a los Novios!'), 'XV invitations must not refer to newlyweds');

const weddingHtml = renderFor('boda');
assert.ok(weddingHtml.includes('¡Ilumina a los Novios!'), 'weddings should retain the newlyweds copy');

const otherEventHtml = renderFor('social');
assert.ok(otherEventHtml.includes('¡Ilumina la celebración!'), 'other events should use generic celebration copy');
assert.ok(!otherEventHtml.includes('¡Ilumina sus XV años!'), 'non-XV events must not use XV-specific copy');

console.log('Stardust headline follows the invitation event type.');
