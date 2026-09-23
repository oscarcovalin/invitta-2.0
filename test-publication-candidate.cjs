const assert = require('node:assert/strict');
const { buildPublicationCandidate } = require('./lib/publication-candidate.cjs');

const projectId = '20000000-0000-4000-8000-000000000001';
const documentId = '30000000-0000-4000-8000-000000000001';
const assetId = '40000000-0000-4000-8000-000000000001';
const storagePath = `${projectId}/hero/${assetId}.webp`;
const document = {
  schemaVersion: 1, projectId, revision: 2,
  content: { primaryName: 'Ana', secondaryName: 'Luis', privateNote: 'SECRET_NOTE' },
  sections: [{ id: 'hero', enabled: true }],
  assets: { hero: { storagePath } },
  legacy: { config: { photos: { hero: storagePath }, internalToken: 'SECRET_TOKEN' } },
};

const candidate = buildPublicationCandidate({ documentId, document });
assert.deepEqual(candidate.publicArtifact.imageFields, ['photos.hero']);
assert.equal(candidate.publicArtifact.content.content.primaryName, 'Ana');
assert.equal(candidate.source.projectId, projectId);
assert.equal(candidate.source.documentId, documentId);
assert.equal(candidate.source.revision, 2);
assert.deepEqual(candidate.privateImages, [{ field: 'photos.hero', storagePath }]);
assert.doesNotMatch(JSON.stringify(candidate.publicArtifact), /SECRET_|storagePath|invitation-assets|legacy/);

const bundled = structuredClone(document);
bundled.assets.hero.storagePath = 'assets/hero-boda-hd.jpg';
const bundledCandidate = buildPublicationCandidate({ documentId, document: bundled });
assert.deepEqual(bundledCandidate.publicArtifact.bundledImages,
  [{ field: 'photos.hero', publicPath: 'assets/hero-boda-hd.jpg' }]);
assert.deepEqual(bundledCandidate.privateImages, []);

const sample = structuredClone(document);
sample.content.primaryName = 'Catalina';
assert.throws(() => buildPublicationCandidate({ documentId, document: sample }), /sample/i);

const sampleStory = structuredClone(document);
sampleStory.sections.push({ id: 'story', enabled: true });
sampleStory.legacy.config.story = { enabled: true, title: 'Nuestra Historia' };
assert.throws(() => buildPublicationCandidate({ documentId, document: sampleStory }), (error) =>
  error.fields.includes('story.title'));

const inconsistentDate = structuredClone(document);
inconsistentDate.event = { startsAt: '2027-04-18T18:00:00-06:00' };
inconsistentDate.legacy.config.eventDateLabel = '19 de Abril, 2027';
inconsistentDate.legacy.config.eventDateShort = '18 · Abril · 2027';
assert.throws(() => buildPublicationCandidate({ documentId, document: inconsistentDate }), (error) =>
  error.code === 'PUBLICATION_DATE_MISMATCH' && error.fields.includes('dateLabels.long'));
inconsistentDate.legacy.config.eventDateLabel = '18 de Abril, 2027';
assert.doesNotThrow(() => buildPublicationCandidate({ documentId, document: inconsistentDate }));
inconsistentDate.legacy.config.eventDateShort = '18 · Mayo · 2027';
assert.throws(() => buildPublicationCandidate({ documentId, document: inconsistentDate }), (error) =>
  error.code === 'PUBLICATION_DATE_MISMATCH' && error.fields.includes('dateLabels.short'));
inconsistentDate.legacy.config.eventDateShort = '18 · Abril · 2027';
inconsistentDate.legacy.config.eventDateLabel = 'Domingo por la tarde';
assert.doesNotThrow(() => buildPublicationCandidate({ documentId, document: inconsistentDate }));

const invalidImage = structuredClone(document);
invalidImage.assets.hero.storagePath = `${documentId}/hero/${assetId}.webp`;
assert.throws(() => buildPublicationCandidate({ documentId, document: invalidImage }), /Invalid publication image/);

const oldEmptySections = structuredClone(document);
oldEmptySections.sections = [];
assert.throws(() => buildPublicationCandidate({ documentId, document: oldEmptySections }), /enabled section/i);
const allHiddenSections = structuredClone(document);
allHiddenSections.sections = [{ id: 'hero', enabled: false }];
assert.throws(() => buildPublicationCandidate({ documentId, document: allHiddenSections }), /enabled section/i);
const hiddenByLegacy = structuredClone(document);
hiddenByLegacy.sections = [{ id: 'story', enabled: true }, { id: 'unknown', enabled: true }];
hiddenByLegacy.legacy.config.story = { enabled: false, title: 'No visible' };
assert.throws(() => buildPublicationCandidate({ documentId, document: hiddenByLegacy }), /enabled section/i);

assert.throws(() => buildPublicationCandidate({ documentId: 'invalid', document }), /Invalid publication source/);
assert.throws(() => buildPublicationCandidate({ documentId, document: { ...document, revision: 0 } }), /Invalid publication source/);
assert.throws(() => buildPublicationCandidate({ documentId, document: { ...document, schemaVersion: 2 } }), /Invalid publication source/);
console.log('Publication candidate separates public artifact and private image manifest.');
