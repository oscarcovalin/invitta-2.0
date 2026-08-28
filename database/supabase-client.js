/**
 * ============================================================================
 * INVITTA 2.0 BETA — SUPABASE CLOUD ADAPTER & REALTIME DATA SYNC
 * Conexión Nube con Aislamiento Multi-Tenant & Fallback Local (ProjectsVault)
 * ============================================================================
 */

const SupabaseAdapter = {
  CLIENT_CONFIG_KEY: 'invitta_supabase_config',

  // Configuración de Conexión
  getConfig() {
    try {
      const stored = localStorage.getItem(this.CLIENT_CONFIG_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}

    return {
      url: window.INVITTA_SUPABASE_URL || '',
      anonKey: window.INVITTA_SUPABASE_KEY || '',
      isCloudActive: false
    };
  },

  setConfig(url, anonKey) {
    const config = {
      url: (url || '').trim(),
      anonKey: (anonKey || '').trim(),
      isCloudActive: Boolean(url && anonKey)
    };
    localStorage.setItem(this.CLIENT_CONFIG_KEY, JSON.stringify(config));
    return config;
  },

  // Headers de petición a Supabase REST API
  getHeaders() {
    const config = this.getConfig();
    return {
      'Content-Type': 'application/json',
      'apikey': config.anonKey,
      'Authorization': `Bearer ${config.anonKey}`,
      'Prefer': 'return=representation'
    };
  },

  // ==========================================
  // MÉTODOS DE EVENTOS & CONFIGURACIONES
  // ==========================================

  // Obtener eventos de la cuenta
  async getEvents() {
    const config = this.getConfig();
    if (!config.isCloudActive) {
      // Modo Local Fallback
      return typeof ProjectsVault !== 'undefined' ? ProjectsVault.getAll() : [];
    }

    try {
      const res = await fetch(`${config.url}/rest/v1/events?select=*,invitation_configs(*)&order=created_at.desc`, {
        headers: this.getHeaders()
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.map(ev => ({
        id: ev.id,
        title: ev.title,
        eventType: ev.event_type,
        date: ev.event_date ? ev.event_date.split('T')[0] : '',
        venue: ev.venue,
        city: ev.city,
        theme: ev.theme,
        status: ev.status,
        config: (ev.invitation_configs && ev.invitation_configs[0]) ? ev.invitation_configs[0].config_json : {}
      }));
    } catch (e) {
      console.warn('Error fetching events from Supabase Cloud, falling back to local:', e);
      return typeof ProjectsVault !== 'undefined' ? ProjectsVault.getAll() : [];
    }
  },

  // Guardar / Sincronizar evento y su configuración en la Nube
  async saveEvent(eventData) {
    const config = this.getConfig();
    if (!config.isCloudActive) {
      // Guardado Local
      return typeof ProjectsVault !== 'undefined' ? ProjectsVault.save(eventData) : eventData;
    }

    try {
      // 1. Upsert en tabla events
      const eventPayload = {
        title: eventData.title,
        event_type: eventData.eventType || 'boda',
        event_date: eventData.date ? `${eventData.date}T16:00:00Z` : null,
        venue: eventData.venue || '',
        city: eventData.city || '',
        theme: eventData.theme || 'vino',
        status: eventData.status || 'active'
      };

      let eventId = eventData.id;
      if (eventId && !eventId.startsWith('proj_')) {
        eventPayload.id = eventId;
      }

      const resEvent = await fetch(`${config.url}/rest/v1/events`, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(eventPayload)
      });
      const savedEvents = await resEvent.json();
      const savedEvent = Array.isArray(savedEvents) ? savedEvents[0] : savedEvents;
      if (savedEvent && savedEvent.id) eventId = savedEvent.id;

      // 2. Upsert en tabla invitation_configs
      if (eventData.config && eventId) {
        await fetch(`${config.url}/rest/v1/invitation_configs`, {
          method: 'POST',
          headers: { ...this.getHeaders(), 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify({
            event_id: eventId,
            config_json: eventData.config
          })
        });
      }

      // Sincronizar también en copia local
      if (typeof ProjectsVault !== 'undefined') {
        ProjectsVault.save({ ...eventData, id: eventId });
      }

      return { ...eventData, id: eventId };
    } catch (e) {
      console.error('Error saving event to Supabase:', e);
      return typeof ProjectsVault !== 'undefined' ? ProjectsVault.save(eventData) : eventData;
    }
  },

  // ==========================================
  // MÉTODOS DE INVITADOS & RSVP EN TIEMPO REAL
  // ==========================================

  // Obtener invitados de un evento
  async getGuests(eventId) {
    const config = this.getConfig();
    if (!config.isCloudActive || !eventId) {
      return typeof GuestManager !== 'undefined' ? GuestManager.getAllGuests() : [];
    }

    try {
      const res = await fetch(`${config.url}/rest/v1/guests?event_id=eq.${eventId}&select=*&order=full_name.asc`, {
        headers: this.getHeaders()
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn('Error fetching guests from Supabase:', e);
      return typeof GuestManager !== 'undefined' ? GuestManager.getAllGuests() : [];
    }
  },

  // Confirmar RSVP desde la Invitación Digital
  async updateGuestRSVP(eventId, guestName, status = 'confirmed', plusOnes = 0, dietary = '') {
    const config = this.getConfig();
    if (!config.isCloudActive) return true;

    try {
      await fetch(`${config.url}/rest/v1/guests`, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({
          event_id: eventId,
          full_name: guestName,
          rsvp_status: status,
          plus_ones: plusOnes,
          dietary_notes: dietary,
          updated_at: new Date().toISOString()
        })
      });
      return true;
    } catch (e) {
      console.error('Error updating guest RSVP in Supabase:', e);
      return false;
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SupabaseAdapter;
}
