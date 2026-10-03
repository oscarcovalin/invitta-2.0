const assert = require('node:assert/strict');
const fs = require('node:fs');

const portal = fs.readFileSync('./portal.html', 'utf8');

for (const id of ['formAuthHost', 'inputAuthHostCode', 'inputAuthHostPin']) {
  assert.match(portal, new RegExp(`id="${id}"`), `The host sign-in needs ${id}`);
}
assert.match(portal, /auth\.loginHostByPin\(code, pin\)/,
  'The host form must authenticate using the supplied code and PIN');
assert.match(portal, /window\.location\.href = 'organizador-mesas\.html'/,
  'A successful host login must open the internal organizer');
assert.match(portal, /invitacion-estudio\.html\?project=\$\{encodeURIComponent\(e\.id\)\}/,
  'Each cloud project must open its own Studio invitation');
assert.doesNotMatch(portal, /invitacion-estudio\.html\?role=/,
  'Portal links must not grant Studio editing via URL role');

console.log('Current portal host login and Studio links are wired as expected.');
