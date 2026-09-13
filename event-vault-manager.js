/**
 * ============================================================================
 * EventVaultManager — Arquitectura Multi-Tenant & Bóveda de Eventos (Invitta 2.0)
 * Haute-Couture Event Isolation & Multi-Client Security Engine
 * ============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EventVaultManager = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  const VAULT_STORAGE_KEY = 'invitta_events_vault_v2';
  const ACTIVE_EVENT_KEY = 'invitta_active_event_slug_v2';

  // Plantillas base de demostración
  const DEFAULT_EVENTS = [
    {
      id: 'ev_cat_jul_2027',
      slug: 'boda-catalina-julian',
      name: 'Boda Catalina & Julián',
      type: 'boda',
      dateLabel: '20 de Marzo, 2027',
      dateISO: '2027-03-20T18:00',
      venue: 'Hacienda San José',
      capacity: 150,
      assignedPax: 138,
      packageType: 'host_premium',
      status: 'active',
      token: 'tok_cat_9823',
      pin: '4821',
      createdAt: '2026-08-15T10:00:00Z'
    },
    {
      id: 'ev_val_xv_2027',
      slug: 'xv-valentina-2027',
      name: 'Mis XV Años Valentina',
      type: 'xv',
      dateLabel: '18 de Julio, 2027',
      dateISO: '2027-07-18T19:00',
      venue: 'Salón Diamante Real',
      capacity: 200,
      assignedPax: 165,
      packageType: 'host_premium',
      status: 'active',
      token: 'tok_val_1042',
      pin: '7392',
      createdAt: '2026-08-20T12:00:00Z'
    }
  ];

  class EventVaultManager {
    constructor(options = {}) {
      this.storageKey = options.vaultKey || VAULT_STORAGE_KEY;
      this.activeKey = options.activeKey || ACTIVE_EVENT_KEY;
      this.events = this.loadEvents();
      this.activeEventSlug = this.resolveActiveEventSlug();
    }

    loadEvents() {
      if (typeof localStorage !== 'undefined') {
        try {
          const saved = localStorage.getItem(this.storageKey);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed;
            }
          }
        } catch (err) {}
      }
      return JSON.parse(JSON.stringify(DEFAULT_EVENTS));
    }

    saveEvents() {
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(this.events));
        } catch (err) {}
      }
    }

    generateSlug(name, year = '2027') {
      const clean = name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return clean.includes(year) ? clean : `${clean}-${year}`;
    }

    createEvent(payload) {
      const name = payload.name || 'Nuevo Evento';
      const year = payload.dateISO ? payload.dateISO.substring(0, 4) : '2027';
      let slug = payload.slug || this.generateSlug(name, year);

      // Asegurar slug único
      let count = 1;
      const baseSlug = slug;
      while (this.events.some(e => e.slug === slug)) {
        count++;
        slug = `${baseSlug}-${count}`;
      }

      const newEvent = {
        id: 'ev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36),
        slug: slug,
        name: name,
        type: payload.type || 'boda',
        dateLabel: payload.dateLabel || 'Próximamente',
        dateISO: payload.dateISO || '2027-01-01T18:00',
        venue: payload.venue || 'Salón Principal',
        capacity: parseInt(payload.capacity, 10) || 100,
        assignedPax: 0,
        packageType: payload.packageType || 'host_premium',
        status: 'active',
        token: 'tok_' + Math.random().toString(36).substring(2, 8),
        pin: payload.pin || String(Math.floor(1000 + Math.random() * 9000)),
        createdAt: new Date().toISOString()
      };

      this.events.unshift(newEvent);
      this.saveEvents();
      this.setActiveEventSlug(newEvent.slug);
      return newEvent;
    }

    deleteEvent(slug) {
      this.events = this.events.filter(e => e.slug !== slug);
      this.saveEvents();
      if (this.activeEventSlug === slug) {
        this.activeEventSlug = this.events.length > 0 ? this.events[0].slug : DEFAULT_EVENTS[0].slug;
        this.setActiveEventSlug(this.activeEventSlug);
      }
    }

    getAllEvents() {
      return this.events;
    }

    
    isSingleEventMode(searchStr) {
      if (typeof window !== 'undefined' && window.location) {
        const p = new URLSearchParams(searchStr || window.location.search);
        // Sólo la agencia maestra puede ver todos los eventos en el dropdown
        if (p.get('role') === 'superadmin' || p.get('role') === 'master_agency') {
          return false;
        }
        // Para cualquier otro rol (admin/host/planner), bloquear siempre al evento activo aislando el tenant
        return true;
      }
      return true;
    }

    getVisibleEvents(searchStr) {

      if (this.isSingleEventMode(searchStr)) {
        return [this.getActiveEvent()];
      }
      return this.getAllEvents();
    }

    getEventBySlug(slug) {
      return this.events.find(e => e.slug === slug) || this.events[0] || DEFAULT_EVENTS[0];
    }

    findEventByCode(inputCode) {
      if (!inputCode || typeof inputCode !== 'string') return null;
      let raw = inputCode.trim();

      // Si es una URL completa
      if (raw.includes('?') && raw.includes('event=')) {
        try {
          const urlObj = new URL(raw, 'https://invitta.local');
          const slug = urlObj.searchParams.get('event');
          const role = urlObj.searchParams.get('role') || 'host_premium';
          const token = urlObj.searchParams.get('token') || '';
          if (slug) {
            const ev = this.events.find(e => e.slug === slug);
            if (ev) return { event: ev, role, token, redirectUrl: `organizador-mesas.html?event=${ev.slug}&role=${role}&token=${token || ev.token}` };
          }
        } catch (err) {}
      }

      // Normalizar texto
      const clean = raw.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // 1. Coincidencia exacta con slug, token o ID
      let found = this.events.find(e => 
        (e.slug && e.slug.toLowerCase() === clean) || 
        (e.slug && e.slug.toLowerCase() === raw.toLowerCase()) || 
        (e.token && e.token.toLowerCase() === raw.toLowerCase()) ||
        (e.id && e.id.toLowerCase() === raw.toLowerCase())
      );
      if (found) {
        return { event: found, role: 'host_premium', token: found.token, redirectUrl: `organizador-mesas.html?event=${found.slug}&role=host_premium&token=${found.token}` };
      }

      // 2. Coincidencia con slug parcial
      found = this.events.find(e => {
        const s = e.slug.toLowerCase();
        const base = s.replace(/^(boda-|xv-)/, '').replace(/-\d{4}$/, '');
        return s.includes(clean) || clean.includes(base) || base.includes(clean);
      });
      if (found) {
        return { event: found, role: 'host_premium', token: found.token, redirectUrl: `organizador-mesas.html?event=${found.slug}&role=host_premium&token=${found.token}` };
      }

      // 3. Coincidencia con nombre
      found = this.events.find(e => {
        const nameClean = e.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return nameClean.includes(raw.toLowerCase()) || raw.toLowerCase().includes(nameClean);
      });
      if (found) {
        return { event: found, role: 'host_premium', token: found.token, redirectUrl: `organizador-mesas.html?event=${found.slug}&role=host_premium&token=${found.token}` };
      }

      return null;
    }

    resolveActiveEventSlug() {
      // 1. Prioridad: Parámetro URL ?event=slug
      if (typeof window !== 'undefined' && window.location) {
        try {
          const params = new URLSearchParams(window.location.search);
          const slugFromUrl = params.get('event');
          if (slugFromUrl) {
            this.setActiveEventSlug(slugFromUrl);
            return slugFromUrl;
          }
        } catch (err) {}
      }

      // 2. Persistencia en localStorage
      if (typeof localStorage !== 'undefined') {
        try {
          const saved = localStorage.getItem(this.activeKey);
          if (saved) return saved;
        } catch (err) {}
      }

      return this.events[0]?.slug || 'boda-catalina-julian';
    }

    setActiveEventSlug(slug) {
      this.activeEventSlug = slug;
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(this.activeKey, slug);
        } catch (err) {}
      }
    }

    getActiveEvent() {
      return this.getEventBySlug(this.activeEventSlug);
    }

    /**
     * Claves particionadas de almacenamiento por evento (Multi-Tenant)
     */
    getPartitionedStorageKey(baseKey, eventSlug = this.activeEventSlug) {
      return `${baseKey}_${eventSlug}`;
    }

    generateEventMagicLink(role, eventSlug = this.activeEventSlug, targetPath = 'mesas', baseUrl = '') {
      const origin = baseUrl || (typeof window !== 'undefined' && window.location ? window.location.origin : '');
      const path = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
      const ev = this.getEventBySlug(eventSlug);
      const token = ev ? ev.token : 'public';
      return `${origin}${path}?event=${eventSlug}&role=${role}&token=${token}`;
    }

    generateEventWhatsAppUrl(role, eventSlug = this.activeEventSlug, phone = '', targetPath = 'mesas') {
      const ev = this.getEventBySlug(eventSlug);
      const link = this.generateEventMagicLink(role, eventSlug, targetPath);
      const roleName = role === 'host_premium' ? 'Anfitrión Premium' :
                       role === 'host_basic' ? 'Anfitrión Esencial' :
                       role === 'designer' ? 'Diseñador Creativo' :
                       role === 'hostess' ? 'Hostess de Puerta' : 'Salón & Planner';
      const text = encodeURIComponent(`✨ *Acceso Privado a ${ev.name} — Invitta 2.0*\n\nHola, aquí tienes tu enlace exclusivo de acceso con perfil de *${roleName}*:\n🔗 ${link}\n\n_Tu espacio está listo y aislado para tu celebración._`);
      const phoneDigits = (phone || '').replace(/[^0-9]/g, '');
      return phoneDigits ? `https://wa.me/${phoneDigits}?text=${text}` : `https://wa.me/?text=${text}`;
    }
  }

  return {
    DEFAULT_EVENTS,
    EventVaultManager,
    create: (options) => new EventVaultManager(options)
  };
}));
