begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@invitta.test', now(), now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'planner@invitta.test', now(), now()),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'designer@invitta.test', now(), now()),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hostess@invitta.test', now(), now()),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'viewer@invitta.test', now(), now()),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider@invitta.test', now(), now());

insert into public.invitation_projects (id, owner_user_id, slug, name, event_type)
values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'boda-prueba',
  'Boda de prueba',
  'wedding'
);

insert into public.invitation_project_members (project_id, user_id, role)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'planner'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'designer'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'hostess');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select results_eq(
  $$ select count(*)::bigint from public.invitation_projects $$,
  array[1::bigint],
  'owner can read the project'
);
select lives_ok(
  $$ insert into public.invitation_projects (id, owner_user_id, slug, name, event_type)
     values ('20000000-0000-0000-0000-000000000002',
             '10000000-0000-0000-0000-000000000001',
             'owner-created-project', 'Owner-created project', 'other')
     returning id $$,
  'owner can create a project and receive the inserted row'
);
select lives_ok(
  $$ insert into public.invitation_project_members (project_id, user_id, role) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'viewer') $$,
  'owner can add a project member'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select results_eq(
  $$ select count(*)::bigint from public.invitation_projects $$,
  array[1::bigint],
  'planner can read an assigned project'
);
select throws_ok(
  $$ insert into public.invitation_project_members (project_id, user_id, role) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'viewer') $$,
  '42501',
  null,
  'planner cannot manage project members'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select lives_ok(
  $$ insert into public.invitation_documents (project_id, revision, schema_version, document, created_by) values ('20000000-0000-0000-0000-000000000001', 1, 1, '{"projectId":"20000000-0000-0000-0000-000000000001","schemaVersion":1}', '10000000-0000-0000-0000-000000000003') $$,
  'designer can create an immutable document revision'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.invitation_documents (project_id, revision, schema_version, document, created_by) values ('20000000-0000-0000-0000-000000000001', 2, 1, '{"projectId":"20000000-0000-0000-0000-000000000001","schemaVersion":1}', '10000000-0000-0000-0000-000000000004') $$,
  '42501',
  null,
  'hostess cannot create document revisions'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select results_eq(
  $$ select count(*)::bigint from public.invitation_documents $$,
  array[1::bigint],
  'viewer can read project revisions'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
select results_eq(
  $$ select count(*)::bigint from public.invitation_projects $$,
  array[0::bigint],
  'non-member cannot read the project'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select results_eq(
  $$ select count(*)::bigint from public.invitation_projects $$,
  array[0::bigint],
  'anonymous users cannot read private projects'
);

select * from finish();
rollback;
