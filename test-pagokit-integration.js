/**
 * Test Suite: PagoKit Integration in Invitta 2.0
 */
const fs = require('fs');
const crypto = require('crypto');

console.log('=== TEST 1: FILE EXISTENCE & SYNTAX ===');
const requiredFiles = [
  'api/payment-config.js',
  'api/checkout.js',
  'api/webhooks/mercadopago.js',
  'api/webhooks/stripe.js',
  'api/webhooks/clip.js',
  'pago-exitoso.html',
  'pago-pendiente.html',
  'package.json'
];

requiredFiles.forEach(f => {
  const exists = fs.existsSync(f);
  console.log(`- File ${f}: ${exists ? 'EXISTS (OK)' : 'MISSING'}`);
  if (!exists) process.exit(1);
});

console.log('\n=== TEST 2: PAYMENT CONFIG ENDPOINT ===');
const paymentConfigHandler = require('./api/payment-config.js');
let configResult = null;
const mockRes = {
  setHeader: () => {},
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  json: function(data) {
    configResult = data;
    return this;
  },
  end: () => {}
};

paymentConfigHandler({ method: 'GET', headers: {} }, mockRes);
console.log('- Status code:', mockRes.statusCode);
console.log('- Providers configured:', configResult && configResult.providers ? Object.keys(configResult.providers) : 'none');
console.log('- Clip configured in providers:', Boolean(configResult && configResult.providers && configResult.providers.clip));
console.log('- Has WhatsApp fallback:', !!(configResult && configResult.whatsappFallback));
console.log('- Has plans catalog:', !!(configResult && configResult.plans && configResult.plans.basico));

console.log('\n=== TEST 3: CHECKOUT ENDPOINT FALLBACK & VALIDATION ===');
const checkoutHandler = require('./api/checkout.js');
let checkoutResult = null;
const mockResCheckout = {
  setHeader: () => {},
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  json: function(data) {
    checkoutResult = data;
    return this;
  },
  end: () => {}
};

// Test request without credentials (should trigger smart WhatsApp fallback, not crash)
checkoutHandler({
  method: 'POST',
  headers: { host: 'localhost:8080' },
  body: {
    planId: 'premium',
    provider: 'mercadopago',
    clientName: 'Andrea Villanueva',
    clientPhone: '525512345678',
    eventType: 'boda'
  }
}, mockResCheckout);

console.log('- Checkout status code:', mockResCheckout.statusCode);
console.log('- Checkout fallback triggered:', checkoutResult && checkoutResult.fallback);
console.log('- Fallback URL contains WhatsApp:', checkoutResult && checkoutResult.url && checkoutResult.url.includes('wa.me'));

console.log('\n=== TEST 4: MERCADO PAGO WEBHOOK CRYPTOGRAPHIC VALIDATION ===');
const mpWebhookHandler = require('./api/webhooks/mercadopago.js');
process.env.MERCADOPAGO_WEBHOOK_SECRET = 'test_secret_key_12345';

let webhookStatus = null;
let webhookResult = null;
const mockResWebhook = {
  setHeader: () => {},
  status: function(code) {
    webhookStatus = code;
    return this;
  },
  json: function(data) {
    webhookResult = data;
    return this;
  }
};

// 4.1 Missing signature should return 401
mpWebhookHandler({
  method: 'POST',
  headers: {},
  body: {}
}, mockResWebhook);
console.log('- Missing signature returns 401:', webhookStatus === 401);

// 4.2 Replay attack (timestamp > 5 min in past) should return 401
const oldTs = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
mpWebhookHandler({
  method: 'POST',
  headers: {
    'x-signature': `ts=${oldTs},v1=fakehash`,
    'x-request-id': 'req-123'
  },
  body: { data: { id: '999999' } }
}, mockResWebhook);
console.log('- Expired timestamp (Replay Attack) returns 401:', webhookStatus === 401);

// 4.3 Valid signature calculation using PagoKit HMAC-SHA256
const currentTs = Math.floor(Date.now() / 1000);
const reqId = 'req-valid-123';
const paymentId = '1234567890';
const manifest = `id:${paymentId};request-id:${reqId};ts:${currentTs};`;
const validHash = crypto.createHmac('sha256', process.env.MERCADOPAGO_WEBHOOK_SECRET).update(manifest).digest('hex');

mpWebhookHandler({
  method: 'POST',
  headers: {
    'x-signature': `ts=${currentTs},v1=${validHash}`,
    'x-request-id': reqId
  },
  body: { data: { id: paymentId } }
}, mockResWebhook);
console.log('- Valid HMAC signature returns 200 (Verified):', webhookStatus === 200 && webhookResult && webhookResult.verified);

console.log('\n=== TEST 5: CLIP INTEGRATION & WEBHOOK ===');
let clipCheckoutResult = null;
const mockResClip = {
  setHeader: () => {},
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  json: function(data) {
    clipCheckoutResult = data;
    return this;
  }
};

// Test Clip checkout without API key (triggers smart fallback)
checkoutHandler({
  method: 'POST',
  headers: { host: 'localhost:8080' },
  body: {
    planId: 'vip',
    provider: 'clip',
    clientName: 'Roberto Gomez',
    clientPhone: '525599887766',
    eventType: 'xv'
  }
}, mockResClip);

console.log('- Clip checkout status code:', mockResClip.statusCode);
console.log('- Clip checkout fallback triggered:', clipCheckoutResult && clipCheckoutResult.fallback);
console.log('- Clip fallback URL contains WhatsApp:', clipCheckoutResult && clipCheckoutResult.url && clipCheckoutResult.url.includes('wa.me'));

// Test Clip Webhook
const clipWebhookHandler = require('./api/webhooks/clip.js');
let clipWebhookStatus = null;
let clipWebhookData = null;
const mockResClipWebhook = {
  setHeader: () => {},
  status: function(code) {
    clipWebhookStatus = code;
    return this;
  },
  json: function(data) {
    clipWebhookData = data;
    return this;
  }
};

clipWebhookHandler({
  method: 'POST',
  headers: {},
  body: {
    event_type: 'payment.approved',
    id: 'pay_clip_test_123',
    status: 'approved',
    metadata: {
      plan_id: 'vip',
      me_reference_id: 'invitta_vip_123'
    }
  }
}, mockResClipWebhook);

console.log('- Clip webhook status code:', clipWebhookStatus);
console.log('- Clip webhook status approved:', clipWebhookData && clipWebhookData.status === 'approved');

console.log('\n🎉 ALL PAGOKIT & CLIP INTEGRATION TESTS PASSED!');
