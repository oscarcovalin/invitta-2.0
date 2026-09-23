'use strict';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function dateInStudioLabel(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2})(?:\s+de\s+|\s*·\s*)([a-záéíóú]+)(?:,\s*|\s*·\s*|\s+de\s+)(\d{4})$/i);
  if (!match) return null;
  const month = MONTHS.indexOf(match[2].toLocaleLowerCase('es')) + 1;
  if (!month) return null;
  return `${match[3]}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}

function findPublicationDateConflicts(publicDocument) {
  const startsAt = publicDocument?.event?.startsAt;
  const eventDate = typeof startsAt === 'string' ? startsAt.match(/^(\d{4}-\d{2}-\d{2})T/)?.[1] : null;
  if (!eventDate) return [];
  return ['long', 'short'].filter((key) => {
    const labelDate = dateInStudioLabel(publicDocument?.dateLabels?.[key]);
    return labelDate && labelDate !== eventDate;
  }).map((key) => `dateLabels.${key}`);
}

module.exports = { findPublicationDateConflicts };
