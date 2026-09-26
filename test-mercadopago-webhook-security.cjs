const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const handler = require('./api-handlers/webhooks/mercadopago.js');
const previousSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
const previousToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
const previousFetch = global.fetch;

async function send(req) {
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader() {},
  };
  await handler({ method: 'POST', query: {}, headers: {}, body: {}, ...req }, res);
  return res;
}

function signedRequest(type = 'payment') {
  const ts = String(Math.floor(Date.now() / 1000));
  const requestId = 'test-request';
  const dataId = '123456789';
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const signature = crypto.createHmac('sha256', 'test-webhook-secret').update(manifest).digest('hex');
  return {
    headers: { 'x-signature': `ts=${ts},v1=${signature}`, 'x-request-id': requestId },
    body: { type, data: { id: dataId } },
  };
}

(async () => {
  try {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    const unconfigured = await send(signedRequest());
    assert.equal(unconfigured.statusCode, 503);
    assert.notEqual(unconfigured.body.verified, true);

    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'test-webhook-secret';
    const malformed = signedRequest();
    malformed.headers['x-signature'] = malformed.headers['x-signature'].replace(/v1=.*/, 'v1=xyz');
    assert.equal((await send(malformed)).statusCode, 401);

    const noPaymentToken = await send(signedRequest());
    assert.equal(noPaymentToken.statusCode, 503);
    assert.notEqual(noPaymentToken.body.verified, true);

    process.env.MERCADOPAGO_ACCESS_TOKEN = 'test-access-token';
    let paymentReads = 0;
    global.fetch = async (url, options) => {
      paymentReads++;
      assert.equal(url, 'https://api.mercadopago.com/v1/payments/123456789');
      assert.equal(options.headers.Authorization, 'Bearer test-access-token');
      return { ok: true, json: async () => ({ id: 123456789, status: 'approved' }) };
    };
    const confirmedPayment = await send(signedRequest());
    assert.equal(confirmedPayment.statusCode, 200);
    assert.equal(confirmedPayment.body.verified, true);
    assert.equal(paymentReads, 1);

    global.fetch = async () => ({ ok: false, status: 503 });
    assert.equal((await send(signedRequest())).statusCode, 503);
    global.fetch = async () => ({ ok: true, json: async () => ({ id: 42, status: 'approved' }) });
    assert.equal((await send(signedRequest())).statusCode, 503);

    const authenticatedNotification = await send(signedRequest('test'));
    assert.equal(authenticatedNotification.statusCode, 200);
    assert.equal(authenticatedNotification.body.verified, true);
    console.log('Mercado Pago webhook fails closed without verification.');
  } finally {
    if (previousSecret === undefined) delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    else process.env.MERCADOPAGO_WEBHOOK_SECRET = previousSecret;
    if (previousToken === undefined) delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    else process.env.MERCADOPAGO_ACCESS_TOKEN = previousToken;
    global.fetch = previousFetch;
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
