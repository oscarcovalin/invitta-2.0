const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const handler = require('./api-handlers/webhooks/clip.cjs');
const priorSecret = process.env.CLIP_WEBHOOK_SECRET;

async function send(payload) {
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', 'test-clip-secret').update(body).digest('hex');
  const response = {
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
  await handler({ method: 'POST', headers: { 'x-clip-signature': signature }, body, query: {} }, response);
  return response;
}

(async () => {
  try {
    process.env.CLIP_WEBHOOK_SECRET = 'test-clip-secret';
    const completed = await send({
      id: 'notification-1',
      resource: 'CHECKOUT',
      resource_status: 'COMPLETED',
      payment_request_id: 'request-1',
      transaction_id: 'transaction-1',
      me_reference_id: 'order-1',
    });
    assert.equal(completed.statusCode, 200);
    assert.equal(completed.body.status, 'completed');
    assert.equal(completed.body.paymentRequestId, 'request-1');
    assert.equal(completed.body.paymentId, 'transaction-1');

    const refund = await send({
      id: 'notification-2',
      resource: 'REFUND',
      resource_status: 'APPROVED',
      payment_request_id: 'request-1',
    });
    assert.equal(refund.statusCode, 200);
    assert.notEqual(refund.body.status, 'approved');
    console.log('Clip checkout and refund notifications use their documented identifiers.');
  } finally {
    if (priorSecret === undefined) delete process.env.CLIP_WEBHOOK_SECRET;
    else process.env.CLIP_WEBHOOK_SECRET = priorSecret;
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
