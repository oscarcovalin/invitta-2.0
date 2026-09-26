const assert = require('node:assert/strict');
const fs = require('node:fs');

const portal = fs.readFileSync('./portal.html', 'utf8');
const hostLogin = portal.slice(portal.indexOf('const res = await auth.loginHostByPin('),
  portal.indexOf('// 4. Formulario Profesional'));
const authHandlers = fs.readFileSync('./api-handlers/auth/invitations.js', 'utf8');

assert.ok(hostLogin.includes("window.location.href = 'organizador-mesas.html'"),
  'A host login must go to the fixed internal organizer page');
assert.ok(!hostLogin.includes("get('next')"),
  'A URL-provided next parameter must not control post-login navigation');
assert.match(portal, /Crear cuenta profesional/);
assert.match(portal, /\/api\/auth\/register/);
assert.match(portal, /Olvidé mi contraseña/);
assert.match(portal, /\/api\/auth\/invitations/);
assert.match(portal, /\/api\/auth\/recover/);
assert.match(authHandlers, /isPlatformAdmin\(user\)/);
assert.doesNotMatch(fs.readFileSync('./lib/supabase-auth-service.cjs', 'utf8'), /INVITTA_BOOTSTRAP_ADMIN_EMAIL/);
assert.doesNotMatch(authHandlers, /service[_-]?role|secretKey/i);
console.log('Host PIN login cannot redirect to a URL-supplied destination.');
