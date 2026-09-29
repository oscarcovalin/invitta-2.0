'use strict';

const { publicationSupabaseOrigin } = require('./publication-supabase-origin.cjs');

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIETARY_OPTIONS = new Set(['', 'child_menu', 'allergies', 'vegan']);

class PublicRsvpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function invalidSubmission() {
  return new PublicRsvpError(422, 'Revisa los datos de tu confirmación e inténtalo de nuevo.');
}

function validateRsvpSubmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalidSubmission();
  const slug = typeof input.slug === 'string' ? input.slug.trim() : '';
  const submissionId = typeof input.submissionId === 'string' ? input.submissionId.trim() : '';
  const guestName = typeof input.guestName === 'string' ? input.guestName.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const attendance = input.attendance;
  const passes = Number(input.passes);
  const dietary = typeof input.dietary === 'string' ? input.dietary.trim() : '';

  if (!SLUG.test(slug) || slug.length > 128 || !UUID.test(submissionId)
      || guestName.length < 2 || guestName.length > 120 || /[\u0000-\u001f\u007f]/.test(guestName)
      || (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
      || !['confirmed', 'declined'].includes(attendance) || !Number.isInteger(passes)
      || !DIETARY_OPTIONS.has(dietary)) throw invalidSubmission();
  if ((attendance === 'confirmed' && (passes < 1 || passes > 5))
      || (attendance === 'declined' && passes !== 0)) throw invalidSubmission();

  return { slug, submissionId, guestName, email: email || null, attendance, passes, dietary: attendance === 'confirmed' ? (dietary || null) : null };
}

async function readRows(url, key, fetchImpl) {
  const response = await fetchImpl(url, { method: 'GET', redirect: 'error', headers: { apikey: key } });
  if (!response.ok) throw new PublicRsvpError(502, 'No fue posible guardar la confirmación. Intenta más tarde.');
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new PublicRsvpError(502, 'No fue posible guardar la confirmación. Intenta más tarde.');
  return rows;
}

async function submitPublicRsvp({ input, config, fetchImpl = fetch }) {
  const submission = validateRsvpSubmission(input);
  const base = publicationSupabaseOrigin(config);
  if (!base) throw new PublicRsvpError(503, 'El envío de confirmaciones no está configurado.');

  const projectParams = new URLSearchParams({ slug: `eq.${submission.slug}`, status: 'eq.published', select: 'id', limit: '1' });
  const project = (await readRows(`${base}/rest/v1/invitation_projects?${projectParams}`, config.secretKey, fetchImpl))[0];
  if (!project || project.status !== 'published' || !UUID.test(project.id || '')) {
    throw new PublicRsvpError(404, 'La invitación ya no está disponible para recibir respuestas.');
  }

  const insertParams = new URLSearchParams({ on_conflict: 'project_id,submission_id' });
  const response = await fetchImpl(`${base}/rest/v1/invitation_rsvps?${insertParams}`, {
    method: 'POST',
    redirect: 'error',
    headers: {
      apikey: config.secretKey,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify({
      project_id: project.id,
      submission_id: submission.submissionId,
      guest_name: submission.guestName,
      email: submission.email,
      attendance: submission.attendance,
      passes: submission.passes,
      dietary_option: submission.dietary,
    }),
  });
  if (!response.ok) {
    if (response.status === 404) throw new PublicRsvpError(503, 'El registro de respuestas aún no está habilitado.');
    throw new PublicRsvpError(502, 'No fue posible guardar la confirmación. Intenta más tarde.');
  }
  return { saved: true };
}

module.exports = { PublicRsvpError, submitPublicRsvp, validateRsvpSubmission };
