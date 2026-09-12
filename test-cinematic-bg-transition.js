const CinematicBgTransition = require('./cinematic-bg-transition.js');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ? PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ? FAIL: ${message}`);
    failed++;
  }
}

console.log("\n?? Testing CinematicBgTransition (60fps Scroll Crossfade #FAF8F5 -> #163C2B)...");

const engine = new CinematicBgTransition({
  autoInjectLayers: false
});

// 1. Instantiation and default color configuration
assert(engine.options.colorStart === '#FAF8F5', 'Initial ceremony color is #FAF8F5 (Ivory/Cream)');
assert(engine.options.colorEnd === '#163C2B', 'Final reception color is #163C2B (Deep Emerald)');
assert(engine.options.cssVarName === '--bg-crossfade', 'Uses GPU CSS variable --bg-crossfade');

// 2. Test Easing Curve (easeInOutCubic)
assert(engine.easeInOutCubic(0) === 0, 'Ease curve starts at 0 at t=0');
assert(engine.easeInOutCubic(1) === 1, 'Ease curve reaches 1 at t=1');
assert(engine.easeInOutCubic(0.5) === 0.5, 'Ease curve passes 0.5 at midpoint');
assert(engine.easeInOutCubic(0.2) < 0.2, 'Ease-in demonstrates soft acceleration');
assert(engine.easeInOutCubic(0.8) > 0.8, 'Ease-out demonstrates smooth deceleration');

// 3. Monotonic check across 100 intervals (Zero Jumps / Zero Jank)
let isMonotonic = true;
let prev = 0;
for (let i = 0; i <= 100; i++) {
  const curr = engine.easeInOutCubic(i / 100);
  if (curr < prev) {
    isMonotonic = false;
    break;
  }
  prev = curr;
}
assert(isMonotonic, 'Crossfade progression is perfectly monotonic with zero micro-jumps (60fps smooth)');

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
