const fs = require('fs');
const path = require('path');

const ROOT      = 'C:/Users/oscar/.gemini/antigravity/scratch/invitta-2.0-beta';
const HTML_FILE = path.join(ROOT, 'organizador-mesas.html');
const JS_FILE   = path.join(ROOT, 'seating-module', 'seating-planner.js');

function patch(filePath, label, fn) {
  console.log('\n[' + label + '] Patching: ' + path.basename(filePath));
  const src = fs.readFileSync(filePath, 'utf8');
  const result = fn(src);
  if (result === src) { console.error('  X  No change made.'); process.exitCode = 1; return; }
  fs.writeFileSync(filePath, result, 'utf8');
  console.log('  OK Done.');
}

function req(src, needle, label) {
  if (!src.includes(needle)) throw new Error('[' + label + '] Not found: ' + needle.slice(0, 60));
}

// TASK 1a -- panel height
patch(HTML_FILE, 'TASK 1a', function(src) {
  var O = 'flex flex-col max-h-56 lg:max-h-full lg:h-full z-10 shrink-0';
  var N = 'flex flex-col max-h-[40vh] lg:max-h-full lg:h-full z-10 shrink-0';
  req(src, O, 'TASK 1a');
  return src.replace(O, N);
});

// TASK 1b -- collapse button
patch(HTML_FILE, 'TASK 1b', function(src) {
  if (src.includes('id="btnTogglePanel"')) { console.log('  SKIP'); return src; }
  var ANCHOR = '<div class="p-5 border-b border-outline-variant bg-surface-container-lowest space-y-3">';
  req(src, ANCHOR, 'TASK 1b');
  var BTN  = '\n          <!-- Mobile Collapse Toggle -->\n';
      BTN += '          <button type="button" id="btnTogglePanel" ';
      BTN += 'class="lg:hidden flex items-center justify-between w-full px-4 py-2 bg-surface-container border-b border-outline-variant text-xs font-semibold text-charcoal" ';
      BTN += "onclick=\"(function(){var p=document.getElementById('unassignedPanel');var isOpen=p.dataset.mobileOpen!=='false';p.dataset.mobileOpen=isOpen?'false':'true';p.style.maxHeight=isOpen?'2.5rem':'40vh';this.querySelector('span.label').textContent=isOpen?'\u25bc Ver Invitados Pendientes':'\u25b2 Ocultar Panel';}).call(this)\">\n";
      BTN += '            <span class="label">\u25b2 Ocultar Panel</span>\n';
      BTN += '            <span class="text-warm-grey text-[10px]">Toca para colapsar</span>\n';
      BTN += '          </button>\n          ';
  return src.replace(ANCHOR, BTN + ANCHOR);
});

// TASK 2a -- responsive circle style
patch(JS_FILE, 'TASK 2a', function(src) {
  var O = 'style="width: 288px; height: 288px;"';
  var N = 'style="width: min(288px, calc(100vw - 80px)); height: min(288px, calc(100vw - 80px));"';
  req(src, O, 'TASK 2a');
  return src.replace(O, N);
});

// TASK 2b -- dynamic radius
patch(JS_FILE, 'TASK 2b', function(src) {
  var O = 'const radius = 124; // Radio en px';
  var N = "// Dynamic radius -- respects mobile viewport\n      const circleSize = Math.min(288, (typeof window !== 'undefined' ? window.innerWidth - 80 : 288));\n      const radius = circleSize / 2 - 28; // Radio en px (dynamic)";
  req(src, O, 'TASK 2b');
  return src.replace(O, N);
});

// TASK 3 -- pinch-to-zoom
patch(HTML_FILE, 'TASK 3', function(src) {
  if (src.includes('PINCH-TO-ZOOM for Plano 2D')) { console.log('  SKIP'); return src; }
  var ANCHOR = '</body>';
  req(src, ANCHOR, 'TASK 3');
  var s = '  <script>\n';
  s += '  // --- PINCH-TO-ZOOM for Plano 2D (mobile) ---\n';
  s += '  (function() {\n';
  s += "    var fpContainer = document.getElementById('floorPlanCanvas')\n";
  s += "      || document.getElementById('viewFloorPlanContainer')\n";
  s += "      || document.querySelector('#tablesContainer');\n";
  s += '    if (!fpContainer) return;\n';
  s += '    var initialDistance = 0, currentScale = 1, lastScale = 1;\n';
  s += "    fpContainer.addEventListener('touchstart', function(e) {\n";
  s += '      if (e.touches.length === 2) {\n';
  s += '        initialDistance = Math.hypot(\n';
  s += '          e.touches[0].clientX - e.touches[1].clientX,\n';
  s += '          e.touches[0].clientY - e.touches[1].clientY\n';
  s += '        );\n';
  s += '        e.preventDefault();\n';
  s += '      }\n';
  s += '    }, { passive: false });\n';
  s += "    fpContainer.addEventListener('touchmove', function(e) {\n";
  s += '      if (e.touches.length === 2) {\n';
  s += '        var distance = Math.hypot(\n';
  s += '          e.touches[0].clientX - e.touches[1].clientX,\n';
  s += '          e.touches[0].clientY - e.touches[1].clientY\n';
  s += '        );\n';
  s += '        currentScale = Math.min(3, Math.max(0.4, lastScale * (distance / initialDistance)));\n';
  s += "        fpContainer.style.transform = 'scale(' + currentScale + ')';\n";
  s += "        fpContainer.style.transformOrigin = 'top center';\n";
  s += '        e.preventDefault();\n';
  s += '      }\n';
  s += '    }, { passive: false });\n';
  s += "    fpContainer.addEventListener('touchend', function(e) {\n";
  s += '      if (e.touches.length < 2) { lastScale = currentScale; }\n';
  s += '    });\n';
  s += '  })();\n';
  s += '  </script>\n';
  return src.replace(ANCHOR, s + ANCHOR);
});

// Verify
console.log('\n[VERIFY]');
try { new Function(fs.readFileSync(JS_FILE, 'utf8')); console.log('  OK seating-planner.js: no syntax errors'); }
catch(e) { console.error('  X  JS syntax error: ' + e.message); process.exitCode = 1; }

var html = fs.readFileSync(HTML_FILE, 'utf8');
var js   = fs.readFileSync(JS_FILE, 'utf8');
[
  [html, 'max-h-[40vh]',                'HTML: panel height class'],
  [html, 'btnTogglePanel',              'HTML: collapse toggle button'],
  [html, 'PINCH-TO-ZOOM for Plano 2D', 'HTML: pinch-to-zoom script'],
  [js,   'min(288px, calc(100vw',       'JS: responsive circle size'],
  [js,   'circleSize / 2 - 28',         'JS: dynamic radius'],
].forEach(function(c) { console.log('  ' + (c[0].includes(c[1]) ? 'OK' : 'X ') + '  ' + c[2]); });
console.log('\nAll patches complete.');
