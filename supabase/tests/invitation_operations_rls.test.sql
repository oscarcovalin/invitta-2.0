-- Only run against the disposable local test database, never the client project.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select has_table('public', 'invitation_tables', 'project tables exist');
select has_table('public', 'invitation_guests', 'project guests exist');
select ok(
  coalesce((select relrowsecurity from pg_class
    where oid = to_regclass('public.invitation_tables')), false),
  'tables enforce row-level security'
);
select ok(
  coalesce((select relrowsecurity from pg_class
    where oid = to_regclass('public.invitation_guests')), false),
  'guests enforce row-level security'
);

select ok(has_table_privilege('authenticated', 'public.invitation_tables', 'SELECT'), 'authenticated can select with RLS');
select ok(has_column_privilege('authenticated', 'public.invitation_guests', 'name', 'UPDATE'), 'guest names are editable');
select ok(not has_column_privilege('authenticated', 'public.invitation_guests', 'project_id', 'UPDATE'), 'project identity is not editable');
select ok(not has_table_privilege('authenticated', 'public.invitation_tables', 'DELETE'), 'no table deletion grant');
select ok(not has_table_privilege('anon', 'public.invitation_guests', 'SELECT'), 'anonymous guests have no table grant');
select ok(not has_column_privilege('authenticated', resource, col, action), resource || ': clients cannot ' || action || ' ' || col)
from unnest(array['public.invitation_tables', 'public.invitation_guests']) resource
cross join unnest(array['version', 'created_at', 'updated_at']) col
cross join unnest(array['INSERT', 'UPDATE']) action;
select ok(not has_table_privilege('anon', resource, action), resource || ': anonymous cannot ' || action)
from unnest(array['public.invitation_tables', 'public.invitation_guests']) resource
cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) action;
select ok(not has_function_privilege('authenticated', 'private.guard_invitation_operation_update()', 'EXECUTE'),
  'clients cannot execute private trigger directly');

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select ('11000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'ops-' || n || '@invitta.test', now(), now()
from generate_series(1, 7) n;
insert into public.invitation_projects(id, owner_user_id, slug, name, event_type)
values
  ('21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'ops-a', 'Test A', 'other'),
  ('21000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', 'ops-b', 'Test B', 'other');
select is((select count(*) from public.invitation_tables), 0::bigint, 'migration does not seed tables');
select is((select count(*) from public.invitation_guests), 0::bigint, 'migration does not seed guests');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($$insert into public.invitation_tables(id, project_id, name, type, capacity)
  values ('31000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'A', 'circular', 8) returning id$$,
  'owner creates a table and receives its row');
select lives_ok($$insert into public.invitation_guests(id, project_id, name, passes, table_id)
  values ('41000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'Family A', 3,
  '31000000-0000-0000-0000-000000000001') returning id$$, 'owner creates an assigned guest and receives its row');
reset role;

insert into public.invitation_project_members(project_id, user_id, role)
select '21000000-0000-0000-0000-000000000001',
  ('11000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  (array['planner', 'designer', 'hostess', 'catering', 'viewer'])[n - 1]
from generate_series(2, 6) n;
insert into public.invitation_tables(id, project_id, name, type, capacity)
values ('31000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', 'B', 'imperial', 10);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$update public.invitation_guests set table_id = '31000000-0000-0000-0000-000000000002'$$,
  '23503', null, 'even an owner of both projects cannot cross-assign tables');
select throws_ok($$update public.invitation_guests set project_id = '21000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'guest project cannot be reassigned');
select throws_ok($$update public.invitation_tables set id = gen_random_uuid()$$,
  '42501', null, 'table identity cannot be reassigned');
select throws_ok($$insert into public.invitation_guests(project_id, name, passes, version)
  values ('21000000-0000-0000-0000-000000000001', 'Bad version', 1, 50)$$,
  '42501', null, 'client cannot choose initial version');
select throws_ok($$update public.invitation_guests set created_at = now()$$,
  '42501', null, 'client cannot edit timestamps');
select throws_ok($$delete from public.invitation_guests$$, '42501', null, 'guest deletion is not enabled');
select throws_ok($$delete from public.invitation_tables$$, '42501', null, 'table deletion is not enabled');

select throws_ok(format('update public.invitation_guests set name = %L', invalid), '23514', null, 'invalid guest name rejected')
from (values (''), (' padded '), (E'\tTabbed'), (repeat('x', 161))) cases(invalid);
select throws_ok(format('update public.invitation_tables set name = %L', invalid), '23514', null, 'invalid table name rejected')
from (values (''), (' padded '), (E'Newline\n'), (repeat('x', 161))) cases(invalid);
select throws_ok(format('update public.invitation_guests set passes = %s', invalid), '23514', null, 'invalid passes rejected')
from (values (0), (-1), (101)) cases(invalid);
select throws_ok(format('update public.invitation_tables set capacity = %s', invalid), '23514', null, 'invalid capacity rejected')
from (values (0), (-1), (101)) cases(invalid);
select throws_ok($$update public.invitation_tables set type = 'unknown'$$, '23514', null, 'invalid table type rejected');
select throws_ok($$update public.invitation_guests set passes = null$$, '23502', null, 'passes required');
select throws_ok($$insert into public.invitation_guests(project_id, name, passes)
  values ('21000000-0000-0000-0000-000000000001', '', 1)$$, '23514', null, 'invalid guest insert rejected');
select throws_ok($$insert into public.invitation_tables(project_id, name, type, capacity)
  values ('21000000-0000-0000-0000-000000000001', 'Bad', 'circular', 101)$$, '23514', null, 'invalid table insert rejected');
select lives_ok($$update public.invitation_guests set name = repeat('x', 160), passes = 100, table_id = null$$,
  'upper boundaries and unassigned table are valid');
select is((select version from public.invitation_guests limit 1), 2, 'successful edit increments version');
select lives_ok($$update public.invitation_tables set capacity = 100, type = 'rectangular'$$, 'table fields are editable');
select is((select version from public.invitation_tables where name = 'A'), 2, 'table edit increments version');

select set_config('request.jwt.claims', '{"sub":"11000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select results_eq($$select name from public.invitation_tables$$, array['A'], 'planner only sees assigned project');
select lives_ok($$insert into public.invitation_guests(project_id, name, passes)
  values ('21000000-0000-0000-0000-000000000001', 'Planner family', 1) returning id$$, 'planner creates guest');
select lives_ok($$insert into public.invitation_tables(project_id, name, type, capacity)
  values ('21000000-0000-0000-0000-000000000001', 'Planner table', 'imperial', 1) returning id$$, 'planner creates table');
select lives_ok($$update public.invitation_guests set name = 'Planner edit' where id = '41000000-0000-0000-0000-000000000001'$$,
  'planner edits assigned guest');
select throws_ok($$insert into public.invitation_guests(project_id, name, passes)
  values ('21000000-0000-0000-0000-000000000002', 'Forbidden', 1)$$, '42501', null, 'planner cannot insert into other project');
select results_eq($$with changed as (update public.invitation_tables set name = 'Forbidden'
  where project_id = '21000000-0000-0000-0000-000000000002' returning id) select count(*) from changed$$,
  array[0::bigint], 'planner cannot update other project');
reset role;

-- Each excluded role (and the non-member) must be checked separately on both resources.
create function pg_temp.check_excluded(n integer) returns setof text language plpgsql as $$
declare resource text; fields text; sample_values text;
begin
    perform set_config('request.jwt.claims', json_build_object('sub',
      '11000000-0000-0000-0000-' || lpad(n::text, 12, '0'), 'role', 'authenticated')::text, true);
    foreach resource in array array['invitation_tables', 'invitation_guests'] loop
      return next results_eq(format('select count(*) from public.%I', resource), array[0::bigint], resource || ' excludes user ' || n);
      return next results_eq(format('with changed as (update public.%I set name = ''Forbidden'' returning id) select count(*) from changed', resource),
        array[0::bigint], resource || ' denies update for user ' || n);
      fields := case when resource = 'invitation_tables' then 'type, capacity' else 'passes' end;
      sample_values := case when resource = 'invitation_tables' then '''circular'', 1' else '1' end;
      return next throws_ok(format('insert into public.%I(project_id, name, %s) values (''21000000-0000-0000-0000-000000000001'', ''Forbidden'', %s)',
        resource, fields, sample_values), '42501', null, resource || ' denies insert for user ' || n);
    end loop;
end $$;
set local role authenticated;
select pg_temp.check_excluded(n) from generate_series(3, 7) n;
reset role;

-- Trigger protection is independent of column privileges, including privileged maintenance writes.
select throws_ok($$update public.invitation_guests set project_id = '21000000-0000-0000-0000-000000000002'$$,
  '23514', null, 'identity guard applies to privileged maintenance');
select throws_ok($$update public.invitation_tables set created_at = now() + interval '1 day'$$,
  '23514', null, 'creation timestamp guard applies to privileged maintenance');
update public.invitation_guests set table_id = '31000000-0000-0000-0000-000000000001'
  where id = '41000000-0000-0000-0000-000000000001';
select throws_ok($$delete from public.invitation_tables where id = '31000000-0000-0000-0000-000000000001'$$,
  '23503', null, 'assigned table cannot be deleted, even by privileged maintenance');

delete from public.invitation_project_members where user_id = '11000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select results_eq($$select count(*) from public.invitation_guests$$, array[0::bigint], 'revoked planner loses guest access');
select results_eq($$select count(*) from public.invitation_tables$$, array[0::bigint], 'revoked planner loses table access');
reset role;

set local role anon;
select throws_ok($$select * from public.invitation_tables$$, '42501', null, 'anonymous cannot read tables');
select throws_ok($$select * from public.invitation_guests$$, '42501', null, 'anonymous cannot read guests');
reset role;

select * from finish();
rollback;
