const assert = require('assert');
const fixture = require('./fixtures/invitation-document.v1.json');
const {
  publishInvitationRevision,
  saveInvitationRevision
} = require('./lib/invitation-project-repository.js');

function createClient(result) {
  const calls = [];
  return {
    calls,
    from(table) {
      calls.push({ method: 'from', table });
      return {
        insert(payload) {
          calls.push({ method: 'insert', payload });
          return {
            select(columns) {
              calls.push({ method: 'select', columns });
              return { single: async () => result };
            }
          };
        }
      };
    }
  };
}

function createPublishClient(result) {
  const calls = [];
  return {
    calls,
    from(table) {
      calls.push({ method: 'from', table });
      return {
        update(payload) {
          calls.push({ method: 'update', payload });
          return {
            eq(column, value) {
              calls.push({ method: 'eq', column, value });
              return {
                select(columns) {
                  calls.push({ method: 'select', columns });
                  return { single: async () => result };
                }
              };
            }
          };
        }
      };
    }
  };
}

(async () => {
  const savedRow = { id: 'revision-id', project_id: fixture.projectId, revision: fixture.revision };
  const client = createClient({ data: savedRow, error: null });
  const result = await saveInvitationRevision(client, fixture, { userId: 'user-id' });
  assert.deepStrictEqual(result, savedRow);
  assert.deepStrictEqual(client.calls[1].payload, {
    project_id: fixture.projectId,
    revision: fixture.revision,
    schema_version: fixture.schemaVersion,
    document: fixture,
    created_by: 'user-id'
  });

  const invalidClient = createClient({ data: null, error: null });
  const invalid = structuredClone(fixture);
  invalid.schemaVersion = 99;
  await assert.rejects(
    saveInvitationRevision(invalidClient, invalid, { userId: 'user-id' }),
    (error) => error.code === 'INVALID_INVITATION_DOCUMENT'
  );
  assert.strictEqual(invalidClient.calls.length, 0);

  const deniedClient = createClient({ data: null, error: { code: '42501', message: 'denied' } });
  await assert.rejects(
    saveInvitationRevision(deniedClient, fixture, { userId: 'user-id' }),
    (error) => error.code === 'REVISION_SAVE_FAILED' && error.cause.code === '42501'
  );

  const documentId = '30000000-0000-4000-8000-000000000001';
  const publishedRow = { id: fixture.projectId, published_document_id: documentId, status: 'published' };
  const publishClient = createPublishClient({ data: publishedRow, error: null });
  const published = await publishInvitationRevision(publishClient, {
    projectId: fixture.projectId,
    documentId
  });
  assert.deepStrictEqual(published, publishedRow);
  assert.deepStrictEqual(publishClient.calls[1], {
    method: 'update',
    payload: { published_document_id: documentId, status: 'published' }
  });

  const deniedPublishClient = createPublishClient({ data: null, error: { code: '42501' } });
  await assert.rejects(
    publishInvitationRevision(deniedPublishClient, {
      projectId: fixture.projectId,
      documentId
    }),
    (error) => error.code === 'REVISION_PUBLISH_FAILED' && error.cause.code === '42501'
  );

  console.log('Invitation revisions validate before persistence and preserve RLS errors.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
