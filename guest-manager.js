/**
 * ============================================================================
 * GuestManager — Motor Central de Logística, Invitados y Envíos
 * Invitta 2.0 Beta · Antigravity
 * ============================================================================
 */

function sanitizeText(value, maxLen = 200) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') value = String(value);
  return value.replace(/[<>"'`;&\\]/g, '').trim().slice(0, maxLen);
}

class GuestManager {
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'invitta_2_guest_db';
    this.options = Object.assign({
      defaultContemplatedGuests: 120,
      defaultCapacityPerTable: 8,
      eventDetails: {
        coupleName: 'Catalina & Julián',
        eventDate: '20 de Marzo, 2027',
        venue: 'Jardín Las Magnolias',
        rsvpDeadline: '15 de Febrero, 2027',
        baseUrl: options.baseUrl || (typeof window !== 'undefined' && window.location ? window.location.href.split('index.html')[0] : '')
      }
    }, options);

    // Sincronizar datos con el Creador de Invitación si existen
    if (typeof localStorage !== 'undefined') {
      try {
        const rawInvite = localStorage.getItem('invitta_event_invitation_config');
        if (rawInvite) {
          const inviteConf = JSON.parse(rawInvite);
          if (inviteConf.brideName && inviteConf.groomName) {
            this.options.eventDetails.coupleName = `${inviteConf.brideName} & ${inviteConf.groomName}`;
          }
          if (inviteConf.eventDate) this.options.eventDetails.eventDate = inviteConf.eventDate;
          if (inviteConf.receptionPlace) this.options.eventDetails.venue = inviteConf.receptionPlace;
          if (inviteConf.rsvpDeadline) this.options.eventDetails.rsvpDeadline = inviteConf.rsvpDeadline;
        }
      } catch (e) {}
    }

    this.state = this.loadState();
  }

  loadState() {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) return JSON.parse(raw);
      } catch (e) {
        console.warn('Error loading from storage, using defaults', e);
      }
    }

    return this.getInitialState();
  }

  saveState() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.state));
      } catch (e) {}
    }
  }

  getInitialState() {
    const contemplated = this.options.defaultContemplatedGuests;
    const capacity = this.options.defaultCapacityPerTable;
    const requiredTables = Math.ceil(contemplated / capacity);

    return {
      config: {
        contemplatedGuests: contemplated,
        capacityPerTable: capacity,
        totalTables: requiredTables,
        overCapacityColor: '#A38047'
      },
      tables: this.generateInitialTables(requiredTables, capacity),
      guests: this.getDefaultGuests()
    };
  }

  generateInitialTables(count, capacity) {
    const tables = [];
    for (let i = 1; i <= count; i++) {
      const isImperial = i === 1;
      tables.push({
        id: `tbl_${i}`,
        number: isImperial ? 'I' : String(i),
        name: isImperial ? 'Mesa Imperial (Novios & Corte)' : `Mesa ${i}`,
        subtitle: isImperial ? 'Presidencial' : 'Banquete',
        type: isImperial ? 'imperial' : 'circular',
        capacity: capacity
      });
    }
    return tables;
  }

  getDefaultGuests() {
    return [
      // 1. Familia Martínez (Bloque 4 pases)
      {
        id: 'g_martinez',
        name: 'Familia Martínez Valdés',
        contactName: 'Carlos Martínez',
        familyKey: 'martinez',
        passes: 4,
        confirmedPasses: 0,
        phone: '+525512345678',
        email: 'carlos.martinez@example.com',
        role: 'family_bride',
        roleLabel: 'Familia de la Novia',
        vip: true,
        court: false,
        tableId: 'tbl_2',
        status: 'SENT', // DRAFT, SENT, CONFIRMED, DECLINED
        diet: 'none',
        notes: 'Incluye menú infantil para Mateo',
        sentAt: '2026-08-25T14:30:00Z',
        respondedAt: null,
        reminderSentAt: null
      },
      // 2. Camila Ortiz (Corte de Honor · 2 pases)
      {
        id: 'g_camila',
        name: 'Camila Ortiz',
        contactName: 'Camila Ortiz',
        familyKey: '',
        passes: 2,
        confirmedPasses: 2,
        phone: '+525598765432',
        email: 'camila.ortiz@example.com',
        role: 'court',
        roleLabel: 'Dama de Honor · Corte',
        vip: true,
        court: true,
        tableId: 'tbl_1',
        status: 'CONFIRMED',
        diet: 'none',
        notes: 'Dama principal',
        sentAt: '2026-08-25T10:15:00Z',
        respondedAt: '2026-08-25T16:45:00Z',
        reminderSentAt: null
      },
      // 3. Diego Fuentes (Best Man · 2 pases)
      {
        id: 'g_diego',
        name: 'Diego Fuentes',
        contactName: 'Diego Fuentes',
        familyKey: '',
        passes: 2,
        confirmedPasses: 2,
        phone: '+525533221100',
        email: 'diego.fuentes@example.com',
        role: 'court',
        roleLabel: 'Best Man · Corte',
        vip: true,
        court: true,
        tableId: 'tbl_1',
        status: 'CONFIRMED',
        diet: 'none',
        notes: 'Padrino de brindis',
        sentAt: '2026-08-25T10:20:00Z',
        respondedAt: '2026-08-25T17:00:00Z',
        reminderSentAt: null
      },
      // 4. Dr. Carlos Valenzuela (2 pases)
      {
        id: 'g_valenzuela',
        name: 'Dr. Carlos & Sofía Valenzuela',
        contactName: 'Carlos Valenzuela',
        familyKey: 'valenzuela',
        passes: 2,
        confirmedPasses: 0,
        phone: '+525544332211',
        email: 'dr.valenzuela@example.com',
        role: 'vip',
        roleLabel: 'Invitado Especial',
        vip: true,
        court: false,
        tableId: 'tbl_2',
        status: 'DRAFT',
        diet: 'none',
        notes: '',
        sentAt: null,
        respondedAt: null,
        reminderSentAt: null
      },
      // 5. Renata Vega (Dama de Honor · 2 pases)
      {
        id: 'g_renata',
        name: 'Renata Vega',
        contactName: 'Renata Vega',
        familyKey: '',
        passes: 2,
        confirmedPasses: 2,
        phone: '+525577889900',
        email: 'renata.vega@example.com',
        role: 'court',
        roleLabel: 'Dama de Honor',
        vip: true,
        court: true,
        tableId: 'tbl_1',
        status: 'CONFIRMED',
        diet: 'celiac',
        notes: 'Restricción celíaca estricta',
        sentAt: '2026-08-25T11:00:00Z',
        respondedAt: '2026-08-25T15:20:00Z',
        reminderSentAt: null
      },
      // 6. Fernando Martínez Ruiz (2 pases)
      {
        id: 'g_fernando',
        name: 'Fernando Martínez Ruiz',
        contactName: 'Fernando Martínez',
        familyKey: '',
        passes: 2,
        confirmedPasses: 0,
        phone: '+525566778899',
        email: 'fernando.m@example.com',
        role: 'friends',
        roleLabel: 'Amigos',
        vip: false,
        court: false,
        tableId: 'tbl_3',
        status: 'SENT',
        diet: 'none',
        notes: '',
        sentAt: '2026-08-25T14:35:00Z',
        respondedAt: null,
        reminderSentAt: null
      }
    ];
  }

  // ==========================================
  // PASO 1: DIMENSIONAMIENTO & MESAS
  // ==========================================
  setDimensioning(contemplatedGuests, capacityPerTable) {
    const guests = Math.max(1, parseInt(contemplatedGuests, 10) || 120);
    const capacity = [8, 10, 12].includes(Number(capacityPerTable)) ? Number(capacityPerTable) : 8;
    const requiredTables = Math.ceil(guests / capacity);

    this.state.config.contemplatedGuests = guests;
    this.state.config.capacityPerTable = capacity;
    this.state.config.totalTables = requiredTables;

    this.state.tables = this.generateInitialTables(requiredTables, capacity);
    this.saveState();

    return {
      contemplatedGuests: guests,
      capacityPerTable: capacity,
      requiredTables: requiredTables,
      totalCapacity: requiredTables * capacity,
      marginSeats: (requiredTables * capacity) - guests
    };
  }

  // ==========================================
  // PASO 2: GESTIÓN DE INVITADOS
  // ==========================================
  addGuest(guestData) {
    if (guestData) {
      if (guestData.name !== undefined) guestData.name = sanitizeText(guestData.name, 100);
      if (guestData.contactName !== undefined) guestData.contactName = sanitizeText(guestData.contactName, 100);
      if (guestData.familyKey !== undefined) guestData.familyKey = sanitizeText(guestData.familyKey, 50);
      if (guestData.phone !== undefined) guestData.phone = sanitizeText(guestData.phone, 20);
      if (guestData.email !== undefined) guestData.email = sanitizeText(guestData.email, 100);
      if (guestData.notes !== undefined) guestData.notes = sanitizeText(guestData.notes, 500);
      if (guestData.diet !== undefined) guestData.diet = sanitizeText(guestData.diet, 50);
    }

    const newGuest = Object.assign({
      id: 'g_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      name: 'Invitado Nuevo',
      contactName: '',
      familyKey: '',
      passes: 2,
      confirmedPasses: 0,
      phone: '',
      email: '',
      role: 'general',
      roleLabel: 'Invitado General',
      vip: false,
      court: false,
      tableId: null,
      status: 'DRAFT',
      diet: 'none',
      notes: '',
      sentAt: null,
      respondedAt: null,
      reminderSentAt: null
    }, guestData);

    if (!newGuest.folio) {
      newGuest.folio = this.generateFolio(newGuest);
    }

    this.state.guests.push(newGuest);
    this.saveState();
    return newGuest;
  }

  updateGuest(id, updateData) {
    const guest = this.state.guests.find(g => g.id === id);
    if (!guest) return null;

    if (updateData) {
      if (updateData.name !== undefined) updateData.name = sanitizeText(updateData.name, 100);
      if (updateData.contactName !== undefined) updateData.contactName = sanitizeText(updateData.contactName, 100);
      if (updateData.familyKey !== undefined) updateData.familyKey = sanitizeText(updateData.familyKey, 50);
      if (updateData.phone !== undefined) updateData.phone = sanitizeText(updateData.phone, 20);
      if (updateData.email !== undefined) updateData.email = sanitizeText(updateData.email, 100);
      if (updateData.notes !== undefined) updateData.notes = sanitizeText(updateData.notes, 500);
      if (updateData.diet !== undefined) updateData.diet = sanitizeText(updateData.diet, 50);
    }

    Object.assign(guest, updateData);
    this.saveState();
    return guest;
  }

  deleteGuest(id) {
    const index = this.state.guests.findIndex(g => g.id === id);
    if (index !== -1) {
      this.state.guests.splice(index, 1);
      this.saveState();
      return true;
    }
    return false;
  }

  // ==========================================
  // PASO 3: AUTO-DISTRIBUCIÓN DE MESAS
  // ==========================================
  autoDistributeGuests() {
    const capacity = this.state.config?.capacityPerTable || 8;
    
    // Limpiar mesas
    this.state.guests.forEach(g => g.tableId = null);

    // 1. Asignar VIPs y Corte a Mesa 1 (Imperial)
    const imperialTable = this.state.tables.find(t => t.type === 'imperial' || t.id === 'tbl_imperial' || t.id === 'tbl_1') || this.state.tables[0];
    const courtVips = this.state.guests.filter(g => g.court || g.vip || g.isCourt || g.isVip);
    
    if (imperialTable) {
      let currentCount = 0;
      courtVips.forEach(g => {
        const p = g.passes || 1;
        if (currentCount + p <= imperialTable.capacity) {
          g.tableId = imperialTable.id;
          currentCount += p;
        }
      });
    }

    // 2. Agrupar por familias / afinidad (mismo apellido o familyKey)
    const unassigned = this.state.guests.filter(g => !g.tableId);
    
    const families = {};
    unassigned.forEach(g => {
      let key = g.familyKey;
      if (!key) {
        const cleanTokens = (g.name || '')
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .trim()
          .split(/\s+/)
          .filter(w => !['FAMILIA', 'FAM', 'SR', 'SRA', 'DR', 'DRA', 'ING', 'LIC', 'DON', 'DONA', 'DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y'].includes(w.toUpperCase()));
        key = cleanTokens.length > 0 ? cleanTokens[cleanTokens.length - 1].toLowerCase() : g.id;
      }
      if (!families[key]) families[key] = [];
      families[key].push(g);
    });

    Object.values(families).forEach(famGuests => {
      const famPasses = famGuests.reduce((sum, g) => sum + (g.passes || 1), 0);
      
      let table = this.state.tables.find(tbl => {
        if (tbl.id === imperialTable?.id && tbl.type === 'imperial') return false;
        const assignedInTable = this.state.guests
          .filter(x => x.tableId === tbl.id)
          .reduce((sum, x) => sum + (x.passes || 1), 0);
        return (assignedInTable + famPasses) <= tbl.capacity;
      });

      if (!table) {
        famGuests.forEach(g => {
          let indTable = this.state.tables.find(tbl => {
            const assignedInTable = this.state.guests
              .filter(x => x.tableId === tbl.id)
              .reduce((sum, x) => sum + (x.passes || 1), 0);
            return (assignedInTable + (g.passes || 1)) <= tbl.capacity;
          });

          if (!indTable) {
            const newNum = this.state.tables.length + 1;
            indTable = {
              id: `tbl_${newNum}`,
              number: String(newNum),
              name: `Mesa ${newNum.toString().padStart(2, '0')}`,
              subtitle: 'Banquete',
              type: 'circular',
              capacity: capacity
            };
            this.state.tables.push(indTable);
          }
          g.tableId = indTable.id;
        });
      } else {
        famGuests.forEach(g => g.tableId = table.id);
      }
    });

    this.saveState();
    const summary = this.getDistributionSummary();
    summary.success = true;
    summary.unassignedCount = this.state.guests.filter(g => !g.tableId).length;
    return summary;
  }

  getWaiterSheetData() {
    const tableData = this.state.tables.map(tbl => {
      const guests = this.state.guests.filter(g => g.tableId === tbl.id);
      const totalPax = guests.reduce((sum, g) => sum + (g.passes || 1), 0);
      const confirmedPax = guests.filter(g => g.status === 'CONFIRMED' || g.status === 'CHECKED_IN').reduce((sum, g) => sum + (g.confirmedPasses || g.passes || 1), 0);
      
      const specialDiets = [];
      guests.forEach(g => {
        if (g.diet && g.diet !== 'none') {
          specialDiets.push(g.diet);
        }
      });

      return {
        id: tbl.id,
        name: tbl.name,
        type: tbl.type,
        capacity: tbl.capacity,
        totalPax,
        confirmedPax,
        availableSeats: Math.max(0, tbl.capacity - totalPax),
        guests: guests.map(g => ({
          name: g.name,
          passes: g.passes,
          confirmedPasses: g.confirmedPasses,
          status: g.status,
          diet: g.diet,
          folio: g.folio || this.generateFolio(g)
        })),
        specialDiets
      };
    });

    return {
      eventName: this.options?.eventDetails?.title || 'Invitación de Gala',
      eventDate: this.options?.eventDetails?.date || '',
      totalGuests: this.state.guests.length,
      totalPax: this.state.guests.reduce((sum, g) => sum + (g.passes || 1), 0),
      tables: tableData
    };
  }

  searchGuestsAndTables(query) {
    if (!query) return [];
    const q = String(query).trim().toLowerCase();
    if (!q) return [];

    const results = [];
    this.state.guests.forEach(g => {
      const gName = (g.name || '').toLowerCase();
      const cName = (g.contactName || '').toLowerCase();
      const folio = (g.folio || '').toLowerCase();
      const table = this.state.tables.find(t => t.id === g.tableId);
      const tName = (table?.name || '').toLowerCase();

      if (gName.includes(q) || cName.includes(q) || folio.includes(q) || tName.includes(q)) {
        results.push({
          guestId: g.id,
          name: g.name,
          passes: g.passes,
          status: g.status,
          tableId: g.tableId,
          tableName: table?.name || 'Sin Asignar',
          folio: g.folio || this.generateFolio(g)
        });
      }
    });

    return results;
  }

  getDistributionSummary() {
    const totalPasses = this.state.guests.reduce((sum, g) => sum + g.passes, 0);
    const assignedPasses = this.state.guests.filter(g => g.tableId).reduce((sum, g) => sum + g.passes, 0);
    const totalCapacity = this.state.tables.reduce((sum, t) => sum + t.capacity, 0);

    return {
      totalGuestsCount: this.state.guests.length,
      totalPasses: totalPasses,
      assignedPasses: assignedPasses,
      unassignedPasses: totalPasses - assignedPasses,
      totalTables: this.state.tables.length,
      totalCapacity: totalCapacity,
      margin: totalCapacity - totalPasses
    };
  }

  // ==========================================
  // PASO 4: GENERADOR DE MENSAJES & LINKS
  // ==========================================
  getPersonalizedUrl(guest) {
    const base = this.options.eventDetails.baseUrl.replace(/\/+$/, '');
    const cleanGuest = encodeURIComponent(guest.name || guest.contactName || guest.id.replace(/^g_/, ''));
    const passes = guest.passes || 2;
    let url = `${base}/invitacion.html?guest=${cleanGuest}&passes=${passes}`;
    if (guest.phone) {
      url += `&phone=${encodeURIComponent(guest.phone)}`;
    }
    if (guest.tableId) {
      if (guest.tableId === 'tbl_imperial' || String(guest.tableId).includes('imp') || guest.court || guest.vip) {
        url += `&mesa=imperial`;
      } else {
        const match = String(guest.tableId).match(/\d+/);
        if (match) url += `&mesa=${match[0]}`;
      }
    }
    return url;
  }

  getWhatsAppLink(guest) {
    const url = this.getPersonalizedUrl(guest);
    const couple = this.options.eventDetails.coupleName;
    const date = this.options.eventDetails.eventDate;
    const passes = guest.passes;

    const message = `✨ *Invitación Especial de Boda — ${couple}* ✨\n\n` +
      `Estimad@ *${guest.name}*:\n` +
      `Nos llena de alegría invitarte a celebrar nuestra boda este *${date}*.\n\n` +
      `🎟️ Hemos reservado con mucho cariño *${passes} ${passes === 1 ? 'pase' : 'pases'}* para ti.\n\n` +
      `📲 Por favor confirma tu asistencia y consulta los detalles de la recepción en tu pase digital interactivo:\n` +
      `${url}\n\n` +
      `¡Esperamos contar con tu valiosa presencia!`;

    const encoded = encodeURIComponent(message);
    const cleanPhone = (guest.phone || '').replace(/[^0-9]/g, '');
    
    return cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
  }

  getReminderWhatsAppLink(guest) {
    const url = this.getPersonalizedUrl(guest);
    const couple = this.options.eventDetails.coupleName;
    const deadline = this.options.eventDetails.rsvpDeadline;

    const message = `🔔 *Recordatorio de Asistencia — Boda ${couple}* 🔔\n\n` +
      `Hola *${guest.name}*:\n` +
      `Esperamos que te encuentres muy bien. Te recordamos que la fecha límite para confirmar tu asistencia es el *${deadline}*.\n\n` +
      `🎟️ Tienes *${guest.passes} ${guest.passes === 1 ? 'pase reservado' : 'pases reservados'}*.\n\n` +
      `👉 Confirma en 1 clic aquí:\n${url}\n\n` +
      `¡Un abrazo grande!`;

    const encoded = encodeURIComponent(message);
    const cleanPhone = (guest.phone || '').replace(/[^0-9]/g, '');
    
    return cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
  }

  getEmailLink(guest) {
    const url = this.getPersonalizedUrl(guest);
    const couple = this.options.eventDetails.coupleName;
    const date = this.options.eventDetails.eventDate;
    
    const subject = encodeURIComponent(`Invitación Especial de Boda: ${couple}`);
    const body = encodeURIComponent(
      `Estimad@ ${guest.name},\n\n` +
      `Nos complace invitarte a celebrar el inicio de nuestra vida juntos este ${date}.\n\n` +
      `Tienes ${guest.passes} pases asignados. Puedes ver los horarios, mapas y confirmar asistencia en tu enlace personalizado:\n` +
      `${url}\n\n` +
      `Con afecto,\n${couple}`
    );

    return `mailto:${guest.email || ''}?subject=${subject}&body=${body}`;
  }

  markAsSent(id) {
    const g = this.updateGuest(id, {
      status: 'SENT',
      sentAt: new Date().toISOString()
    });
    return g;
  }

  markReminderSent(id) {
    const g = this.updateGuest(id, {
      reminderSentAt: new Date().toISOString()
    });
    return g;
  }

  recordRsvpResponse(id, { confirmed, confirmedPasses, diet, notes }) {
    const currentGuest = this.getGuest(id);
    const maxPasses = currentGuest?.passes || 1;
    let validPasses = 0;
    if (confirmed) {
      if (confirmedPasses !== undefined && confirmedPasses !== null && !isNaN(parseInt(confirmedPasses, 10))) {
        validPasses = Math.min(maxPasses, Math.max(0, parseInt(confirmedPasses, 10)));
      } else {
        validPasses = maxPasses;
      }
    }
    const g = this.updateGuest(id, {
      status: confirmed ? 'CONFIRMED' : 'DECLINED',
      confirmedPasses: validPasses,
      diet: diet || 'none',
      notes: notes || '',
      respondedAt: new Date().toISOString()
    });
    return g;
  }

  getGuest(id) {
    return this.state.guests.find(g => g.id === id);
  }

  getMetrics() {
    const total = this.state.guests.length;
    const totalPasses = this.state.guests.reduce((s, g) => s + g.passes, 0);
    
    const sent = this.state.guests.filter(g => g.status === 'SENT' || g.status === 'CONFIRMED' || g.status === 'DECLINED').length;
    const confirmedList = this.state.guests.filter(g => g.status === 'CONFIRMED');
    const confirmedCount = confirmedList.length;
    const confirmedPasses = confirmedList.reduce((s, g) => s + (g.confirmedPasses !== undefined ? g.confirmedPasses : g.passes), 0);
    
    const declinedList = this.state.guests.filter(g => g.status === 'DECLINED');
    const declinedCount = declinedList.length;
    const declinedPasses = declinedList.reduce((s, g) => s + g.passes, 0);

    const pendingCount = this.state.guests.filter(g => g.status === 'SENT' || g.status === 'DRAFT').length;

    return {
      totalGuests: total,
      totalPasses: totalPasses,
      sentCount: sent,
      confirmedCount: confirmedCount,
      confirmedPasses: confirmedPasses,
      declinedCount: declinedCount,
      declinedPasses: declinedPasses,
      pendingCount: pendingCount,
      confirmedPercent: totalPasses > 0 ? ((confirmedPasses / totalPasses) * 100).toFixed(1) : 0
    };
  }

  generateFolio(guest, passesCount) {
    if (!guest) return 'MGEN-INVITADO-1P';
    let mesaCode = 'MGEN';
    if (guest.isCourt || guest.isImperial || guest.court || guest.vip || guest.tableId === 'tbl_imperial' || String(guest.tableId).includes('imp')) {
      mesaCode = 'MIMP';
    } else if (guest.tableId || guest.table) {
      const match = String(guest.tableId || guest.table).match(/\d+/);
      if (match) mesaCode = 'M' + match[0].padStart(2, '0');
    }

    const gName = guest.name || guest.contactName || 'Invitado';
    const cleanTokens = gName
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .filter(w => !['FAMILIA', 'FAM', 'SR', 'SRA', 'DR', 'DRA', 'ING', 'LIC', 'DON', 'DONA', 'DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y'].includes(w.toUpperCase()));
    
    const isFamily = /familia|fam\b|flia\b/i.test(gName);
    let apellidoCode = 'INVITADO';
    if (cleanTokens.length > 0) {
      if (isFamily) {
        apellidoCode = cleanTokens[0].toUpperCase().substring(0, 10);
      } else {
        apellidoCode = (cleanTokens.length > 1 ? cleanTokens[cleanTokens.length - 1] : cleanTokens[0]).toUpperCase().substring(0, 10);
      }
    }
    const passes = passesCount !== undefined ? passesCount : (guest.passes || 1);
    return `${mesaCode}-${apellidoCode}-${passes}P`;
  }

  checkInGuest(queryOrFolio, admittedPasses) {
    if (!queryOrFolio) return { success: false, error: 'Query o Folio requerido' };
    const q = String(queryOrFolio).trim().toLowerCase();
    if (!q) return { success: false, error: 'Query o Folio requerido' };
    
    // Find by ID, exact stored Folio, or generated Folio match
    let guest = this.state.guests.find(g => {
      if (g.id && g.id.toLowerCase() === q) return true;
      if (g.folio && (g.folio.toLowerCase() === q || g.folio.toLowerCase().replace(/-/g, '') === q.replace(/-/g, ''))) return true;
      const f = this.generateFolio(g).toLowerCase();
      if (f === q || f.replace(/-/g, '') === q.replace(/-/g, '')) return true;
      return false;
    });

    if (!guest) {
      // Fuzzy search by name or contact name only if query has meaningful alphanumeric content
      const cleanQ = q.replace(/[^a-z0-9]/g, '');
      if (cleanQ.length >= 2) {
        guest = this.state.guests.find(g => {
          const n = (g.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const c = (g.contactName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return (n && (n.includes(cleanQ) || cleanQ.includes(n))) || (c && (c.includes(cleanQ) || cleanQ.includes(c)));
        });
      }
    }

    if (!guest) {
      return { success: false, error: 'Invitado no encontrado con el folio o nombre proporcionado' };
    }

    const totalAllowed = guest.passes || 1;
    const finalAdmitted = admittedPasses !== undefined ? Math.min(totalAllowed, Math.max(1, parseInt(admittedPasses, 10))) : (guest.confirmedPasses || totalAllowed);

    guest.status = 'CHECKED_IN';
    guest.admittedPasses = finalAdmitted;
    guest.checkedInAt = new Date().toISOString();
    
    const folio = this.generateFolio(guest, finalAdmitted);
    guest.folio = folio;

    this.state.checkinLogs = this.state.checkinLogs || [];
    this.state.checkinLogs.unshift({
      timestamp: guest.checkedInAt,
      guestId: guest.id,
      guestName: guest.name,
      folio: folio,
      tableId: guest.tableId,
      admittedPasses: finalAdmitted,
      totalPasses: totalAllowed,
      isEmergency: !!guest.isEmergency
    });

    this.saveState();
    return {
      success: true,
      guest: guest,
      folio: folio,
      admittedPasses: finalAdmitted,
      totalPasses: totalAllowed
    };
  }

  createEmergencyGuest({ name, phone = '', passes = 2, tableId = 'tbl_1', autoCheckIn = true, notes = '' }) {
    if (!name || !name.trim()) return { success: false, error: 'El nombre es obligatorio' };
    
    name = sanitizeText(name, 100);
    phone = sanitizeText(phone, 20);
    notes = sanitizeText(notes, 500);

    const count = parseInt(passes, 10) || 2;
    const id = `g_emerg_${Date.now()}`;
    
    const newGuest = {
      id: id,
      name: name.trim(),
      contactName: name.trim(),
      familyKey: 'emergencia',
      passes: count,
      confirmedPasses: count,
      admittedPasses: autoCheckIn ? count : 0,
      phone: phone.trim(),
      email: '',
      role: 'emergency',
      roleLabel: 'Pase de Emergencia',
      vip: true,
      court: false,
      isEmergency: true,
      tableId: tableId,
      status: autoCheckIn ? 'CHECKED_IN' : 'EMERGENCY',
      diet: 'none',
      notes: notes || 'Generado express desde el celular',
      sentAt: new Date().toISOString(),
      respondedAt: new Date().toISOString(),
      checkedInAt: autoCheckIn ? new Date().toISOString() : null
    };

    const folio = this.generateFolio(newGuest, count);
    newGuest.folio = folio;

    this.state.guests.push(newGuest);

    if (autoCheckIn) {
      this.state.checkinLogs = this.state.checkinLogs || [];
      this.state.checkinLogs.unshift({
        timestamp: newGuest.checkedInAt,
        guestId: newGuest.id,
        guestName: newGuest.name,
        folio: folio,
        tableId: newGuest.tableId,
        admittedPasses: count,
        totalPasses: count,
        isEmergency: true
      });
    }

    this.saveState();
    return {
      success: true,
      guest: newGuest,
      folio: folio
    };
  }

  // ==========================================================================
  // IMPORTADOR MASIVO DE LISTAS DE EMPLEADOS / INVITADOS (EXCEL, CSV, TEXTO)
  // ==========================================================================
  getCsvTemplate() {
    return 'Nombre,Pases,Telefono,Email,Mesa,Dieta,Rol\n' +
      'Lic. Roberto Garza,2,+528112345678,roberto@empresa.com,Mesa Imperial,none,vip\n' +
      'Ing. Sofia Valdés,1,+525598765432,sofia@empresa.com,Mesa 02,Vegetariano,general\n' +
      'Dr. Fernando Ruiz,3,+528187654321,fernando@empresa.com,Mesa 02,Sin Gluten,general\n';
  }

  parseBulkText(rawText) {
    if (!rawText || typeof rawText !== 'string') return [];
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];

    const firstLine = lines[0];
    let delimiter = ',';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';
    else if (firstLine.includes('|')) delimiter = '|';

    const headerTokens = firstLine.split(delimiter).map(t => t.trim().toLowerCase());
    const hasHeader = headerTokens.some(t => ['nombre', 'name', 'empleado', 'invitado', 'pases', 'passes', 'telefono', 'phone', 'mesa', 'table', 'dieta', 'diet', 'email', 'correo', 'rol', 'role'].includes(t));

    const startIndex = hasHeader ? 1 : 0;
    const colMap = { name: 0, passes: -1, phone: -1, email: -1, table: -1, diet: -1, role: -1 };

    if (hasHeader) {
      headerTokens.forEach((tok, idx) => {
        if (['nombre', 'name', 'empleado', 'invitado', 'contacto'].includes(tok)) colMap.name = idx;
        else if (['pases', 'passes', 'lugares', 'cupo', 'pax'].includes(tok)) colMap.passes = idx;
        else if (['telefono', 'teléfono', 'phone', 'whatsapp', 'celular'].includes(tok)) colMap.phone = idx;
        else if (['email', 'correo'].includes(tok)) colMap.email = idx;
        else if (['mesa', 'table', 'area', 'departamento'].includes(tok)) colMap.table = idx;
        else if (['dieta', 'diet', 'menu', 'menú', 'alergia'].includes(tok)) colMap.diet = idx;
        else if (['rol', 'role', 'tipo', 'vip'].includes(tok)) colMap.role = idx;
      });
    }

    const results = [];
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      let parts;
      if (line.includes(delimiter)) {
        parts = line.split(delimiter).map(p => p.trim());
      } else {
        parts = [line];
      }

      let name = '';
      let passes = 1;
      let phone = '';
      let email = '';
      let table = '';
      let diet = 'none';
      let role = 'general';

      if (hasHeader) {
        name = parts[colMap.name] || parts[0] || '';
        if (colMap.passes >= 0 && parts[colMap.passes]) passes = parseInt(parts[colMap.passes], 10) || 1;
        if (colMap.phone >= 0 && parts[colMap.phone]) phone = parts[colMap.phone];
        if (colMap.email >= 0 && parts[colMap.email]) email = parts[colMap.email];
        if (colMap.table >= 0 && parts[colMap.table]) table = parts[colMap.table];
        if (colMap.diet >= 0 && parts[colMap.diet]) diet = parts[colMap.diet];
        if (colMap.role >= 0 && parts[colMap.role]) role = parts[colMap.role];
      } else {
        name = parts[0] || '';
        if (parts.length > 1) {
          const p1 = parts[1];
          if (/^\d+$/.test(p1)) {
            passes = parseInt(p1, 10) || 1;
          } else if (/^\+?\d[\d\s-]{6,}$/.test(p1)) {
            phone = p1;
          } else {
            table = p1;
          }
        }
        if (parts.length > 2) {
          const p2 = parts[2];
          if (/^\+?\d[\d\s-]{6,}$/.test(p2)) phone = p2;
          else if (/^\d+$/.test(p2)) passes = parseInt(p2, 10) || 1;
          else table = p2;
        }
        if (parts.length > 3) {
          const p3 = parts[3];
          if (!table) table = p3;
          else if (!diet || diet === 'none') diet = p3;
        }
      }

      if (name.length > 0) {
        results.push({
          name,
          passes: Math.max(1, passes),
          phone: phone || '',
          email: email || '',
          table: table || '',
          diet: diet || 'none',
          isVip: /vip|directivo|corte|honor/i.test(role)
        });
      }
    }

    return results;
  }

  importBulkGuests(rawText, options = { mode: 'append' }) {
    const parsed = this.parseBulkText(rawText);
    if (parsed.length === 0) {
      return { success: false, error: 'No se encontraron registros válidos para importar', importedCount: 0 };
    }

    if (options && options.mode === 'replace') {
      this.state.guests = [];
    }

    let count = 0;
    parsed.forEach(item => {
      let tableId = null;
      if (item.table) {
        const foundTable = this.state.tables.find(t => 
          t.id.toLowerCase() === item.table.toLowerCase() || 
          t.name.toLowerCase().includes(item.table.toLowerCase())
        );
        if (foundTable) tableId = foundTable.id;
      }

      const newId = 'g_' + (this.state.guests.length + 1) + '_' + Math.random().toString(36).substring(2, 6);
      const guestObj = {
        id: newId,
        name: item.name,
        contactName: item.name,
        familyKey: item.name.toLowerCase().startsWith('familia') ? item.name.toLowerCase() : '',
        passes: item.passes,
        pases: item.passes,
        confirmedPasses: 0,
        admittedPasses: 0,
        phone: item.phone,
        email: item.email,
        tableId: tableId,
        status: 'DRAFT',
        diet: item.diet,
        vip: item.isVip,
        isVip: item.isVip,
        court: item.isVip,
        isCourt: item.isVip,
        notes: ''
      };

      guestObj.folio = this.generateFolio(guestObj);
      this.state.guests.push(guestObj);
      count++;
    });

    this.saveState();
    return {
      success: true,
      importedCount: count,
      totalGuests: this.state.guests.length
    };
  }

  getAccessMetrics() {
    const totalGuests = this.state.guests.length;
    const totalPasses = this.state.guests.reduce((sum, g) => sum + (g.passes || 1), 0);

    // 🟢 Verde: Ingresados al Salón
    const inSalonGuests = this.state.guests.filter(g => g.status === 'CHECKED_IN');
    const inSalonPasses = inSalonGuests.reduce((sum, g) => sum + (g.admittedPasses || g.confirmedPasses || g.passes || 1), 0);

    // 🟡 Amarillo: Confirmados pero en camino
    const inTransitGuests = this.state.guests.filter(g => g.status === 'CONFIRMED');
    const inTransitPasses = inTransitGuests.reduce((sum, g) => sum + (g.confirmedPasses || g.passes || 1), 0);

    // 🔴 Rojo: Pendientes / Declinados
    const pendingGuests = this.state.guests.filter(g => g.status === 'SENT' || g.status === 'DRAFT' || g.status === 'DECLINED' || !g.status);
    const pendingPasses = pendingGuests.reduce((sum, g) => sum + (g.passes || 1), 0);

    // 🔵 Azul: Emergencias / VIP Express
    const emergencyGuests = this.state.guests.filter(g => g.isEmergency || g.status === 'EMERGENCY');
    const emergencyPasses = emergencyGuests.reduce((sum, g) => sum + (g.passes || 1), 0);

    return {
      totalGuests,
      totalPasses,
      inSalon: { count: inSalonGuests.length, passes: inSalonPasses },
      inTransit: { count: inTransitGuests.length, passes: inTransitPasses },
      pending: { count: pendingGuests.length, passes: pendingPasses },
      emergency: { count: emergencyGuests.length, passes: emergencyPasses },
      occupancyRate: totalPasses > 0 ? ((inSalonPasses / totalPasses) * 100).toFixed(1) : '0.0'
    };
  }

  // ==========================================================================
  // GESTIÓN DE ROLES Y SEGURIDAD (ADMIN VS ORGANIZADOR VS HOSTESS VS CATERING)
  // ==========================================================================

  getMasterPin() {
    return (this.state && this.state.config && this.state.config.masterPin) || '2027';
  }

  setMasterPin(pin) {
    if (!pin || String(pin).trim().length < 4) return false;
    this.state.config = this.state.config || {};
    this.state.config.masterPin = String(pin).trim();
    this.saveState();
    return true;
  }

  generateRandomMasterPin(digits = 4) {
    const min = Math.pow(10, digits - 1);
    const max = Math.pow(10, digits) - 1;
    const randomPin = Math.floor(min + Math.random() * (max - min + 1)).toString();
    this.setMasterPin(randomPin);
    return randomPin;
  }

  verifyMasterPin(inputPin) {
    if (!inputPin) return false;
    return String(inputPin).trim() === this.getMasterPin();
  }

  getCurrentRole(explicitRole = null) {
    if (explicitRole) return explicitRole.toLowerCase();
    
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const r = params.get('role');
      if (r) return r.toLowerCase();
    }

    if (typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem('invitta_active_role');
      if (stored) return stored.toLowerCase();
    }

    return 'admin'; // Por defecto: Novios / Master Admin
  }

  setActiveRole(role) {
    const validRoles = ['admin', 'designer', 'planner', 'hostess', 'catering'];
    const targetRole = validRoles.includes(role) ? role : 'admin';
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('invitta_active_role', targetRole);
    }
    return targetRole;
  }

  canPerformAction(action, role = null) {
    const activeRole = role || this.getCurrentRole();
    
    const permissions = {
      // Exclusivo Novios / Admin Master
      reset_database: ['admin'],
      modify_event_settings: ['admin'],
      view_master_financials: ['admin'],

      // Creativo: Novios y Diseñador Gráfico de Invitaciones
      edit_invitation_design: ['admin', 'designer'],
      export_invitation_html: ['admin', 'designer'],

      // Operativo Permitido para Organizador / Wedding Planner (Solo Organización, Cronograma y Catering)
      manage_tables: ['admin', 'planner'],
      edit_guest_assignment: ['admin', 'planner'],
      view_timeline: ['admin', 'planner', 'hostess', 'catering'],
      view_catering: ['admin', 'planner', 'catering'],
      
      // Exclusivo Novios
      dispatch_whatsapp: ['admin'],
      view_guest_phones: ['admin'],
      scan_access_qr: ['admin', 'hostess'],
      create_emergency_pass: ['admin', 'hostess'],
      view_access_metrics: ['admin', 'hostess']
    };

    const allowed = permissions[action] || [];
    return allowed.includes(activeRole);
  }

  getDelegationLinks(customBaseUrl = null) {
    let base = customBaseUrl || '';
    if (!base && typeof window !== 'undefined' && window.location) {
      const href = window.location.href.split('#')[0].split('?')[0];
      base = href.substring(0, href.lastIndexOf('/') + 1);
    }

    return {
      designer: {
        role: 'designer',
        title: 'Diseñador de Invitación',
        badge: '🎨 Creativo / Diseño',
        url: `${base}invitacion-estudio.html?role=designer`,
        description: 'Acceso exclusivo al Estudio de Invitación para personalizar fotos, música, historia, tipografías y temas (sin acceso al plano de mesas ni teléfonos).'
      },
      planner: {
        role: 'planner',
        title: 'Organizador / Wedding Planner',
        badge: '📋 Acceso Operativo',
        url: `${base}portal.html?role=planner`,
        description: 'Acceso táctico al plano de mesas, cronograma, semáforo de acceso y catering (sin edición de invitación ni borrado destructivo).'
      },
      hostess: {
        role: 'hostess',
        title: 'Hostess / Recepción en Puerta',
        badge: '🚪 Acceso Puerta',
        url: `${base}scanner-acceso.html`,
        description: 'Escáner QR offline de pases en tiempo real, búsqueda de mesa y registro de ingresos.'
      },
      emergency: {
        role: 'hostess',
        title: 'Pase Express de Emergencia',
        badge: '⚡ Móvil Express',
        url: `${base}generador-emergencia.html`,
        description: 'Emisión de invitaciones de último minuto desde el celular con auto check-in.'
      },
      catering: {
        role: 'catering',
        title: 'Catering / Banquete Táctico',
        badge: '🍽️ Servicio & Cocina',
        url: `${base}catering-module/catering-tactical-sheet.html`,
        description: 'Tabla táctica con desglose de platillos, dietas especiales y alergias por mesa.'
      },
      invitation: {
        role: 'guest',
        title: 'Invitación Digital de Gala',
        badge: '💍 Invitados',
        url: `${base}invitacion.html`,
        description: 'Enlace web general para que los invitados disfruten la experiencia completa.'
      }
    };
  }

  exportDataJson() {
    return JSON.stringify(this.state, null, 2);
  }

  importDataJson(jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && Array.isArray(parsed.guests) && Array.isArray(parsed.tables)) {
        this.state = {
          config: parsed.config || this.getInitialState().config,
          tables: parsed.tables,
          guests: parsed.guests,
          checkinLogs: Array.isArray(parsed.checkinLogs) ? parsed.checkinLogs : []
        };
        this.saveState();
        return true;
      }
    } catch (e) {
      console.error('JSON import error', e);
    }
    return false;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GuestManager;
} else if (typeof window !== 'undefined') {
  window.GuestManager = GuestManager;
}
