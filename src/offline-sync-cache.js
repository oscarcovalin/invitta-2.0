/**
 * INVITTA 2.0 BETA — OFFLINE SYNC CACHE & RESILIENCE QUEUE
 * Cola de persistencia offline para escáner en puerta y confirmaciones sin conexión
 */

class OfflineSyncCache {
  constructor(storageKey = 'invitta_offline_sync_queue_v2') {
    this.storageKey = storageKey;
    this.cacheKey = 'invitta_offline_event_cache_v2';
  }

  getStorage() {
    if (typeof localStorage !== 'undefined') return localStorage;
    if (typeof global !== 'undefined' && global.localStorage) return global.localStorage;
    return null;
  }

  // Guardar snapshot del evento para consulta offline (Hostess / Puerta)
  cacheEventSnapshot(eventId, snapshot) {
    const storage = this.getStorage();
    if (!storage) return false;
    try {
      storage.setItem(`${this.cacheKey}_${eventId}`, JSON.stringify({
        timestamp: new Date().toISOString(),
        snapshot: snapshot
      }));
      return true;
    } catch (e) {
      console.warn('Error saving offline snapshot:', e);
      return false;
    }
  }

  // Obtener snapshot en caso de caída de WiFi
  getCachedEventSnapshot(eventId) {
    const storage = this.getStorage();
    if (!storage) return null;
    try {
      const data = storage.getItem(`${this.cacheKey}_${eventId}`);
      return data ? JSON.parse(data).snapshot : null;
    } catch (e) {
      return null;
    }
  }

  // Encolar una mutación realizada offline (Check-in o RSVP)
  enqueue(actionType, payload) {
    const storage = this.getStorage();
    if (!storage) return null;
    try {
      const queue = this.getPending();
      const item = {
        id: 'sync_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        actionType, // 'CHECKIN' | 'RSVP' | 'PHOTO_UPLOAD'
        payload,
        createdAt: new Date().toISOString(),
        retryCount: 0
      };
      queue.push(item);
      storage.setItem(this.storageKey, JSON.stringify(queue));
      return item;
    } catch (e) {
      console.error('Error enqueuing offline item:', e);
      return null;
    }
  }

  // Obtener lista de mutaciones pendientes de sincronizar
  getPending() {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const data = storage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  // Marcar elemento sincronizado exitosamente
  markSynced(id) {
    const storage = this.getStorage();
    if (!storage) return false;
    try {
      const queue = this.getPending().filter(item => item.id !== id);
      storage.setItem(this.storageKey, JSON.stringify(queue));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Vaciar cola
  clear() {
    const storage = this.getStorage();
    if (storage) {
      storage.removeItem(this.storageKey);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = OfflineSyncCache;
} else if (typeof window !== 'undefined') {
  window.OfflineSyncCache = OfflineSyncCache;
}
