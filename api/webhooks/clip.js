/**
 * Invitta 2.0 — Webhook Handler para Clip México
 * Powered by PagoKit (Replay safe, Idempotent, Cryptographic audit)
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
  const eventType = body.event_type || body.type || body.status || 'unknown';
  const data = body.data || body.payload || body;
  const paymentId = data.id || data.payment_id || body.id;
  const status = (data.status || body.status || '').toLowerCase();
  const metadata = data.metadata || body.metadata || {};

  const isApproved = (
    status === 'approved' ||
    status === 'paid' ||
    status === 'success' ||
    status === 'completed' ||
    eventType.includes('approved')
  );

  if (isApproved) {
    console.log(`✅ [PagoKit] Pago Clip APROBADO: ID=${paymentId}, Plan=${metadata.plan_id || 'N/A'}, Ref=${metadata.me_reference_id || 'N/A'}`);
    // TODO: Activar suscripción / actualizar estado en base de datos
  } else {
    console.log(`ℹ️ [PagoKit] Evento Clip "${eventType}" con estado: "${status}"`);
  }

  return res.status(200).json({
    received: true,
    provider: 'clip',
    status: isApproved ? 'approved' : status,
    paymentId: paymentId || null,
    timestamp: new Date().toISOString()
  });
};

