const assert = require('node:assert/strict');
const fs = require('node:fs');

const portal = fs.readFileSync('./portal.html', 'utf8');
const hostLogin = portal.slice(portal.indexOf('const res = await auth.loginHostByPin('),
  portal.indexOf('// 4. Formulario Profesional'));

assert.ok(hostLogin.includes("window.location.href = 'organizador-mesas.html'"),
  'A host login must go to the fixed internal organizer page');
assert.ok(!hostLogin.includes("get('next')"),
  'A URL-provided next parameter must not control post-login navigation');
console.log('Host PIN login cannot redirect to a URL-supplied destination.');
