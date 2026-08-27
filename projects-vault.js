/**
 * ============================================================================
 * INVITTA 2.0 BETA — PROJECTS VAULT & PRODUCTION MANAGER
 * Gestor de Almacenamiento, Importación, Exportación y Bóveda de Invitaciones
 * ============================================================================
 */

const ProjectsVault = {
  STORAGE_KEY: 'invitta_projects_vault',

  // Proyectos Iniciales de Demostración
  getDefaultProjects() {
    const defaultEngineConfig = typeof TemplateEngine !== 'undefined' ? TemplateEngine.defaultConfig : {};
    
    // 1. Proyecto Boda Muestra
    const weddingConfig = JSON.parse(JSON.stringify(defaultEngineConfig));
    weddingConfig.eventType = 'boda';
    weddingConfig.brideName = 'Catalina';
    weddingConfig.groomName = 'Julián';
    weddingConfig.nameConnector = '&';
    weddingConfig.monogram = 'C & J';
    weddingConfig.eyebrow = 'Nuestra Boda';
    weddingConfig.welcomeMessage = 'Con la bendición de Dios y nuestras familias, nos unimos en matrimonio.';
    weddingConfig.quote = '"El amor no se mira, se siente, y aún más cuando ella está junto a ti."';
    weddingConfig.footerClosing = 'Con amor,';
    weddingConfig.footerText = '#BodaCatayJulian';
    weddingConfig.eventDate = '2027-03-20T16:00:00';

    // 2. Proyecto XV Años Muestra
    const xvConfig = JSON.parse(JSON.stringify(defaultEngineConfig));
    xvConfig.eventType = 'xv';
    xvConfig.name = 'Valentina';
    xvConfig.monogram = 'V';
    xvConfig.eyebrow = 'Mis XV Años';
    xvConfig.welcomeMessage = 'Hay momentos en la vida que son inolvidables, y compartirlos con quienes más quiero los hace eternos.';
    xvConfig.quote = '"Hoy comienzo a escribir un nuevo capítulo lleno de ilusiones, sueños y gratitud."';
    xvConfig.footerClosing = 'Con cariño,';
    xvConfig.footerText = '#MisXVValentina';
    xvConfig.eventDate = '2026-10-15T18:00:00';

    return [
      {
        id: 'proj_boda_catalina_julian',
        title: 'Nuestra Boda · Catalina & Julián',
        hosts: 'Catalina & Julián',
        eventType: 'boda',
        date: '2027-03-20',
        venue: 'Cantabria Salón de Eventos',
        city: 'Chihuahua, Chih.',
        theme: 'vino',
        status: 'active', // active | delivered | draft
        createdAt: '2026-08-20T10:00:00.000Z',
        lastModified: new Date().toISOString(),
        config: weddingConfig
      },
      {
        id: 'proj_xv_valentina',
        title: 'Mis XV Años · Valentina',
        hosts: 'Valentina',
        eventType: 'xv',
        date: '2026-10-15',
        venue: 'Hacienda Los Laureles',
        city: 'Guadalajara, Jal.',
        theme: 'rosa',
        status: 'active',
        createdAt: '2026-08-22T14:30:00.000Z',
        lastModified: new Date().toISOString(),
        config: xvConfig
      }
    ];
  },

  // Obtener todos los proyectos guardados
  getAll() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) {
        const defaults = this.getDefaultProjects();
        this.saveAll(defaults);
        return defaults;
      }
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        const defaults = this.getDefaultProjects();
        this.saveAll(defaults);
        return defaults;
      }
      return parsed;
    } catch (e) {
      console.warn('Error reading projects vault, resetting to defaults:', e);
      const defaults = this.getDefaultProjects();
      this.saveAll(defaults);
      return defaults;
    }
  },

  // Guardar lista completa
  saveAll(projects) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(projects));
      return true;
    } catch (e) {
      console.error('Error saving projects vault to localStorage:', e);
      return false;
    }
  },

  // Obtener un proyecto por ID
  getById(id) {
    const list = this.getAll();
    return list.find(p => p.id === id) || null;
  },

  // Crear o actualizar un proyecto
  save(projectData) {
    const list = this.getAll();
    const now = new Date().toISOString();
    
    if (!projectData.id) {
      projectData.id = 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      projectData.createdAt = now;
    }
    
    projectData.lastModified = now;

    // Autogenerar título y anfitriones si no están explícitos
    if (projectData.config) {
      const isWedding = projectData.config.eventType === 'boda';
      if (isWedding) {
        projectData.hosts = `${projectData.config.brideName || 'Novia'} & ${projectData.config.groomName || 'Novio'}`;
        projectData.title = projectData.title || `Boda ${projectData.hosts}`;
        projectData.eventType = 'boda';
      } else {
        projectData.hosts = projectData.config.name || 'Festejada';
        projectData.title = projectData.title || `XV Años ${projectData.hosts}`;
        projectData.eventType = projectData.config.eventType || 'xv';
      }
      
      if (projectData.config.eventDate) {
        projectData.date = projectData.config.eventDate.split('T')[0];
      }
      if (projectData.config.reception && projectData.config.reception.venue) {
        projectData.venue = projectData.config.reception.venue;
      } else if (projectData.config.ceremony && projectData.config.ceremony.venue) {
        projectData.venue = projectData.config.ceremony.venue;
      }
    }

    const index = list.findIndex(p => p.id === projectData.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...projectData };
    } else {
      list.unshift(projectData);
    }

    this.saveAll(list);
    return projectData;
  },

  // Eliminar un proyecto
  delete(id) {
    let list = this.getAll();
    list = list.filter(p => p.id !== id);
    this.saveAll(list);
    return true;
  },

  // Duplicar un proyecto
  duplicate(id) {
    const orig = this.getById(id);
    if (!orig) return null;

    const copy = JSON.parse(JSON.stringify(orig));
    copy.id = 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    copy.title = `${orig.title} (Copia)`;
    copy.createdAt = new Date().toISOString();
    copy.lastModified = copy.createdAt;
    copy.status = 'draft';

    const list = this.getAll();
    list.unshift(copy);
    this.saveAll(list);
    return copy;
  },

  // Exportar proyecto como archivo JSON descargable
  exportJSON(id) {
    const proj = this.getById(id);
    if (!proj) return false;

    const jsonStr = JSON.stringify(proj.config || proj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = `Invitta-${(proj.hosts || 'Proyecto').replace(/\\s+/g, '_')}.json`;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  },

  // Exportar proyecto como archivo HTML autónomo
  exportHTML(id) {
    const proj = this.getById(id);
    if (!proj || typeof TemplateEngine === 'undefined') return false;

    const decorAssets = typeof DECOR_ASSETS !== 'undefined' ? DECOR_ASSETS : {};
    const theme = proj.theme || (proj.config && proj.config.theme) || 'vino';
    const html = TemplateEngine.generateHTML(proj.config, theme, null, decorAssets);
    
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = `Invitacion-${(proj.hosts || 'Evento').replace(/\\s+/g, '_')}.html`;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  },

  // Importar archivo JSON a la bóveda
  importJSON(jsonString, customTitle) {
    try {
      const parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      const config = parsed.config ? parsed.config : parsed;
      const isWedding = config.eventType === 'boda';
      const hosts = isWedding 
        ? `${config.brideName || 'Novia'} & ${config.groomName || 'Novio'}` 
        : (config.name || 'Festejada');
      
      const newProj = {
        id: 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        title: customTitle || (isWedding ? `Boda ${hosts}` : `XV Años ${hosts}`),
        hosts: hosts,
        eventType: config.eventType || 'xv',
        date: config.eventDate ? config.eventDate.split('T')[0] : new Date().toISOString().split('T')[0],
        venue: (config.reception && config.reception.venue) || (config.ceremony && config.ceremony.venue) || 'Recinto por confirmar',
        theme: parsed.theme || 'vino',
        status: 'active',
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        config: config
      };

      const list = this.getAll();
      list.unshift(newProj);
      this.saveAll(list);
      return newProj;
    } catch (e) {
      console.error('Error importing JSON to Projects Vault:', e);
      return null;
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProjectsVault;
}
