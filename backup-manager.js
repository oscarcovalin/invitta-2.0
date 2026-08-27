/**
 * Sistema de Puntos de Restauración y Respaldos Automáticos
 * Dashboard Generador de Invitaciones de Lujo
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_DIR = __dirname;
const BACKUPS_DIR = path.join(PROJECT_DIR, 'backups');

const CORE_FILES = [
  'template-engine.js',
  'index.html',
  'portal.html',
  'organizador-mesas.html',
  'invitacion-estudio.html',
  'app.js',
  'style.css',
  'decor-assets.js'
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `${y}-${m}-${d}_${hh}-${mm}-${ss}`;
}

/**
 * Crea un punto de restauración con nombre o versión
 */
function createSnapshot(label = 'manual') {
  ensureDir(BACKUPS_DIR);
  const timestamp = getTimestamp();
  const safeLabel = label.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const snapshotName = `${safeLabel}_${timestamp}`;
  const targetDir = path.join(BACKUPS_DIR, snapshotName);

  fs.mkdirSync(targetDir, { recursive: true });

  const manifest = {
    label,
    timestamp: new Date().toISOString(),
    files: []
  };

  CORE_FILES.forEach(filename => {
    const src = path.join(PROJECT_DIR, filename);
    if (fs.existsSync(src)) {
      const dest = path.join(targetDir, filename);
      fs.copyFileSync(src, dest);
      const stats = fs.statSync(src);
      manifest.files.push({ filename, size: stats.size });
    }
  });

  // Guardar metadata
  fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  // Crear también un commit en Git si está disponible
  try {
    execSync('git add .', { cwd: PROJECT_DIR, stdio: 'ignore' });
    execSync(`git commit -m "Snapshot [${label}]: ${timestamp}"`, { cwd: PROJECT_DIR, stdio: 'ignore' });
    execSync(`git tag -a "snapshot_${safeLabel}_${Date.now()}" -m "${label}"`, { cwd: PROJECT_DIR, stdio: 'ignore' });
  } catch (e) {
    // Si no hay cambios en git, continuar
  }

  console.log(`✅ Punto de restauración creado con éxito:`);
  console.log(`   📁 backups/${snapshotName}`);
  console.log(`   📝 Archivos respaldados: ${manifest.files.length}`);
  return snapshotName;
}

/**
 * Lista todos los puntos de restauración disponibles
 */
function listSnapshots() {
  ensureDir(BACKUPS_DIR);
  const entries = fs.readdirSync(BACKUPS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort()
    .reverse();

  console.log(`\n📦 Puntos de Restauración Disponibles (${entries.length}):\n`);
  if (entries.length === 0) {
    console.log('   (No hay respaldos creados aún)');
    return [];
  }

  entries.forEach((name, i) => {
    const manifestPath = path.join(BACKUPS_DIR, name, 'manifest.json');
    let info = '';
    if (fs.existsSync(manifestPath)) {
      try {
        const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        info = `| Etiqueta: "${m.label}" | Fecha: ${m.timestamp}`;
      } catch(e) {}
    }
    console.log(`   ${i + 1}. [${name}] ${info}`);
  });
  console.log('\nPara restaurar un punto, ejecuta:');
  console.log('   node backup-manager.js restore <nombre_o_numero>\n');
  return entries;
}

/**
 * Restaura un punto de restauración específico
 */
function restoreSnapshot(target) {
  ensureDir(BACKUPS_DIR);
  const entries = fs.readdirSync(BACKUPS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort()
    .reverse();

  let targetDirName = target;

  // Si el usuario pasó un número (1, 2, 3...)
  const num = parseInt(target, 10);
  if (!isNaN(num) && num >= 1 && num <= entries.length) {
    targetDirName = entries[num - 1];
  } else if (!entries.includes(targetDirName)) {
    // Buscar por coincidencia parcial
    const matched = entries.find(e => e.toLowerCase().includes(target.toLowerCase()));
    if (matched) {
      targetDirName = matched;
    } else {
      console.error(`❌ No se encontró el punto de restauración "${target}".`);
      console.log(`Usa "node backup-manager.js list" para ver los respaldos disponibles.`);
      return false;
    }
  }

  const snapshotPath = path.join(BACKUPS_DIR, targetDirName);
  console.log(`\n⏳ Restaurando desde: ${targetDirName}...`);

  // Crear un respaldo de seguridad del estado actual antes de sobreescribir
  const safetySnapshot = createSnapshot('pre-restore-safety');
  console.log(`🛡️ Respaldo de seguridad previo creado: ${safetySnapshot}`);

  // Restaurar archivos
  let restoredCount = 0;
  CORE_FILES.forEach(filename => {
    const src = path.join(snapshotPath, filename);
    if (fs.existsSync(src)) {
      const dest = path.join(PROJECT_DIR, filename);
      fs.copyFileSync(src, dest);
      restoredCount++;
    }
  });

  console.log(`\n🎉 ¡Restauración completada con éxito!`);
  console.log(`   ${restoredCount} archivos restaurados al estado de [${targetDirName}].`);
  return true;
}

// CLI Runner
const args = process.argv.slice(2);
const command = args[0] || 'create';

if (command === 'create' || command === 'save') {
  const label = args[1] || 'v5.6_estable';
  createSnapshot(label);
} else if (command === 'list') {
  listSnapshots();
} else if (command === 'restore') {
  const target = args[1];
  if (!target) {
    console.error('❌ Especifica el nombre o número del punto a restaurar:');
    console.log('   node backup-manager.js restore <nombre_o_numero>');
    listSnapshots();
  } else {
    restoreSnapshot(target);
  }
} else {
  console.log(`Uso del Administrador de Respaldos:`);
  console.log(`  node backup-manager.js create [etiqueta]   -> Guarda un punto de restauración`);
  console.log(`  node backup-manager.js list              -> Lista todos los puntos guardados`);
  console.log(`  node backup-manager.js restore <nombre>  -> Restaura el proyecto al punto indicado`);
}
