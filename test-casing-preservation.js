const TemplateEngine = require('./template-engine');

console.log("\n=== RUNNING CASING PRESERVATION TESTS ===\n");

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

const config = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig));
config.instagram = {
  enabled: true,
  hashtag: '#BodaCatalinayJulian',
  text: 'Comparte tus mejores fotos con nosotros'
};
config.music = {
  enabled: true,
  title: 'A Thousand Years (Acústico)',
  url: 'https://example.com/audio.mp3'
};
config.story = {
  enabled: true,
  subtitle: 'Nuestra Historia de Amor',
  title: 'Cómo nos conocimos',
  text: 'Todo comenzó en una tarde de verano...'
};
config.sharedAlbum = {
  enabled: true,
  subtitle: 'Recuerdos del Gran Día',
  title: 'Álbum Colaborativo',
  accessCode: 'Boda2027-Vip'
};
config.dressCode = {
  enabled: true,
  title: 'Formal / Etiqueta Rigurosa',
  description: 'Agradecemos vestir de gala',
  colorsEnabled: true,
  colorPalette: [
    { name: 'Verde Esmeralda', hex: '#163c2b' },
    { name: 'Rosa Palo', hex: '#d48b7b' }
  ]
};
config.giftRegistry = {
  enabled: true,
  stores: [
    { name: 'Liverpool Departamental', url: 'https://liverpool.com.mx' },
    { name: 'Palacio de Hierro', url: 'https://elpalaciodehierro.com' }
  ]
};
config.vendorCard = {
  enabled: true,
  badge: '¿Deseas una invitación como esta?',
  agencyName: 'Invitta Studio · Invitaciones Digitales'
};
config.eyebrow = 'Nuestra Boda Soñada';

const html = TemplateEngine.generateHTML(config, 'classicGold');

// 1. Instagram Hashtag
assert(html.includes('#BodaCatalinayJulian'), 'Hashtag retains CamelCase verbatim');
assert(!html.includes('id="instagramHashtag" class="font-display-lg'), 'Hashtag does not use font-display-lg (which uses all-caps Cinzel)');
assert(html.includes('id="instagramHashtag" class="font-body-lg text-2xl sm:text-3xl font-bold text-[#f7f6ec] mb-4 tracking-wide">#BodaCatalinayJulian</h3>'), 'Hashtag has correct casing structure');

// 2. Music Title
assert(html.includes('A Thousand Years (Acústico)'), 'Music title retains mixed case');
const musicTitleMatch = html.match(/id="musicTitle"[^>]*>([\s\S]*?)<\/span>/);
assert(musicTitleMatch && !musicTitleMatch[0].includes('uppercase'), 'Music title span has no uppercase class');

// 3. Vendor Card Badge & Agency
assert(html.includes('¿Deseas una invitación como esta?'), 'Vendor card badge retains mixed case');
const badgeMatch = html.match(/id="vendorCardBadge"[^>]*>/);
assert(badgeMatch && !badgeMatch[0].includes('uppercase'), 'Vendor card badge has no uppercase class');

// 4. Story Subtitle
const storySubMatch = html.match(/id="storySubtitle"[^>]*>/);
assert(storySubMatch && !storySubMatch[0].includes('uppercase'), 'Story subtitle has no uppercase class');

// 5. Dress Code Title & Color Palette
const dressPaletteColor = html.match(/Verde Esmeralda/);
assert(dressPaletteColor !== null, 'Color palette Verde Esmeralda is present');
assert(html.includes('Rosa Palo'), 'Color palette Rosa Palo is present');

// 6. Gift Registry Stores
assert(html.includes('Liverpool Departamental'), 'Store name retains mixed case');
assert(html.includes('Palacio de Hierro'), 'Store name Palacio de Hierro retains mixed case');

// 7. Shared Album Subtitle
const albumSubMatch = html.match(/id="albumSubtitle"[^>]*>/);
assert(albumSubMatch && !albumSubMatch[0].includes('uppercase'), 'Album subtitle has no uppercase class');

// 8. Eyebrow / Header Title
const eyebrowMatch = html.match(/id="heroEyebrow"[^>]*>/);
assert(eyebrowMatch && !eyebrowMatch[0].includes('uppercase'), 'Hero eyebrow has no uppercase class');

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
