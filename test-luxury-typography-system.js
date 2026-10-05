const assert = require('assert');
const TemplateEngine = require('./template-engine.js');

console.log('\n=== TESTING LUXURY TYPOGRAPHIC SYSTEM (INVITTA STUDIO) ===\n');

const config = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig));
config.photos = {
  hero: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1200'
};

const html = TemplateEngine.generateHTML(config, 'vino');

// 1. FUENTES: Cormorant Garamond (Serif), Inter (Sans), Parisienne (Script)
assert(html.includes('Cormorant+Garamond'), 'Google Fonts includes Cormorant Garamond');
assert(html.includes('Inter:wght'), 'Google Fonts includes Inter');
assert(html.includes('Parisienne'), 'Google Fonts includes Parisienne');

// 2. TAILWIND TOKENS
assert(html.includes('"display-lg": ["var(--font-display)", "\'Cormorant Garamond\'", "serif"]'), 'Tailwind display-lg uses Cormorant Garamond');
assert(html.includes('"body-lg": ["var(--font-body)", "\'Inter\'", "sans-serif"]'), 'Tailwind body-lg uses Inter');
assert(html.includes('"label-caps": ["var(--font-body)", "\'Inter\'", "sans-serif"]'), 'Tailwind label-caps uses Inter');
assert(html.includes('"script-accent": ["var(--font-script)", "\'Parisienne\'", "cursive"]'), 'Tailwind script-accent uses Parisienne');

// 3. ESCALA HERO NAMES (Serif, 44-56px, Light/Regular, NUNCA BOLD)
const brideNameMatch = html.match(/<h1[^>]*id="heroBrideName"[^>]*>/);
assert(brideNameMatch, 'heroBrideName exists');
assert(brideNameMatch[0].includes('font-names') && brideNameMatch[0].includes('var(--font-names'), 'Hero bride name uses the configurable names font');
assert(brideNameMatch[0].includes('font-light'), 'Hero bride name uses font-light');
assert(!brideNameMatch[0].includes('font-bold'), 'Hero bride name is NEVER bold');

const groomNameMatch = html.match(/<h1[^>]*id="heroGroomName"[^>]*>/);
assert(groomNameMatch, 'heroGroomName exists');
assert(groomNameMatch[0].includes('font-names') && groomNameMatch[0].includes('var(--font-names'), 'Hero groom name uses the configurable names font');
assert(groomNameMatch[0].includes('font-light'), 'Hero groom name uses font-light');
assert(!groomNameMatch[0].includes('font-bold'), 'Hero groom name is NEVER bold');

// 4. PALABRA DE ACENTO SCRIPT (Parisienne, 32-40px, máx 1-2 palabras)
const connectorMatch = html.match(/<span[^>]*id="heroNameConnector"[^>]*>([\s\S]*?)<\/span>/);
assert(connectorMatch, 'heroNameConnector exists');
assert(connectorMatch[0].includes('font-script'), 'Connector uses font-script');
assert(connectorMatch[0].includes('hero-connector-scaled'), 'Connector uses hero-connector-scaled');
assert(connectorMatch[1].trim() === '&', 'Connector has clean &');

// 5. NÚMERO DE FECHA (Serif 44-56px Light)
const dateDayMatch = html.match(/<span[^>]*id="heroDateDay"[^>]*>/);
assert(dateDayMatch, 'heroDateDay exists');
assert(dateDayMatch[0].includes('font-display-lg'), 'Date day number uses font-display-lg');
assert(dateDayMatch[0].includes('font-light'), 'Date day number uses font-light');

// 6. LABELS & EYEBROWS (Sans 11-14px Medium; preserve the author's casing)
const eyebrowMatch = html.match(/<p[^>]*id="heroEyebrow"[^>]*>/);
assert(eyebrowMatch, 'heroEyebrow exists');
assert(eyebrowMatch[0].includes('font-label-caps'), 'Eyebrow uses font-label-caps (Inter)');
assert(!eyebrowMatch[0].includes('uppercase'), 'Eyebrow preserves the configured text casing');
assert(eyebrowMatch[0].includes('font-medium'), 'Eyebrow uses font-medium');

// 7. CUERPO EDITORIAL / NARRATIVA (Serif Cormorant Garamond 17-19px Light)
const welcomeMsgMatch = html.match(/<p[^>]*id="welcomeMessage"[^>]*>/);
assert(welcomeMsgMatch, 'welcomeMessage exists');
assert(welcomeMsgMatch[0].includes('font-display-lg'), 'Welcome message uses font-display-lg (Serif Editorial)');
assert(welcomeMsgMatch[0].includes('font-light'), 'Welcome message uses font-light');

// 8. BOTONES / CTA (Sans 11-12px Medium MAYÚSCULAS tracking +3px)
const rsvpSubmitMatch = html.match(/<button[^>]*id="rsvpSubmit"[^>]*>/);
assert(rsvpSubmitMatch, 'rsvpSubmit exists');
assert(rsvpSubmitMatch[0].includes('btn-rsvp-submit-clean'), 'RSVP submit button uses its dedicated style');
assert(/\.btn-rsvp-submit-clean\s*\{[^}]*text-transform:\s*uppercase/.test(html), 'RSVP submit style is uppercase');
assert(/\.btn-rsvp-submit-clean\s*\{[^}]*letter-spacing:\s*0\.2em/.test(html), 'RSVP submit style has tracking');

// 9. PALETA ACTIVA VINO
const vino = TemplateEngine.defaultThemes.vino;
assert(html.includes(`--champagne: ${vino.cream}`), 'Champagne variable uses the selected theme cream');
assert(html.includes(`--onyx: ${vino['ink-900']}`), 'Onyx variable uses the selected theme ink');
assert(html.includes(`--gold: ${vino['gold-500']}`), 'Gold variable uses the selected theme gold');

// 10. SIN GLOW O SOMBRAS PESADAS EN HERO
assert(!brideNameMatch[0].includes('drop-shadow-'), 'Hero bride name has no artificial drop-shadow');
assert(!groomNameMatch[0].includes('drop-shadow-'), 'Hero groom name has no artificial drop-shadow');

console.log('✅ ALL 10 LUXURY TYPOGRAPHY SYSTEM RULES FULLY VERIFIED PASSING!\n');
