'use strict';

// Exact values shipped in Studio's defaultConfig. This is not a general
// placeholder detector and never substitutes an editorial review.
const samples = new Map([
  ['content.title', 'Catalina & Julián'],
  ['content.primaryName', 'Catalina'],
  ['content.secondaryName', 'Julián'],
  ['event.startsAt', '2026-12-18T18:00:00-06:00'],
  ['dateLabels.long', '20 de Marzo, 2027'],
  ['dateLabels.short', '20 · Marzo · 2027'],
  ['story.title', 'Nuestra Historia'],
  ['story.subtitle', 'Un camino lleno de momentos inolvidables'],
  ['story.text', 'Todo comenzó con una mirada y una conversación que duró horas. Desde ese instante supimos que nuestras vidas estarían unidas para siempre. Hoy damos el paso más importante y queremos compartirlo contigo.'],
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
  check('content.title', publicDocument?.content?.title);
  check('content.primaryName', publicDocument?.content?.primaryName);
  check('content.secondaryName', publicDocument?.content?.secondaryName);
  check('event.startsAt', publicDocument?.event?.startsAt);
  check('dateLabels.long', publicDocument?.dateLabels?.long);
  check('dateLabels.short', publicDocument?.dateLabels?.short);
  check('story.title', publicDocument?.story?.title);
  check('story.subtitle', publicDocument?.story?.subtitle);
  check('story.text', publicDocument?.story?.text);
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
