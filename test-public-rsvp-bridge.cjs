const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const script = fs.readFileSync('./public-rsvp-bridge.js', 'utf8');
const slug = 'p-a769a84d-ca84-4dad-a1bd-6e35ac66ea21';
const requestId = 'b417c2f7-4df2-4ef9-b57c-92f6f3dd1f88';

function createBridge(response = { ok: true, json: async () => ({ success: true }) }) {
  const listeners = new Map();
  const fetchCalls = [];
  const window = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    fetch: async (...args) => { fetchCalls.push(args); return response; },
  };
  vm.runInNewContext(script, { window });
  return { bridge: window.InvittaPublicRsvpBridge, listeners, fetchCalls };
}

function messageEvent(frameWindow, data, origin = 'null') {
  const replies = [];
  frameWindow.postMessage = (...args) => replies.push(args);
  return { event: { source: frameWindow, origin, data }, replies };
}

(async () => {
  const { bridge, listeners, fetchCalls } = createBridge();
  const frameWindow = {};
  const frame = { contentWindow: frameWindow };
  const detach = bridge.attach(frame, slug);
  const { event, replies } = messageEvent(frameWindow, {
    type: 'INVITTA_PUBLIC_RSVP_SUBMIT',
    requestId,
    payload: {
      slug: 'attacker-controlled-slug',
      submissionId: requestId,
      guestName: 'Prueba Janna',
      email: '',
      attendance: 'confirmed',
      passes: 1,
      dietary: '',
      unexpected: 'must not be forwarded',
    },
  });

  await listeners.get('message')(event);

  assert.equal(fetchCalls.length, 1, 'the parent should forward an RSVP from its own frame');
  assert.equal(fetchCalls[0][0], '/api/public/rsvp');
  assert.equal(fetchCalls[0][1].credentials, 'omit');
  assert.deepEqual(JSON.parse(fetchCalls[0][1].body), {
    slug,
    submissionId: requestId,
    guestName: 'Prueba Janna',
    email: '',
    attendance: 'confirmed',
    passes: 1,
    dietary: '',
  });
  assert.equal(replies.length, 1);
  assert.equal(replies[0][0].type, 'INVITTA_PUBLIC_RSVP_RESULT');
  assert.equal(replies[0][0].requestId, requestId);
  assert.equal(replies[0][0].success, true);
  assert.equal(replies[0][1], '*');

  const invalidSource = messageEvent({}, event.data);
  await listeners.get('message')({ ...invalidSource.event, origin: 'null' });
  const wrongOrigin = messageEvent(frameWindow, event.data, 'https://attacker.example');
  await listeners.get('message')(wrongOrigin.event);
  assert.equal(fetchCalls.length, 1, 'messages from another window or origin must be ignored');
  assert.equal(wrongOrigin.replies.length, 0);

  detach();
  assert.equal(listeners.has('message'), false, 'the bridge should detach cleanly');
  console.log('Public RSVP bridge accepts only its sandboxed frame and pins writes to the trusted invitation slug.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
