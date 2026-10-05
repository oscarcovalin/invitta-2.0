const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const TemplateEngine = require('./template-engine.js');
const Adapter = require('./invitation-document-adapter.js');
const { readPublicReview } = require('./lib/public-review.cjs');

const projectId = '20000000-0000-4000-8000-000000000011';
const documentId = '30000000-0000-4000-8000-000000000011';
const title = '¡Nuestra noche de estrellas!';
const config = { eventType: 'boda', name: 'Sofía y Miguel', brideName: 'Sofía', groomName: 'Miguel',
  eventDateISO: '2027-05-01T18:00:00-06:00', stardust: { enabled: true, overlayTitle: title } };
function headline(configuration) {
  const html = TemplateEngine.generateHTML(configuration);
  return html.match(/<h2[^>]*id="stardustOverlayTitle"[^>]*>([\s\S]*?)<\/h2>/)?.[1].trim();
}
assert.equal(headline(config), title, 'custom overlay title must render');
assert.equal(headline({ ...config, stardust: {} }), '¡Ilumina a los Novios!');
assert.equal(headline({ ...config, stardust: { overlayTitle: '   ' } }), '¡Ilumina a los Novios!');
assert.equal(headline({ ...config, stardust: { overlayTitle: 42 } }), '¡Ilumina a los Novios!');
const hostile = '</h2><script>alert("x")</script><img onerror="bad()"> & \'';
const safeTitle = headline({ ...config, stardust: { overlayTitle: hostile } });
assert.equal(safeTitle, '&lt;/h2&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&lt;img onerror=&quot;bad()&quot;&gt; &amp; &#39;');
assert.ok(!TemplateEngine.generateHTML({ ...config, stardust: { overlayTitle: hostile } }).includes(hostile), 'CONFIG must also keep script closing tags escaped');

// Execute the real Studio binding and hydration blocks, not a copied handler.
const source = fs.readFileSync('./app.js', 'utf8');
const field = { value: '', handlers: {}, addEventListener(event, fn) { this.handlers[event] = fn; } };
const context = { currentConfig: { stardust: {} }, TemplateEngine, updates: 0,
  document: { getElementById: id => id === 'inputStardustOverlayTitle' ? field : null },
  schedulePreviewUpdate() { context.updates++; } };
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function setObjectPath('), source.indexOf('// ==================== DYNAMIC LISTS')), context);
const bindingsStart = source.indexOf('  const bindings = [', source.indexOf('function setupInputListeners()'));
vm.runInContext(source.slice(bindingsStart, source.indexOf('  const checkGift =', bindingsStart)), context);
assert.equal(typeof field.handlers.input, 'function', 'Studio must bind the editable title');
field.handlers.input({ target: { value: title } });
assert.equal(context.currentConfig.stardust.overlayTitle, title);
assert.equal(context.updates, 1);
const hydrateStart = source.indexOf('  // Polvo de Estrellas', source.indexOf('function populateForm()'));
vm.runInContext(source.slice(hydrateStart, source.indexOf('  // Itinerario', hydrateStart)), context);
assert.equal(field.value, title, 'Studio must restore a saved title');
assert.ok(fs.readFileSync('./invitacion-estudio.html', 'utf8').includes('for="inputStardustOverlayTitle"'), 'the field needs an accessible label');

const saved = Adapter.fromLegacyTemplateConfig(JSON.parse(JSON.stringify(config)), { projectId }).document;
const restored = Adapter.toLegacyTemplateConfig(JSON.parse(JSON.stringify(saved)));
assert.equal(restored.stardust.overlayTitle, title, 'document/JSON round-trip must preserve the title');
assert.equal(headline(restored), title);

(async () => {
  const project = { id: projectId, status: 'published', published_document_id: documentId };
  const review = await readPublicReview({ slug: 'sofia-miguel', config: { url: 'https://example.supabase.co', secretKey: 'sb_secret_synthetic_test' },
    fetchImpl: async url => ({ ok: true, json: async () => url.includes('/invitation_projects?')
      ? [project] : [{ revision: saved.revision, document: saved }] }) });
  assert.equal(review.presentation.stardust.overlayTitle, title, 'public presentation must retain the saved title');
  assert.equal(headline(review.presentation), title);
  console.log('Editable Stardust title survives Studio/document/public rendering and remains text-only.');
})().catch(error => { console.error(error); process.exitCode = 1; });
