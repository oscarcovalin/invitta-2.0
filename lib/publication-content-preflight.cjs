'use strict';

// Exact values shipped in Studio's defaultConfig. This is not a general
// placeholder detector and never substitutes an editorial review.
const samples = new Map([
  ['content.primaryName', 'Catalina'],
  ['content.secondaryName', 'Julián'],
  ['giftRegistry.bank.holder', 'Catalina Martínez Ruiz'],
  ['giftRegistry.bank.clabe', '0121 8001 2345 6789 01'],
  ['whatsappNumber', '5215512345678'],
  ['whatsappHosts.phone', '5215512345678'],
  ['lodging.hotels.code', 'BODA2027'],
  ['sharedAlbum.accessCode', 'BODA2027'],
]);

function findSamplePublicationFields(publicDocument) {
  const found = [];
  const check = (path, value, samplePath = path) => {
    if (typeof value === 'string' && value.trim() === samples.get(samplePath)) found.push(path);
  };
  check('content.primaryName', publicDocument?.content?.primaryName);
  check('content.secondaryName', publicDocument?.content?.secondaryName);
  check('giftRegistry.bank.holder', publicDocument?.giftRegistry?.bank?.holder);
  check('giftRegistry.bank.clabe', publicDocument?.giftRegistry?.bank?.clabe);
  check('whatsappNumber', publicDocument?.whatsappNumber);
  publicDocument?.whatsappHosts?.forEach((host, index) => {
    check(`whatsappHosts[${index}].phone`, host?.phone, 'whatsappHosts.phone');
  });
  publicDocument?.lodging?.hotels?.forEach((hotel, index) => {
    check(`lodging.hotels[${index}].code`, hotel?.code, 'lodging.hotels.code');
  });
  check('sharedAlbum.accessCode', publicDocument?.sharedAlbum?.accessCode);
  return found;
}

module.exports = { findSamplePublicationFields };
