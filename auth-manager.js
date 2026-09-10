/**
 * ============================================================================
 * AuthManager — Sistema de Autenticación & Control de Acceso (Invitta 2.0)
 * Hybrid Security Architecture: Superadmin Gate, B2B Planners & Host PIN Engine
 * ============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./event-vault-manager.js'));
  } else {
    root.AuthManager = factory(root.EventVaultManager);
  }
}(typeof self !== 'undefined' ? self : this, function (EventVaultModule) {

  const SESSION_KEY = 'invitta_auth_session_v2';
  const B2B_ACCOUNTS_KEY = 'invitta_b2b_accounts_v2';

  // Cuentas B2B y Superadmin por defecto (Solo metadata, validación movida al backend)
  const DEFAULT_SUPERADMIN = {
    username: 'admin@invitta.mx',
    aliases: ['admin', 'oscar', 'superadmin'],
    role: 'superadmin',
    name: 'Administrador General'
  };

  const DEFAULT_PLANNERS = [
    {
      id: 'pl_hacienda_01',
      username: 'planner@hacienda.com',
      aliases: ['hacienda', 'planner_hacienda'],
      role: 'planner',
      name: 'Coordinación Hacienda San José',
      assignedEvents: ['boda-catalina-julian']
    },
    {
      id: 'pl_diamante_02',
      username: 'eventos@diamantereal.com',
      aliases: ['diamante', 'planner_diamante'],
      role: 'planner',
      name: 'Eventos Salón Diamante Real',
      assignedEvents: ['xv-valentina-2027']
    }
  ];

  class AuthManager {
    constructor(options = {}) {
      this.sessionKey = options.sessionKey || SESSION_KEY;
      this.b2bKey = options.b2bKey || B2B_ACCOUNTS_KEY;
      this.evm = options.evm || (EventVaultModule && EventVaultModule.create ? EventVaultModule.create() : null);
      this.planners = this.loadPlannerAccounts();
    }

    loadPlannerAccounts() {
      if (typeof localStorage !== 'undefined') {
        try {
          const saved = localStorage.getItem(this.b2bKey);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          }
        } catch (err) {}
      }
      return JSON.parse(JSON.stringify(DEFAULT_PLANNERS));
    }

    savePlannerAccounts() {
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(this.b2bKey, JSON.stringify(this.planners));
        } catch (err) {}
      }
    }

    /**
     * Autentica Superadmin o Planner profesional (Secure Backend Version)
     */
    async loginProfessional(username, password) {
      if (!username || !password) {
        return { success: false, error: 'Ingresa tu usuario y contraseña' };
      }

      try {
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          this.saveSession(data.session);
          return data;
        } else {
          return { success: false, error: data.error || 'Error de autenticación' };
        }
      } catch (err) {
        console.error('Login error:', err);
        return { success: false, error: 'Error de conexión con el servidor.' };
      }
    }


    /**
     * Autentica Anfitrión (Novios / XV) mediante Código de Evento + PIN Secreto de 4 Dígitos
     */
    loginHostByPin(eventCode, pin) {
      if (!eventCode || !eventCode.trim()) {
        return { success: false, error: 'Ingresa el código de tu evento.' };
      }
      if (!pin || !pin.trim()) {
        return { success: false, error: 'Ingresa tu PIN de 4 dígitos.' };
      }

      if (!this.evm) {
        return { success: false, error: 'Motor de eventos no inicializado.' };
      }

      const match = this.evm.findEventByCode(eventCode.trim());
      if (!match || !match.event) {
        return { success: false, error: 'Código de evento no encontrado. Verifica con tus organizadores.' };
      }

      const targetEvent = match.event;
      const expectedPin = String(targetEvent.pin || '4821').trim();
      const enteredPin = String(pin).trim();

      if (enteredPin !== expectedPin) {
        return { success: false, error: 'PIN incorrecto para este evento. Verifica tu PIN de 4 dígitos.' };
      }

      const session = {
        role: targetEvent.packageType || 'host_premium',
        eventSlug: targetEvent.slug,
        eventName: targetEvent.name,
        token: targetEvent.token,
        createdAt: new Date().toISOString()
      };
      this.saveSession(session);

      return {
        success: true,
        session,
        event: targetEvent,
        redirectUrl: `organizador-mesas.html?event=${targetEvent.slug}&role=${session.role}&token=${targetEvent.token}`
      };
    }

    saveSession(session) {
      this.memorySession = session;
      if (typeof sessionStorage !== 'undefined') {
        try {
          sessionStorage.setItem(this.sessionKey, JSON.stringify(session));
        } catch (err) {}
      }
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(this.sessionKey, JSON.stringify(session));
        } catch (err) {}
      }
    }

    getCurrentSession() {
      if (typeof sessionStorage !== 'undefined') {
        try {
          const s = sessionStorage.getItem(this.sessionKey);
          if (s) return JSON.parse(s);
        } catch (err) {}
      }
      if (typeof localStorage !== 'undefined') {
        try {
          const s = localStorage.getItem(this.sessionKey);
          if (s) return JSON.parse(s);
        } catch (err) {}
      }
      return this.memorySession || null;
    }

    isSuperadmin() {
      const s = this.getCurrentSession();
      return Boolean(s && s.role === 'superadmin');
    }

    logout() {
      this.memorySession = null;
      if (typeof sessionStorage !== 'undefined') {
        try { sessionStorage.removeItem(this.sessionKey); } catch (err) {}
      }
      if (typeof localStorage !== 'undefined') {
        try { localStorage.removeItem(this.sessionKey); } catch (err) {}
      }
    }
  }

  return {
    DEFAULT_SUPERADMIN,
    DEFAULT_PLANNERS,
    AuthManager,
    create: (options) => new AuthManager(options)
  };
}));
