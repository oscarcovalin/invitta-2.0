/**
 * INVITTA 2.0 BETA — CLOUD GUEST ADAPTER (SUPABASE / POSTGRESQL)
 * Adaptador de producción que conecta el motor de eventos con backend en la nube
 */

const OfflineSyncCache = require('./offline-sync-cache.js');

class CloudGuestAdapter {
  constructor(config = {}) {
    this.supabaseUrl = config.supabaseUrl || process.env.SUPABASE_URL || '';
    this.supabaseKey = config.supabaseKey || process.env.SUPABASE_ANON_KEY || '';
    this.client = config.client || null; // Supabase client instance or mock
    this.offlineCache = new OfflineSyncCache();
    this.listeners = [];
  }

  // Cargar metadatos y estado del evento por slug
  async loadEvent(slug) {
    if (!this.client) {
      // Fallback a caché offline si no hay cliente activo
      return this.offlineCache.getCachedEventSnapshot(slug);
    }

    try {
      const { data, error } = await this.client
        .from('events')
        .select(`
          id, slug, title, event_type, hosts, event_date, venue, config,
          tables ( id, name, type, capacity, order_index ),
          guests ( id, table_id, name, contact_name, passes, confirmed_passes, admitted_passes, folio, status, phone, email, diet, notes, is_court, is_vip, is_emergency )
        `)
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      if (data) {
        this.offlineCache.cacheEventSnapshot(slug, data);
      }
      return data;
    } catch (err) {
      console.warn('Cloud fetch failed, attempting offline fallback cache:', err.message);
      return this.offlineCache.getCachedEventSnapshot(slug);
    }
  }

  // Registrar confirmación RSVP en la nube
  async recordRsvpResponse(guestId, { confirmed, confirmedPasses, diet, notes }) {
    if (!this.client) {
      // Encolar offline
      this.offlineCache.enqueue('RSVP', { guestId, confirmed, confirmedPasses, diet, notes });
      return { success: true, offlineQueued: true };
    }

    try {
      // Llamar al procedimiento almacenado atómico
      const { data, error } = await this.client.rpc('submit_guest_rsvp', {
        p_guest_id: guestId,
        p_confirmed: !!confirmed,
        p_confirmed_passes: confirmedPasses !== undefined ? parseInt(confirmedPasses, 10) : null,
        p_diet: diet || 'none',
        p_notes: notes || ''
      });

      if (error) throw error;
      this._notifyListeners('RSVP_UPDATED', data.guest);
      return data;
    } catch (err) {
      console.warn('Cloud RSVP failed, enqueuing for offline sync:', err.message);
      this.offlineCache.enqueue('RSVP', { guestId, confirmed, confirmedPasses, diet, notes });
      return { success: true, offlineQueued: true, error: err.message };
    }
  }

  // Check-In de acceso en puerta (Hostess)
  async checkInGuest(eventId, queryOrFolio, admittedPasses, scannedBy = 'Hostess Puerta Principal') {
    if (!this.client) {
      this.offlineCache.enqueue('CHECKIN', { eventId, queryOrFolio, admittedPasses, scannedBy });
      return { success: true, offlineQueued: true };
    }

    try {
      const { data, error } = await this.client.rpc('process_door_checkin', {
        p_event_id: eventId,
        p_query_or_folio: queryOrFolio,
        p_admitted_passes: admittedPasses !== undefined ? parseInt(admittedPasses, 10) : null,
        p_scanned_by: scannedBy
      });

      if (error) throw error;
      this._notifyListeners('CHECKIN_PROCESSED', data.guest);
      return data;
    } catch (err) {
      console.warn('Cloud checkin failed, enqueuing for offline sync:', err.message);
      this.offlineCache.enqueue('CHECKIN', { eventId, queryOrFolio, admittedPasses, scannedBy });
      return { success: true, offlineQueued: true, error: err.message };
    }
  }

  // Sincronizar cola de operaciones offline al recuperar conexión
  async syncOfflineQueue() {
    const pending = this.offlineCache.getPending();
    if (!pending || pending.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;

    for (const item of pending) {
      try {
        if (item.actionType === 'RSVP') {
          await this.recordRsvpResponse(item.payload.guestId, item.payload);
        } else if (item.actionType === 'CHECKIN') {
          await this.checkInGuest(item.payload.eventId, item.payload.queryOrFolio, item.payload.admittedPasses, item.payload.scannedBy);
        }
        this.offlineCache.markSynced(item.id);
        synced++;
      } catch (e) {
        failed++;
      }
    }

    return { synced, failed };
  }

  // Suscripción a eventos en tiempo real
  onUpdate(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  _notifyListeners(type, payload) {
    this.listeners.forEach(fn => {
      try { fn(type, payload); } catch (e) {}
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CloudGuestAdapter;
} else if (typeof window !== 'undefined') {
  window.CloudGuestAdapter = CloudGuestAdapter;
}
