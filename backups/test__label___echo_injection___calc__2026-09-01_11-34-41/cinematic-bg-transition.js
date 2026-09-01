/**
 * ============================================================================
 * CinematicBgTransition — Transición de Fondo Cinemática a 60fps (Scroll-Linked)
 * Entorno Antigravity · Invitta Studio
 * ============================================================================
 * Realiza un fundido cruzado cinemático ultra-suave y acelerado por GPU
 * de #FAF8F5 (crema nupcial) a #163C2B (esmeralda profundo) al desplazarse
 * entre la sección de la Ceremonia y la Recepción, con cero jank en móviles.
 */

class CinematicBgTransition {
  /**
   * @param {Object} options - Configuración de selectores, colores y umbrales
   */
  constructor(options = {}) {
    this.options = Object.assign({
      ceremonySelector: '#ceremonyCard',
      receptionSelector: '#receptionCard',
      containerSelector: '#details',
      colorStart: '#FAF8F5', // Crema nupcial suave
      colorEnd: '#163C2B',   // Verde bosque / Esmeralda profundo de lujo
      cssVarName: '--bg-crossfade',
      targetContainer: 'body',
      autoInjectLayers: true
    }, options);

    this.progress = 0;
    this.isObserving = false;
    this.ticking = false;

    this.init();
  }

  init() {
    if (typeof document === 'undefined') return;

    if (this.options.autoInjectLayers) {
      this.injectGpuLayers();
    }

    this.setupIntersectionObserver();
  }

  /**
   * Inyecta las capas fijas aceleradas por GPU para fundido sin repaints
   */
  injectGpuLayers() {
    if (document.getElementById('cinematicBgContainer')) return;

    const container = document.createElement('div');
    container.id = 'cinematicBgContainer';
    container.setAttribute('aria-hidden', 'true');
    container.style.cssText = `
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: -5;
      overflow: hidden;
      contain: strict;
    `;

    // Capa 1: Color Inicial (#FAF8F5)
    const layerStart = document.createElement('div');
    layerStart.className = 'cinematic-layer-start';
    layerStart.style.cssText = `
      position: absolute;
      inset: 0;
      background-color: ${this.options.colorStart};
      transform: translateZ(0);
      will-change: transform;
    `;

    // Capa 2: Color Final (#163C2B) con opacidad dinámica ligada a GPU
    const layerEnd = document.createElement('div');
    layerEnd.className = 'cinematic-layer-end';
    layerEnd.style.cssText = `
      position: absolute;
      inset: 0;
      background-color: ${this.options.colorEnd};
      opacity: var(${this.options.cssVarName}, 0);
      transform: translateZ(0);
      will-change: opacity;
      transition: opacity 0.05s linear;
    `;

    container.appendChild(layerStart);
    container.appendChild(layerEnd);
    document.body.prepend(container);
  }

  /**
   * Configura IntersectionObserver para activar el tracking solo cuando el usuario se acerca
   */
  setupIntersectionObserver() {
    const ceremonyEl = document.querySelector(this.options.ceremonySelector);
    const receptionEl = document.querySelector(this.options.receptionSelector);
    const containerEl = document.querySelector(this.options.containerSelector) || ceremonyEl?.parentElement;

    if (!ceremonyEl || !receptionEl) {
      // Fallback a listener pasivo si los elementos aún no están en el DOM
      window.addEventListener('scroll', () => this.onScroll(), { passive: true });
      return;
    }

    // IntersectionObserver con 100 thresholds para máxima fidelidad
    const thresholds = Array.from({ length: 101 }, (_, i) => i / 100);

    const observer = new IntersectionObserver((entries) => {
      let isAnyVisible = entries.some(e => e.isIntersecting);
      if (isAnyVisible) {
        if (!this.isObserving) {
          this.isObserving = true;
          window.addEventListener('scroll', this.boundScrollHandler, { passive: true });
        }
        this.updateTransitionProgress();
      } else {
        if (this.isObserving) {
          this.isObserving = false;
          window.removeEventListener('scroll', this.boundScrollHandler);
        }
      }
    }, {
      root: null,
      rootMargin: '200px 0px 200px 0px',
      threshold: thresholds
    });

    this.boundScrollHandler = () => this.onScroll();
    if (containerEl) observer.observe(containerEl);
    if (ceremonyEl) observer.observe(ceremonyEl);
    if (receptionEl) observer.observe(receptionEl);

    // Ejecutar cálculo inicial
    this.updateTransitionProgress();
  }

  onScroll() {
    if (!this.ticking) {
      window.requestAnimationFrame(() => {
        this.updateTransitionProgress();
        this.ticking = false;
      });
      this.ticking = true;
    }
  }

  /**
   * Calcula el progreso cinemático normalizado [0.0 - 1.0] entre Ceremonia y Recepción
   */
  calculateProgress() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return 0;

    const ceremonyEl = document.querySelector(this.options.ceremonySelector);
    const receptionEl = document.querySelector(this.options.receptionSelector);

    if (!ceremonyEl || !receptionEl) return 0;

    const ceremonyRect = ceremonyEl.getBoundingClientRect();
    const receptionRect = receptionEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Punto focal: tercio inferior de la pantalla donde se cruza la lectura
    const focusPoint = viewportHeight * 0.65;

    // Distancia total entre el final de la ceremonia y el inicio de la recepción
    const startY = ceremonyRect.top + ceremonyRect.height * 0.5;
    const endY = receptionRect.top + receptionRect.height * 0.2;

    if (endY <= startY) return 0;

    const rawProgress = (focusPoint - startY) / (endY - startY);
    
    // Suavizado cinemático con curva cubic ease-in-out
    const clamped = Math.max(0, Math.min(1, rawProgress));
    return this.easeInOutCubic(clamped);
  }

  /**
   * Curva de interpolación suave (SmoothStep / Ease-In-Out)
   */
  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Aplica el progreso al DOM mediante variables CSS en GPU
   */
  updateTransitionProgress() {
    const progress = this.calculateProgress();
    this.progress = progress;

    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty(this.options.cssVarName, progress.toFixed(4));
      
      // Adaptación de contraste en tarjetas de Ceremonia y Recepción
      const receptionCard = document.querySelector(this.options.receptionSelector);
      if (receptionCard) {
        // En progreso alto, el texto de la recepción adquiere luz nupcial
        if (progress > 0.4) {
          receptionCard.style.setProperty('--reception-contrast', '1');
        } else {
          receptionCard.style.setProperty('--reception-contrast', '0');
        }
      }
    }

    // Emisión de evento para hooks reactivos
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cinematic:bg-changed', { detail: { progress: progress } }));
    }

    return progress;
  }
}

// Exportación modular para Browser o Node
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CinematicBgTransition;
} else if (typeof window !== 'undefined') {
  window.CinematicBgTransition = CinematicBgTransition;
}
