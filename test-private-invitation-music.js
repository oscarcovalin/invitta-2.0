const assert = require('assert');
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
const migrationName = fs.readdirSync(migrationsDir)
  .find((name) => name.endsWith('_add_private_invitation_music_bucket.sql'));
assert.ok(migrationName, 'Private invitation music migration exists');

const sql = fs.readFileSync(path.join(migrationsDir, migrationName), 'utf8');
assert.match(sql, /'invitation-music',[\s\S]*false[\s\S]*5000000[\s\S]*array\['audio\/mpeg'\]/);
for (const operation of ['select', 'insert', 'update', 'delete']) {
  assert.match(sql, new RegExp(`create policy invitation_music_${operation}[\\s\\S]*for ${operation}`));
  assert.match(sql, /private\.has_project_role/);
}
assert.match(sql, /music\//);
assert.match(sql, /\[\.\]mp3/);
assert.doesNotMatch(sql, /to anon|public\s*=\s*true/i);

const rollback = fs.readFileSync(path.join(__dirname, 'supabase', 'rollbacks', migrationName), 'utf8');
assert.match(rollback, /not exists[\s\S]*storage\.objects[\s\S]*invitation-music/);
assert.match(rollback, /drop policy if exists invitation_music_select/);

console.log('Invitation music uses a separate private, project-scoped MP3 bucket.');
