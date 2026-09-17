const ALLOWED_ORIGINS = [
  'https://invitta-2-0.vercel.app',
  'https://invitta-v2-production.vercel.app',
  'https://invitta.vercel.app',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:3000'
];

export default async function handler(req, res) {
  // Configurar CORS
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Ingresa tu usuario y contraseña' });
    }

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    // Environment variables - No plaintext fallbacks for security
    const superAdminPassword = process.env.SUPERADMIN_PASSWORD;
    const plannerPassword1 = process.env.PLANNER_HACIENDA_PASSWORD;
    const plannerPassword2 = process.env.PLANNER_DIAMANTE_PASSWORD;

    if (!superAdminPassword || !plannerPassword1 || !plannerPassword2) {
      console.error('[Auth Security] Faltan variables de entorno para contraseñas.');
      return res.status(500).json({ success: false, error: 'Configuración del servidor incompleta (Missing Auth Secrets).' });
    }

    // 1. Validar Superadmin
    const superadminAliases = ['admin@invitta.mx', 'admin', 'oscar', 'superadmin'];
    
    if (superadminAliases.includes(cleanUser) && cleanPass === superAdminPassword) {
      const session = {
        role: 'superadmin',
        username: 'admin@invitta.mx',
        name: 'Administrador General',
        token: 'tok_admin_' + Math.random().toString(36).substring(2, 9),
        createdAt: new Date().toISOString()
      };
      return res.status(200).json({ success: true, session, redirectUrl: 'portal.html' });
    }

    // 2. Validar Planners B2B
    // In a real database this would be a lookup. We simulate the array here securely.
    const planners = [
      {
        id: 'pl_hacienda_01',
        username: 'planner@hacienda.com',
        aliases: ['hacienda', 'planner_hacienda'],
        password: plannerPassword1,
        role: 'planner',
        name: 'Coordinación Hacienda San José',
        assignedEvents: ['boda-catalina-julian']
      },
      {
        id: 'pl_diamante_02',
        username: 'eventos@diamantereal.com',
        aliases: ['diamante', 'planner_diamante'],
        password: plannerPassword2,
        role: 'planner',
        name: 'Eventos Salón Diamante Real',
        assignedEvents: ['xv-valentina-2027']
      }
    ];

    const planner = planners.find(p => 
      (p.username.toLowerCase() === cleanUser || (p.aliases && p.aliases.includes(cleanUser))) &&
      p.password === cleanPass
    );

    if (planner) {
      const primaryEvent = planner.assignedEvents && planner.assignedEvents[0] ? planner.assignedEvents[0] : 'boda-catalina-julian';
      const session = {
        role: 'planner',
        username: planner.username,
        name: planner.name,
        assignedEvents: planner.assignedEvents || [],
        token: 'tok_planner_' + Math.random().toString(36).substring(2, 9),
        createdAt: new Date().toISOString()
      };
      return res.status(200).json({
        success: true,
        session,
        redirectUrl: `mesas?event=${primaryEvent}&role=planner`
      });
    }

    // Invalid credentials
    return res.status(401).json({ success: false, error: 'Credenciales inválidas. Verifica tu usuario y contraseña.' });

  } catch (error) {
    console.error('Auth API Error:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
}
