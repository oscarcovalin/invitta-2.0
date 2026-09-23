'use strict';

const { projectPublicInvitation } = require('./public-invitation-projection.cjs');
const { collectPublicationImages } = require('./publication-image-manifest.cjs');
const { findSamplePublicationFields } = require('./publication-content-preflight.cjs');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildPublicationCandidate({ documentId, document } = {}) {
  if (!UUID.test(documentId || '') || !document || !UUID.test(document.projectId || '')
      || document.schemaVersion !== 1 || !Number.isSafeInteger(document.revision)
      || document.revision < 1) throw new TypeError('Invalid publication source.');

  const content = projectPublicInvitation(document);
  const sampleFields = findSamplePublicationFields(content);
  if (sampleFields.length > 0) {
    const error = new TypeError('Publication contains Studio sample data.');
    error.fields = sampleFields;
    throw error;
  }

  const images = collectPublicationImages(document);
  return {
    source: { projectId: document.projectId, documentId, revision: document.revision },
    publicArtifact: {
      schemaVersion: 1,
      content,
      imageFields: images.map(({ field }) => field),
      bundledImages: images.filter(({ publicPath }) => publicPath).map(({ field, publicPath }) => ({ field, publicPath })),
    },
    privateImages: images.filter(({ storagePath }) => storagePath).map(({ field, storagePath }) => ({ field, storagePath })),
  };
}

module.exports = { buildPublicationCandidate };
