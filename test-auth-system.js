const assert = require("assert");
const fs = require("fs");
const { EventVaultManager } = require("./event-vault-manager.js");
const { AuthManager } = require("./auth-manager.js");

console.log("\n?? Testing Hybrid Authentication & Security Engine...\n");
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

const evm = new EventVaultManager();
const auth = new AuthManager({ evm });

// 1. Superadmin Authentication
it("Superadmin logs in successfully with primary email and master password", () => {
  const res = auth.loginProfessional("admin@invitta.mx", "invitta2027");
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.session.role, "superadmin");
  assert.strictEqual(res.redirectUrl, "portal.html");
  assert.ok(res.session.token.startsWith("tok_admin_"));
});

it("Superadmin logs in successfully with alias 'admin'", () => {
  const res = auth.loginProfessional("admin", "invitta2027");
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.session.role, "superadmin");
});

it("Superadmin login fails with wrong password", () => {
  const res = auth.loginProfessional("admin", "wrongpass123");
  assert.strictEqual(res.success, false);
  assert.ok(res.error.includes("Credenciales"));
});

// 2. Planner B2B Authentication
it("Planner logs in successfully and retrieves assigned event route", () => {
  const res = auth.loginProfessional("planner@hacienda.com", "planner123");
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.session.role, "planner");
  assert.ok(res.redirectUrl.includes("event=boda-catalina-julian"));
  assert.ok(res.redirectUrl.includes("role=planner"));
});

it("Planner alias 'hacienda' works with correct password", () => {
  const res = auth.loginProfessional("hacienda", "planner123");
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.session.role, "planner");
});

// 3. Host PIN Authentication
it("Host logs in with valid Event Code (CATALINA-JULIAN) and 4-digit PIN (4821)", () => {
  const res = auth.loginHostByPin("CATALINA-JULIAN", "4821");
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.session.role, "host_premium");
  assert.strictEqual(res.event.slug, "boda-catalina-julian");
  assert.ok(res.redirectUrl.includes("event=boda-catalina-julian"));
  assert.ok(res.redirectUrl.includes("token=tok_cat_9823"));
});

it("Host login for Mis XV Años Valentina with valid PIN (7392)", () => {
  const res = auth.loginHostByPin("VALENTINA", "7392");
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.event.slug, "xv-valentina-2027");
});

it("Host login fails with wrong PIN", () => {
  const res = auth.loginHostByPin("CATALINA-JULIAN", "0000");
  assert.strictEqual(res.success, false);
  assert.ok(res.error.includes("PIN incorrecto"));
});

it("Host login fails with non-existent Event Code", () => {
  const res = auth.loginHostByPin("EVENTO_FANTASMA_XYZ", "1234");
  assert.strictEqual(res.success, false);
  assert.ok(res.error.includes("Código de evento no encontrado"));
});

// 4. Session & Logout Lifecycle
it("Session persists and isSuperadmin helper returns true after admin login", () => {
  auth.loginProfessional("admin", "invitta2027");
  assert.strictEqual(auth.isSuperadmin(), true);
  
  auth.logout();
  assert.strictEqual(auth.isSuperadmin(), false);
  assert.strictEqual(auth.getCurrentSession(), null);
});

console.log("\nResults: " + passed + " / 10 passed.\n");
if (passed < 10) process.exit(1);
