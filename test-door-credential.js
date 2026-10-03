const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { signCredential, verifyCredential, digestCredential } = require('./lib/door-credential.cjs');
const project = 'aaaabbbb-cccc-4ddd-8eee-ffffffffffff';
const ticket = 'bbbbcccc-dddd-4eee-8fff-aaaaaaaaaaaa';
const secret = crypto.randomBytes(32).toString('hex');
const credential = signCredential(project, ticket, secret);
assert.equal(credential, signCredential(project, ticket, secret), 'Retry reconstructs same credential');
assert.deepEqual(verifyCredential(credential, secret), { projectId: project, ticketId: ticket });
assert.match(digestCredential(credential), /^[0-9a-f]{64}$/);
for (const value of [null, '', 'folio-123', JSON.stringify({ folio: ticket, pases: 100 }),
  credential.replace(project, ticket), credential.slice(0, -1) + (credential.endsWith('A') ? 'B' : 'A'),
  credential + '.extra', credential.toUpperCase()]) {
  assert.throws(() => verifyCredential(value, secret), e => e.status === 422, 'Malformed/forged QR rejected');
}
assert.throws(() => verifyCredential(credential, secret + 'x'), e => e.status === 422);
for (const key of [undefined, '', 'short', ' '.repeat(32)]) {
  assert.throws(() => signCredential(project, ticket, key), e => e.status === 503, 'No fallback secret');
}
assert.throws(() => signCredential('not-project', ticket, secret), e => e.status === 422);
console.log('PASS: deterministic signed credential and forgery checks');
