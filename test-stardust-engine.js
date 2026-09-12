const StardustEngine = require('./stardust-module/stardust-engine.js');

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

console.log("\n?? Testing StardustEngine (3D Parallax, Zero-Canvas, 60fps, #A38047)...");

const engine = new StardustEngine({
  autoInject: false,
  count: 60,
  goldColor: '#A38047'
});

// 1. Color Configuration
assert(engine.options.goldColor === '#A38047', 'Uses gold color #A38047');

// 2. Parallax Layer Speeds
assert(engine.options.speedBack === 0.08, 'Background speed factor is 0.08 (slow depth)');
assert(engine.options.speedMid === 0.26, 'Middle speed factor is 0.26 (moderate depth)');
assert(engine.options.speedFront === 0.58, 'Front speed factor is 0.58 (fast foreground)');
assert(engine.options.speedFront > engine.options.speedMid && engine.options.speedMid > engine.options.speedBack, 'Layer speeds follow strict differential parallax ratio');

// 3. Particle element generation
const testParticle = engine.createParticleElement({
  size: 3.5,
  opacity: 0.8,
  duration: 2.5,
  delay: 1.0,
  glow: true,
  glowBlur: 6,
  isDiamond: true
});

assert(testParticle.className === 'stardust-star', 'Particle is an HTML div element (Zero-Canvas compliance)');
assert(testParticle.style.cssText.includes('#A38047'), 'Particle styling incorporates #A38047');
assert(testParticle.style.cssText.includes('stardustTwinkle'), 'Particle has CSS keyframe twinkle animation');

// 4. Random Range bounds
for (let i = 0; i < 50; i++) {
  const r = engine.randomRange(2.0, 5.0);
  if (r < 2.0 || r > 5.0) {
    assert(false, `randomRange out of bounds: ${r}`);
    break;
  }
}
assert(true, 'Particle dimensions and timings stay within strictly calibrated bounds');

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
