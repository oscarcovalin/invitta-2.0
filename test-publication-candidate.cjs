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

const invalidImage = structuredClone(document);
invalidImage.assets.hero.storagePath = `${documentId}/hero/${assetId}.webp`;
assert.throws(() => buildPublicationCandidate({ documentId, document: invalidImage }), /Invalid publication image/);

assert.throws(() => buildPublicationCandidate({ documentId: 'invalid', document }), /Invalid publication source/);
assert.throws(() => buildPublicationCandidate({ documentId, document: { ...document, revision: 0 } }), /Invalid publication source/);
assert.throws(() => buildPublicationCandidate({ documentId, document: { ...document, schemaVersion: 2 } }), /Invalid publication source/);
console.log('Publication candidate separates public artifact and private image manifest.');
