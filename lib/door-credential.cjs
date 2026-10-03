'use strict';
const { createHmac, createHash, timingSafeEqual } = require('node:crypto');
const { OperationError } = require('./project-operations-store.cjs');
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const FORMAT = new RegExp(`^IV2\\.(${UUID})\\.(${UUID})\\.([A-Za-z0-9_-]{43})$`);
function invalid() { return new OperationError(422, 'INVALID_CREDENTIAL', 'El código no es un boleto válido de este sistema.'); }
function signingKey(secret) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret.trim()) < 32) {
    throw new OperationError(503, 'NOT_CONFIGURED', 'La firma de boletos no está configurada.');
  }
  return secret;
}
function signCredential(projectId, ticketId, secret) {
  signingKey(secret);
  const prefix = `IV2.${projectId}.${ticketId}`;
  if (!new RegExp(`^IV2\\.${UUID}\\.${UUID}$`).test(prefix)) throw invalid();
  return `${prefix}.${createHmac('sha256', secret).update(prefix).digest('base64url')}`;
}
function verifyCredential(credential, secret) {
  signingKey(secret);
  const match = typeof credential === 'string' && FORMAT.exec(credential);
  if (!match) throw invalid();
  const expected = signCredential(match[1], match[2], secret);
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(credential))) throw invalid();
  return { projectId: match[1], ticketId: match[2] };
}
function digestCredential(credential) { return createHash('sha256').update(credential).digest('hex'); }
module.exports = { signCredential, verifyCredential, digestCredential };
