/**
 * Invitta 2.0 — Unified Checkout Session Endpoint
 * Built following PagoKit patterns:
 * - Deterministic fee & provider handling
 * - Replay-safe metadata & idempotency support
 * - Graceful fallback to WhatsApp if credentials are not configured yet
 *
 * Seguridad aplicada:
 * [C-2] CORS restringido a dominios propios
 * [A-2] Sanitización y validación de todos los inputs con allowlists
 * [A-3] Eliminados Mercado Pago y Stripe — solo Clip México
 * [M-2] Mensajes de error genéricos al cliente
 * [M-3] BASE_URL desde variable de entorno, no desde headers del request
 */

const PLANS = {
  // Invitaciones Digitales
  basica: {
    id: 'basica',
    name: 'Invitación Básica / Esencial · Invitta',
    price: 399,
    currency: 'MXN',
    description: 'Diseño clásico personalizado con cuenta regresiva, mapas GPS y confirmación RSVP por WhatsApp.'
  },
  esencial: {
    id: 'esencial',
    name: 'Invitación Básica / Esencial · Invitta',
    price: 399,
    currency: 'MXN',
    description: 'Diseño clásico personalizado con cuenta regresiva, mapas GPS y confirmación RSVP por WhatsApp.'
  },
  premium: {
    id: 'premium',
    name: 'Invitación Premium con Música · Invitta',
    price: 699,
    currency: 'MXN',
    description: 'Diseño moderno con música ambiental, animaciones elegantes, galería interactiva y mesa de regalos.'
  },
  vip: {
    id: 'vip',
    name: 'Invitación VIP Experience · Invitta',
    price: 999,
    currency: 'MXN',
    description: 'La experiencia definitiva: sobre digital animado con lacre, pases QR individuales y álbum compartido.'
  },
  mesas: {
    id: 'mesas',
    name: 'Invitación VIP + Mesas 2D · Invitta 2.0',
    price: 2290,
    currency: 'MXN',
    description: 'Invitación digital de lujo completa + Organizador de mesas 2D drag and drop (hasta 150 invitados).'
  },
  full: {
    id: 'full',
    name: 'Invitta 2.0 Full Platform · Todo Incluido',
    price: 4890,
    currency: 'MXN',
    description: 'Suite profesional completa con escáner de acceso QR en puerta, generador express y hojas tácticas.'
  },
  basico: {
    id: 'basico',
    name: 'Plan Básico · Invitta 2.0',
    price: 2500,
    currency: 'MXN',
    description: 'Invitación digital de alta gama con sobre digital, música, mapa, mesa de regalos y RSVP por WhatsApp.'
  }
};

// [C-2] Dominios permitidos para CORS
const ALLOWED_ORIGINS = [
  'https://invitta-v2-production.vercel.app',
  'https://invitta.vercel.app',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:3000'
];

// [A-2] Tipos de evento permitidos (allowlist)
const VALID_EVENT_TYPES = [
  'boda', 'xv', 'quinceañera', 'graduacion', 'bautizo',
  'comunion', 'cumpleanos', 'corporativo', 'fiesta', 'otro'
];

// [A-2] Sanitización de campos de texto libre
function sanitizeText(value, maxLen = 200) {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>"'`;&\\]/g, '').trim().slice(0, maxLen);
}

// [A-2] Validación de email
function isValidEmail(email) {
  return typeof email === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) &&
    email.length <= 254;
}

// [A-2] Validación de fecha ISO YYYY-MM-DD
function isValidDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);
}

// [A-1] In-memory Rate Limiting (mitigación Serverless)
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minuto
const MAX_REQUESTS_PER_WINDOW = 5;
const ipRequestCounts = new Map();

// Limpiador periódico para evitar memory leaks en instancias cálidas
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of ipRequestCounts.entries()) {
    if (now - data.startTime > RATE_LIMIT_WINDOW_MS) {
      ipRequestCounts.delete(ip);
    }
  }
}, 300000).unref();

module.exports = async function handler(req, res) {
  // [A-1] Rate Limiting Check
  const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || 'unknown';
  if (clientIp !== 'unknown') {
    const now = Date.now();
    let rateData = ipRequestCounts.get(clientIp);

    if (!rateData || now - rateData.startTime > RATE_LIMIT_WINDOW_MS) {
      rateData = { count: 1, startTime: now };
    } else {
      rateData.count++;
    }
    ipRequestCounts.set(clientIp, rateData);

    if (rateData.count > MAX_REQUESTS_PER_WINDOW) {
      console.warn(`[PagoKit] 🚫 Rate limit excedido para IP: ${clientIp} (${rateData.count} reqs)`);
      return res.status(429).json({ error: 'Demasiadas peticiones. Por favor, intenta de nuevo en un minuto.' });
    }
  }

  // [C-2] CORS restringido — solo orígenes propios
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Idempotency-Key');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Utilice POST.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  body = body || {};

  // [A-2] Validación y sanitización estricta de todos los inputs
  const planId = sanitizeText(body.planId || 'basico', 20).toLowerCase();
  const provider = sanitizeText(body.provider || 'clip', 20).toLowerCase();

  // [A-3] Solo aceptar proveedor Clip — MP y Stripe eliminados
  if (provider !== 'clip') {
    return res.status(400).json({ error: 'Proveedor no soportado. Solo se acepta: clip.' });
  }

  const clientName = sanitizeText(body.clientName || 'Cliente Invitta', 100);
  const clientEmail = isValidEmail(body.clientEmail) ? body.clientEmail.slice(0, 254) : '';
  const clientPhone = typeof body.clientPhone === 'string'
    ? body.clientPhone.replace(/[^\d+\-\s()]/g, '').trim().slice(0, 20)
    : '';
  const eventType = VALID_EVENT_TYPES.includes((body.eventType || '').toLowerCase())
    ? body.eventType.toLowerCase()
    : 'boda';
  const eventDate = isValidDate(body.eventDate) ? body.eventDate : '';
  const projectId = sanitizeText(body.projectId || '', 50).replace(/[^a-zA-Z0-9_-]/g, '');

  const selectedPlan = PLANS[planId];
  if (!selectedPlan) {
    return res.status(400).json({
      error: 'Plan seleccionado inválido.',
      validPlans: Object.keys(PLANS)
    });
  }

  // [M-3] BASE_URL desde variable de entorno — nunca desde headers del request (SSRF prevention)
  const baseUrl = (process.env.BASE_URL || 'https://invitta-v2-production.vercel.app').replace(/\/$/, '');

  // Helper para generar URL de WhatsApp en caso de fallback
  const getWhatsAppFallback = () => {
    const defaultNumber = process.env.WHATSAPP_NUMBER || '525566790073';
    const text = encodeURIComponent(
      `¡Hola Invitta! Quiero contratar el *${selectedPlan.name}* ($${selectedPlan.price.toLocaleString('es-MX')} MXN).\n` +
      `• Nombre: ${clientName}\n` +
      `• Evento: ${eventType.toUpperCase()} (${eventDate || 'Fecha por confirmar'})\n` +
      `• WhatsApp: ${clientPhone || 'No especificado'}\n\n` +
      `Por favor compártanme los datos para realizar la transferencia / depósito directo ✨`
    );
    return `https://wa.me/${defaultNumber}?text=${text}`;
  };

  // ─── CLIP (único proveedor activo) ────────────────────────────────────────
  const clipApiKey = (process.env.CLIP_API_KEY || '').trim();
  let businessClipLink = process.env.CLIP_PAYMENT_LINK || 'https://www.clip.mx/@cinewed';
  if (selectedPlan.id === 'esencial' || selectedPlan.id === 'basica') {
    businessClipLink = 'https://pago.clip.mx/85a05e71-4ffc-46f7-bff2-ede8f616556d';
  }

  if (!clipApiKey) {
    // Sin API Key: redirigir directamente al Link de Negocio CineWed
    return res.status(200).json({
      provider: 'clip',
      id: `clip_business_${Date.now()}`,
      url: businessClipLink
    });
  }

  try {
    const webhookSecret = process.env.CLIP_WEBHOOK_SECRET
      ? `?secret=${encodeURIComponent(process.env.CLIP_WEBHOOK_SECRET)}`
      : '';

    const clipPayload = {
      amount: selectedPlan.price,
      currency: 'MXN',
      purchase_description: `${selectedPlan.name} · Invitta 2.0`,
      redirection_url: {
        success: `${baseUrl}/pago-exitoso.html?provider=clip&plan=${selectedPlan.id}`,
        error: `${baseUrl}/pago-pendiente.html?status=error&provider=clip`,
        default: `${baseUrl}/landing.html`
      },
      webhook_url: `${baseUrl}/api/webhooks/clip${webhookSecret}`,
      metadata: {
        me_reference_id: `invitta_${selectedPlan.id}_${Date.now()}`,
        event_type: eventType,
        project_id: projectId
      }
    };

    const clipSecretKey = (process.env.CLIP_SECRET_KEY || '').trim();
    const endpoint = 'https://api-gw.payclip.com/checkout';

    const authVariants = [];

    if (clipSecretKey) {
      authVariants.push({ 'Authorization': 'Basic ' + Buffer.from(`${clipApiKey}:${clipSecretKey}`).toString('base64') });
    } else if (clipApiKey.includes(':')) {
      authVariants.push({ 'Authorization': 'Basic ' + Buffer.from(clipApiKey).toString('base64') });
    }

    authVariants.push({ 'Authorization': 'Basic ' + Buffer.from(`${clipApiKey}:`).toString('base64') });

    if (!clipApiKey.includes(':') && clipApiKey.length > 20) {
      authVariants.push({ 'Authorization': 'Basic ' + clipApiKey });
    }

    authVariants.push({ 'Authorization': `Bearer ${clipApiKey}` });
    authVariants.push({ 'x-api-key': clipApiKey });

    let lastStatus = null;
    for (const authHeader of authVariants) {
      try {
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify(clipPayload)
        });
        const data = await resp.json();
        const checkoutUrl = data.payment_request_url || data.url || (data.data && data.data.payment_request_url);

        if (resp.ok && checkoutUrl) {
          console.log('✅ [PagoKit] Checkout Clip creado exitosamente');
          return res.status(200).json({
            provider: 'clip',
            id: data.id || `clip_${Date.now()}`,
            url: checkoutUrl
          });
        }
        // [M-2] Loguear internamente sin exponer al cliente
        lastStatus = resp.status;
        console.warn(`[PagoKit] Clip API retornó ${resp.status}`);
      } catch (fetchErr) {
        console.error('[PagoKit] Error de red con Clip API:', fetchErr.message);
      }
    }

    // Fallback al Link de Negocio CineWed
    console.log(`ℹ️ [PagoKit] Redirigiendo a Link de Negocio Clip (API status: ${lastStatus})`);
    return res.status(200).json({
      provider: 'clip',
      id: `clip_business_${Date.now()}`,
      url: businessClipLink
    });

  } catch (err) {
    // [M-2] No exponer detalles del error al cliente
    console.error('[PagoKit] Error inesperado en checkout:', err.message);
    return res.status(200).json({
      fallback: true,
      reason: 'GATEWAY_UNAVAILABLE',
      url: getWhatsAppFallback(),
      message: 'Hubo un detalle al conectar con la pasarela. Te atendemos de inmediato por WhatsApp.'
    });
  }
};
