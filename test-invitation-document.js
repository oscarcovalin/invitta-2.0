const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  INVITATION_SCHEMA_VERSION,
  validateInvitationDocument
} = require('./invitation-document.js');

const schema = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'schemas', 'invitation-document.schema.json'),
  'utf8'
));
const weddingFixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'invitation-document.v1.json'),
  'utf8'
));
const quinceaneraFixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'invitation-document-xv.v1.json'),
  'utf8'
));

assert.strictEqual(INVITATION_SCHEMA_VERSION, 1);
assert.strictEqual(schema.$id, 'https://invitta.mx/schemas/invitation-document.v1.json');
assert.deepStrictEqual(schema.required, [
  'schemaVersion', 'projectId', 'revision', 'event', 'content', 'design', 'sections', 'assets'
]);

for (const fixture of [weddingFixture, quinceaneraFixture]) {
  const result = validateInvitationDocument(fixture);
  assert.strictEqual(result.valid, true, result.errors.join('\n'));
}

const invalid = structuredClone(weddingFixture);
invalid.assets.hero = { storagePath: 'data:image/png;base64,AAAA' };
const invalidResult = validateInvitationDocument(invalid);
assert.strictEqual(invalidResult.valid, false);
assert.ok(invalidResult.errors.some((error) => error.includes('Storage')));

console.log('Invitation document v1 contract is valid.');
