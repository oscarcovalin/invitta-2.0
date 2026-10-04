const assert = require('node:assert/strict');
const vm = require('node:vm');
const TemplateEngine = require('./template-engine.js');

const config = {
  ...structuredClone(TemplateEngine.defaultConfig), eventType: 'boda', brideName: 'Mara', groomName: 'Fer',
  whatsappHosts: [
    { label: 'Anfitrión Principal / Novia', phone: '+52 55 0000 0001' },
    { label: 'Segundo Anfitrión / Novio', phone: '+52 55 0000 0002' },
    { label: 'Planner', phone: '' },
  ],
};

function fixture(options = {}) {
  const html = TemplateEngine.generateHTML(options.config || config);
  const script = html.slice(html.indexOf('(function initRsvpPergamino()'), html.indexOf('// 6.5.'));
  const elements = new Map();
  const node = (id) => {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, {
        id, value: '', textContent: '', innerHTML: '', disabled: false, style: {}, dataset: {}, children: [], listeners: {},
        classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
        addEventListener(type, listener) { this.listeners[type] = listener; },
        appendChild(child) { this.children.push(child); },
        checkValidity: () => options.valid !== false, reportValidity() {}, reset() {},
      });
    }
    return elements.get(id);
  };
  const buttons = ['rsvpSubmit', 'rsvpSubmitHost1'].map((id, index) => {
    const button = node(id); button.dataset.rsvpHost = String(index); return button;
  });
  const calls = [];
  const chats = [];
  const window = {
    location: { origin: 'https://example.test' }, crypto: { randomUUID: () => '10000000-0000-4000-8000-000000000001' },
    dispatchEvent() {},
    open(...args) {
      calls.push(['open', ...args]);
      if (options.blocked) return null;
      const chat = { closed: false, opener: window, location: { replace(url) { chat.url = url; } }, close() { this.closed = true; } };
      chats.push(chat); return chat;
    },
  };
  window.parent = window;
  vm.runInNewContext(script, {
    CONFIG: options.config || config, isWedding: true, window,
    document: { getElementById: node, createElement: () => node('created-' + elements.size), querySelectorAll: () => buttons },
    urlParams: new URLSearchParams('slug=p-10000000-0000-4000-8000-000000000002'),
    escapeHTML: (text) => text, CustomEvent: function () {},
    QRCode: function () { throw new Error('Generic RSVP must not issue a legacy QR'); },
    setTimeout: (fn) => { fn(); return 1; }, clearTimeout() {},
    fetch: async (...args) => {
      calls.push(['save', ...args]);
      if (options.save) return options.save(...args);
      return { ok: options.fail !== true, json: async () => options.fail ? { error: 'Sin conexión' } : { success: true } };
    },
  });
  node('nombre').value = 'Ana López'; node('asistencia').value = 'si'; node('pases').value = '2';
  node('dieta').value = 'Vegano';
  const submit = (index = 0) => node('rsvpForm').listeners.submit({ preventDefault() {}, submitter: buttons[index] });
  return { html, node, buttons, submit, calls, chats };
}

(async () => {
  const yes = fixture();
  assert.match(yes.html, />Confirmar con Mara<\/button>/);
  assert.match(yes.html, />Confirmar con Fer<\/button>/);
  assert.equal(yes.node('pases').children.length, 5, 'named RSVP choices match the server limit');
  await yes.submit(1);
  assert.equal(yes.chats[0].opener, null);
  const url = new URL(yes.chats[0].url);
  assert.equal(url.pathname, '/525500000002');
  assert.match(url.searchParams.get('text'), /Ana López/);
  assert.match(url.searchParams.get('text'), /¡Sí, ahí estaré!/);
  assert.match(url.searchParams.get('text'), /Mara & Fer/);
  assert.match(url.searchParams.get('text'), /Lugares:.*2/);
  assert.doesNotMatch(url.searchParams.get('text'), /Folio|Mesa Asignada|de 2/);
  assert.equal(JSON.parse(yes.calls.find(c => c[0] === 'save')[2].body).attendance, 'confirmed');
  assert.match(yes.node('btnSharePassWhatsapp').textContent, /Fer/);
  assert.equal(yes.node('passTicketPergamino').style.display, 'none');

  const no = fixture(); no.node('asistencia').value = 'no';
  no.node('asistencia').listeners.change();
  await no.submit();
  const noMessage = new URL(no.chats[0].url).searchParams.get('text');
  assert.match(noMessage, /No podré asistir/);
  assert.doesNotMatch(noMessage, /Lugares:|Dieta:|Folio/);
  assert.equal(JSON.parse(no.calls.find(c => c[0] === 'save')[2].body).passes, 0);

  const failed = fixture({ fail: true }); await failed.submit(1);
  assert.equal(failed.chats[0].closed, true);
  assert.equal(failed.chats[0].url, undefined, 'never notify before persistence succeeds');
  assert.ok(failed.buttons.every(b => !b.disabled));
  assert.equal(failed.node('rsvpError').textContent, 'Sin conexión');
  const invalid = fixture({ valid: false }); await invalid.submit(); assert.equal(invalid.calls.length, 0);
  const blocked = fixture({ blocked: true }); await blocked.submit(1);
  assert.match(blocked.node('rsvpSuccessMsg').textContent, /Abrir WhatsApp con Fer/);
  assert.match(blocked.node('btnSharePassWhatsapp').textContent, /Fer/);
  blocked.node('btnResetRsvp').listeners.click();
  assert.equal(blocked.buttons[0].textContent, 'Confirmar con Mara');
  assert.equal(blocked.buttons[1].textContent, 'Confirmar con Fer');

  let resolveSave;
  const busy = fixture({ save: () => new Promise(resolve => { resolveSave = resolve; }) });
  const pending = busy.submit(); await busy.submit(1);
  assert.equal(busy.calls.filter(c => c[0] === 'save').length, 1);
  assert.ok(busy.buttons.every(b => b.disabled));
  resolveSave({ ok: true, json: async () => ({ success: true }) }); await pending;

  const unsafe = fixture({ config: { ...config, whatsappHosts: [{ label: '<img onerror=evil()>', phone: '525500000001' }, { label: 'Bad', phone: 'javascript:evil' }] } });
  assert.doesNotMatch(unsafe.html, />Confirmar con <img/);
  const xv = TemplateEngine.generateHTML({ ...config, eventType: 'xv', name: 'Janna', whatsappHosts: [], whatsappNumber: '525500000001' });
  assert.match(xv, /id="rsvpSubmit"[^>]*>Enviar Confirmación/);
  console.log('Named RSVP hosts: saved yes/no, selected recipient, failure, popup fallback, concurrency and legacy compatibility.');
})().catch(error => { console.error(error); process.exitCode = 1; });
