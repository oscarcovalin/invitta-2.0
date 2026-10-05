'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const engine = require('./template-engine.js');
const adapter = require('./invitation-document-adapter.js');
const { buildPublicationCandidate } = require('./lib/publication-candidate.cjs');
const { publicPresentation } = require('./lib/public-review.cjs');

const config = structuredClone(engine.defaultConfig);
config.eventType = 'boda'; config.name = 'Test couple';
config.brideName = 'Test A'; config.groomName = 'Test B';
config.eventDateISO = '2027-11-14T18:00'; config.eventDateLabel = ''; config.eventDateShort = '';
config.story.enabled = false; config.giftRegistry.enabled = false;
config.lodging.enabled = false; config.sharedAlbum.enabled = false;
config.whatsappNumber = ''; config.whatsappHosts = [];
config.photos.gallery = ['assets/gallery-boda-1.jpg', '', 'assets/gallery-boda-2.jpg'];
config.photos.galleryFrame = 'torn-paper';
const rendered = engine.generateHTML(config, 'vino');
assert.equal((rendered.match(/class="gallery-item-wrap gallery-paper /g) || []).length, 2, 'Only nonempty gallery photos get paper frames');
assert.match(rendered, /class="gallery-paper-photo"/, 'White paper rim surrounds the photo mask');
assert.match(rendered, /-webkit-mask-image:/, 'Safari-compatible mask');
assert.match(rendered, /feDisplacementMap/, 'Irregular fibres, not a geometric zigzag');
assert.match(rendered, /if \(wrap.classList.contains\('gallery-paper'\)\) return;/, 'No parallax crop of paper photos');
for (const frame of [undefined, 'plain', 'unknown', '<script>']) {
  config.photos.galleryFrame = frame;
  assert.doesNotMatch(engine.generateHTML(config, 'vino'), /class="gallery-item-wrap gallery-paper /, 'Opt-in only; old invitations unchanged');
}
config.photos.galleryFrame = 'torn-paper';
const { document } = adapter.fromLegacyTemplateConfig(config, { projectId: '20000000-0000-4000-8000-000000000002', revision: 5 });
assert.equal(adapter.toLegacyTemplateConfig(document).photos.galleryFrame, 'torn-paper', 'Cloud document roundtrip preserves frame');
const candidate = buildPublicationCandidate({ documentId: '30000000-0000-4000-8000-000000000003', document });
const presentation = publicPresentation({ slug: 'test-couple', document, candidate });
assert.equal(presentation.photos.galleryFrame, 'torn-paper');
assert.match(engine.generateHTML(presentation, 'vino'), /class="gallery-item-wrap gallery-paper /, 'Published presentation retains frame');

// Execute the actual small form binding without loading unrelated Studio code.
const source = fs.readFileSync('app.js', 'utf8');
const binding = source.match(/function setupGalleryFrameControl\(\) \{[\s\S]*?\n\}/);
assert.ok(binding, 'Studio frame binding exists');
const control = { value: '', addEventListener(type, listener) { this[type] = listener; } };
const sandbox = { document: { getElementById: () => control }, currentConfig: {}, schedulePreviewUpdate() { sandbox.updated = true; } };
vm.runInNewContext(binding[0] + '\nsetupGalleryFrameControl();', sandbox);
control.change({ target: { value: 'torn-paper' } });
assert.equal(sandbox.currentConfig.photos.galleryFrame, 'torn-paper');
assert.equal(sandbox.updated, true);
control.change({ target: { value: 'unexpected' } });
assert.equal(sandbox.currentConfig.photos.galleryFrame, 'plain');
assert.match(fs.readFileSync('invitacion-estudio.html', 'utf8'), /<label for="selectGalleryFrame">/);
console.log('Paper gallery: render, isolation, cloud/public roundtrip and form binding passed.');
