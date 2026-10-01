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
      this.memorySession = null;
      this.sessionStatus = 'checking';
      this.sessionGeneration = 0;
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

      const generation = ++this.sessionGeneration;
      if (this.loginController) this.loginController.abort();
      const controller = new AbortController();
      this.loginController = controller;
      try {
        const response = await fetch('/api/auth', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (generation !== this.sessionGeneration) {
          return { success: false, error: 'Esta solicitud de acceso fue cancelada.' };
        }

        if (response.ok && data.success) {
          this.saveSession(data.session);
          return data;
        } else {
          return { success: false, error: data.error || 'Error de autenticación' };
        }
      } catch (err) {
        if (controller.signal.aborted) return { success: false, error: 'Esta solicitud de acceso fue cancelada.' };
        console.error('Login error:', err);
        return { success: false, error: 'Error de conexión con el servidor.' };
      } finally {
        if (this.loginController === controller) this.loginController = null;
      }
    }


    /**
     * Autentica Anfitrión (Novios / XV) mediante Código de Evento + PIN Secreto de 4 Dígitos
     */
    async loginHostByPin(eventCode, pin) {
      if (!eventCode || !eventCode.trim()) {
        return { success: false, error: 'Ingresa el código de tu evento.' };
      }
      if (!pin || !pin.trim()) {
        return { success: false, error: 'Ingresa tu PIN de 4 dígitos.' };
      }

      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventCode: eventCode.trim(), pin: pin.trim() })
        });

        const data = await response.json();

        if (response.ok) {
          return { success: true, eventCode: eventCode.trim() };
        } else {
          return { success: false, error: data.error || 'Código o PIN incorrecto' };
        }
      } catch (err) {
        console.error('Login error:', err);
        return { success: false, error: 'Error de conexión con el servidor.' };
      }
    }

    saveSession(session) {
      this.sessionGeneration += 1;
      this.memorySession = session;
      this.sessionStatus = session ? 'authenticated' : 'anonymous';
      if (typeof sessionStorage !== 'undefined') {
        try { sessionStorage.removeItem(this.sessionKey); } catch (err) {}
      }
      if (typeof localStorage !== 'undefined') {
        try { localStorage.removeItem(this.sessionKey); } catch (err) {}
      }
    }

    getCurrentSession() {
      return this.memorySession || null;
    }

    getSessionStatus() {
      return this.sessionStatus;
    }

    async refreshSession() {
      if (this.pendingSessionCheck) return this.pendingSessionCheck;
      const generation = this.sessionGeneration;
      this.memorySession = null;
      this.sessionStatus = 'checking';
      const check = (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          const response = await fetch('/api/session', {
            method: 'GET', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
          });
          const data = response.status === 401 || response.status === 403 ? null : await response.json();
          if (generation !== this.sessionGeneration) return this.getCurrentSession();
          if (response.status === 401 || response.status === 403 || (response.ok && data?.authenticated === false)) {
            this.sessionStatus = 'anonymous';
          } else if (response.ok && data?.authenticated === true &&
              typeof data.session?.role === 'string' && typeof data.session?.email === 'string') {
            this.memorySession = data.session;
            this.sessionStatus = 'authenticated';
          } else {
            this.sessionStatus = 'unavailable';
          }
        } catch (err) {
          if (generation === this.sessionGeneration) this.sessionStatus = 'unavailable';
        } finally {
          clearTimeout(timeout);
        }
        return this.getCurrentSession();
      })();
      this.pendingSessionCheck = check;
      try { return await check; } finally {
        if (this.pendingSessionCheck === check) this.pendingSessionCheck = null;
      }
    }

    isSuperadmin() {
      const s = this.getCurrentSession();
      return Boolean(s && s.role === 'platform_admin');
    }

    async logout() {
      this.sessionGeneration += 1;
      if (this.loginController) this.loginController.abort();
      this.memorySession = null;
      this.sessionStatus = 'anonymous';
      if (typeof sessionStorage !== 'undefined') {
        try { sessionStorage.removeItem(this.sessionKey); } catch (err) {}
      }
      if (typeof localStorage !== 'undefined') {
        try { localStorage.removeItem(this.sessionKey); } catch (err) {}
      }
      try { await fetch('/api/logout', { method: 'POST' }); } catch (err) {}
    }
  }

  return {
    DEFAULT_SUPERADMIN,
    DEFAULT_PLANNERS,
    AuthManager,
    create: (options) => new AuthManager(options)
  };
}));
