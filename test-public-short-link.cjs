const assert = require('node:assert/strict');
const fs = require('node:fs');

const config = JSON.parse(fs.readFileSync('./vercel.json', 'utf8'));
const shortLink = (config.redirects || []).find(rule => rule.source === '/mara-y-fer');
assert.ok(shortLink, 'Mara and Fer need a short, exact public route.');
assert.equal(shortLink.permanent, false, 'Keep the mapping reversible instead of caching a permanent redirect.');
const destination = new URL(shortLink.destination, 'https://invitta.example');
assert.equal(destination.origin, 'https://invitta.example', 'Do not send invitation traffic to another service.');
assert.equal(destination.pathname, '/invitacion-publica.html');
assert.equal(destination.searchParams.get('slug'), 'p-1f4e41cc-a44a-41f3-b82e-bbd57d0f66bc');
assert.deepEqual([...destination.searchParams.keys()], ['slug']);
assert.ok(!shortLink.source.includes('*'), 'Only the requested invitation path should redirect.');
assert.deepEqual(config.rewrites, [
  { source: '/invitacion-publica.html', destination: '/api/index?route=public/share-preview' },
  { source: '/api/:route*', destination: '/api/index?route=:route*' },
], 'Keep existing invitation links and private API routing unchanged.');
assert.equal(config.headers[0].source, '/(.*)');
assert.ok(config.headers[0].headers.some(header => header.key === 'X-Frame-Options' && header.value === 'DENY'));
console.log('The short Mara and Fer link resolves to the existing public invitation without changing legacy routes.');
