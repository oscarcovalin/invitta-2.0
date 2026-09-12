const fs = require("fs");
const assert = require("assert");
const TemplateEngine = require("./template-engine.js");

console.log("\n?? Testing Church & Venue Photograph Feature & Fallback Engine...\n");
let passed = 0;
function it(desc, fn) {
  try {
    fn();
    console.log("  ? PASS: " + desc);
    passed++;
  } catch(e) {
    console.error("  ? FAIL: " + desc, e.message);
  }
}

it("defaultConfig includes ceremony.image and reception.image initialized to empty string", () => {
  assert.ok(TemplateEngine.defaultConfig.ceremony, "Ceremony config exists");
  assert.ok(TemplateEngine.defaultConfig.reception, "Reception config exists");
  assert.strictEqual(typeof TemplateEngine.defaultConfig.ceremony.image, "string");
  assert.strictEqual(typeof TemplateEngine.defaultConfig.reception.image, "string");
  assert.strictEqual(TemplateEngine.defaultConfig.ceremony.image, "");
  assert.strictEqual(TemplateEngine.defaultConfig.reception.image, "");
});

it("Fallback: When no photos are provided, generated HTML does not render image tags and preserves default layout", () => {
  const cfg = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig));
  cfg.ceremony.image = "";
  cfg.reception.image = "";
  const html = TemplateEngine.generateHTML(cfg);
  assert.ok(html.includes('id="ceremonyCard"'));
  assert.ok(html.includes('id="receptionCard"'));
  assert.strictEqual(html.includes('alt="Lugar de la Ceremonia"'), false);
  assert.strictEqual(html.includes('alt="Lugar de la Recepción"'), false);
});

it("Church photo URL renders luxury banner in ceremonyCard", () => {
  const cfg = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig));
  cfg.ceremony.image = "https://images.unsplash.com/photo-church";
  cfg.reception.image = "";
  const html = TemplateEngine.generateHTML(cfg);
  assert.ok(html.includes('src="https://images.unsplash.com/photo-church"'));
  assert.ok(html.includes('alt="Lugar de la Ceremonia"'));
  assert.strictEqual(html.includes('alt="Lugar de la Recepción"'), false);
});

it("Venue photo base64 renders luxury banner in receptionCard", () => {
  const cfg = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig));
  const b64Data = "data:image/jpeg;base64,sample123";
  cfg.ceremony.image = "";
  cfg.reception.image = b64Data;
  const html = TemplateEngine.generateHTML(cfg);
  assert.ok(html.includes('src="' + b64Data + '"'));
  assert.ok(html.includes('alt="Lugar de la Recepción"'));
  assert.strictEqual(html.includes('alt="Lugar de la Ceremonia"'), false);
});

it("Both photos provided renders both cards with photos", () => {
  const cfg = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig));
  cfg.ceremony.image = "https://example.com/church.jpg";
  cfg.reception.image = "https://example.com/venue.jpg";
  const html = TemplateEngine.generateHTML(cfg);
  assert.ok(html.includes('src="https://example.com/church.jpg"'));
  assert.ok(html.includes('src="https://example.com/venue.jpg"'));
  assert.ok(html.includes('alt="Lugar de la Ceremonia"'));
  assert.ok(html.includes('alt="Lugar de la Recepción"'));
});

it("Clearing photo restores fallback layout without broken placeholders", () => {
  const cfg = JSON.parse(JSON.stringify(TemplateEngine.defaultConfig));
  cfg.ceremony.image = "https://example.com/church.jpg";
  let html = TemplateEngine.generateHTML(cfg);
  assert.ok(html.includes('src="https://example.com/church.jpg"'));
  cfg.ceremony.image = "";
  html = TemplateEngine.generateHTML(cfg);
  assert.strictEqual(html.includes('src="https://example.com/church.jpg"'), false);
  assert.strictEqual(html.includes('alt="Lugar de la Ceremonia"'), false);
});

it("invitacion-estudio.html contains upload inputs and clear buttons", () => {
  const html = fs.readFileSync("invitacion-estudio.html", "utf8");
  assert.ok(html.includes('id="inputCeremonyImage"'));
  assert.ok(html.includes('id="fileCeremonyImage"'));
  assert.ok(html.includes('id="btnClearCeremonyImage"'));
  assert.ok(html.includes('id="inputReceptionImage"'));
  assert.ok(html.includes('id="fileReceptionImage"'));
  assert.ok(html.includes('id="btnClearReceptionImage"'));
});

it("app.js has file upload handlers and bindings for ceremony and reception images", () => {
  const code = fs.readFileSync("app.js", "utf8");
  assert.ok(code.includes("id: 'inputCeremonyImage', path: 'ceremony.image'"));
  assert.ok(code.includes("id: 'inputReceptionImage', path: 'reception.image'"));
  assert.ok(code.includes("fileId: 'fileCeremonyImage'"));
  assert.ok(code.includes("fileId: 'fileReceptionImage'"));
});

console.log("\nResults: " + passed + " / 8 passed.\n");
if (passed < 8) process.exit(1);
