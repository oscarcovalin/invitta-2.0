const { validateInvitationDocument } = require('../invitation-document.js');

class InvitationRepositoryError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'InvitationRepositoryError';
    this.code = code;
  }
}

async function saveInvitationRevision(client, document, { userId } = {}) {
  if (!client || typeof client.from !== 'function') {
    throw new InvitationRepositoryError('INVALID_CLIENT', 'An authenticated Supabase client is required.');
  }
  if (typeof userId !== 'string' || !userId) {
    throw new InvitationRepositoryError('INVALID_USER', 'An authenticated user ID is required.');
  }

  const validation = validateInvitationDocument(document);
  if (!validation.valid) {
    throw new InvitationRepositoryError(
      'INVALID_INVITATION_DOCUMENT',
      `The invitation document is invalid: ${validation.errors.join(' ')}`
    );
  }

  const { data, error } = await client
    .from('invitation_documents')
    .insert({
      project_id: document.projectId,
      revision: document.revision,
      schema_version: document.schemaVersion,
      document,
      created_by: userId
    })
    .select('id, project_id, revision, schema_version, created_by, created_at')
    .single();

  if (error) {
    throw new InvitationRepositoryError(
      'REVISION_SAVE_FAILED',
      'The invitation revision could not be saved.',
      { cause: error }
    );
  }
  return data;
}

module.exports = { InvitationRepositoryError, saveInvitationRevision };
