// api/invitacion/token.js
import { jwtVerify } from 'jose';

const GUEST_RECORDS = {
  'M03-MARTINEZ-4P': {
    familia: 'Familia Martínez Valdés',
    mesa: 3,
    pases: 4,
    datosRegalo: {
      banco: process.env.WEDDING_BANK_NAME || 'BBVA',
      cuenta: process.env.WEDDING_BANK_ACCOUNT || '0121 8001 2345 6789 01',
      titular: process.env.WEDDING_BANK_HOLDER || 'Catalina Martínez Ruiz',
    },
    corte: {
      padrinos: process.env.WEDDING_GODPARENTS_JSON
        ? JSON.parse(process.env.WEDDING_GODPARENTS_JSON)
        : ['Andrea & Roberto (Velación)', 'Sofía & Carlos (Lazo)'],
    },
    parents: { bride: ['Roberto Mart�nez', 'Elena de Mart�nez'], groom: ['Carlos Morales', 'Mar�a de Morales'] }, venue: { ceremonyMap: 'https://maps.google.com/?q=Parroquia+San+Rafael', ceremonyWaze: 'https://waze.com/ul?q=Parroquia+San+Rafael', receptionMap: 'https://maps.google.com/?q=Jard�n+Las+Magnolias', receptionWaze: 'https://waze.com/ul?q=Jard�n+Las+Magnolias',
      parroquia: process.env.WEDDING_VENUE_CHURCH || 'Parroquia de San Miguel Arcángel',
      salon: process.env.WEDDING_VENUE_RECEPTION || 'Hacienda Los Arcángeles',
    },
  },
  'TEST-FOLIO': {
    familia: 'Invitado Especial',
    mesa: 1,
    pases: 2,
    datosRegalo: { banco: 'BBVA', cuenta: '0121 8001 2345 6789 01', titular: 'Catalina Martínez Ruiz' },
    corte: { padrinos: ['Andrea & Roberto (Velación)', 'Sofía & Carlos (Lazo)'] },
    venue: { parroquia: 'Parroquia de San Miguel Arcángel', salon: 'Hacienda Los Arcángeles' },
  }
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const token = req.query.t;
  if (!token) {
    return res.status(400).json({ error: 'Falta el parámetro t' });
  }

  try {
    const secret = new TextEncoder().encode(process.env.INVITE_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const folio = payload.folio;

    // TODO: En producción, usar BD en lugar de objeto en memoria.
    const record = GUEST_RECORDS[folio] || GUEST_RECORDS['TEST-FOLIO'];
    if (!record) {
      return res.status(404).json({ error: 'Invitación no encontrada' });
    }

    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ folio, ...record });
  } catch (err) {
    return res.status(401).json({ error: 'Link de invitación inválido o vencido' });
  }
}
