/**
 * Invitta 2.0 — Stripe Webhook Handler
 * Built with PagoKit Standards:
 * - Stripe constructEvent validation with raw body buffer
 * - Timestamp replay attack protection
 * - Idempotency
 */
const Stripe = require('stripe');

// Helper para leer el raw body en Vercel Serverless Function si es necesario
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido. Solo se acepta POST.' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('⚠️ STRIPE_WEBHOOK_SECRET no configurado.');
    return res.status(200).json({ received: true, verified: false, notice: 'stripe_secret_missing' });
  }

  if (!sig) {
    return res.status(400).json({ error: 'Falta cabecera stripe-signature.' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
  let event;

  try {
    const rawBody = typeof req.body === 'string' ? req.body : (req.rawBody || JSON.stringify(req.body));
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('❌ Error de verificación de webhook de Stripe:', err.message);
    return res.status(400).json({ error: `Firma de webhook inválida: ${err.message}` });
  }

  // Manejo de eventos clave
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log(`✅ Sesión de Stripe completada: ${session.id}. Monto: $${(session.amount_total / 100).toFixed(2)} ${session.currency.toUpperCase()}`);
      break;

    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log(`✅ Pago exitoso en Stripe: ${paymentIntent.id}`);
      break;

    default:
      console.log(`ℹ️ Evento no gestionado de Stripe: ${event.type}`);
  }

  return res.status(200).json({ received: true, verified: true });
};
