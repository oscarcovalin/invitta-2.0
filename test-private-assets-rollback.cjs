'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = '20260922191746_add_private_invitation_assets.sql';
const rollbackPath = path.join(__dirname, 'supabase', 'rollbacks', migration);
assert.ok(fs.existsSync(rollbackPath), 'Private asset migration has a rollback');

const sql = fs.readFileSync(rollbackPath, 'utf8');
for (const policy of ['select', 'insert', 'update', 'delete']) {
  assert.match(sql, new RegExp(`drop policy if exists invitation_assets_${policy} on storage\\.objects`));
}
assert.match(sql, /drop function if exists private\.invitation_asset_project_id\(text\)/);
assert.doesNotMatch(sql, /delete\s+from\s+storage\.objects|drop\s+table/i);
assert.match(sql, /delete\s+from\s+storage\.buckets[\s\S]*not exists\s*\([\s\S]*from storage\.objects/i);

console.log('Private asset rollback removes policies while preserving stored files.');
