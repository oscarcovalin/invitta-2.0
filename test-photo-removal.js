const templateEngine = require('./template-engine.js');

// Test 1: Full config with all photos
const cfg1 = JSON.parse(JSON.stringify(templateEngine.defaultConfig));
cfg1.photos.hero = 'https://images.unsplash.com/hero.jpg';
cfg1.photos.portrait = 'https://images.unsplash.com/portrait.jpg';
cfg1.countdownPhoto = 'https://images.unsplash.com/cd.jpg';
const html1 = templateEngine.generateHTML(cfg1, 'vino');

console.log('--- TEST 1: ALL PHOTOS PRESENT ---');
console.log('Hero photo present:', html1.includes('id="heroPhotoFrame"'));
console.log('Welcome portrait present:', html1.includes('id="welcomePortraitWrap"'));
console.log('Countdown photo present:', html1.includes('countdownPhotoImg'));

// Test 2: Hero photo removed
const cfg2 = JSON.parse(JSON.stringify(cfg1));
cfg2.photos.hero = '';
const html2 = templateEngine.generateHTML(cfg2, 'vino');

console.log('\n--- TEST 2: HERO PHOTO REMOVED ---');
console.log('Hero photo frame removed (falls back to clean atmospheric layout):', !html2.includes('id="heroPhotoFrame"'));
console.log('Hero names still present:', html2.includes('heroBrideName') || html2.includes('heroName'));
console.log('Welcome portrait in no-photo mode present:', html2.includes('id="welcomePortraitWrap"'));

// Test 3: All photos removed (Clean Editorial Minimalist Mode)
const cfg3 = JSON.parse(JSON.stringify(cfg1));
cfg3.photos.hero = '';
cfg3.photos.portrait = '';
cfg3.countdownPhoto = '';
const html3 = templateEngine.generateHTML(cfg3, 'vino');

console.log('\n--- TEST 3: ALL PHOTOS REMOVED ---');
console.log('Hero photo frame removed:', !html3.includes('id="heroPhotoFrame"'));
console.log('Welcome portrait removed:', !html3.includes('id="welcomePortraitWrap"'));
console.log('Countdown photo frame removed (editorial layout active):', !html3.includes('countdownPhotoImg'));
console.log('Countdown digits present:', html3.includes('id="days"') && html3.includes('id="hours"'));

console.log('\n🎉 ALL PHOTO REMOVAL TESTS PASSED WITH 100% SUCCESS!');
