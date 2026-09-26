/**
 * Invitta 2.0 — Webhook Handler para Clip México
 * Validates the configured webhook secret before acknowledging notifications.
 * It does not reconcile orders or provide persistent idempotency yet.
 *
 * Seguridad implementada [C-1]:
 * - Verificación HMAC-SHA256 cuando Clip envía x-clip-signature o x-signature
 * - Fallback a token estático en query param ?secret=CLIP_WEBHOOK_SECRET
 * - timingSafeEqual para prevenir timing attacks
 * - Ventana anti-replay de 5 minutos si el payload incluye timestamp
 */
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  // Webhooks de pasarelas no generan CORS preflight — no exponer CORS aquí
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Utilice POST.' });
  }

  const clipSecret = process.env.CLIP_WEBHOOK_SECRET;

  if (!clipSecret) {
    // Sin secret configurado: log de advertencia y rechazo en producción
    console.error('❌ [PagoKit] CLIP_WEBHOOK_SECRET no configurado. Rechazando webhook por seguridad.');
    return res.status(500).json({ error: 'Servidor de webhooks no configurado correctamente.' });
  }

  // ── VERIFICACIÓN CRIPTOGRÁFICA ────────────────────────────────────────────
  // Capturar el raw body para HMAC (antes de cualquier parse)
  const rawBody = typeof req.body === 'string'
    ? req.body
    : JSON.stringify(req.body || {});

  const receivedSig = (
    req.headers['x-clip-signature'] ||
    req.headers['x-signature'] ||
    ''
  ).replace(/^sha256=/, '').toLowerCase();

  if (receivedSig) {
    // Modo HMAC: Clip envía la firma en el header
    const expectedSig = crypto
      .createHmac('sha256', clipSecret)
      .update(rawBody, 'utf8')
      .digest('hex');

    let signaturesMatch = false;
    try {
      // timingSafeEqual requiere buffers de igual longitud
      signaturesMatch = crypto.timingSafeEqual(
        Buffer.from(receivedSig.padEnd(64, '0'), 'hex'),
        Buffer.from(expectedSig, 'hex')
      );
    } catch (_) {
      signaturesMatch = false;
    }

    if (!signaturesMatch) {
      console.error('❌ [PagoKit] Firma HMAC de Clip inválida. Webhook rechazado.');
      return res.status(401).json({ error: 'Firma criptográfica inválida.' });
    }
    console.log('✅ [PagoKit] Firma HMAC de Clip verificada correctamente.');
  } else {
    // Modo token estático: validar ?secret=CLIP_WEBHOOK_SECRET en la URL
    const querySecret = req.query?.secret || req.query?.token || '';
    let tokenMatch = false;
    try {
      tokenMatch = crypto.timingSafeEqual(
        Buffer.from(querySecret.padEnd(64, '\0')),
        Buffer.from(clipSecret.padEnd(64, '\0'))
      );
    } catch (_) {
      tokenMatch = false;
    }

    if (!tokenMatch) {
      console.error('❌ [PagoKit] Token de webhook Clip inválido. Webhook rechazado.');
      return res.status(401).json({ error: 'Token de webhook inválido.' });
    }
    console.log('✅ [PagoKit] Token estático de webhook Clip verificado.');
  }

  // ── PARSE DEL BODY ────────────────────────────────────────────────────────
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  body = body || {};

  // ── ANTI-REPLAY (ventana de 5 minutos) ───────────────────────────────────
  const eventTimestamp = body.created_at || body.timestamp || body.ts;
  if (eventTimestamp) {
    const eventTime = Math.floor(new Date(eventTimestamp).getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);
    if (isNaN(eventTime) || Math.abs(now - eventTime) > 300) {
      console.error('❌ [PagoKit] Webhook Clip fuera de ventana de 5 minutos. Posible replay attack.');
      return res.status(401).json({ error: 'Evento fuera de la ventana de tiempo permitida.' });
    }
  }

  // ── PROCESAMIENTO DEL EVENTO ──────────────────────────────────────────────
  const eventType = body.event_type || body.type || body.resource || 'unknown';
  const data = body.data || body.payload || body;
  const isCheckout = body.resource === 'CHECKOUT';
  const isRefund = body.resource === 'REFUND';
  const paymentRequestId = isCheckout ? body.payment_request_id : null;
  const paymentId = (isCheckout || isRefund) ? body.transaction_id : (data.id || data.payment_id || body.id);
  const resourceStatus = String(body.resource_status || '').toLowerCase();
  const status = isCheckout ? resourceStatus
    : isRefund ? `refund_${resourceStatus}`
      : String(data.status || body.status || '').toLowerCase();
  const metadata = data.metadata || body.metadata || {};

  const isApproved = isCheckout ? status === 'completed' : !isRefund && (
    status === 'approved' ||
    status === 'paid' ||
    status === 'success' ||
    status === 'completed' ||
    eventType.includes('approved')
  );

  if (isApproved) {
    console.log(`✅ [PagoKit] Checkout Clip completado: solicitud=${paymentRequestId || 'N/A'}, transacción=${paymentId || 'N/A'}, referencia=${body.me_reference_id || metadata.me_reference_id || 'N/A'}`);
    // No activar servicios sin conciliar payment_request_id con un pedido persistido.
  } else {
    console.log(`ℹ️ [PagoKit] Evento Clip "${eventType}" con estado: "${status}"`);
  }

  return res.status(200).json({
    received: true,
    provider: 'clip',
    status,
    paymentId: paymentId || null,
    paymentRequestId: paymentRequestId || null,
    timestamp: new Date().toISOString()
  });
};

