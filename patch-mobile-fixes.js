/**
 * patch-mobile-fixes.js
 * Applies three targeted mobile responsiveness fixes:
 *  TASK 1 -- organizador-mesas.html: guest panel height + collapse toggle button
 *  TASK 2 -- seating-module/seating-planner.js: circular table size + dynamic radius
 *  TASK 3 -- organizador-mesas.html: pinch-to-zoom for the floor plan canvas
 */

const fs = require('fs');
const path = require('path');

// Helpers
function patch(filePath, label, fn) {
  console.log('\n[' + label + '] Patching: ' + filePath);
  let src = fs.readFileSync(filePath, 'utf8');
  const result = fn(src);
  if (result === src) {
    console.error('  X  No change made -- target string not found.');
    process.exitCode = 1;
    return;
  }
  fs.writeFileSync(filePath, result, 'utf8');
  console.log('  OK Done.');
}

function requireExact(src, needle, label) {
  if (!src.includes(needle)) {
    throw new Error('[' + label + '] Could not find exact target string:\n---\n' + needle + '\n---');
  }
}

const ROOT      = 'C:\\Users\\oscar\\.gemini\\antigravity\\scratch\\invitta-2.0-beta';
const HTML_FILE = path.join(ROOT, 'organizador-mesas.html');
const JS_FILE   = path.join(ROOT, 'seating-module', 'seating-planner.js');

// TASK 1a -- Change max-h-56 to max-h-[40vh]
patch(HTML_FILE, 'TASK 1a', (src) => {
  const OLD = 'flex flex-col max-h-56 lg:max-h-full lg:h-full z-10 shrink-0';
  const NEW = 'flex flex-col max-h-[40vh] lg:max-h-full lg:h-full z-10 shrink-0';
  requireExact(src, OLD, 'TASK 1a');
  return src.replace(OLD, NEW);
});

// TASK 1b -- Inject collapse toggle button
patch(HTML_FILE, 'TASK 1b', (src) => {
  if (src.includes('id="btnTogglePanel"')) {
    console.log('  SKIP btnTogglePanel already present.');
    return src;
  }
  const ANCHOR = '<div class="p-5 border-b border-outline-variant bg-surface-container-lowest space-y-3">';
  requireExact(src, ANCHOR, 'TASK 1b');
  const BTN = <!-- Mobile Collapse Toggle -->
          <button type="button" id="btnTogglePanel" class="lg:hidden flex items-center justify-between w-full px-4 py-2 bg-surface-container border-b border-outline-variant text-xs font-semibold text-charcoal" onclick="(function(){var p=document.getElementById('unassignedPanel');var isOpen=p.dataset.mobileOpen!=='false';p.dataset.mobileOpen=isOpen?'false':'true';p.style.maxHeight=isOpen?'2.5rem':'40vh';this.querySelector('span.label').textContent=isOpen?'\u25bc Ver Invitados Pendientes':'\u25b2 Ocultar Panel';}).call(this)">
            <span class="label">\u25b2 Ocultar Panel</span>
            <span class="text-warm-grey text-[10px]">Toca para colapsar</span>
          </button>
          ;
  return src.replace(ANCHOR, BTN + ANCHOR);
});

// TASK 2a -- Circular table: responsive inline style
patch(JS_FILE, 'TASK 2a', (src) => {
  const OLD = 'style="width: 288px; height: 288px;"';
  const NEW = 'style="width: min(288px, calc(100vw - 80px)); height: min(288px, calc(100vw - 80px));"';
  requireExact(src, OLD, 'TASK 2a');
  return src.replace(OLD, NEW);
});

// TASK 2b -- Circular table: dynamic radius
patch(JS_FILE, 'TASK 2b', (src) => {
  const OLD = 'const radius = 124; // Radio en px';
  const NEW = "// Dynamic radius -- respects mobile viewport\n      const circleSize = Math.min(288, (typeof window !== 'undefined' ? window.innerWidth - 80 : 288));\n      const radius = circleSize / 2 - 28; // Radio en px (dynamic)";
  requireExact(src, OLD, 'TASK 2b');
  return src.replace(OLD, NEW);
});

// TASK 3 -- Pinch-to-zoom injected before </body>
patch(HTML_FILE, 'TASK 3', (src) => {
  if (src.includes('PINCH-TO-ZOOM for Plano 2D')) {
    console.log('  SKIP pinch-to-zoom already present.');
    return src;
  }
  const ANCHOR = '</body>';
  requireExact(src, ANCHOR, 'TASK 3');
  const SCRIPT =   <script>
  // --- PINCH-TO-ZOOM for Plano 2D (mobile) ---
  (function() {
    const fpContainer = document.getElementById('floorPlanCanvas')
      || document.getElementById('viewFloorPlanContainer')
      || document.querySelector('#tablesContainer');
    if (!fpContainer) return;
    let initialDistance = 0;
    let currentScale = 1;
    let lastScale = 1;
    fpContainer.addEventListener('touchstart', function(e) {
      if (e.touches.length === 2) {
        initialDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        e.preventDefault();
      }
    }, { passive: false });
    fpContainer.addEventListener('touchmove', function(e) {
      if (e.touches.length === 2) {
        const distance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        currentScale = Math.min(3, Math.max(0.4, lastScale * (distance / initialDistance)));
        fpContainer.style.transform = \scale(\)\;
        fpContainer.style.transformOrigin = 'top center';
        e.preventDefault();
      }
    }, { passive: false });
    fpContainer.addEventListener('touchend', function(e) {
      if (e.touches.length < 2) { lastScale = currentScale; }
    });
  })();
  </script>
;
  return src.replace(ANCHOR, SCRIPT + ANCHOR);
});

// Verification
console.log('\n[VERIFY] seating-planner.js syntax check...');
try {
  new Function(fs.readFileSync(JS_FILE, 'utf8'));
  console.log('  OK seating-planner.js: no syntax errors.');
} catch(e) {
  console.error('  X  Syntax error: ' + e.message);
  process.exitCode = 1;
}

console.log('[VERIFY] organizador-mesas.html content checks...');
const html = fs.readFileSync(HTML_FILE, 'utf8');
const js   = fs.readFileSync(JS_FILE, 'utf8');
[
  [html, 'max-h-[40vh]',                          'HTML: panel height class'],
  [html, 'btnTogglePanel',                         'HTML: collapse toggle button'],
  [html, 'PINCH-TO-ZOOM for Plano 2D',            'HTML: pinch-to-zoom script'],
  [js,   'min(288px, calc(100vw - 80px))',         'JS:   responsive circle size'],
  [js,   'circleSize / 2 - 28',                   'JS:   dynamic radius'],
].forEach(([src, needle, desc]) => {
  console.log('  ' + (src.includes(needle) ? 'OK' : 'X ') + ' ' + desc);
});

console.log('\nAll patches complete.\n');
