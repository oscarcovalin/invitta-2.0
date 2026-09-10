const assert = require("assert");
const fs = require("fs");
const { EventVaultManager } = require("./event-vault-manager.js");

console.log("\n🧪 Testing Fast Event Code & PIN Access Engine...\n");
let passed = 0;
function it(desc, fn) {
  try {
    fn();
    console.log("  ✅ PASS: " + desc);
    passed++;
  } catch(e) {
    console.error("  ❌ FAIL: " + desc, e.message);
  }
}

const evm = new EventVaultManager();

it("Matches event by exact slug", () => {
  const res = evm.findEventByCode("boda-catalina-julian");
  assert.ok(res, "Result found");
  assert.strictEqual(res.event.slug, "boda-catalina-julian");
  assert.ok(res.redirectUrl.includes("event=boda-catalina-julian"));
});

it("Matches event by uppercase short code (CATALINA-JULIAN)", () => {
  const res = evm.findEventByCode("CATALINA-JULIAN");
  assert.ok(res, "Result found");
  assert.strictEqual(res.event.slug, "boda-catalina-julian");
});

it("Matches event by single name (VALENTINA)", () => {
  const res = evm.findEventByCode("VALENTINA");
  assert.ok(res, "Result found");
  assert.strictEqual(res.event.slug, "xv-valentina-2027");
});

it("Matches event by secret token", () => {
  const res = evm.findEventByCode("tok_cat_9823");
  assert.ok(res, "Result found");
  assert.strictEqual(res.event.slug, "boda-catalina-julian");
});

it("Parses full magic link pasted into input", () => {
  const res = evm.findEventByCode("https://invitta-v2-production.vercel.app/organizador-mesas.html?event=xv-valentina-2027&role=host_premium&token=tok_val_1042");
  assert.ok(res, "Result found");
  assert.strictEqual(res.event.slug, "xv-valentina-2027");
  assert.strictEqual(res.role, "host_premium");
});

it("Returns null for non-existent code", () => {
  const res = evm.findEventByCode("CODIGO-INVENTADO-999");
  assert.strictEqual(res, null);
});

it("index.html contains the code login portal and elements", () => {
  const html = fs.readFileSync("index.html", "utf8");
  assert.ok(html.includes('id="formEventCodeAccess"'), "formEventCodeAccess present");
  assert.ok(html.includes('id="inputClientEventCode"'), "inputClientEventCode present");
  assert.ok(html.includes('id="clientAccessFeedback"'), "clientAccessFeedback present");
  assert.ok(html.includes('Código:'), "Código badge present");
});

console.log("\nResults: " + passed + " / 7 passed.\n");
if (passed < 7) process.exit(1);
