// test-e2e-full-lifecycle.js
// Simulación End-to-End: Desde la creación del evento hasta la entrega y check-in del invitado

const assert = require('assert');
const path = require('path');

// Mock localStorage and window for headless execution
if (typeof window === 'undefined') {
  global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
  };
  global.sessionStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
  };
  global.window = {
    location: {
      href: 'http://localhost:3000/index.html',
      search: ''
    }
  };
}

const ProjectsVault = require('./projects-vault.js');
const GuestManager = require('./guest-manager.js');

console.log('================================================================');
console.log('🚀 INVITTA 2.0 BETA — SIMULACIÓN E2E DE ENTREGA DE INVITACIÓN');
console.log('================================================================\n');

// -------------------------------------------------------------
// PASO 1: Creación del Proyecto de Boda en el Vault
// -------------------------------------------------------------
console.log('📦 PASO 1: Creación del Proyecto en el Vault de Eventos...');
const project = ProjectsVault.save({
  title: 'Boda Valentina & Sebastián',
  venue: 'Hacienda San José de las Palmas',
  config: {
    eventType: 'boda',
    brideName: 'Valentina',
    groomName: 'Sebastián',
    eventDate: '2027-10-24T18:00:00',
    reception: {
      venue: 'Hacienda San José de las Palmas'
    },
    musicTheme: 'Royal Romance Suite'
  }
});
console.log(`   ✅ Proyecto Creado: ID=${project.id}, Anfitriones: "${project.hosts}"`);
console.log(`   📍 Sede: ${project.venue} | Fecha: ${project.date}`);

// -------------------------------------------------------------
// PASO 2: Configuración del Motor de Invitados y Dimensionamiento
// -------------------------------------------------------------
console.log('\n📐 PASO 2: Dimensionamiento y Configuración de Sala...');
const gm = new GuestManager();
gm.setDimensioning({
  totalGuests: 150,
  tableCapacity: 10,
  hasImperial: true,
  imperialCapacity: 16
});
console.log(`   ✅ Capacidad configurada: 150 invitados en mesas de 10 + Mesa Imperial (16 pax)`);

// -------------------------------------------------------------
// PASO 3: Registro y Asignación de un Nuevo Invitado
// -------------------------------------------------------------
console.log('\n👤 PASO 3: Registro y Personalización de Invitado...');
const nuevoInvitado = gm.addGuest({
  name: 'Lic. Roberto Garza & Familia',
  passes: 3,
  phone: '+528112345678',
  email: 'rgarza@ejemplo.com',
  isCourt: true,
  tableId: 'tbl_imperial'
});
console.log(`   ✅ Invitado registrado: "${nuevoInvitado.name}" (ID: ${nuevoInvitado.id})`);
console.log(`   🎫 Pases asignados: ${nuevoInvitado.passes} | Mesa: Imperial (Corte de Honor)`);
console.log(`   🏷️  Folio Logístico Único Generado: ${nuevoInvitado.folio}`);

// -------------------------------------------------------------
// PASO 4: Generación del Enlace de Gala y Mensaje de WhatsApp
// -------------------------------------------------------------
console.log('\n💌 PASO 4: Despacho de Invitación Digital Personalizada...');
const urlPersonalizada = gm.getPersonalizedUrl(nuevoInvitado);
const linkWhatsApp = gm.getWhatsAppLink(nuevoInvitado);
const linkEmail = gm.getEmailLink(nuevoInvitado);

console.log(`   🌐 URL de Invitación Web:`);
console.log(`      ${urlPersonalizada}`);
console.log(`   💬 Enlace de Envío Directo por WhatsApp:`);
console.log(`      ${linkWhatsApp.substring(0, 100)}...`);
console.log(`   ✉️  Enlace de Envío por Email:`);
console.log(`      ${linkEmail}`);

gm.markAsSent(nuevoInvitado.id);
console.log(`   📬 Estado actualizado a: "${gm.getGuest(nuevoInvitado.id).status}"`);

// -------------------------------------------------------------
// PASO 5: Simulación de la Experiencia del Invitado (RSVP)
// -------------------------------------------------------------
console.log('\n✨ PASO 5: El Invitado abre su Invitación y Confirma Asistencia (RSVP)...');
const rsvpResponse = gm.recordRsvpResponse(nuevoInvitado.id, {
  confirmed: true,
  confirmedPasses: 3,
  diet: 'Opción Vegetariana (1 pax)',
  notes: 'Muchas felicidades, ahí estaremos con gusto!'
});
console.log(`   🎉 Respuesta RSVP Registrada:`);
console.log(`      - Estado: ${rsvpResponse.status}`);
console.log(`      - Pases Confirmados: ${rsvpResponse.confirmedPasses} de ${nuevoInvitado.passes}`);
console.log(`      - Preferencias dietéticas: ${rsvpResponse.diet}`);
console.log(`      - Mensaje para los novios: "${rsvpResponse.notes}"`);

// -------------------------------------------------------------
// PASO 6: Métricas en Tiempo Real en el Dashboard del Organizador
// -------------------------------------------------------------
console.log('\n📊 PASO 6: Verificación de Métricas en el Organizador...');
const metricas = gm.getMetrics();
console.log(`   📈 Resumen de Asistencia en Vivo:`);
console.log(`      - Total Registrados: ${metricas.totalGuests} (${metricas.totalPasses} pases totales)`);
console.log(`      - Confirmados: ${metricas.confirmedCount} (${metricas.confirmedPasses} pases confirmados)`);
console.log(`      - Porcentaje de Confirmación: ${metricas.confirmedPercent}%`);

// -------------------------------------------------------------
// PASO 7: Día del Evento — Check-In en Puerta con Escáner Hostess
// -------------------------------------------------------------
console.log('\n🚪 PASO 7: Llegada al Evento — Check-In con Escáner de Acceso (Hostess)...');
console.log(`   🔍 Hostess escanea el Folio: "${nuevoInvitado.folio}"`);

const checkinResult = gm.checkInGuest(nuevoInvitado.folio, 3);
assert(checkinResult.success, 'El check-in debe ser exitoso');
console.log(`   🟢 ACCESO CONCEDIDO:`);
console.log(`      - Invitado: ${checkinResult.guest.name}`);
console.log(`      - Mesa: ${checkinResult.guest.tableId}`);
console.log(`      - Pases Admitidos al Salón: ${checkinResult.guest.admittedPasses}`);
console.log(`      - Hora de Ingreso: ${checkinResult.guest.checkedInAt}`);

const accessMetrics = gm.getAccessMetrics();
console.log(`   🏰 Aforo en Salón en Tiempo Real:`);
console.log(`      - Personas dentro del salón: ${accessMetrics.inSalon.passes} personas (${accessMetrics.inSalon.count} grupos)`);
console.log(`      - En tránsito / confirmados por llegar: ${accessMetrics.inTransit.passes} personas (${accessMetrics.inTransit.count} grupos)`);
console.log(`      - Tasa de ocupación actual: ${accessMetrics.occupancyRate}%`);

console.log('\n================================================================');
console.log('🏁 FLUJO E2E COMPLETADO EXITOSAMENTE AL 100% SIN ERRORES');
console.log('================================================================\n');
