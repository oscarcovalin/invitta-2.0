const assert = require('node:assert/strict');
const { findSamplePublicationFields } = require('./lib/publication-content-preflight.cjs');

const approved = {
  content: { title: 'Ana y Luis', primaryName: 'Ana', secondaryName: 'Luis' },
  giftRegistry: { bank: { holder: 'Ana López', clabe: '123456789012345678' } },
  whatsappNumber: '5215511112233',
  whatsappHosts: [{ phone: '5215511112233' }],
  lodging: { hotels: [{ code: 'FIESTA' }] },
  sharedAlbum: { accessCode: 'FOTOSANA' },
};
assert.deepEqual(findSamplePublicationFields(approved), []);

const samples = structuredClone(approved);
samples.content.title = 'Catalina & Julián';
samples.content.primaryName = 'Catalina';
samples.content.secondaryName = 'Julián';
samples.giftRegistry.bank.holder = 'Catalina Martínez Ruiz';
samples.giftRegistry.bank.clabe = '0121 8001 2345 6789 01';
samples.whatsappHosts[0].phone = '5215512345678';
samples.whatsappNumber = '5215512345678';
samples.lodging.hotels[0].code = 'BODA2027';
samples.sharedAlbum.accessCode = 'BODA2027';
assert.deepEqual(findSamplePublicationFields(samples), [
  'content.title', 'content.primaryName', 'content.secondaryName', 'giftRegistry.bank.holder',
  'giftRegistry.bank.clabe', 'whatsappNumber', 'whatsappHosts[0].phone',
  'lodging.hotels[0].code', 'sharedAlbum.accessCode',
]);

const hidden = structuredClone(approved);
delete hidden.giftRegistry;
delete hidden.sharedAlbum;
hidden.whatsappHosts = [];
assert.deepEqual(findSamplePublicationFields(hidden), []);
console.log('Publication preflight detects exact Studio sample values only in projected fields.');
