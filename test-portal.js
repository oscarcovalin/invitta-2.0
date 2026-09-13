
    const evm = window.EventVaultManager ? window.EventVaultManager.create() : null;
    const auth = window.AuthManager ? window.AuthManager.create({ evm }) : null;

    function openCreateEventModal() {
      const modal = document.getElementById('modalCreateEvent');
      if (modal) {
        document.getElementById('inputNewEventDate').value = '2027-03-20';
        modal.classList.remove('hidden');
      }
    }

    function closeCreateEventModal() {
      const modal = document.getElementById('modalCreateEvent');
      if (modal) modal.classList.add('hidden');
    }

    function closeCreatedAccessModal() {
      const modal = document.getElementById('modalClientAccessReady');
      if (modal) modal.classList.add('hidden');
    }

    function handleCreateEventSubmit(e) {
      e.preventDefault();
      const name = document.getElementById('inputNewEventName').value;
      const type = document.getElementById('selectNewEventType').value;
      const packageType = document.getElementById('selectNewEventPackage').value;
      const date = document.getElementById('inputNewEventDate').value;
      const capacity = document.getElementById('inputNewEventCapacity').value;
      const venue = document.getElementById('inputNewEventVenue').value;

      if (!evm) return;

      const dateObj = new Date(date + 'T18:00:00');
      const dateLabel = dateObj.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

      const newEv = evm.createEvent({
        name: name.trim(),
        type: type,
        packageType: packageType,
        dateISO: date + 'T18:00',
        dateLabel: dateLabel,
        capacity: parseInt(capacity, 10) || 150,
        venue: venue.trim() || 'Salón Principal'
      });

      closeCreateEventModal();
      renderVaultProjects();

      // Mostrar modal de accesos generados
      const readyModal = document.getElementById('modalClientAccessReady');
      const labelTitle = document.getElementById('labelCreatedEventTitle');
      const inputLink = document.getElementById('inputCreatedMagicLink');
      const btnWa = document.getElementById('btnWhatsAppCreatedClient');

      if (readyModal && labelTitle && inputLink && btnWa) {
        labelTitle.textContent = `${newEv.type === 'boda' ? '💍' : '👑'} ${newEv.name} · ${newEv.dateLabel} (PIN: ${newEv.pin})`;
        const magicLink = evm.generateEventMagicLink(newEv.packageType, newEv.slug, 'mesas');
        inputLink.value = magicLink;
        btnWa.href = evm.generateEventWhatsAppUrl(newEv.packageType, newEv.slug, '', 'mesas');
        readyModal.classList.remove('hidden');
      }
    }

    function copyCreatedLink() {
      const inputLink = document.getElementById('inputCreatedMagicLink');
      if (inputLink) {
        navigator.clipboard.writeText(inputLink.value).then(() => {
          alert('¡Enlace del anfitrión copiado al portapapeles!');
        }).catch(() => {
          prompt('Copia el enlace de acceso:', inputLink.value);
        });
      }
    }

    document.addEventListener('DOMContentLoaded', () => {
      // 1. Verificar Estado de Autenticación
      updateAuthGateUI();

      // 2. Control de Pestañas de Acceso (Host vs Pro)
      const tabHost = document.getElementById('tabBtnHost');
      const tabPro = document.getElementById('tabBtnPro');
      const formHost = document.getElementById('formAuthHost');
      const formPro = document.getElementById('formAuthPro');

      if (tabHost && tabPro && formHost && formPro) {
        tabHost.addEventListener('click', () => {
          tabHost.className = 'py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all bg-amber-500 text-neutral-950 shadow-md flex items-center justify-center gap-1.5';
          tabPro.className = 'py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-neutral-400 hover:text-white flex items-center justify-center gap-1.5';
          formHost.classList.remove('hidden');
          formPro.classList.add('hidden');
        });

        tabPro.addEventListener('click', () => {
          tabPro.className = 'py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all bg-amber-500 text-neutral-950 shadow-md flex items-center justify-center gap-1.5';
          tabHost.className = 'py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-neutral-400 hover:text-white flex items-center justify-center gap-1.5';
          formPro.classList.remove('hidden');
          formHost.classList.add('hidden');
        });
      }

      // 3. Formulario Anfitrión (Código + PIN)
      if (formHost && auth) {
        formHost.addEventListener('submit', async (e) => {
          e.preventDefault();
          const code = document.getElementById('inputAuthHostCode').value.trim();
          const pin = document.getElementById('inputAuthHostPin').value.trim();
          const feedback = document.getElementById('feedbackAuthHost');

          const res = await auth.loginHostByPin(code, pin);
          if (res.success) {
            if (feedback) {
              feedback.className = 'text-xs mt-2 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-semibold block animate-pulse';
              feedback.textContent = '✨ ¡Acceso concedido! Redirigiendo a tu espacio privado...';
              setTimeout(() => {
                const next = new URLSearchParams(window.location.search).get('next') || 'organizador-mesas.html';
                window.location.href = next;
              }, 300);
            }
          } else {
            if (feedback) {
              feedback.className = 'text-xs mt-2 p-2.5 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-300 font-semibold block';
              feedback.textContent = `❌ ${res.error}`;
            }
          }
        });
      }

      // 4. Formulario Profesional (Superadmin / Planner B2B)
      if (formPro && auth) {
        formPro.addEventListener('submit', async (e) => {
          e.preventDefault();
          const user = document.getElementById('inputAuthProUser').value.trim();
          const pass = document.getElementById('inputAuthProPass').value.trim();
          const feedback = document.getElementById('feedbackAuthPro');

          const res = await auth.loginProfessional(user, pass);
          if (res.success) {
            if (feedback) {
              feedback.className = 'text-xs mt-2 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-semibold block animate-pulse';
              feedback.textContent = `✨ ¡Sesión iniciada como ${res.session.name}! Redirigiendo...`;
            }
            setTimeout(() => {
              if (res.session.role === 'superadmin') {
                updateAuthGateUI();
              } else {
                window.location.href = res.redirectUrl;
              }
            }, 300);
          } else {
            if (feedback) {
              feedback.className = 'text-xs mt-2 p-2.5 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-300 font-semibold block';
              feedback.textContent = `❌ ${res.error}`;
            }
          }
        });
      }

      // 5. Botón Cerrar Sesión Superadmin
      const btnLogout = document.getElementById('btnLogoutAdmin');
      if (btnLogout && auth) {
        btnLogout.addEventListener('click', () => {
          auth.logout();
          updateAuthGateUI();
        });
      }

      // 6. Buscador del Vault
      const searchInput = document.getElementById('vaultSearchInput');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          renderVaultProjects(e.target.value, currentFilter);
        });
      }

      // 7. Filtros del Vault
      let currentFilter = 'all';
      const filterBtns = document.querySelectorAll('.vault-filter-btn');
      filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          filterBtns.forEach(b => {
            b.classList.remove('bg-amber-500', 'text-neutral-950', 'shadow-md', 'active');
            b.classList.add('bg-white/5', 'text-neutral-300', 'border', 'border-white/10');
          });
          btn.classList.add('bg-amber-500', 'text-neutral-950', 'shadow-md', 'active');
          btn.classList.remove('bg-white/5', 'text-neutral-300', 'border', 'border-white/10');
          currentFilter = btn.dataset.filter;
          renderVaultProjects(searchInput ? searchInput.value : '', currentFilter);
        });
      });

      // 8. Botón Dar de Alta Nuevo Evento
      const btnNew = document.getElementById('btnNewProjectModal');
      if (btnNew) {
        btnNew.addEventListener('click', openCreateEventModal);
      }
    });

    function updateAuthGateUI() {
      const publicGate = document.getElementById('publicAuthGate');
      const adminDash = document.getElementById('adminVaultDashboard');
      const labelAdminName = document.getElementById('labelAdminSessionName');

      const isSuper = auth && auth.isSuperadmin();
      if (isSuper) {
        if (publicGate) publicGate.classList.add('hidden');
        if (adminDash) adminDash.classList.remove('hidden');
        const session = auth.getCurrentSession();
        if (labelAdminName && session) labelAdminName.textContent = session.username || 'Usuario Profesional';
        renderVaultProjects();
      } else {
        if (publicGate) publicGate.classList.remove('hidden');
        if (adminDash) adminDash.classList.add('hidden');
      }
    }

    function renderVaultProjects(query = '', filter = 'all') {
      const grid = document.getElementById('vaultProjectsGrid');
      if (!grid || !evm) return;

      const events = evm.getAllEvents();
      
      // Actualizar contadores
      const cAll = document.getElementById('countFilterAll');
      const cBoda = document.getElementById('countFilterBoda');
      const cXv = document.getElementById('countFilterXv');
      if (cAll) cAll.textContent = events.length;
      if (cBoda) cBoda.textContent = events.filter(e => e.type === 'boda').length;
      if (cXv) cXv.textContent = events.filter(e => e.type === 'xv').length;

      let filtered = events;
      if (filter !== 'all') {
        filtered = filtered.filter(e => e.type === filter);
      }
      if (query && query.trim()) {
        const q = query.toLowerCase().trim();
        filtered = filtered.filter(e => 
          (e.name && e.name.toLowerCase().includes(q)) ||
          (e.venue && e.venue.toLowerCase().includes(q)) ||
          (e.slug && e.slug.toLowerCase().includes(q))
        );
      }

      if (filtered.length === 0) {
        grid.innerHTML = `
          <div class="col-span-full py-12 text-center text-neutral-400 bg-white/[0.02] border border-white/10 rounded-2xl">
            <span class="material-symbols-outlined text-4xl text-neutral-500 mb-2">folder_open</span>
            <p class="text-sm font-medium">No se encontraron clientes guardados con ese criterio.</p>
            <p class="text-xs text-neutral-500 mt-1">Haz clic en "+ Nueva Invitación" para dar de alta a tu primer cliente.</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = filtered.map(e => {
        const isBoda = e.type === 'boda';
        const isPremium = e.packageType === 'host_premium';
        const dateStr = e.dateLabel || 'Fecha por definir';
        const readableCode = e.slug.replace(/^(boda-|xv-)/, '').toUpperCase();
        const pinCode = e.pin || '4821';
        const hostLink = evm.generateEventMagicLink(e.packageType || 'host_premium', e.slug, 'mesas');
        const plannerLink = `mesas?event=${e.slug}&role=planner`;
        const studioLink = `invitacion-estudio.html?event=${e.slug}&role=designer`;
        const previewLink = isBoda ? `invitacion-boda.html?event=${e.slug}` : `invitacion-xv.html?event=${e.slug}`;
        const waShareLink = evm.generateEventWhatsAppUrl(e.packageType || 'host_premium', e.slug, '', 'mesas');

        return `
          <div class="glass-portal-card rounded-2xl p-5 flex flex-col justify-between border border-amber-500/25 bg-black/40 hover:border-amber-400 transition-all group">
            <div>
              <div class="flex items-center justify-between mb-3">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${isBoda ? 'bg-amber-500/15 border border-amber-400/40 text-amber-300' : 'bg-pink-500/15 border border-pink-400/40 text-pink-300'}">
                  <span>${isBoda ? '💍 Boda' : '👑 Mis XV'}</span>
                </span>
                
                <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${isPremium ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' : 'bg-blue-500/20 text-blue-300 border border-blue-400/30'}">
                  <span>${isPremium ? '💎 Premium' : '💌 Esencial'}</span>
                </span>
              </div>

              <h3 class="font-['Cinzel'] text-lg font-bold text-white group-hover:text-amber-300 transition-colors mb-1 truncate" title="${e.name}">
                ${e.name}
              </h3>

              <div class="space-y-1 text-xs text-neutral-400 font-light mb-3">
                <p class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[15px] text-amber-400/80">calendar_today</span>
                  <span>${dateStr}</span>
                </p>
                <p class="flex items-center gap-1.5 truncate" title="${e.venue || 'Salón Principal'}">
                  <span class="material-symbols-outlined text-[15px] text-amber-400/80">location_on</span>
                  <span class="truncate">${e.venue || 'Salón Principal'} (${e.capacity || 100} pax)</span>
                </p>
              </div>

              <!-- Código de Acceso & PIN del Cliente -->
              <div class="mb-4 px-2.5 py-2 rounded-lg bg-amber-500/10 border border-amber-400/20 flex items-center justify-between text-[11px] font-mono">
                <span class="text-neutral-400 flex items-center gap-1">
                  <span class="material-symbols-outlined text-[13px] text-amber-400">key</span> Código:
                  <strong class="text-amber-300 font-bold tracking-wider">${readableCode}</strong>
                </span>
                <span class="text-neutral-400 flex items-center gap-1 border-l border-white/10 pl-2">
                  <span class="material-symbols-outlined text-[13px] text-emerald-400">lock</span> PIN:
                  <strong class="text-emerald-400 font-bold tracking-wider">${pinCode}</strong>
                </span>
              </div>
            </div>

            <!-- Suite de Acciones Rápidas -->
            <div class="pt-4 border-t border-white/10 space-y-2">
              <div class="grid grid-cols-2 gap-2">
                <a href="${plannerLink}" class="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 text-xs font-bold tracking-wider transition-all">
                  <span class="material-symbols-outlined text-sm">table_restaurant</span>
                  <span>Mesas Master</span>
                </a>
                
                <a href="${waShareLink}" target="_blank" class="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs font-bold tracking-wider transition-all">
                  <span>📲 WhatsApp</span>
                </a>
              </div>

              <!-- Menú de Acciones Secundarias -->
              <div class="flex items-center justify-between pt-1 text-[11px] text-neutral-400">
                <a href="${studioLink}" class="hover:text-amber-300 transition-colors inline-flex items-center gap-1">
                  <span class="material-symbols-outlined text-xs">palette</span> Diseño
                </a>
                <a href="${previewLink}" target="_blank" class="hover:text-emerald-300 transition-colors inline-flex items-center gap-1">
                  <span class="material-symbols-outlined text-xs">visibility</span> Invitación ↗
                </a>
                <button type="button" onclick="navigator.clipboard.writeText('${hostLink}').then(()=>alert('Enlace del anfitrión copiado al portapapeles: ${hostLink}'));" class="hover:text-amber-300 transition-colors inline-flex items-center gap-1" title="Copiar enlace del cliente">
                  <span class="material-symbols-outlined text-xs">link</span> Magic Link
                </button>
              </div>
            </div>

          </div>
        `;
      }).join('');
    }
  