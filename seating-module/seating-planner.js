/**
 * ============================================================================
 * SeatingPlanner — Motor Reactivo de Asignación de Mesas & Floor Plan
 * Haute-Couture Design System · Invitta Studio (Antigravity)
 * ============================================================================
 */

class SeatingPlanner {
  constructor(options = {}) {
    this.shortNamesMode = typeof localStorage !== "undefined" && localStorage.getItem("invitta_seat_names") === "short";
    this.options = Object.assign({
      unassignedListSelector: '#unassignedList',
      tablesContainerSelector: '#tablesContainer',
      statsAssignedCountSelector: '#statAssignedCount',
      statsTotalCountSelector: '#statTotalCount',
      statsUnassignedSelector: '#statUnassignedCount',
      statsProgressBarSelector: '#statProgressBar',
      statsPercentSelector: '#statPercent',
      statsOvercapacityBadgeSelector: '#statOvercapacityBadge',
      searchInputSelector: '#searchGuestsInput',
      overCapacityColor: '#A38047',
      storageKey: 'invitta_seating_state_v2',
      onStateChange: null
    }, options);

    this.storageKey = this.options.storageKey;
    this.searchQuery = '';

    // Estado reactivo centralizado con persistencia local
    this.state = this.loadPersistedState(options.initialGuests, options.initialTables);

    this.init();
  }

  loadPersistedState(initialGuests, initialTables) {
    if (initialGuests && initialTables) {
      return { guests: initialGuests, tables: initialTables, draggedItem: null };
    }

    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.guests) && Array.isArray(parsed.tables) && parsed.guests.length > 0) {
            return {
              guests: parsed.guests,
              tables: parsed.tables,
              draggedItem: null
            };
          }
        }
      } catch (err) {
        console.warn('Could not load persisted seating state:', err);
      }
    }

    return {
      guests: initialGuests || this.getDefaultGuests(),
      tables: initialTables || this.getDefaultTables(),
      draggedItem: null
    };
  }

  savePersistedState() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify({
          guests: this.state.guests,
          tables: this.state.tables
        }));
      } catch (err) {
        console.warn('Could not save seating state:', err);
      }
    }
  }

  clearPersistedState() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(this.storageKey);
      } catch (err) {}
    }
    this.state.guests = this.getDefaultGuests();
    this.state.tables = this.getDefaultTables();
    this.updateStateAndDOM();
  }

  getDefaultGuests() {
    return [
      { id: 'g_martinez', name: 'Familia Martínez Valdés', pases: 4, passes: 4, tableId: null, vip: false, court: false, phone: '+52 55 1234 5678', tag: '1 Menú Vegano, 1 Silla' },
      { id: 'g_lopez', name: 'Hermanos López', pases: 2, passes: 2, tableId: null, vip: false, court: false, phone: '+52 55 8765 4321', tag: 'Sin Gluten' },
      { id: 'g_valenzuela', name: 'Familia Valenzuela', pases: 3, passes: 3, tableId: null, vip: false, court: false, phone: '+52 55 9988 7766', tag: '' },
      { id: 'g_silva', name: 'Sr. Fernando Silva & Acompañante', pases: 2, passes: 2, tableId: null, vip: true, court: false, phone: '+52 55 3344 5566', tag: 'Padrino de Velación' },
      { id: 'g_ortiz', name: 'Camila Ortiz & Acompañante', pases: 2, passes: 2, tableId: 'tbl_imperial', vip: true, court: true, phone: '+52 55 5566 7788', tag: 'Dama de Honor' },
      { id: 'g_fuentes', name: 'Diego Fuentes', pases: 1, passes: 1, tableId: 'tbl_imperial', vip: true, court: true, phone: '+52 55 6677 8899', tag: 'Best Man' }
    ];
  }

  getDefaultTables() {
    return [
      {
        id: 'tbl_imperial',
        number: 'I',
        name: 'Mesa Imperial',
        subtitle: 'Novios & Corte de Honor',
        type: 'imperial', // rectangular
        capacity: 10,
        posX: '50%',
        posY: '40px'
      },
      {
        id: 'tbl_1',
        number: '1',
        name: 'Mesa 1',
        subtitle: 'Familia Principal',
        type: 'circular',
        capacity: 8,
        posX: '16%',
        posY: '270px'
      },
      {
        id: 'tbl_2',
        number: '2',
        name: 'Mesa 2',
        subtitle: 'Familia Foránea',
        type: 'circular',
        capacity: 8,
        posX: '72%',
        posY: '270px'
      },
      {
        id: 'tbl_3',
        number: '3',
        name: 'Mesa 3',
        subtitle: 'Amigos Cercanos',
        type: 'circular',
        capacity: 8,
        posX: '16%',
        posY: '530px'
      },
      {
        id: 'tbl_4',
        number: '4',
        name: 'Mesa 4',
        subtitle: 'Compañeros & Amistades',
        type: 'circular',
        capacity: 8,
        posX: '72%',
        posY: '530px'
      }
    ];
  }

  
  setupTooltip() {
    if (typeof document !== 'undefined' && !document.getElementById('seat-tooltip')) {
      const tooltip = document.createElement('div');
      tooltip.id = 'seat-tooltip';
      tooltip.className = 'fixed z-[100] hidden pointer-events-none bg-charcoal text-white text-xs rounded-xl shadow-xl p-3 border border-outline-variant/20 flex flex-col gap-1 w-max transition-opacity duration-150';
      document.body.appendChild(tooltip);
      
      document.addEventListener('touchstart', (e) => {
        if (!e.target.closest('.seat-pill')) {
          this.hideTooltip();
        }
      }, { passive: true });
    }
  }

  showTooltip(e, guestId) {
    const tooltip = document.getElementById('seat-tooltip');
    if (!tooltip || !guestId) return;
    const g = this.state.guests.find(x => x.id === guestId);
    if (!g) return;
    
    const roleLabel = g.roleLabel || g.role || 'Invitado';
    const ageCategory = (g.diet === 'infantil' || g.diet === 'infant') ? 'Infantil' : 'Adulto';
    
    tooltip.innerHTML = `
      <span class="font-['Cinzel'] font-bold text-sm tracking-wide text-brushed-champagne">${g.name}</span>
      <div class="flex items-center gap-2 mt-1">
        <span class="px-2 py-0.5 rounded-md bg-white/10 text-white font-mono text-[9px] uppercase tracking-wider">${roleLabel}</span>
        <span class="px-2 py-0.5 rounded-md bg-white/10 text-white font-mono text-[9px] uppercase tracking-wider">${ageCategory}</span>
      </div>
    `;
    
    tooltip.classList.remove('hidden');
    
    const rect = e.target.getBoundingClientRect();
    let top = rect.top - tooltip.offsetHeight - 12;
    let left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2);
    
    if (top < 10) top = rect.bottom + 12;
    if (left < 10) left = 10;
    if (left + tooltip.offsetWidth > window.innerWidth - 10) left = window.innerWidth - tooltip.offsetWidth - 10;
    
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  }

  hideTooltip() {
    const tooltip = document.getElementById('seat-tooltip');
    if (tooltip) {
      tooltip.classList.add('hidden');
    }
  }

  init() {
    if (typeof document === 'undefined') return;
    this.bindSearch();
    this.render();
  }

  normalizeText(text) {
    return (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  getUnassignedGuests() {
    let unassigned = this.state.guests.filter(g => !g.tableId);

    if (this.searchQuery) {
      const q = this.normalizeText(this.searchQuery);
      unassigned = unassigned.filter(g => 
        this.normalizeText(g.name).includes(q) || 
        this.normalizeText(g.tag).includes(q)
      );
    }

    return unassigned;
  }

  assignGuestToTable(guestId, targetTableId) {
    const guest = this.state.guests.find(g => g.id === guestId);
    if (!guest) return;
    guest.tableId = targetTableId;
    this.updateStateAndDOM();
  }

  assignFamilyGroupToTable(familyMemberIds, targetTableId) {
    if (!Array.isArray(familyMemberIds)) return;
    familyMemberIds.forEach(id => {
      const guest = this.state.guests.find(g => g.id === id);
      if (guest) guest.tableId = targetTableId;
    });
    this.updateStateAndDOM();
  }

  unassignGuest(guestId) {
    const guest = this.state.guests.find(g => g.id === guestId);
    if (!guest) return;
    guest.tableId = null;
    this.updateStateAndDOM();
  }

  /**
   * Intercambio Directo (Swap) de Mesas entre dos Invitados/Familias
   */
  swapGuests(guestIdA, guestIdB) {
    if (!guestIdA || !guestIdB || guestIdA === guestIdB) return false;
    const guestA = this.state.guests.find(g => g.id === guestIdA);
    const guestB = this.state.guests.find(g => g.id === guestIdB);
    if (!guestA || !guestB) return false;

    const tableA = guestA.tableId;
    const tableB = guestB.tableId;

    guestA.tableId = tableB;
    guestB.tableId = tableA;

    this.updateStateAndDOM();
    return true;
  }

  updateStateAndDOM() {
    this.savePersistedState();

    if (typeof document !== 'undefined') {
      this.renderUnassignedList();
      this.renderTables();
      this.renderStats();
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('seating:updated', { detail: { state: this.state } }));
    }

    if (typeof this.options.onStateChange === 'function') {
      this.options.onStateChange(this.state);
    }
  }

  bindSearch() {
    if (typeof document === 'undefined') return;
    const searchInput = document.querySelector(this.options.searchInputSelector);
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.renderUnassignedList();
    });
  }

  getGuestStatusClasses(g) {
    if (!g) return { pill: 'border-charcoal text-on-surface bg-surface', badge: 'bg-neutral-100 text-neutral-700 border border-neutral-300', label: 'Sin Estado' };
    if (g.isEmergency || g.status === 'EMERGENCY') {
      return {
        pill: 'border-blue-500 bg-blue-50 text-blue-900 ring-2 ring-blue-500/50 shadow-xs font-bold',
        badge: 'bg-blue-500/15 text-blue-800 border border-blue-400/40 font-bold',
        dot: 'bg-blue-500',
        label: '🔵 Emergencia'
      };
    }
    if (g.status === 'CHECKED_IN') {
      return {
        pill: 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/50 shadow-xs font-bold',
        badge: 'bg-emerald-500/15 text-emerald-900 border border-emerald-500/40 font-bold',
        dot: 'bg-emerald-500',
        label: '🟢 Ingresó'
      };
    }
    if (g.status === 'CONFIRMED') {
      return {
        pill: 'border-amber-500 bg-amber-50 text-amber-950 ring-2 ring-amber-500/50 shadow-xs font-bold',
        badge: 'bg-amber-500/15 text-amber-900 border border-amber-400/40 font-bold',
        dot: 'bg-amber-400',
        label: '🟡 Confirmado'
      };
    }
    if (g.status === 'DECLINED') {
      return {
        pill: 'border-neutral-300 bg-neutral-100 text-neutral-500 opacity-60',
        badge: 'bg-neutral-200 text-neutral-600 border border-neutral-300',
        dot: 'bg-neutral-400',
        label: '✕ Declinó'
      };
    }
    // Default PENDING / SENT / DRAFT
    return {
      pill: 'border-rose-300 bg-rose-50/70 text-rose-950 ring-1 ring-rose-300/60 font-medium',
      badge: 'bg-rose-500/10 text-rose-800 border border-rose-400/30 font-medium',
      dot: 'bg-rose-400',
      label: '🔴 Pendiente'
    };
  }

  render() {
    if (typeof document === 'undefined') return;
    this.renderUnassignedList();
    this.renderTables();
    this.renderStats();
    this.bindGlobalEvents();
  }

  /**
   * Renderizado de la lista izquierda: SOLO NOMBRE DE INVITACIÓN & NÚMERO DE PASES
   */
  renderUnassignedList() {
    if (typeof document === 'undefined') return;
    const container = document.querySelector(this.options.unassignedListSelector);
    if (!container) return;

    const unassigned = this.getUnassignedGuests();

    if (unassigned.length === 0) {
      container.innerHTML = `
        <div class="text-center py-16 px-4 text-on-surface-variant select-none">
          <span class="material-symbols-outlined text-4xl mb-3 text-secondary block opacity-70">task_alt</span>
          <p class="font-headline-lg-mobile text-primary text-base">Todos Asignados</p>
          <p class="font-label-sm text-warm-grey mt-1">No hay invitaciones pendientes en este momento.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = unassigned.map(g => {
      const passes = g.pases || g.passes || 1;
      const isVip = g.vip || g.court;
      const st = this.getGuestStatusClasses(g);

      return `
        <div class="border ${isVip ? 'border-brushed-champagne bg-amber-500/5' : 'border-outline-variant bg-surface'} rounded-xl overflow-hidden hover:border-charcoal transition-all mb-3 select-none cursor-grab active:cursor-grabbing shadow-sm group"
          draggable="true"
          data-drag-type="single"
          data-guest-id="${g.id}">
          
          <div class="p-3.5 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-on-surface-variant font-light text-[18px]">drag_indicator</span>
              <div class="flex flex-col gap-0.5">
                <div class="flex items-center gap-1.5">
                  <span class="font-body-lg text-primary font-medium text-sm">${g.name}</span>
                  ${isVip ? `<span class="material-symbols-outlined text-brushed-champagne text-[15px]" title="VIP / Corte">star</span>` : ''}
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-[10px] px-2 py-0.5 rounded-full ${st.badge} font-mono tracking-wide">${st.label}</span>
                  ${g.tag ? `<span class="font-label-caps text-on-surface-variant text-[10px] tracking-wider">${g.tag}</span>` : ''}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <!-- Insignia con el Número de Pases -->
              <span class="px-2.5 py-1 rounded-lg bg-surface-container-high border border-outline-variant font-mono font-bold text-xs text-primary">
                ${passes} ${passes === 1 ? 'pase' : 'pases'}
              </span>

              <!-- Botón Editar Invitado / Familia -->
              <button type="button" class="btn-guest-card-edit p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors" title="Editar datos" data-id="${g.id}">
                <span class="material-symbols-outlined text-[14px]">edit</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-guest-card-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (typeof window.openModalGuestEdit === 'function') {
          window.openModalGuestEdit(id);
        } else {
          window.dispatchEvent(new CustomEvent('guest:edit', { detail: { guestId: id } }));
        }
      });
    });

    this.bindDragStartEvents(container);
  }

  /**
   * Renderizado individual de una tarjeta de mesa (Imperial o Circular)
   */
  renderSingleTableHTML(table) {
    const assigned = this.state.guests.filter(g => g.tableId === table.id);
    const totalPasses = assigned.reduce((sum, g) => sum + (g.pases || g.passes || 1), 0);
    const isOver = totalPasses > table.capacity;
    const overCount = totalPasses - table.capacity;

    // Expandir asientos por número de pases de cada invitación
    const seatedSlots = [];
    assigned.forEach(g => {
      const passes = g.pases || g.passes || 1;
      for (let p = 1; p <= passes; p++) {
        seatedSlots.push({ guest: g, passNumber: p, totalPasses: passes });
      }
    });

    // Estilo de Sobrecupo Elegante (#A38047)
    let overBorderClass = isOver ? 'border-[#A38047] shadow-[0_0_25px_rgba(163,128,71,0.25)] ring-1 ring-[#A38047]' : 'border-outline-variant';
      if (table.isStaff) overBorderClass = 'border-amber-700/50 bg-amber-50 shadow-sm';
    const isImperial = table.type === 'imperial';

    if (isImperial) {
      // ==================== MESA IMPERIAL (RECTANGULAR) ====================
      const half = Math.ceil(table.capacity / 2);
      const topAssigned = seatedSlots.slice(0, half);
      const botAssigned = seatedSlots.slice(half);

      return `
        <div class="table-card-dropzone relative group w-full max-w-[560px]"
          data-table-id="${table.id}"
          style="transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);">
          
          <div class="w-full bg-surface-container-lowest rounded-2xl border ${overBorderClass} shadow-md flex flex-col items-center justify-center relative transition-all hover:border-charcoal p-5" style="min-height: 180px;">
            
            <!-- Asientos Superiores -->
            <div class="absolute w-full flex justify-around px-12" style="top: -20px;">
              ${Array.from({ length: half }).map((_, i) => {
                const slot = topAssigned[i];
                if (slot) {
                  const g = slot.guest;
                  const st = this.getGuestStatusClasses(g);
                  
                    const rawName = g.name.replace(/^(Familia|Hermanos|Sr\.|Sra\.|Dr\.|Dra\.)\s+/i, '');
                    const initials = rawName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'IN';
                    const shortName = rawName.split(' ')[0].substring(0, 6) || 'INV';
                    const baseLabel = this.shortNamesMode ? shortName : initials;
                    
                    const label = slot.totalPasses > 1 ? `${baseLabel}${slot.passNumber}` : baseLabel;
                    
                    let dietBadge = '';
                    if (g.diet && g.diet.toLowerCase() !== 'none' && g.diet.toLowerCase() !== 'ninguna') {
                      const d = g.diet.toLowerCase();
                      let color = 'bg-red-500'; // Default alert
                      if (d.match(/veg|vegan/)) color = 'bg-emerald-500';
                      else if (d.match(/infant|niñ|kid/)) color = 'bg-amber-400';
                      dietBadge = `<div class="absolute -top-1 -right-1 w-2.5 h-2.5 ${color} rounded-full border-2 border-white shadow-xs z-10"></div>`;
                    }


                  return `
                    <div class="seat-pill relative h-7 w-auto min-w-[28px] px-1.5 text-[9px] rounded-full bg-emerald-100 text-emerald-900 border border-emerald-400 ring-2 ring-emerald-500/30 flex items-center justify-center cursor-grab active:cursor-grabbing text-[10px] font-mono font-bold shadow-sm transition-all hover:scale-125 select-none hover:ring-2 hover:ring-primary"
                      draggable="true"
                      data-drag-type="single"
                      data-guest-id="${g.id}"
                      data-table-id="${table.id}"
                      title="${g.name} (${slot.totalPasses} ${slot.totalPasses === 1 ? 'pase' : 'pases'} · ${st.label})">
                      ${dietBadge}
                        ${label}
                    </div>
                  `;
                }
                const seatKey = `top-${i}`;
                  const config = (table.seatsConfig || {})[seatKey] || 'standard';
                  let seatIcon = '+';
                  let extraClass = 'text-on-surface-variant opacity-60 bg-surface-container-low border-outline-variant text-[10px]';
                  if (config === 'wheelchair') { seatIcon = '♿'; extraClass = 'text-blue-600 bg-blue-50 border-blue-300 opacity-100 text-[14px]'; }
                  if (config === 'highchair') { seatIcon = '🪑'; extraClass = 'text-amber-600 bg-amber-50 border-amber-300 opacity-100 text-[14px]'; }
                  return `
                    <div class="empty-seat w-7 h-7 rounded-full border border-dashed flex items-center justify-center cursor-pointer hover:scale-110 transition-transform ${extraClass}"
                      data-table-id="${table.id}"
                      data-seat-key="${seatKey}"
                      title="${config === 'standard' ? 'Asiento Estándar (Clic para cambiar)' : config === 'wheelchair' ? 'Silla de Ruedas' : 'Periquera'}">
                      ${seatIcon}
                    </div>`;
              }).join('')}
            </div>

            <!-- Asientos Inferiores -->
            <div class="absolute w-full flex justify-around px-12" style="bottom: -20px;">
              ${Array.from({ length: half }).map((_, i) => {
                const slot = botAssigned[i];
                if (slot) {
                  const g = slot.guest;
                  const st = this.getGuestStatusClasses(g);
                  
                    const rawName = g.name.replace(/^(Familia|Hermanos|Sr\.|Sra\.|Dr\.|Dra\.)\s+/i, '');
                    const initials = rawName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'IN';
                    const shortName = rawName.split(' ')[0].substring(0, 6) || 'INV';
                    const baseLabel = this.shortNamesMode ? shortName : initials;
                    
                    const label = slot.totalPasses > 1 ? `${baseLabel}${slot.passNumber}` : baseLabel;
                    
                    let dietBadge = '';
                    if (g.diet && g.diet.toLowerCase() !== 'none' && g.diet.toLowerCase() !== 'ninguna') {
                      const d = g.diet.toLowerCase();
                      let color = 'bg-red-500'; // Default alert
                      if (d.match(/veg|vegan/)) color = 'bg-emerald-500';
                      else if (d.match(/infant|niñ|kid/)) color = 'bg-amber-400';
                      dietBadge = `<div class="absolute -top-1 -right-1 w-2.5 h-2.5 ${color} rounded-full border-2 border-white shadow-xs z-10"></div>`;
                    }


                  return `
                    <div class="seat-pill relative h-7 w-auto min-w-[28px] px-1.5 text-[9px] rounded-full bg-emerald-100 text-emerald-900 border border-emerald-400 ring-2 ring-emerald-500/30 flex items-center justify-center cursor-grab active:cursor-grabbing text-[10px] font-mono font-bold shadow-sm transition-all hover:scale-125 select-none hover:ring-2 hover:ring-primary"
                      draggable="true"
                      data-drag-type="single"
                      data-guest-id="${g.id}"
                      data-table-id="${table.id}"
                      title="${g.name} (${slot.totalPasses} ${slot.totalPasses === 1 ? 'pase' : 'pases'} · ${st.label})">
                      ${dietBadge}
                        ${label}
                    </div>
                  `;
                }
                const seatKey = `bot-${i}`;
                  const config = (table.seatsConfig || {})[seatKey] || 'standard';
                  let seatIcon = '+';
                  let extraClass = 'text-on-surface-variant opacity-60 bg-surface-container-low border-outline-variant text-[10px]';
                  if (config === 'wheelchair') { seatIcon = '♿'; extraClass = 'text-blue-600 bg-blue-50 border-blue-300 opacity-100 text-[14px]'; }
                  if (config === 'highchair') { seatIcon = '🪑'; extraClass = 'text-amber-600 bg-amber-50 border-amber-300 opacity-100 text-[14px]'; }
                  return `
                    <div class="empty-seat w-7 h-7 rounded-full border border-dashed flex items-center justify-center cursor-pointer hover:scale-110 transition-transform ${extraClass}"
                      data-table-id="${table.id}"
                      data-seat-key="${seatKey}"
                      title="${config === 'standard' ? 'Asiento Estándar (Clic para cambiar)' : config === 'wheelchair' ? 'Silla de Ruedas' : 'Periquera'}">
                      ${seatIcon}
                    </div>`;
              }).join('')}
            </div>

            <!-- Contenido de la Mesa -->
            <div class="flex flex-col items-center select-none text-center">
              <span class="font-['Cinzel'] font-bold text-primary tracking-widest uppercase text-base">${table.name}</span>
              ${table.subtitle ? `<span class="text-on-surface-variant mt-0.5 tracking-widest text-[10.5px] uppercase font-medium">${table.subtitle}</span>` : ''}
              
              <div class="mt-2.5 flex items-center gap-4 text-[11px] text-on-surface-variant">
                <span class="flex items-center gap-1.5 font-mono ${isOver ? 'text-[#A38047] font-bold' : ''}">
                  <span class="material-symbols-outlined font-light text-[15px]">group</span>
                  ${totalPasses} / ${table.capacity} pases ${isOver ? `(+${overCount} sobrecupo)` : ''}
                </span>
                ${(table.id === 'tbl_imperial' || table.type === 'imperial') ? `
                  <span class="flex items-center gap-1 text-amber-700 font-semibold">
                    <span class="material-symbols-outlined font-light text-[14px]">star</span> VIP
                  </span>
                ` : ''}
              </div>
            </div>

            <!-- Dropzone Hover Indicator -->
            <div class="drop-indicator absolute inset-0 flex items-center justify-center bg-surface-container-high/80 rounded-2xl opacity-0 pointer-events-none transition-opacity">
              <span class="material-symbols-outlined font-light text-[32px] text-charcoal">add</span>
            </div>

          </div>
        </div>
      `;
    } else {
      // ==================== MESA CIRCULAR ====================
      const seatSlots = Math.max(table.capacity, seatedSlots.length);
      const radius = 124; // Radio en px

      return `
        <div class="table-card-dropzone relative group flex justify-center mb-6"
          data-table-id="${table.id}"
          style="transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);">
          
          <div class="rounded-full bg-surface-container-lowest border ${overBorderClass} flex flex-col items-center justify-center relative transition-all hover:border-charcoal shadow-md" style="width: 288px; height: 288px;">
            
            <!-- Asientos Radiales Circulares -->
            ${Array.from({ length: seatSlots }).map((_, i) => {
              const angle = (i / seatSlots) * 2 * Math.PI - Math.PI / 2;
              const x = Math.round(radius * Math.cos(angle));
              const y = Math.round(radius * Math.sin(angle));
              const slot = seatedSlots[i];

              if (slot) {
                const g = slot.guest;
                const st = this.getGuestStatusClasses(g);
                
                    const rawName = g.name.replace(/^(Familia|Hermanos|Sr\.|Sra\.|Dr\.|Dra\.)\s+/i, '');
                    const initials = rawName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'IN';
                    const shortName = rawName.split(' ')[0].substring(0, 6) || 'INV';
                    const baseLabel = this.shortNamesMode ? shortName : initials;
                    
                    const label = slot.totalPasses > 1 ? `${baseLabel}${slot.passNumber}` : baseLabel;
                    
                    let dietBadge = '';
                    if (g.diet && g.diet.toLowerCase() !== 'none' && g.diet.toLowerCase() !== 'ninguna') {
                      const d = g.diet.toLowerCase();
                      let color = 'bg-red-500'; // Default alert
                      if (d.match(/veg|vegan/)) color = 'bg-emerald-500';
                      else if (d.match(/infant|niñ|kid/)) color = 'bg-amber-400';
                      dietBadge = `<div class="absolute -top-1 -right-1 w-2.5 h-2.5 ${color} rounded-full border-2 border-white shadow-xs z-10"></div>`;
                    }


                return `
                  <div class="seat-pill relative h-7 w-auto min-w-[28px] px-1.5 text-[9px] rounded-full bg-emerald-100 text-emerald-900 border border-emerald-400 ring-2 ring-emerald-500/30 flex items-center justify-center cursor-grab active:cursor-grabbing text-[10px] font-mono font-bold shadow-sm transition-all hover:scale-125 select-none hover:ring-2 hover:ring-primary absolute"
                    style="left: calc(50% + ${x}px - 14px); top: calc(50% + ${y}px - 14px);"
                    draggable="true"
                    data-drag-type="single"
                    data-guest-id="${g.id}"
                    data-table-id="${table.id}"
                    title="${g.name} (${slot.totalPasses} ${slot.totalPasses === 1 ? 'pase' : 'pases'} · ${st.label})">
                    ${dietBadge}
                        ${label}
                  </div>
                `;
              }

              
                const seatKey = `circ-${i}`;
                const config = (table.seatsConfig || {})[seatKey] || 'standard';
                let seatIcon = '+';
                let extraClass = 'text-on-surface-variant opacity-60 bg-surface-container-low border-outline-variant text-[10px]';
                if (config === 'wheelchair') { seatIcon = '♿'; extraClass = 'text-blue-600 bg-blue-50 border-blue-300 opacity-100 text-[14px]'; }
                if (config === 'highchair') { seatIcon = '🪑'; extraClass = 'text-amber-600 bg-amber-50 border-amber-300 opacity-100 text-[14px]'; }
                return `
                  <div class="empty-seat w-7 h-7 rounded-full border border-dashed flex items-center justify-center cursor-pointer hover:scale-110 transition-transform absolute ${extraClass}"
                    data-table-id="${table.id}"
                    data-seat-key="${seatKey}"
                    title="${config === 'standard' ? 'Asiento Estándar (Clic para cambiar)' : config === 'wheelchair' ? 'Silla de Ruedas' : 'Periquera'}"
                    style="left: calc(50% + ${x}px - 14px); top: calc(50% + ${y}px - 14px);">
                    ${seatIcon}
                  </div>
                `;

            }).join('')}

            <!-- Contenido Central Mesa Circular -->
            <div class="flex flex-col items-center select-none text-center px-4">
              <span class="font-['Cinzel'] font-bold text-primary tracking-widest text-base">${table.name}</span>
              ${table.subtitle ? `<span class="text-[10px] text-on-surface-variant tracking-wider uppercase font-medium">${table.subtitle}</span>` : ''}
              
              <div class="mt-2 flex items-center gap-1 text-[10.5px] font-mono text-on-surface-variant bg-surface px-2.5 py-0.5 rounded-lg border ${isOver ? 'border-[#A38047] text-[#A38047] font-bold' : 'border-outline-variant'}">
                ${totalPasses} / ${table.capacity} pases ${isOver ? `(+${overCount})` : ''}
              </div>
            </div>

            <!-- Dropzone Hover Indicator -->
            <div class="drop-indicator absolute inset-0 flex items-center justify-center bg-surface-container-high/80 rounded-full opacity-0 pointer-events-none transition-opacity">
              <span class="material-symbols-outlined font-light text-[32px] text-charcoal">add</span>
            </div>

          </div>
        </div>
      `;
    }
  }

  /**
   * Renderizado de las mesas interactivas en el Floor Plan
   * Distribución: Mesa Imperial Superior Centrada + 50% Ala Izquierda y 50% Ala Derecha
   */
  renderTables() {
    if (typeof document === 'undefined') return;
    const container = document.querySelector(this.options.tablesContainerSelector);
    if (!container) return;

    // 1. Separar Mesa Imperial (Presidencia) y Mesas de Invitados
    const imperialTables = this.state.tables.filter(t => t.id === 'tbl_imperial' || (t.type === 'imperial' && t.name.toLowerCase().includes('imperial')));
    const guestTables = this.state.tables.filter(t => !imperialTables.includes(t));

    // Si no hay imperial explícita pero hay alguna imperial, usar la primera como presidencia
    if (imperialTables.length === 0 && this.state.tables.some(t => t.type === 'imperial')) {
      const firstImp = this.state.tables.find(t => t.type === 'imperial');
      imperialTables.push(firstImp);
      const idx = guestTables.indexOf(firstImp);
      if (idx !== -1) guestTables.splice(idx, 1);
    }

    // 2. Dividir las mesas de invitados en 50% Izquierda y 50% Derecha
    const halfCount = Math.ceil(guestTables.length / 2);
    const leftWingTables = guestTables.slice(0, halfCount);
    const rightWingTables = guestTables.slice(halfCount);

    let html = '';

    // ── ZONA SUPERIOR: MESA IMPERIAL CENTRADA (PRESIDENCIA) ──
    if (imperialTables.length > 0) {
      html += `
        <div class="floor-plan-presidencia w-full flex flex-col items-center mb-10">
          <div class="text-center mb-3">
            <span class="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-amber-900 bg-amber-50 border border-amber-300/60 px-3.5 py-1 rounded-full font-bold shadow-xs">
              <span class="material-symbols-outlined text-[14px] text-amber-700">stars</span>
              Presidencia · Novios & Corte de Honor
            </span>
          </div>
          ${imperialTables.map(t => this.renderSingleTableHTML(t)).join('')}
        </div>
      `;
    }

    // ── ZONA INFERIOR: DISTRIBUCIÓN BILATERAL (ALA IZQUIERDA Y ALA DERECHA) ──
    if (guestTables.length > 0) {
      html += `
        <div class="floor-plan-wings-grid grid grid-cols-1 lg:grid-cols-2 w-full max-w-[960px] mx-auto items-start" style="column-gap: 4rem; row-gap: 3.5rem;">
          
          <!-- ALA IZQUIERDA (50% de las mesas) -->
          <div class="wing-column wing-left flex flex-col items-center gap-6 p-4 rounded-2xl bg-white/50 border border-outline-variant/60 shadow-xs">
            <div class="w-full flex items-center justify-between px-3 py-1.5 border-b border-outline-variant/60">
              <span class="text-[10.5px] font-mono uppercase tracking-wider text-primary font-bold flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[15px] text-amber-700">west</span>
                Ala Izquierda
              </span>
              <span class="text-[10px] font-mono text-on-surface-variant font-semibold bg-surface px-2 py-0.5 rounded border border-outline-variant">${leftWingTables.length} mesas</span>
            </div>
            <div class="flex flex-col items-center gap-4 w-full">
              ${leftWingTables.map(t => this.renderSingleTableHTML(t)).join('')}
            </div>
          </div>

          <!-- ALA DERECHA (50% de las mesas) -->
          <div class="wing-column wing-right flex flex-col items-center gap-6 p-4 rounded-2xl bg-white/50 border border-outline-variant/60 shadow-xs">
            <div class="w-full flex items-center justify-between px-3 py-1.5 border-b border-outline-variant/60">
              <span class="text-[10.5px] font-mono uppercase tracking-wider text-primary font-bold flex items-center gap-1.5">
                Ala Derecha
                <span class="material-symbols-outlined text-[15px] text-amber-700">east</span>
              </span>
              <span class="text-[10px] font-mono text-on-surface-variant font-semibold bg-surface px-2 py-0.5 rounded border border-outline-variant">${rightWingTables.length} mesas</span>
            </div>
            <div class="flex flex-col items-center gap-4 w-full">
              ${rightWingTables.map(t => this.renderSingleTableHTML(t)).join('')}
            </div>
          </div>

        </div>
      `;
    }

    container.innerHTML = html;
    this.bindDropZoneEvents(container);
  }

  /**
   * Renderizado de la barra de estadísticas superior (por número total de pases)
   */
  
  renderStats() {
    if (typeof document === 'undefined') return;

    const staffTableIds = this.state.tables.filter(t => t.isStaff).map(t => t.id);
    const guestPassesList = this.state.guests.filter(g => !staffTableIds.includes(g.tableId));

    const totalPasses = guestPassesList.reduce((s, g) => s + (g.pases || g.passes || 1), 0);
    const assignedPasses = guestPassesList.filter(g => g.tableId).reduce((s, g) => s + (g.pases || g.passes || 1), 0);
    const unassignedPasses = totalPasses - assignedPasses;
    const percent = totalPasses > 0 ? Math.round((assignedPasses / totalPasses) * 100) : 0;

    const overCapacityTables = this.state.tables.filter(table => {
      const passes = this.state.guests.filter(g => g.tableId === table.id).reduce((s, g) => s + (g.pases || g.passes || 1), 0);
      return passes > table.capacity;
    }).length;


    // Actualizar contadores DOM
    const elAssigned = document.querySelector(this.options.statsAssignedCountSelector);
    if (elAssigned) elAssigned.textContent = assignedPasses;

    const elTotal = document.querySelector(this.options.statsTotalCountSelector);
    if (elTotal) elTotal.textContent = `/ ${totalPasses} pases`;

    const elUnassigned = document.querySelector(this.options.statsUnassignedSelector);
    if (elUnassigned) elUnassigned.textContent = unassignedPasses;

    const elProgressBar = document.querySelector(this.options.statsProgressBarSelector);
    if (elProgressBar) elProgressBar.style.width = `${percent}%`;

    const elPercent = document.querySelector(this.options.statsPercentSelector);
    if (elPercent) elPercent.textContent = `${percent}%`;

    const elOvercapacityBadge = document.querySelector(this.options.statsOvercapacityBadgeSelector);
    if (elOvercapacityBadge) {
      if (overCapacityTables > 0) {
        elOvercapacityBadge.innerHTML = `
          <span class="material-symbols-outlined font-light text-[18px] text-[#A38047]">warning</span>
          <span class="font-label-caps text-[#A38047] font-semibold">${overCapacityTables} en Sobrecupo</span>
        `;
        elOvercapacityBadge.className = "flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-[#A38047] border border-[#A38047]/40 rounded-lg";
      } else {
        elOvercapacityBadge.innerHTML = `
          <span class="material-symbols-outlined font-light text-[18px]">info</span>
          <span class="font-label-caps">0 Sobrecupo</span>
        `;
        elOvercapacityBadge.className = "flex items-center gap-2 px-4 py-2 bg-surface-container text-on-surface-variant border border-outline-variant rounded-lg";
      }
    }
  }

  bindDragStartEvents(scopeElement) {
    if (typeof document === 'undefined') return;
    
      scopeElement.querySelectorAll('[draggable="true"]').forEach(el => {
        el.addEventListener('dragstart', (e) => {
          if (this.options.readOnly) {
            e.preventDefault();
            return;
          }
          const guestId = el.dataset.guestId;

        this.state.draggedItem = { type: 'single', id: guestId };
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'single', id: guestId }));

        el.classList.add('opacity-40');
        e.dataTransfer.effectAllowed = 'move';
      });

      el.addEventListener('dragend', () => {
        el.classList.remove('opacity-40');
        this.state.draggedItem = null;
        document.querySelectorAll('.drop-indicator').forEach(ind => ind.classList.add('opacity-0'));
      });
    });
  }

  bindDropZoneEvents(scopeElement) {
    if (typeof document === 'undefined') return;

    // 1. Dropzones de Mesa (Reasignación y Mover entre mesas)
    
      // -- EMPTY SEAT CONFIG (WHEELCHAIR/HIGHCHAIR) --
      scopeElement.querySelectorAll('.empty-seat').forEach(seat => {
        seat.addEventListener('click', (e) => {
          if (this.options.readOnly) return;
          const tableId = seat.dataset.tableId;
          const seatKey = seat.dataset.seatKey;
          const table = this.state.tables.find(t => t.id === tableId);
          if (table) {
            table.seatsConfig = table.seatsConfig || {};
            const current = table.seatsConfig[seatKey] || 'standard';
            if (current === 'standard') table.seatsConfig[seatKey] = 'wheelchair';
            else if (current === 'wheelchair') table.seatsConfig[seatKey] = 'highchair';
            else table.seatsConfig[seatKey] = 'standard';
            this.updateStateAndDOM();
          }
        });
      });

      scopeElement.querySelectorAll('.table-card-dropzone').forEach(dropzone => {
      const tableId = dropzone.dataset.tableId;
      const indicator = dropzone.querySelector('.drop-indicator');

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (indicator) indicator.classList.remove('opacity-0');
      });

      dropzone.addEventListener('dragleave', () => {
        if (indicator) indicator.classList.add('opacity-0');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        if (indicator) indicator.classList.add('opacity-0');

        let draggedId = null;
        try {
          const payload = JSON.parse(e.dataTransfer.getData('text/plain'));
          draggedId = payload.id;
        } catch (err) {
          if (this.state.draggedItem && this.state.draggedItem.id) {
            draggedId = this.state.draggedItem.id;
          }
        }

        if (draggedId) {
          this.assignGuestToTable(draggedId, tableId);
        }
      });
    });

    // 2. Drag & Drop e Intercambio Directo (Swap) en Asientos / Seat Pills
    scopeElement.querySelectorAll('.seat-pill').forEach(pill => {
      const targetGuestId = pill.dataset.guestId;

      
        pill.addEventListener('mouseenter', (e) => {
          if (targetGuestId) this.showTooltip(e, targetGuestId);
        });
        pill.addEventListener('mouseleave', () => {
          this.hideTooltip();
        });
        pill.addEventListener('touchstart', (e) => {
          if (targetGuestId) {
            this.showTooltip(e, targetGuestId);
            setTimeout(() => this.hideTooltip(), 3000);
          }
        }, { passive: true });
        
        
        pill.addEventListener('dragstart', (e) => {
          if (this.options.readOnly) {
            e.preventDefault();
            return;
          }
          this.hideTooltip();


        e.stopPropagation();
        this.state.draggedItem = { type: 'single', id: targetGuestId };
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'single', id: targetGuestId }));
        pill.classList.add('opacity-40');
        e.dataTransfer.effectAllowed = 'move';
      });

      pill.addEventListener('dragend', (e) => {
        e.stopPropagation();
        pill.classList.remove('opacity-40');
        this.state.draggedItem = null;
        document.querySelectorAll('.drop-indicator').forEach(ind => ind.classList.add('opacity-0'));
      });

      pill.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        pill.classList.add('ring-4', 'ring-amber-500', 'scale-125');
      });

      pill.addEventListener('dragleave', (e) => {
        e.stopPropagation();
        pill.classList.remove('ring-4', 'ring-amber-500', 'scale-125');
      });

      pill.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        pill.classList.remove('ring-4', 'ring-amber-500', 'scale-125');

        let draggedId = null;
        try {
          const payload = JSON.parse(e.dataTransfer.getData('text/plain'));
          draggedId = payload.id;
        } catch (err) {
          if (this.state.draggedItem && this.state.draggedItem.id) {
            draggedId = this.state.draggedItem.id;
          }
        }

        if (draggedId && draggedId !== targetGuestId) {
          // INTERCAMBIO DIRECTO (SWAP) ENTRE INVITADOS
          this.swapGuests(draggedId, targetGuestId);
        }
      });

      // Clic en asiento para desasignar
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        this.unassignGuest(targetGuestId);
      });
    });
  }

  bindGlobalEvents() {
    if (typeof document === 'undefined') return;
    const unassignedContainer = document.querySelector(this.options.unassignedListSelector);
    if (!unassignedContainer) return;

    unassignedContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      unassignedContainer.classList.add('ring-2', 'ring-charcoal');
    });

    unassignedContainer.addEventListener('dragleave', () => {
      unassignedContainer.classList.remove('ring-2', 'ring-charcoal');
    });

    unassignedContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      unassignedContainer.classList.remove('ring-2', 'ring-charcoal');
      
      try {
        const payload = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (payload.type === 'family' && Array.isArray(payload.ids)) {
          payload.ids.forEach(id => this.unassignGuest(id));
        } else if (payload.id) {
          this.unassignGuest(payload.id);
        }
      } catch (err) {
        if (this.state.draggedItem && this.state.draggedItem.id) {
          this.unassignGuest(this.state.draggedItem.id);
        }
      }
    });
  }

  addTable(name = 'Mesa', type = 'circular', capacity = 8, isStaff = false) {
    const newNumber = this.state.tables.length + 1;
    const newTable = {
      id: 'tbl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      number: String(newNumber),
      name: isStaff ? `STAFF ${newNumber}` : `${name} ${newNumber}`,
      subtitle: isStaff ? 'Proveedores y Crew' : 'Invitados',
        isStaff: isStaff,
      type: type,
      capacity: capacity
    };
    this.state.tables.push(newTable);
    this.updateStateAndDOM();
    return newTable;
  }

  /**
   * Ajusta la capacidad (8, 10 o 12) en todas las mesas del evento
   */
  setCapacityAcrossTables(capacity = 8) {
    const validCap = [8, 10, 12].includes(Number(capacity)) ? Number(capacity) : 8;
    this.state.tables.forEach(t => {
      t.capacity = validCap;
    });
    this.updateStateAndDOM();
    return validCap;
  }

  /**
   * Ajusta la cantidad total de mesas en el salón
   */
  setTotalTables(targetCount, defaultCapacity = 8) {
    const target = Math.max(1, Number(targetCount) || 1);
    
    // Si faltan mesas, crearlas
    while (this.state.tables.length < target) {
      const newNum = this.state.tables.length + 1;
      this.state.tables.push({
        id: 'tbl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        number: String(newNum),
        name: `Mesa ${newNum}`,
        subtitle: 'Invitados',
        type: 'circular',
        capacity: defaultCapacity
      });
    }

    // Si sobran mesas, desasignar invitados y recortar
    if (this.state.tables.length > target) {
      const removedTables = this.state.tables.slice(target);
      const removedIds = new Set(removedTables.map(t => t.id));
      this.state.guests.forEach(g => {
        if (removedIds.has(g.tableId)) {
          g.tableId = null;
        }
      });
      this.state.tables = this.state.tables.slice(0, target);
    }

    this.updateStateAndDOM();
    return this.state.tables.length;
  }

  /**
   * Configura el Salón con Mesa Imperial personalizada + Mesas Circulares (8, 10 o 12)
   * y distribuye automáticamente a los invitados respetando Presidencia y Alas Izquierda / Derecha
   */
  configureSalonAndDistribute(options = {}) {
    const total = Math.max(1, Number(options.totalGuests) || 120);
    const impCap = Math.max(2, Number(options.imperialCapacity) || 10);
    const circCap = [8, 10, 12].includes(Number(options.circularCapacity)) ? Number(options.circularCapacity) : 8;

    // 1. Calcular mesas circulares requeridas para los comensales restantes
    const remainingGuests = Math.max(0, total - impCap);
    const neededCircular = Math.ceil(remainingGuests / circCap) || 1;

    // 2. Reconstruir tablas del salón: 1 Imperial (Presidencia) + N Circulares (Alas)
    const newTables = [
      {
        id: 'tbl_imperial',
        number: 'I',
        name: 'Mesa Imperial',
        subtitle: 'Novios & Corte de Honor',
        type: 'imperial',
        capacity: impCap,
        posX: '50%',
        posY: '40px'
      }
    ];

    for (let i = 1; i <= neededCircular; i++) {
      newTables.push({
        id: `tbl_${i}`,
        number: String(i),
        name: `Mesa ${i}`,
        subtitle: 'Invitados',
        type: 'circular',
        capacity: circCap
      });
    }

    this.state.tables = newTables;

    // 3. Limpiar asignaciones anteriores
    this.state.guests.forEach(g => g.tableId = null);

    // 4. Asignar primero VIPs y Corte de Honor a Mesa Imperial
    const imperialTable = this.state.tables[0];
    const vips = this.state.guests.filter(g => g.court || g.vip);
    const regulars = this.state.guests.filter(g => !g.court && !g.vip);

    vips.forEach(g => {
      const currentPasses = this.state.guests
        .filter(x => x.tableId === imperialTable.id)
        .reduce((s, x) => s + (x.pases || x.passes || 1), 0);
      const gPasses = g.pases || g.passes || 1;

      if (currentPasses + gPasses <= imperialTable.capacity) {
        g.tableId = imperialTable.id;
      }
    });

    // 5. Asignar resto de invitados (incluyendo VIPs que excedieron) a las mesas circulares
    const unassigned = this.state.guests.filter(g => !g.tableId);
    const circularTablesList = this.state.tables.slice(1);

    unassigned.forEach(g => {
      const gPasses = g.pases || g.passes || 1;

      let bestTable = circularTablesList.find(tbl => {
        const currentPasses = this.state.guests
          .filter(x => x.tableId === tbl.id)
          .reduce((s, x) => s + (x.pases || x.passes || 1), 0);
        return (currentPasses + gPasses) <= tbl.capacity;
      });

      if (!bestTable && circularTablesList.length > 0) {
        bestTable = circularTablesList.reduce((minTbl, tbl) => {
          const occA = this.state.guests.filter(x => x.tableId === tbl.id).reduce((s, x) => s + (x.pases || x.passes || 1), 0);
          const occMin = this.state.guests.filter(x => x.tableId === minTbl.id).reduce((s, x) => s + (x.pases || x.passes || 1), 0);
          return occA < occMin ? tbl : minTbl;
        }, circularTablesList[0]);
      }

      if (bestTable) {
        g.tableId = bestTable.id;
      }
    });

    this.updateStateAndDOM();

    const totalCapacity = impCap + (neededCircular * circCap);
    return {
      totalGuests: total,
      imperialCapacity: impCap,
      circularCapacity: circCap,
      circularTablesCount: neededCircular,
      leftWingCount: Math.ceil(neededCircular / 2),
      rightWingCount: Math.floor(neededCircular / 2),
      totalCapacity: totalCapacity,
      freeSeats: totalCapacity - total
    };
  }

  /**
   * Configura la estructura del salón (Mesa Imperial + Mesas Circulares)
   * preservando asignaciones existentes siempre que sea posible.
   */
  configureSalonStructure(options = {}) {
    const total = Math.max(1, Number(options.totalGuests) || 120);
    const impCap = Math.max(2, Number(options.imperialCapacity) || 10);
    const circCap = [8, 10, 12].includes(Number(options.circularCapacity)) ? Number(options.circularCapacity) : 8;

    const remainingGuests = Math.max(0, total - impCap);
    const neededCircular = Math.ceil(remainingGuests / circCap) || 1;

    let impTable = this.state.tables.find(t => t.type === 'imperial');
    if (!impTable) {
      impTable = {
        id: 'tbl_imperial',
        number: 'I',
        name: 'Mesa Imperial',
        subtitle: 'Novios & Corte de Honor',
        type: 'imperial',
        capacity: impCap,
        posX: '50%',
        posY: '40px'
      };
    } else {
      impTable.capacity = impCap;
    }

    const newTables = [impTable];

    for (let i = 1; i <= neededCircular; i++) {
      const existing = this.state.tables.find(t => t.id === `tbl_${i}`);
      if (existing) {
        existing.capacity = circCap;
        existing.type = 'circular';
        newTables.push(existing);
      } else {
        newTables.push({
          id: `tbl_${i}`,
          number: String(i),
          name: `Mesa ${i}`,
          subtitle: 'Invitados',
          type: 'circular',
          capacity: circCap
        });
      }
    }

    const validTableIds = new Set(newTables.map(t => t.id));
    this.state.guests.forEach(g => {
      if (g.tableId && !validTableIds.has(g.tableId)) {
        g.tableId = null;
      }
    });

    this.state.tables = newTables;
    this.updateStateAndDOM();

    const totalCapacity = impCap + (neededCircular * circCap);
    return {
      totalGuests: total,
      imperialCapacity: impCap,
      circularCapacity: circCap,
      circularTablesCount: neededCircular,
      leftWingCount: Math.ceil(neededCircular / 2),
      rightWingCount: Math.floor(neededCircular / 2),
      totalCapacity: totalCapacity,
      freeSeats: totalCapacity - total
    };
  }

  /**
   * Distribución Automática Inteligente de Invitaciones
   * Respeta cortes de honor / VIPs y capacidad por mesa (8, 10 o 12)
   */
  autoDistributeGuests(options = {}) {
    const capacity = [8, 10, 12].includes(Number(options.capacity)) ? Number(options.capacity) : 8;
    const imperialCap = Number(options.imperialCapacity) || 10;
    
    // 1. Ajustar capacidades
    this.state.tables.forEach(t => {
      if (t.type === 'imperial') {
        t.capacity = imperialCap;
      } else {
        t.capacity = capacity;
      }
    });

    // 2. Limpiar asignaciones
    this.state.guests.forEach(g => g.tableId = null);

    // 3. Separar VIPs y Regulares
    const vips = this.state.guests.filter(g => g.court || g.vip);
    const regulars = this.state.guests.filter(g => !g.court && !g.vip);

    // 4. Asignar primero VIPs a Mesa Imperial
    const imperialTable = this.state.tables.find(t => t.type === 'imperial') || this.state.tables[0];
    if (imperialTable) {
      vips.forEach(g => {
        const currentPasses = this.state.guests
          .filter(x => x.tableId === imperialTable.id)
          .reduce((s, x) => s + (x.pases || x.passes || 1), 0);
        const gPasses = g.pases || g.passes || 1;

        if (currentPasses + gPasses <= imperialTable.capacity) {
          g.tableId = imperialTable.id;
        }
      });
    }

    // 5. Asignar Resto de Invitaciones por Bloques de Pases sin Separar
    const unassignedRemaining = this.state.guests.filter(g => !g.tableId);

    unassignedRemaining.forEach(g => {
      const gPasses = g.pases || g.passes || 1;

      let bestTable = this.state.tables.find(tbl => {
        const currentPasses = this.state.guests
          .filter(x => x.tableId === tbl.id)
          .reduce((s, x) => s + (x.pases || x.passes || 1), 0);
        return (currentPasses + gPasses) <= tbl.capacity;
      });

      if (!bestTable) {
        bestTable = this.addTable('Mesa', 'circular', capacity);
      }

      g.tableId = bestTable.id;
    });

    this.updateStateAndDOM();

    const totalPasses = this.state.guests.reduce((s, g) => s + (g.pases || g.passes || 1), 0);
    const assignedPasses = this.state.guests.filter(g => g.tableId).reduce((s, g) => s + (g.pases || g.passes || 1), 0);

    return {
      totalGuests: this.state.guests.length,
      totalPasses: totalPasses,
      assignedPasses: assignedPasses,
      totalTables: this.state.tables.length,
      capacityPerTable: capacity,
      totalCapacity: this.state.tables.reduce((acc, t) => acc + t.capacity, 0)
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SeatingPlanner;
} else if (typeof window !== 'undefined') {
  window.SeatingPlanner = SeatingPlanner;
}
