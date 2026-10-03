const assert = require('assert');
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
const migrationName = fs.readdirSync(migrationsDir)
  .find((name) => name.endsWith('_add_invitation_projects.sql'));
assert.ok(migrationName, 'Additive invitation projects migration exists');

const sql = fs.readFileSync(path.join(migrationsDir, migrationName), 'utf8');
for (const table of ['invitation_projects', 'invitation_project_members', 'invitation_documents']) {
  assert.match(sql, new RegExp(`create table public\\.${table}`));
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(sql, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`));
}
assert.match(sql, /unique \(project_id, revision\)/);
assert.match(sql, /published_document_id uuid/);
assert.doesNotMatch(sql, /drop table|rename column|drop column/i);

const rollbackPath = path.join(__dirname, 'supabase', 'rollbacks', migrationName);
const rollback = fs.readFileSync(rollbackPath, 'utf8');
assert.match(rollback, /drop table if exists public\.invitation_documents/);
assert.match(rollback, /drop table if exists public\.invitation_project_members/);
assert.match(rollback, /drop table if exists public\.invitation_projects/);

console.log('Invitation projects migration is additive, deny-by-default, and has a rollback.');
