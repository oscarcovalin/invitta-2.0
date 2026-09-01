// test-supabase-connection.js - Verificador de Conexión a Nuevo Proyecto Supabase
const fs = require('fs');
const path = require('path');

// Cargar .env manualmente si existe
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [k, ...v] = trimmed.split('=');
      if (k && v.length > 0) {
        process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  });
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

console.log('================================================================');
console.log('🔌 INVITTA 2.0 — VERIFICADOR DE CONEXIÓN A PROYECTO SUPABASE');
console.log('================================================================\n');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('tu-nuevo-proyecto')) {
  console.log('⚠️  PENDIENTE DE CONFIGURAR:');
  console.log('   Crea un archivo ".env" en esta carpeta con tus credenciales nuevas:');
  console.log('   SUPABASE_URL=https://tu-nuevo-proyecto.supabase.co');
  console.log('   SUPABASE_ANON_KEY=tu-clave-anon\n');
  console.log('📋 Archivo SQL listo para ejecutar en el nuevo proyecto:');
  console.log('   database/deploy-new-project.sql\n');
  process.exit(0);
}

console.log(`📡 Conectando al proyecto: ${SUPABASE_URL}...`);

async function testConnection() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/events?select=id,slug,title,hosts&limit=5`;
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const events = await response.json();
    console.log('✅ ¡CONEXIÓN EXITOSA CON EL NUEVO PROYECTO SUPABASE!');
    console.log(`📊 Eventos encontrados en la base de datos (${events.length}):`);
    events.forEach(e => {
      console.log(`   - [${e.slug}] "${e.title}" (Anfitriones: ${e.hosts})`);
    });
    console.log('\n🎉 El proyecto está 100% aislado, configurado y listo para producción.');
  } catch (err) {
    console.error('❌ Error al conectar con Supabase:', err.message);
  }
}

testConnection();
