const assert = require('assert');
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
const migrationName = fs.readdirSync(migrationsDir)
  .find((name) => name.endsWith('_add_private_invitation_assets.sql'));
assert.ok(migrationName, 'Private invitation assets migration exists');

const sql = fs.readFileSync(path.join(migrationsDir, migrationName), 'utf8');
assert.match(sql, /'invitation-assets',[\s\S]*false/);
assert.match(sql, /file_size_limit/);
assert.match(sql, /allowed_mime_types/);
assert.match(sql, /create policy invitation_assets_select[\s\S]*for select[\s\S]*to authenticated/);
assert.match(sql, /create policy invitation_assets_insert[\s\S]*for insert[\s\S]*with check/);
assert.match(sql, /create policy invitation_assets_update[\s\S]*for update[\s\S]*using[\s\S]*with check/);
assert.match(sql, /create policy invitation_assets_delete[\s\S]*for delete/);
assert.match(sql, /private\.has_project_role/);
assert.doesNotMatch(sql, /to anon|public\s*=\s*true/i);

const rollback = fs.readFileSync(
  path.join(__dirname, 'supabase', 'rollbacks', migrationName),
  'utf8'
);
assert.match(rollback, /drop policy/);
assert.match(rollback, /not exists[\s\S]*storage\.objects/);

console.log('Invitation assets use a private, project-scoped Storage bucket.');
