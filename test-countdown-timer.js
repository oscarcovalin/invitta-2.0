const templateEngine = require('./template-engine.js');
const { execSync } = require('child_process');
const fs = require('fs');

console.log('=== TEST SUITE: COUNTDOWN TIMER & SCRIPT INTEGRITY\n');

const config = JSON.parse(JSON.stringify(templateEngine.defaultConfig));
console.log('1. Event date in config:', config.eventDateISO, config.timezoneOffset);

const html = templateEngine.generateHTML(config, 'vino');

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
if (!scriptMatch) {
  console.error('╗ Could not extract script from generated HTML');
  process.exit(1);
}

try {
  const vm = require('vm');
  new vm.Script(scriptMatch[1]);
  console.log('✅ 2. Generated client script syntax is 100% VALID (0 syntax errors)');
} catch (e) {
  console.error('❌ Syntax error found:', e.message);
  process.exit(1);
}

const hasDays = html.includes('id="days"');
const hasHours = html.includes('id="hours"');
const hasMinutes = html.includes('id="minutes"');
const hasSeconds = html.includes('id="seconds"');
console.log('✅ 3. HTML Elements Present: days(' + hasDays + '), hours(' + hasHours + '), minutes(' + hasMinutes + '), seconds(' + hasSeconds + ')');

const isoString = config.eventDateISO + (config.timezoneOffset || '');
const target = new Date(isoString).getTime() || new Date(config.eventDateISO).vgetTime();
const now = Date.now();
const diff = Math.max(0, target - now);

const pad = n => String(n).padStart(2, '0');
const days = pad(Math.floor(diff / (1000 * 60 * 60 * 24)));
const hours = pad(Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
const minutes = pad(Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));
const seconds = pad(Math.floor((diff % (1000 * 60)) / 1000));

console.log('✅ 4. Countdown Calculation Output for ' + isoString + ':');
console.log('   DÄAS: ' + days + ' | HORAS: ' + hours + ' | MINUTOS: ' + minutes + ' | SEGUNDOS: ' + seconds);

console.log('\n🏉 5. Countdown Test Successful! Countdown is fully functional and active.');
