-- Disposable local database only. Every fixture is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
select ok(coalesce((select relrowsecurity from pg_class where oid=to_regclass(resource)),false),resource || ' has RLS')
from unnest(array['private.invitation_passes','private.invitation_admissions']) resource;
select ok(not has_table_privilege(client,resource,action),client || ' cannot ' || action || ' ' || resource)
from unnest(array['anon','authenticated']) client
cross join unnest(array['private.invitation_passes','private.invitation_admissions']) resource
cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) action;
select ok(not has_function_privilege('anon',signature,'EXECUTE'),'anon cannot execute ' || signature)
from unnest(array['public.invitation_pass_context(uuid)','public.invitation_pass_issue(uuid,uuid,text,integer,uuid,boolean,text)',
 'public.invitation_pass_inspect(uuid,uuid,text)','public.invitation_pass_admit(uuid,uuid,text,uuid,integer)',
 'public.invitation_pass_revoke(uuid,uuid)']) signature;
select ok(not has_function_privilege('authenticated','private.pass_snapshot(uuid)','EXECUTE'),'no direct snapshot execution');
insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
values('12000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','door-security@invitta.test',now(),now());
insert into public.invitation_projects(id,owner_user_id,slug,name,event_type)
values('22000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','door-security','Synthetic door security','other');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"12000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
select lives_ok($$select public.invitation_pass_context('22000000-0000-4000-8000-000000000001')$$,'non-anonymous owner is authorized');
select set_config('request.jwt.claims','{"sub":"12000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true,"user_metadata":{"is_anonymous":false}}',true);
select throws_ok($$select public.invitation_pass_context('22000000-0000-4000-8000-000000000001')$$,'42501',null,'anonymous owner claim cannot access context');
select throws_ok($$select public.invitation_pass_issue('22000000-0000-4000-8000-000000000001',gen_random_uuid(),'Synthetic',1,null,false,repeat('a',64))$$,'42501',null,'anonymous cannot issue despite owner identity');
select throws_ok($$select public.invitation_pass_inspect('22000000-0000-4000-8000-000000000001',gen_random_uuid(),repeat('a',64))$$,'42501',null,'anonymous cannot inspect');
select throws_ok($$select public.invitation_pass_admit('22000000-0000-4000-8000-000000000001',gen_random_uuid(),repeat('a',64),gen_random_uuid(),1)$$,'42501',null,'anonymous cannot admit');
select throws_ok($$select public.invitation_pass_revoke('22000000-0000-4000-8000-000000000001',gen_random_uuid())$$,'42501',null,'anonymous cannot revoke');
reset role;
select * from finish();
rollback;
