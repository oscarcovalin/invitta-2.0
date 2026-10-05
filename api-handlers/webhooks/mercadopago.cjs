/**
 * Invitta 2.0 — Mercado Pago Webhook Handler
 * Follows PagoKit Verification Standards:
 * 1. Cryptographic HMAC-SHA256 signature verification over (x-signature, x-request-id, data.id)
 * 2. Mandatory timestamp check against replay attacks (< 5 minutes)
 * 3. Re-fetch payment from Mercado Pago API (payload is never trusted blindly)
 * This endpoint acknowledges verified notifications; it does not fulfill orders.
 */
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido. Solo se acepta POST.' });
  }

  const signatureHeader = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'];
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('MERCADOPAGO_WEBHOOK_SECRET no configurado.');
    return res.status(503).json({ error: 'Verificación de webhook no disponible.' });
  }

  if (!signatureHeader || !requestId) {
    return res.status(401).json({ error: 'Faltan cabeceras x-signature o x-request-id obligatorias de Mercado Pago.' });
  }

  // Parsear ts y v1 del header x-signature (ej: ts=1700000000,v1=abc...)
  const parts = signatureHeader.split(',').reduce((acc, part) => {
    const [key, val] = part.split('=');
    if (key && val) acc[key.trim()] = val.trim();
    return acc;
  }, {});

  const ts = parts.ts;
  const v1 = parts.v1;

  if (!/^\d+$/.test(ts || '') || !/^[0-9a-f]{64}$/i.test(v1 || '')) {
    return res.status(401).json({ error: 'Formato de x-signature inválido.' });
  }

  // 1. REPLAY ATTACK MITIGATION (Estándar PagoKit: ventana máxima de 5 minutos)
  const currentTime = Math.floor(Date.now() / 1000);
  const eventTime = parseInt(ts, 10);
  if (isNaN(eventTime) || Math.abs(currentTime - eventTime) > 300) {
    return res.status(401).json({ error: 'Firma expirada o timestamp fuera de la ventana de tolerancia de 5 minutos.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  body = body || {};

  const query = req.query || {};
  const dataId = (body.data && body.data.id) || query['data.id'] || query.id;
  if (!dataId) {
    return res.status(400).json({ error: 'Falta el identificador de la notificación.' });
  }

  // 2. VERIFICACIÓN CRIPTOGRÁFICA HMAC SHA256 (Template PagoKit)
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const computedHash = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');

  const isValidSignature = crypto.timingSafeEqual(
    Buffer.from(v1, 'hex'),
    Buffer.from(computedHash, 'hex')
  );

  if (!isValidSignature) {
    console.error('❌ Firma de webhook de Mercado Pago no coincide.');
    return res.status(401).json({ error: 'Firma criptográfica inválida.' });
  }

  // 3. RE-FETCH AUTORITATIVO DE LA TRANSACCIÓN (Regla de oro PagoKit)
  const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (body.type === 'payment') {
    if (!mpToken) {
      return res.status(503).json({ error: 'Verificación de pago no disponible.' });
    }
    if (!/^\d+$/.test(String(dataId))) {
      return res.status(400).json({ error: 'Identificador de pago inválido.' });
    }
    try {
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { Authorization: `Bearer ${mpToken}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`Payment API returned ${response.status}`);
      const paymentInfo = await response.json();
      if (String(paymentInfo.id) !== String(dataId) || !paymentInfo.status) {
        throw new Error('Payment API returned an invalid payment');
      }

      console.log(`Pago Mercado Pago #${dataId} consultado. Estado: ${paymentInfo.status}`);
      
      // No activar invitaciones aquí: falta vinculación del pedido e idempotencia persistente.
    } catch (err) {
      console.error('Error re-consultando estado de pago en Mercado Pago:', err.message);
      return res.status(503).json({ error: 'No se pudo verificar el pago.' });
    }
  }

  return res.status(200).json({ received: true, verified: true });
};
