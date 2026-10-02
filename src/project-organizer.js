(function () {
  'use strict';
  const params = new URLSearchParams(window.location.search);
  if (!params.has('project')) return;
  const root = document.getElementById('project-organizer');
  root.hidden = false; document.body.replaceChildren(root);
  let client;
  try {
    if (params.getAll('project').length !== 1) throw new Error('Abre un único proyecto desde el portal.');
    client = new window.ProjectOrganizerClient(params.get('project'));
  } catch (error) { root.textContent = error.message; return; }
  // Fixed markup only. All project/user values below are rendered as text.
  root.innerHTML = `
    <header><a href="portal.html">Volver al portal</a><button id="ops-refresh" type="button">Actualizar desde la nube</button></header>
    <h1>Invitados y mesas</h1><p class="project-id" id="ops-project"></p>
    <p>Datos privados del proyecto. Guardado confirmado en Supabase; actualización manual entre sesiones.</p>
    <p id="ops-status" role="status" aria-live="polite">Consultando permisos y registros…</p>
    <div class="actions"><button id="ops-verify" type="button" hidden>Verificar resultado pendiente</button>
      <button id="ops-conflict" type="button" hidden>Descartar borradores y consultar versión actual</button>
      <a id="ops-login" hidden>Iniciar sesión</a></div>
    <section id="ops-discard" hidden role="alertdialog" aria-modal="false" aria-labelledby="ops-discard-title" aria-describedby="ops-discard-text">
      <h2 id="ops-discard-title">Hay cambios sin guardar</h2><p id="ops-discard-text"></p>
      <div class="actions"><button id="ops-keep" type="button">Conservar borradores</button><button id="ops-discard-confirm" type="button">Descartar borradores</button></div>
    </section>
    <p id="ops-summary"></p>
    <div class="workspace">
      <section aria-labelledby="ops-tables-title"><h2 id="ops-tables-title">Mesas</h2>
        <form id="ops-tables"><fieldset disabled><legend id="ops-tables-mode">Nueva mesa</legend>
          <label>Nombre de mesa<input name="name" required maxlength="160" autocomplete="off"></label>
          <label>Tipo<select name="type"><option value="circular">Circular</option><option value="imperial">Imperial</option><option value="rectangular">Rectangular</option></select></label>
          <label>Capacidad<input name="capacity" type="number" min="1" max="100" step="1" value="8" required></label>
          <div class="actions"><button type="submit">Guardar mesa</button><button type="button" data-new="tables">Nueva mesa</button></div>
        </fieldset></form><ul id="ops-tables-list" aria-label="Mesas guardadas"></ul>
      </section>
      <section aria-labelledby="ops-guests-title"><h2 id="ops-guests-title">Invitados</h2>
        <form id="ops-guests"><fieldset disabled><legend id="ops-guests-mode">Nuevo invitado o familia</legend>
          <label>Nombre de invitado o familia<input name="name" required maxlength="160" autocomplete="off"></label>
          <label>Pases<input name="passes" type="number" min="1" max="100" step="1" value="1" required></label>
          <label>Mesa asignada<select name="tableId"><option value="">Sin mesa</option></select></label>
          <div class="actions"><button type="submit">Guardar invitado</button><button type="button" data-new="guests">Nuevo invitado</button></div>
        </fieldset></form><ul id="ops-guests-list" aria-label="Invitados guardados"></ul>
      </section>
    </div>
    <p>Esta pantalla conecta nombres, pases, mesas y asignaciones. Importación, plano 2D, QR, RSVP, álbum y pagos no están conectados aquí.</p>`;
  const element = id => root.querySelector(`#ops-${id}`);
  element('project').textContent = `Proyecto: ${client.projectId}`;
  element('login').href = `portal.html?login=required&next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  const forms = { tables: element('tables'), guests: element('guests') };
  const drafts = { tables: { id: crypto.randomUUID() }, guests: { id: crypto.randomUUID() } };
  const dirty = new Set(); let ready = false, working = false, confirming = false;
  function message(text, error = false) { element('status').textContent = text; element('status').dataset.kind = error ? 'error' : 'info'; }
  function locks() {
    Object.values(forms).forEach(form => { form.querySelector('fieldset').disabled = !ready || working || confirming || !!client.pending; });
    root.querySelectorAll('li button').forEach(button => { button.disabled = working || confirming || !!client.pending; });
    element('refresh').disabled = working || confirming || !!client.pending;
    element('verify').hidden = !client.pending; element('verify').disabled = working || confirming;
    element('conflict').disabled = working || confirming;
  }
  function confirmDiscard(text) {
    if (confirming) return Promise.resolve(false);
    confirming = true; locks();
    const panel = element('discard'), keep = element('keep'), discard = element('discard-confirm');
    const previousFocus = document.activeElement;
    element('discard-text').textContent = text; panel.hidden = false; keep.focus();
    return new Promise(resolve => {
      const finish = accepted => {
        keep.removeEventListener('click', cancel); discard.removeEventListener('click', accept);
        panel.removeEventListener('keydown', keydown); panel.hidden = true; confirming = false; locks();
        if (previousFocus?.isConnected && !previousFocus.disabled) previousFocus.focus();
        resolve(accepted);
      };
      const cancel = () => finish(false), accept = () => finish(true);
      const keydown = event => { if (event.key === 'Escape') { event.preventDefault(); cancel(); } };
      keep.addEventListener('click', cancel); discard.addEventListener('click', accept); panel.addEventListener('keydown', keydown);
    });
  }
  function reset(resource) {
    forms[resource].reset(); drafts[resource] = { id: crypto.randomUUID() }; dirty.delete(resource);
    element(`${resource}-mode`).textContent = resource === 'tables' ? 'Nueva mesa' : 'Nuevo invitado o familia';
  }
  async function edit(resource, record) {
    if (dirty.has(resource) && !await confirmDiscard('¿Descartar los cambios no guardados de este formulario?')) return;
    drafts[resource] = { id: record.id, expectedVersion: record.version };
    for (const [key, value] of Object.entries(record)) if (forms[resource].elements.namedItem(key)) forms[resource].elements.namedItem(key).value = value ?? '';
    dirty.delete(resource); element(`${resource}-mode`).textContent = `Editar · versión ${record.version}`;
    forms[resource].elements.namedItem('name').focus();
  }
  function render() {
    const selected = forms.guests.elements.tableId.value;
    forms.guests.elements.tableId.replaceChildren(new Option('Sin mesa', ''));
    client.tables.forEach(table => forms.guests.elements.tableId.add(new Option(table.name, table.id)));
    forms.guests.elements.tableId.value = selected;
    for (const resource of ['tables', 'guests']) {
      const list = element(`${resource}-list`); list.replaceChildren();
      if (!client[resource].length) { const item = document.createElement('li'); item.textContent = `No hay ${resource === 'tables' ? 'mesas guardadas' : 'invitados guardados'} en este proyecto.`; list.append(item); }
      client[resource].forEach(record => {
        const item = document.createElement('li'), text = document.createElement('span'), detail = document.createElement('small'), button = document.createElement('button');
        text.textContent = record.name; button.type = 'button'; button.textContent = 'Editar'; button.setAttribute('aria-label', `Editar ${record.name}`);
        button.addEventListener('click', () => edit(resource, record));
        if (resource === 'tables') {
          const passes = client.guests.filter(g => g.tableId === record.id).reduce((n, g) => n + g.passes, 0);
          detail.textContent = `${record.type} · ${passes}/${record.capacity} pases asignados${passes > record.capacity ? ' · Sobrecupo' : ''}`;
          if (passes > record.capacity) detail.className = 'warning';
        } else detail.textContent = `${record.passes} pases · ${client.tables.find(t => t.id === record.tableId)?.name || (record.tableId ? 'Mesa no disponible' : 'Sin mesa')}`;
        text.append(detail); item.append(text, button); list.append(item);
      });
    }
    element('summary').textContent = `${client.guests.length} invitados/familias · ${client.guests.reduce((n, g) => n + g.passes, 0)} pases · ${client.tables.length} mesas. No son admisiones.`;
    locks();
  }
  function report(error) {
    message(error.message, true);
    element('conflict').hidden = error.code !== 'CONFLICT'; element('login').hidden = error.code !== 'UNAUTHENTICATED';
  }
  async function refresh() {
    if (dirty.size && !await confirmDiscard('¿Descartar los borradores no guardados y actualizar?')) return;
    working = true; locks(); message('Consultando permisos y registros…');
    try {
      if (await client.load()) { ready = true; reset('tables'); reset('guests'); render(); message('Datos confirmados desde Supabase.'); element('conflict').hidden = true; element('login').hidden = true; }
    } catch (error) { ready = false; report(error); }
    finally { working = false; locks(); }
  }
  for (const resource of ['tables', 'guests']) {
    const form = forms[resource];
    form.addEventListener('input', () => dirty.add(resource)); form.addEventListener('change', () => dirty.add(resource));
    form.querySelector('[data-new]').addEventListener('click', async () => { if (!dirty.has(resource) || await confirmDiscard('¿Descartar este borrador?')) reset(resource); });
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (working || confirming || client.pending || !form.reportValidity()) return;
      const values = { ...drafts[resource], name: form.elements.name.value.trim() };
      if (resource === 'tables') { values.type = form.elements.type.value; values.capacity = Number(form.elements.capacity.value); }
      else { values.passes = Number(form.elements.passes.value); values.tableId = form.elements.tableId.value || null; }
      dirty.add(resource); working = true; locks(); message('Guardado pendiente de confirmación…');
      try { await client.save(resource, values); reset(resource); render(); message('Guardado confirmado en Supabase.'); element('conflict').hidden = true; }
      catch (error) { report(error); }
      finally { working = false; locks(); }
    });
  }
  element('verify').addEventListener('click', async () => {
    const resource = client.pending.resource; working = true; locks(); message('Verificando el resultado anterior…');
    try {
      const record = await client.reconcile();
      if (record) { reset(resource); render(); message('La operación anterior quedó guardada y se verificó.'); }
      else message('No se encontró un cambio confirmado. Puedes reintentar conservando el mismo registro.');
    } catch (error) { report(error); }
    finally { working = false; locks(); }
  });
  element('conflict').addEventListener('click', async () => {
    if (!await confirmDiscard('¿Descartar todos los borradores y consultar la versión actual, sin sobrescribirla?')) return;
    dirty.clear(); client.pending = null; refresh();
  });
  element('refresh').addEventListener('click', refresh);
  window.addEventListener('beforeunload', event => { if (dirty.size || working || client.pending) { event.preventDefault(); event.returnValue = ''; } });
  refresh();
})();
