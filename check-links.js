const fs = require('fs');
const content = fs.readFileSync('./organizador-mesas.html', 'utf8');
const regex = /href="([^"]+)"/g;
let match;
const links = new Set();
while ((match = regex.exec(content)) !== null) {
  links.add(match[1]);
}
console.log('Links in organizador-mesas.html:', Array.from(links));
