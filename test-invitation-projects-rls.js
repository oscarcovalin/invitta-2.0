const assert = require('assert');
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
const migrationName = fs.readdirSync(migrationsDir)
  .find((name) => name.endsWith('_add_invitation_project_rls.sql'));
assert.ok(migrationName, 'Invitation project RLS migration exists');

const sql = fs.readFileSync(path.join(migrationsDir, migrationName), 'utf8');
assert.match(sql, /create schema if not exists private/);
assert.match(sql, /security definer[\s\S]*set search_path = ''/);
assert.match(sql, /revoke all on function private\.has_project_role.*from public/);
assert.match(sql, /grant execute on function private\.has_project_role.*to authenticated/);
assert.match(sql, /grant update \(name, event_type, status, published_document_id\)/);
assert.match(sql, /grant update \(role\) on table public\.invitation_project_members/);
assert.match(sql, /for select[\s\S]*to authenticated/);
assert.match(sql, /for insert[\s\S]*to authenticated/);
assert.match(sql, /for update[\s\S]*using[\s\S]*with check/);
assert.doesNotMatch(sql, /for all|auth\.role\(\)/i);
assert.doesNotMatch(sql, /grant .* to anon/i);
assert.doesNotMatch(sql, /grant (?:update|delete).*invitation_documents/i);

const rollbackPath = path.join(__dirname, 'supabase', 'rollbacks', migrationName);
const rollback = fs.readFileSync(rollbackPath, 'utf8');
assert.match(rollback, /drop policy/);
assert.match(rollback, /drop function if exists private\.has_project_role/);

console.log('Invitation project RLS is explicit, role-scoped, and rollbackable.');
