const templateEngine = require('./template-engine.js');

// 1. Test GSAP multi-plane elements are present in base HTML (no illustrations)
const configBase = JSON.parse(JSON.stringify(templateEngine.defaultConfig));
const htmlBase = templateEngine.generateHTML(configBase, 'vino');

console.log('--- TEST 1: BASE HTML — 3-LAYER MULTI-PLANE INFRASTRUCTURE ---');
console.log('parallaxBgHero wrapper present:', htmlBase.includes('id="parallaxBgHero"'));
console.log('Hero section is overflow-visible:', htmlBase.includes('overflow: visible'));
console.log('illustrationBridgeHero present:', htmlBase.includes('id="illustrationBridgeHero"'));
console.log('illustrationBridgeCountdown present:', htmlBase.includes('id="illustrationBridgeCountdown"'));
console.log('illustrationBridgeFamily present:', htmlBase.includes('id="illustrationBridgeFamily"'));
console.log('GSAP parallaxBgHero animation present:', htmlBase.includes("getElementById('parallaxBgHero')"));
console.log('GSAP illBridgeHero animation present:', htmlBase.includes("initIllustrationBridgeParallax('illustrationBridgeHero'"));
console.log('GSAP illBridgeCountdown animation present:', htmlBase.includes("initIllustrationBridgeParallax('illustrationBridgeCountdown'"));
console.log('GSAP illBridgeFamily animation present:', htmlBase.includes("initIllustrationBridgeParallax('illustrationBridgeFamily'"));

// 2. Test Hero illustration active with story section enabled (Debajo de Nuestra Historia)
const configIllHero = JSON.parse(JSON.stringify(templateEngine.defaultConfig));
configIllHero.story = { enabled: true, title: 'Nuestra Historia', subtitle: 'Un año lleno de momentos', text: 'Dicen que los mejores momentos...' };
configIllHero.illustrations = {
  hero: { 
    enabled: true, 
    image: 'https://example.com/alice-illustration.png', 
    widthPct: 85, 
    maxWidth: 580,
    offsetY: -20,
    offsetX: 10,
    overlapPct: 50,
    alignX: 'center',
    parallaxSpeed: 30,
    extraPadding: 40
  },
  countdown: { enabled: false, image: '' },
  family: { enabled: false, image: '' }
};
const htmlIllHero = templateEngine.generateHTML(configIllHero, 'vino');

console.log('\n--- TEST 2: HERO ILLUSTRATION ACTIVE (POSITIONED BELOW NUESTRA HISTORIA) ---');
console.log('Hero bridge shows image URL:', htmlIllHero.includes('alice-illustration.png'));
console.log('Hero bridge NOT hidden:', !htmlIllHero.includes('id="illustrationBridgeHero"\n      class="absolute z-30 pointer-events-none will-change-transform hidden"'));
console.log('Hero bridge contains max-width 580px:', htmlIllHero.includes('max-width: 580px'));
console.log('Hero bridge contains bottom offset calc with offsetY -20px:', htmlIllHero.includes('bottom: calc(-25% + -20px)'));
console.log('Hero bridge contains offsetX calc +10px:', htmlIllHero.includes('left: calc(50% + 10px)'));
console.log('Countdown receives extraPadding 40px:', htmlIllHero.includes('pt-[calc(140px+40px)]'));
console.log('GSAP receives custom parallax speed 30%:', htmlIllHero.includes('const heroParallaxSpeed = 30'));

// Verify illustration is AFTER story text and BEFORE countdown
const idxStoryText = htmlIllHero.indexOf('Dicen que los mejores momentos');
const idxIllBridge = htmlIllHero.indexOf('id="illustrationBridgeHero"');
const idxCountdown = htmlIllHero.indexOf('id="countdownSection"');
console.log('Illustration is placed AFTER Story Text:', idxStoryText < idxIllBridge);
console.log('Illustration is placed BEFORE Countdown Section:', idxIllBridge < idxCountdown);

// 3. Test Countdown-to-Family illustration active (NUEVA CAPA MULTIPLANO)
const configIllCountdown = JSON.parse(JSON.stringify(templateEngine.defaultConfig));
configIllCountdown.illustrations = {
  hero: { enabled: false, image: '' },
  countdown: {
    enabled: true,
    image: 'https://example.com/floral-transition.png',
    widthPct: 80,
    maxWidth: 540,
    offsetY: 10,
    offsetX: 0,
    overlapPct: 60,
    alignX: 'center',
    parallaxSpeed: 35,
    extraPadding: 25
  },
  family: { enabled: false, image: '' }
};
const htmlIllCountdown = templateEngine.generateHTML(configIllCountdown, 'vino');

console.log('\n--- TEST 3: COUNTDOWN-TO-FAMILY MULTIPLANE LAYER ---');
console.log('Countdown bridge shows image URL:', htmlIllCountdown.includes('floral-transition.png'));
console.log('Countdown bridge NOT hidden:', !htmlIllCountdown.includes('id="illustrationBridgeCountdown"\n      class="absolute z-30 pointer-events-none will-change-transform hidden"'));
console.log('Family section receives extra top padding +25px:', htmlIllCountdown.includes('pt-[calc(130px+25px)]'));
console.log('Countdown bridge bottom offset for 60% overlap +10px:', htmlIllCountdown.includes('bottom: calc(-30% + 10px)'));
console.log('GSAP receives custom parallax speed 35%:', htmlIllCountdown.includes('const cdParallaxSpeed = 35'));

const idxBtnCalendar = htmlIllCountdown.indexOf('id="btnCalendar"');
const idxIllCountdown = htmlIllCountdown.indexOf('id="illustrationBridgeCountdown"');
const idxFamily = htmlIllCountdown.indexOf('id="family"');
console.log('Countdown bridge placed AFTER Calendar buttons:', idxBtnCalendar < idxIllCountdown);
console.log('Countdown bridge placed BEFORE Family section:', idxIllCountdown < idxFamily);

// 4. Test All 3 Multi-Plane Layers Active Concurrently
const configAll3 = JSON.parse(JSON.stringify(templateEngine.defaultConfig));
configAll3.story = { enabled: true, title: 'Nuestra Historia', text: 'Historia...' };
configAll3.illustrations = {
  hero: { enabled: true, image: 'https://example.com/ill1.png', widthPct: 85, maxWidth: 560, offsetY: 0, offsetX: 0, overlapPct: 50, alignX: 'center', parallaxSpeed: 25, extraPadding: 0 },
  countdown: { enabled: true, image: 'https://example.com/ill2.png', widthPct: 80, maxWidth: 540, offsetY: 0, offsetX: 0, overlapPct: 50, alignX: 'center', parallaxSpeed: 25, extraPadding: 0 },
  family: { enabled: true, image: 'https://example.com/ill3.png', widthPct: 82, maxWidth: 560, offsetY: 0, offsetX: 0, overlapPct: 50, alignX: 'center', parallaxSpeed: 25, extraPadding: 0 }
};
const htmlAll3 = templateEngine.generateHTML(configAll3, 'vino');

console.log('\n--- TEST 4: ALL 3 MULTI-PLANE LAYERS ACTIVE ---');
console.log('All 3 images present in HTML:', htmlAll3.includes('ill1.png') && htmlAll3.includes('ill2.png') && htmlAll3.includes('ill3.png'));
console.log('Countdown gets top padding:', htmlAll3.includes('pt-[calc(140px+0px)]'));
console.log('Family gets top padding:', htmlAll3.includes('pt-[calc(130px+0px)]'));
console.log('Details gets top padding:', htmlAll3.includes('pt-[calc(130px+0px)]'));

// 5. Section Order Preserved
const idxH = htmlAll3.indexOf('id="hero"');
const idxS = htmlAll3.indexOf('id="storySection"');
const idxC = htmlAll3.indexOf('id="countdownSection"');
const idxF = htmlAll3.indexOf('id="family"');
const idxD = htmlAll3.indexOf('id="details"');
console.log('\n--- TEST 5: SECTION ORDER PRESERVED ---');
console.log('Hero < Story:', idxH < idxS);
console.log('Story < Countdown:', idxS < idxC);
console.log('Countdown < Family:', idxC < idxF);
console.log('Family < Details:', idxF < idxD);
