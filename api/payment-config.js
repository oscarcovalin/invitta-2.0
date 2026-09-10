/**
 * Invitta 2.0 — Payment Configuration Endpoint
 * Powered by PagoKit standard architecture
 */
module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const mpEnabled = Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
  const stripeEnabled = Boolean(process.env.STRIPE_SECRET_KEY);
  const clipEnabled = Boolean(process.env.CLIP_API_KEY);

  const plans = {
    basico: {
      id: 'basico',
      name: 'Plan Básico · Invitta',
      price: 2500,
      currency: 'MXN',
      guestsLimit: 80,
      description: 'Invitación digital de alta gama con sobre digital, música, mapa, mesa de regalos y RSVP por WhatsApp.'
    },
    premium: {
      id: 'premium',
      name: 'Plan Premium · Invitta',
      price: 4800,
      currency: 'MXN',
      guestsLimit: 200,
      description: 'Plataforma integral con Organizador de mesas 2D, pases QR individuales, escáner de acceso y álbum colaborativo.'
    },
    b2b: {
      id: 'b2b',
      name: 'Plan Planner B2B · Invitta',
      price: 0,
      currency: 'MXN',
      description: 'Solución multievento para salones y wedding planners. Cotización personalizada.'
    }
  };

  return res.status(200).json({
    active: true,
    providers: {
      clip: {
        enabled: true,
        businessLink: process.env.CLIP_PAYMENT_LINK || 'https://www.clip.mx/@cinewed',
        sandbox: false
      }
    },
    whatsappFallback: process.env.WHATSAPP_NUMBER || '525566790073',
    plans
  });
};
