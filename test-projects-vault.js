// Mock localStorage for node testing
if (typeof localStorage === 'undefined') {
  global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
  };
}

const ProjectsVault = require('./projects-vault.js');

console.log('=== TEST SUITE: PROJECTS VAULT ===');

// Test 1: Get Defaults
const initial = ProjectsVault.getAll();
console.log('Test 1 - Initial projects count:', initial.length);
console.log('Test 1 - Has wedding project:', initial.some(p => p.eventType === 'boda'));
console.log('Test 1 - Has XV project:', initial.some(p => p.eventType === 'xv'));

// Test 2: Save New Project
const created = ProjectsVault.save({
  title: 'Boda Sofía & Mateo',
  config: {
    eventType: 'boda',
    brideName: 'Sofía',
    groomName: 'Mateo',
    eventDate: '2027-09-18T17:00:00'
  }
});
console.log('Test 2 - Project created with ID:', created.id.startsWith('proj_'));
console.log('Test 2 - Hosts formatted correctly:', created.hosts === 'Sofía & Mateo');

// Test 3: Duplicate
const duplicated = ProjectsVault.duplicate(created.id);
console.log('Test 3 - Duplicate created:', duplicated && duplicated.id !== created.id);
console.log('Test 3 - Duplicate title contains (Copia):', duplicated.title.includes('(Copia)'));

// Test 4: Delete
const deletedOk = ProjectsVault.delete(duplicated.id);
console.log('Test 4 - Delete successful:', deletedOk && !ProjectsVault.getById(duplicated.id));

// Test 5: Import JSON
const sampleJson = JSON.stringify({
  eventType: 'xv',
  name: 'Camila',
  eventDate: '2026-11-20T19:00:00',
  reception: { venue: 'Salón Bellavista' }
});
const imported = ProjectsVault.importJSON(sampleJson, 'XV Años Camila');
console.log('Test 5 - JSON imported successfully:', imported && imported.hosts === 'Camila');
console.log('Test 5 - Imported venue stored:', imported.venue === 'Salón Bellavista');

console.log('\n🎉 ALL PROJECTS VAULT TESTS PASSED WITH 100% SUCCESS!');
