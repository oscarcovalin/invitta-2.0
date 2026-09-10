/**
 * ============================================================================
 * RoleManager — Sistema de Control de Acceso RBAC & Magic Links (Invitta 2.0)
 * Haute-Couture Security & Commercial Licensing Engine
 * ============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RoleManager = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  const ROLES = {
    PLANNER: 'planner',           // Acceso Total (Salón / Wedding Planner)
    HOST_PREMIUM: 'host_premium', // Anfitrión Premium (Mesas + Excel + WhatsApp)
    HOST_BASIC: 'host_basic',     // Anfitrión Esencial (Solo RSVP + WhatsApp)
    DESIGNER: 'designer',         // Diseñador Creativo (Estudio Visual Aislado)
    HOSTESS: 'hostess'            // Staff de Puerta (Escáner QR + Pases Express)
  };

  const PERMISSIONS = {
    // Mesas y distribución
    tables_management: [ROLES.PLANNER, ROLES.HOST_PREMIUM],
    bulk_import_excel: [ROLES.PLANNER, ROLES.HOST_PREMIUM],
    floor_plan_2d: [ROLES.PLANNER, ROLES.HOST_PREMIUM],
    auto_distribute: [ROLES.PLANNER, ROLES.HOST_PREMIUM],
    
    // Captura y contactos
    guest_capture: [ROLES.PLANNER, ROLES.HOST_PREMIUM],
    whatsapp_dispatch: [ROLES.PLANNER, ROLES.HOST_PREMIUM, ROLES.HOST_BASIC],
    rsvp_monitoring: [ROLES.PLANNER, ROLES.HOST_PREMIUM, ROLES.HOST_BASIC],
    
    // Catering y Cocina
    waiter_sheet_report: [ROLES.PLANNER, ROLES.HOST_PREMIUM],
    catering_tactical: [ROLES.PLANNER, ROLES.HOST_PREMIUM],
    
    // Puerta y Pases
    door_scanner: [ROLES.PLANNER, ROLES.HOSTESS],
    emergency_pass: [ROLES.PLANNER, ROLES.HOST_PREMIUM, ROLES.HOST_BASIC, ROLES.HOSTESS],

    // Estudio de Diseño Visual
    invitation_studio: [ROLES.PLANNER, ROLES.DESIGNER],

    // Administración Crítica y Seguridad
    master_pin_config: [ROLES.PLANNER],
    database_reset: [ROLES.PLANNER],
    share_access_hub: [ROLES.PLANNER, ROLES.HOST_PREMIUM]
  };

  const ROLE_DETAILS = {
    [ROLES.PLANNER]: {
      name: 'Salón & Planner Master',
      badgeClass: 'bg-amber-500/20 text-amber-900 border border-amber-400/40',
      icon: '👑',
      tagline: 'Control Total y Configuración de Evento'
    },
    [ROLES.HOST_PREMIUM]: {
      name: 'Anfitrión Premium',
      badgeClass: 'bg-emerald-500/20 text-emerald-900 border border-emerald-400/40',
      icon: '💎',
      tagline: 'Organizador de Mesas & Envíos WhatsApp'
    },
    [ROLES.HOST_BASIC]: {
      name: 'Anfitrión Esencial',
      badgeClass: 'bg-blue-500/20 text-blue-900 border border-blue-400/40',
      icon: '💌',
      tagline: 'Monitor de Confirmaciones RSVP'
    },
    [ROLES.DESIGNER]: {
      name: 'Diseñador Creativo',
      badgeClass: 'bg-purple-500/20 text-purple-900 border border-purple-400/40',
      icon: '🎨',
      tagline: 'Maquetación y Estética Visual'
    },
    [ROLES.HOSTESS]: {
      name: 'Hostess de Puerta',
      badgeClass: 'bg-rose-500/20 text-rose-900 border border-rose-400/40',
      icon: '🚪',
      tagline: 'Acceso en Puerta y Escáner QR'
    }
  };

  class RoleManager {
    constructor(options = {}) {
      this.ROLES = ROLES;
      this.PERMISSIONS = PERMISSIONS;
      this.storageKey = options.storageKey || 'invitta_active_role_v2';
      this.currentRole = this.resolveCurrentRole(options.defaultRole || ROLES.PLANNER);
    }

    resolveCurrentRole(defaultRole = ROLES.PLANNER) {
      if (typeof window !== 'undefined' && window.location) {
        try {
          const params = new URLSearchParams(window.location.search);
          const roleFromUrl = params.get('role');
          if (roleFromUrl && Object.values(ROLES).includes(roleFromUrl)) {
            this.setPersistedRole(roleFromUrl);
            return roleFromUrl;
          }
        } catch (err) {}
      }

      if (typeof localStorage !== 'undefined') {
        try {
          const saved = localStorage.getItem(this.storageKey);
          if (saved && Object.values(ROLES).includes(saved)) {
            return saved;
          }
        } catch (err) {}
      }

      return defaultRole;
    }

    setPersistedRole(role) {
      if (Object.values(ROLES).includes(role)) {
        this.currentRole = role;
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(this.storageKey, role);
          } catch (err) {}
        }
      }
    }

    hasPermission(permissionKey, role = this.currentRole) {
      const allowedRoles = PERMISSIONS[permissionKey];
      if (!allowedRoles) return false;
      return allowedRoles.includes(role);
    }

    getRoleDetails(role = this.currentRole) {
      return ROLE_DETAILS[role] || ROLE_DETAILS[ROLES.PLANNER];
    }

    generateMagicLink(role, targetPath = 'mesas', baseUrl = '') {
      const origin = baseUrl || (typeof window !== 'undefined' && window.location ? window.location.origin : '');
      const path = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
      return `${origin}${path}?role=${role}`;
    }

    generateWhatsAppShareUrl(role, phone = '', eventTitle = 'Nuestra Celebración', targetPath = 'mesas') {
      const link = this.generateMagicLink(role, targetPath);
      const roleName = ROLE_DETAILS[role]?.name || 'Acceso';
      const text = encodeURIComponent(`✨ *Acceso a ${eventTitle} — Invitta 2.0*\n\nHola, aquí tienes tu enlace con perfil de *${roleName}*:\n🔗 ${link}\n\n_Acceso directo sin contraseña requerida._`);
      const phoneDigits = (phone || '').replace(/[^0-9]/g, '');
      return phoneDigits ? `https://wa.me/${phoneDigits}?text=${text}` : `https://wa.me/?text=${text}`;
    }

    applyRoleToDOM(doc = (typeof document !== 'undefined' ? document : null)) {
      if (!doc) return;

      const role = this.currentRole;
      const details = this.getRoleDetails(role);

      // 1. Actualizar Badge de Rol Activo
      const roleBadge = doc.getElementById('activeRoleBadge');
      if (roleBadge) {
        roleBadge.className = `px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-xs ${details.badgeClass}`;
        roleBadge.innerHTML = `<span>${details.icon}</span><span>${details.name}</span>`;
      }

      // 2. Elementos restringidos por atributo data-requires-permission
      const permissionNodes = doc.querySelectorAll('[data-requires-permission]');
      permissionNodes.forEach(node => {
        const required = node.getAttribute('data-requires-permission');
        if (required && !this.hasPermission(required, role)) {
          node.style.display = 'none';
          node.classList.add('hidden');
        } else {
          node.style.display = '';
          node.classList.remove('hidden');
        }
      });

      // 3. Reglas Específicas por Rol:
      const privateSection = doc.getElementById('sidebarPrivateBrideLinks');
      if (privateSection) {
        privateSection.style.display = (role === ROLES.PLANNER) ? 'block' : 'none';
      }

      const resetBtn = doc.getElementById('btnResetAllTables');
      if (resetBtn) {
        resetBtn.style.display = (role === ROLES.PLANNER) ? '' : 'none';
      }

      const masterPinBox = doc.getElementById('masterPinSettingBox');
      if (masterPinBox) {
        masterPinBox.style.display = (role === ROLES.PLANNER) ? '' : 'none';
      }
    }
  }

  return {
    ROLES,
    PERMISSIONS,
    ROLE_DETAILS,
    RoleManager,
    create: (options) => new RoleManager(options)
  };
}));