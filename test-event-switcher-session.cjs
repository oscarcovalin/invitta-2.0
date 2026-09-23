const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('./organizador-mesas.html', 'utf8');
const start = html.indexOf('    const evm = window.EventVaultManager');
const end = html.indexOf('    // 1. Inicializar SeatingPlanner', start);
assert.ok(start >= 0 && end > start, 'Event switcher script exists');
const switcherScript = html.slice(start, end);

const events = [
  { slug: 'boda-ana-luis', name: 'Ana y Luis', type: 'boda' },
  { slug: 'xv-maria', name: 'XV María', type: 'xv' },
];

function element() {
  return {
    children: [], className: '', textContent: '',
    replaceChildren(...children) { this.children = children; },
    appendChild(child) { this.children.push(child); },
  };
}

async function runSwitcher(sessionResponse) {
  const container = element();
  const select = element();
  const sidebarLink = element();
  let activeSlug = events[0].slug;
  const vault = {
    activeEventSlug: activeSlug,
    getActiveEvent: () => events[0],
    getAllEvents: () => events,
    setActiveEventSlug: (slug) => { activeSlug = slug; },
  };
  const nodes = {
    eventSwitcherContainer: container,
    selectActiveEvent: select,
    sidebarLogoLink: sidebarLink,
  };
  const window = {
    EventVaultManager: { create: () => vault },
    RoleManager: { create: () => ({ currentRole: 'planner' }) },
    location: { search: '?role=superadmin', href: '' },
  };
  const document = {
    getElementById: (id) => nodes[id] || null,
    createElement: () => element(),
  };
  const fetch = async () => {
    if (sessionResponse instanceof Error) throw sessionResponse;
    return { ok: sessionResponse.ok, json: async () => sessionResponse.body };
  };
  vm.runInNewContext(switcherScript, { window, document, fetch });
  await new Promise(setImmediate);
  return { container, select, window, getActiveSlug: () => activeSlug };
}

(async () => {
  const denied = await runSwitcher({ ok: false, body: { authenticated: false } });
  assert.equal(denied.container.children.length, 1);
  assert.equal(denied.container.children[0].textContent, '💍 Ana y Luis');
  denied.window.switchEvent(events[1].slug);
  assert.equal(denied.getActiveSlug(), events[0].slug);
  assert.equal(denied.window.location.href, '');

  const unavailable = await runSwitcher(new Error('Network unavailable'));
  assert.equal(unavailable.container.children[0].textContent, '💍 Ana y Luis');
  unavailable.window.switchEvent(events[1].slug);
  assert.equal(unavailable.getActiveSlug(), events[0].slug);

  const member = await runSwitcher({ ok: true, body: { authenticated: true, session: { role: 'member' } } });
  assert.equal(member.container.children[0].textContent, '💍 Ana y Luis');
  member.window.switchEvent(events[1].slug);
  assert.equal(member.getActiveSlug(), events[0].slug);

  const malformed = await runSwitcher({ ok: true, body: { authenticated: 'yes', session: { role: 'platform_admin' } } });
  assert.equal(malformed.container.children[0].textContent, '💍 Ana y Luis');
  malformed.window.switchEvent(events[1].slug);
  assert.equal(malformed.getActiveSlug(), events[0].slug);

  const admin = await runSwitcher({ ok: true, body: { authenticated: true, session: { role: 'platform_admin' } } });
  assert.equal(admin.container.children[0], admin.select);
  assert.deepEqual(admin.select.children.map((option) => option.value), events.map((event) => event.slug));
  admin.window.switchEvent('unknown-event');
  assert.equal(admin.getActiveSlug(), events[0].slug);
  admin.window.switchEvent(events[1].slug);
  assert.equal(admin.getActiveSlug(), events[1].slug);
  assert.match(admin.window.location.href, /event=xv-maria/);

  console.log('Event switcher stays isolated unless a verified administrator session is returned.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
