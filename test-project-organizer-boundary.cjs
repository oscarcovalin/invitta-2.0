'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('organizador-mesas.html', 'utf8');
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const context = { URLSearchParams, window: { location: { search: '?project=10000000-0000-4000-8000-000000000001' } },
  document: { documentElement: { setAttribute() {} } } };
vm.createContext(context);
// Evaluate every loaded legacy dependency too: definitions are permitted, side effects are not.
for (const file of ['role-manager.js', 'event-vault-manager.js', 'seating-module/seating-planner.js', 'guest-manager.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}
for (const script of inline) vm.runInContext(script, context);
assert(!context.window.planner, 'project mode never initializes legacy planner or accesses local demos');
assert(html.includes('src/project-organizer-client.js'));
assert(html.includes('src/project-organizer.js'));
assert(html.includes('id="project-organizer"'));
const ui = fs.readFileSync('src/project-organizer.js', 'utf8');
assert(!ui.includes('window.confirm'), 'discard confirmation must not block the integrated browser');
const confirmation = ui.slice(ui.indexOf('  function confirmDiscard('), ui.indexOf('  function reset('));
function node() {
  return { hidden: true, handlers: {}, focusCount: 0,
    focus() { this.focusCount++; }, addEventListener(type, fn) { this.handlers[type] = fn; },
    removeEventListener(type, fn) { if (this.handlers[type] === fn) delete this.handlers[type]; } };
}
const nodes = Object.fromEntries(['discard', 'keep', 'discard-confirm', 'discard-text'].map(id => [id, node()]));
const focus = { isConnected: true, disabled: false, focus() { this.restored = true; } };
const promptContext = { Promise, document: { activeElement: focus }, element: id => nodes[id], locks() {} };
vm.createContext(promptContext);
vm.runInContext(`let confirming = false; ${confirmation} this.ask = confirmDiscard;`, promptContext);
(async () => {
  let result = promptContext.ask('Discard?');
  assert.equal(nodes.discard.hidden, false); assert.equal(nodes.keep.focusCount, 1);
  assert.equal(await promptContext.ask('Another?'), false, 'a second prompt cannot replace the pending choice');
  nodes.keep.handlers.click(); assert.equal(await result, false); assert(focus.restored); assert(nodes.discard.hidden);
  result = promptContext.ask('Discard?'); nodes['discard-confirm'].handlers.click(); assert.equal(await result, true);
  result = promptContext.ask('Discard?'); let prevented = false;
  nodes.discard.handlers.keydown({ key: 'Escape', preventDefault() { prevented = true; } });
  assert.equal(await result, false); assert(prevented); assert.deepEqual(nodes.keep.handlers, {});
  console.log('Project organizer isolates legacy data and requires a non-blocking, explicit discard choice.');
})().catch(error => { console.error(error); process.exitCode = 1; });
