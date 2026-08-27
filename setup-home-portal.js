const fs = require('fs');

// 1. Copy old index.html (Seating Planner) to organizador-mesas.html
const seatingPlannerHtml = fs.readFileSync('./index.html', 'utf8');
// In seatingPlannerHtml, change sidebar link to index.html
const updatedSeatingPlanner = seatingPlannerHtml.replace(/href="portal\.html"/g, 'href="index.html"');
fs.writeFileSync('./organizador-mesas.html', updatedSeatingPlanner, 'utf8');
console.log('✅ Created organizador-mesas.html with updated sidebar link to index.html');

// 2. Read portal.html (Dashboard)
let portalHtml = fs.readFileSync('./portal.html', 'utf8');

// 3. Update links in portalHtml to point to organizador-mesas.html
portalHtml = portalHtml.replaceAll('href="index.html"', 'href="organizador-mesas.html"');
portalHtml = portalHtml.replaceAll('href="index.html?role=planner"', 'href="organizador-mesas.html?role=planner"');

// 4. Save updated portalHtml as index.html and portal.html
fs.writeFileSync('./index.html', portalHtml, 'utf8');
fs.writeFileSync('./portal.html', portalHtml, 'utf8');
console.log('✅ Set index.html as the official Portal Dashboard Home Page');
