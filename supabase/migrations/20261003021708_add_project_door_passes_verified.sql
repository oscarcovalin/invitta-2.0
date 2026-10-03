-- CLI-generated local schema diff. Explicit ACLs below also override inherited defaults.
SET local check_function_bodies = off;

CREATE TABLE "private"."invitation_admissions" (
  "id"             uuid                     NOT NULL,
  "project_id"     uuid                     NOT NULL,
  "ticket_id"      uuid                     NOT NULL,
  "actor_id"       uuid                     NOT NULL,
  "intent_hash"    text                     NOT NULL,
  "admitted_count" integer                  NOT NULL,
  "confirmed_at"   timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  "result"         jsonb                    NOT NULL,
  CONSTRAINT "invitation_admissions_admitted_count_check" CHECK (((admitted_count >= 1) AND (admitted_count <= 20))),
  CONSTRAINT "invitation_admissions_pkey" PRIMARY KEY (id)
);

ALTER TABLE "private"."invitation_admissions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."invitation_passes" (
  "id"                uuid                     NOT NULL,
  "project_id"        uuid                     NOT NULL,
  "guest_id"          uuid                     NOT NULL,
  "credential_digest" text                     NOT NULL,
  "issued_by"         uuid                     NOT NULL,
  "issued_at"         timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  "expires_at"        timestamp with time zone NOT NULL DEFAULT (clock_timestamp() + '24:00:00'::interval),
  "revoked_at"        timestamp with time zone,
  "revoked_by"        uuid,
  "admitted"          integer                  NOT NULL DEFAULT 0,
  "issue_hash"        text                     NOT NULL,
  "issue_result"      jsonb                    NOT NULL,
  CONSTRAINT "invitation_passes_admitted_check" CHECK ((admitted >= 0)),
  CONSTRAINT "invitation_passes_credential_digest_check" CHECK ((credential_digest ~ '^[0-9a-f]{64}$'::text)),
  CONSTRAINT "invitation_passes_pkey" PRIMARY KEY (id),
  CONSTRAINT "invitation_passes_project_id_guest_id_key" UNIQUE (project_id, guest_id),
  CONSTRAINT "invitation_passes_project_id_id_key" UNIQUE (project_id, id)
);

ALTER TABLE "private"."invitation_passes"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.guard_guest_admitted_balance()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if exists(select 1 from private.invitation_passes where guest_id = old.id
    and project_id = old.project_id and admitted > new.passes) then
    raise exception 'Passes cannot be reduced below admissions' using errcode = '23514';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.pass_admit (
  p_project   uuid,
  p_ticket    uuid,
  p_digest    text,
  p_operation uuid,
  p_count     integer
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  t private.invitation_passes; a private.invitation_admissions; g public.invitation_guests;
  fingerprint text; entry jsonb;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','false') <> 'false'
    or not private.has_project_role(p_project, array['project_owner','planner','hostess']) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_operation is null or p_count is null or p_count not between 1 and 20 then
    raise exception 'Invalid admission input' using errcode = '23514';
  end if;
  fingerprint := encode(extensions.digest(jsonb_build_array(p_project,p_ticket,p_digest,p_count,auth.uid())::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended(p_operation::text, 841));
  select * into a from private.invitation_admissions where id = p_operation;
  if found then
    if a.project_id <> p_project or a.intent_hash <> fingerprint then
      raise exception 'Operation intent changed' using errcode = 'P0001';
    end if;
    return a.result;
  end if;
  if exists (select 1 from private.invitation_passes where id = p_operation) then
    raise exception 'Operation already used' using errcode = 'P0001';
  end if;
  select * into t from private.invitation_passes where id = p_ticket and project_id = p_project and credential_digest = p_digest;
  if not found then raise exception 'Ticket unavailable' using errcode = 'P0002'; end if;
  -- Same order as direct guest UPDATE: guest first, then its ticket. Re-read after waiting.
  select * into g from public.invitation_guests where id = t.guest_id and project_id = p_project for update;
  select * into t from private.invitation_passes where id = p_ticket and project_id = p_project for update;
  if t.id is null or g.id is null or t.revoked_at is not null or t.expires_at <= clock_timestamp() then
    raise exception 'Ticket unavailable' using errcode = 'P0002';
  end if;
  if t.admitted + p_count > g.passes then
    raise exception 'Insufficient remaining passes' using errcode = 'P0001';
  end if;
  update private.invitation_passes set admitted = admitted + p_count where id = p_ticket;
  entry := jsonb_build_object('operationId',p_operation,'ticketId',p_ticket,'count',p_count,
    'admitted',t.admitted + p_count,'remaining',g.passes - t.admitted - p_count,'confirmedAt',clock_timestamp());
  insert into private.invitation_admissions(id,project_id,ticket_id,actor_id,intent_hash,admitted_count,result)
    values(p_operation,p_project,p_ticket,auth.uid(),fingerprint,p_count,entry);
  return entry;
end $function$;

CREATE OR REPLACE FUNCTION private.pass_context (
  p_project uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare label text;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','false') <> 'false'
    or not private.has_project_role(p_project,array['project_owner','planner','hostess']) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select name into label from public.invitation_projects where id=p_project;
  return jsonb_build_object('projectName',label,'canIssue',private.has_project_role(p_project,array['project_owner','planner']),'canAdmit',true);
end $function$;

CREATE OR REPLACE FUNCTION private.pass_inspect (
  p_project uuid,
  p_ticket  uuid,
  p_digest  text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','false') <> 'false'
    or not private.has_project_role(p_project, array['project_owner','planner','hostess']) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from private.invitation_passes where id = p_ticket and project_id = p_project
    and credential_digest = p_digest and revoked_at is null and expires_at > clock_timestamp()) then
    raise exception 'Ticket unavailable' using errcode = 'P0002';
  end if;
  return private.pass_snapshot(p_ticket);
end $function$;

CREATE OR REPLACE FUNCTION private.pass_issue (
  p_project   uuid,
  p_operation uuid,
  p_name      text,
  p_passes    integer,
  p_table     uuid,
  p_immediate boolean,
  p_digest    text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  t private.invitation_passes; g uuid; fingerprint text; snapshot jsonb; entry jsonb;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','false') <> 'false'
    or not private.has_project_role(p_project, array['project_owner','planner']) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_operation is null or p_name is null or p_name <> btrim(p_name, E' \t\n\r')
    or char_length(p_name) not between 1 and 160 or p_passes is null or p_passes not between 1 and 20
    or p_immediate is null or p_digest is null or p_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid issue input' using errcode = '23514';
  end if;
  fingerprint := encode(extensions.digest(jsonb_build_array(p_project,p_name,p_passes,p_table,p_immediate,p_digest,auth.uid())::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended(p_operation::text, 841));
  select * into t from private.invitation_passes where id = p_operation;
  if found then
    if t.project_id <> p_project or t.issue_hash <> fingerprint then
      raise exception 'Operation intent changed' using errcode = 'P0001';
    end if;
    return t.issue_result;
  end if;
  if exists (select 1 from private.invitation_admissions where id = p_operation) then
    raise exception 'Operation already used' using errcode = 'P0001';
  end if;
  insert into public.invitation_guests(project_id,name,passes,table_id)
    values (p_project,p_name,p_passes,p_table) returning id into g;
  insert into private.invitation_passes(id,project_id,guest_id,credential_digest,issued_by,admitted,issue_hash,issue_result)
    values (p_operation,p_project,g,p_digest,auth.uid(),case when p_immediate then p_passes else 0 end,fingerprint,'{}');
  snapshot := private.pass_snapshot(p_operation);
  update private.invitation_passes set issue_result = snapshot where id = p_operation;
  if p_immediate then
    entry := jsonb_build_object('operationId',p_operation,'ticketId',p_operation,'count',p_passes,
      'admitted',p_passes,'remaining',0,'confirmedAt',clock_timestamp());
    insert into private.invitation_admissions(id,project_id,ticket_id,actor_id,intent_hash,admitted_count,result)
      values(p_operation,p_project,p_operation,auth.uid(),fingerprint,p_passes,entry);
  end if;
  return snapshot;
end $function$;

CREATE OR REPLACE FUNCTION private.pass_public (
  p_project uuid,
  p_ticket  uuid,
  p_digest  text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if not exists (select 1 from private.invitation_passes where id = p_ticket and project_id = p_project
    and credential_digest = p_digest and revoked_at is null and expires_at > clock_timestamp()) then
    raise exception 'Ticket unavailable' using errcode = 'P0002';
  end if;
  return private.pass_snapshot(p_ticket) - 'ticketId' - 'guestId' - 'projectId';
end $function$;

CREATE OR REPLACE FUNCTION private.pass_revoke (
  p_project uuid,
  p_ticket  uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare t private.invitation_passes;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','false') <> 'false'
    or not private.has_project_role(p_project, array['project_owner','planner']) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select * into t from private.invitation_passes where id = p_ticket and project_id = p_project;
  if not found then raise exception 'Ticket unavailable' using errcode = 'P0002'; end if;
  perform 1 from public.invitation_guests where id = t.guest_id and project_id = p_project for update;
  update private.invitation_passes set revoked_at = coalesce(revoked_at,clock_timestamp()),
    revoked_by = coalesce(revoked_by,auth.uid()) where id = p_ticket and project_id = p_project;
  return jsonb_build_object('ticketId',p_ticket,'revoked',true);
end $function$;

CREATE OR REPLACE FUNCTION private.pass_snapshot (
  p_ticket uuid
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
  select jsonb_build_object('ticketId', t.id, 'guestId', g.id, 'projectId', t.project_id,
    'name', g.name, 'passes', g.passes, 'admitted', t.admitted,
    'remaining', g.passes - t.admitted, 'expiresAt', t.expires_at,
    'revoked', t.revoked_at is not null, 'projectName', p.name, 'tableName', m.name)
  from private.invitation_passes t join public.invitation_guests g on g.id = t.guest_id
  join public.invitation_projects p on p.id = t.project_id
  left join public.invitation_tables m on m.id = g.table_id and m.project_id = g.project_id
  where t.id = p_ticket
$function$;

CREATE OR REPLACE FUNCTION public.invitation_pass_admit (
  p_project   uuid,
  p_ticket    uuid,
  p_digest    text,
  p_operation uuid,
  p_count     integer
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ select private.pass_admit(p_project,p_ticket,p_digest,p_operation,p_count) $function$;

CREATE OR REPLACE FUNCTION public.invitation_pass_context (
  p_project uuid
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ select private.pass_context(p_project) $function$;

CREATE OR REPLACE FUNCTION public.invitation_pass_inspect (
  p_project uuid,
  p_ticket  uuid,
  p_digest  text
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ select private.pass_inspect(p_project,p_ticket,p_digest) $function$;

CREATE OR REPLACE FUNCTION public.invitation_pass_issue (
  p_project   uuid,
  p_operation uuid,
  p_name      text,
  p_passes    integer,
  p_table     uuid,
  p_immediate boolean,
  p_digest    text
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
  select private.pass_issue(p_project,p_operation,p_name,p_passes,p_table,p_immediate,p_digest)
$function$;

CREATE OR REPLACE FUNCTION public.invitation_pass_public (
  p_project uuid,
  p_ticket  uuid,
  p_digest  text
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ select private.pass_public(p_project,p_ticket,p_digest) $function$;

CREATE OR REPLACE FUNCTION public.invitation_pass_revoke (
  p_project uuid,
  p_ticket  uuid
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ select private.pass_revoke(p_project,p_ticket) $function$;

ALTER TABLE "private"."invitation_admissions"
  ADD CONSTRAINT "invitation_admissions_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.invitation_projects(id) ON DELETE CASCADE;

ALTER TABLE "private"."invitation_passes"
  ADD CONSTRAINT "invitation_passes_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.invitation_projects(id) ON DELETE CASCADE;

ALTER TABLE "private"."invitation_admissions"
  ADD CONSTRAINT "invitation_admissions_project_id_ticket_id_fkey" FOREIGN KEY (project_id, ticket_id) REFERENCES private.invitation_passes(project_id, id) ON DELETE CASCADE;

ALTER TABLE "public"."invitation_guests"
  ADD CONSTRAINT "invitation_guests_project_id_key" UNIQUE (project_id, id);

ALTER TABLE "private"."invitation_passes"
  ADD CONSTRAINT "invitation_passes_project_id_guest_id_fkey" FOREIGN KEY (project_id, guest_id) REFERENCES public.invitation_guests(project_id, id) ON DELETE CASCADE;

CREATE INDEX invitation_admissions_project_ticket_idx ON private.invitation_admissions USING btree (project_id, ticket_id);

CREATE TRIGGER invitation_guests_guard_balance
  BEFORE UPDATE OF passes ON public.invitation_guests
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_guest_admitted_balance();

REVOKE ALL ON FUNCTION "private"."guard_guest_admitted_balance"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."guard_guest_admitted_balance"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."pass_admit"(uuid, uuid, text, uuid, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."pass_admit"(uuid, uuid, text, uuid, integer) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."pass_context"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."pass_context"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."pass_inspect"(uuid, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."pass_inspect"(uuid, uuid, text) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."pass_issue"(uuid, uuid, text, integer, uuid, boolean, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."pass_issue"(uuid, uuid, text, integer, uuid, boolean, text) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."pass_public"(uuid, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."pass_public"(uuid, uuid, text) TO "anon", "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."pass_revoke"(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."pass_revoke"(uuid, uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."pass_snapshot"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."pass_snapshot"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."invitation_pass_admit"(uuid, uuid, text, uuid, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."invitation_pass_admit"(uuid, uuid, text, uuid, integer) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."invitation_pass_context"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."invitation_pass_context"(uuid) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."invitation_pass_inspect"(uuid, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."invitation_pass_inspect"(uuid, uuid, text) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."invitation_pass_issue"(uuid, uuid, text, integer, uuid, boolean, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."invitation_pass_issue"(uuid, uuid, text, integer, uuid, boolean, text) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."invitation_pass_public"(uuid, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."invitation_pass_public"(uuid, uuid, text) TO "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."invitation_pass_revoke"(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."invitation_pass_revoke"(uuid, uuid) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON SCHEMA "private" FROM "anon";

GRANT USAGE ON SCHEMA "private" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."invitation_admissions" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."invitation_passes" TO "postgres";

-- Fresh Supabase databases may have explicit default grants in addition to PUBLIC.
-- Revoke them before regranting only the scoped API. No service-role path is needed.
REVOKE ALL ON TABLE private.invitation_passes,private.invitation_admissions FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.pass_snapshot(uuid),private.guard_guest_admitted_balance() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.pass_context(uuid),public.invitation_pass_context(uuid),
 private.pass_issue(uuid,uuid,text,integer,uuid,boolean,text),public.invitation_pass_issue(uuid,uuid,text,integer,uuid,boolean,text),
 private.pass_inspect(uuid,uuid,text),public.invitation_pass_inspect(uuid,uuid,text),
 private.pass_admit(uuid,uuid,text,uuid,integer),public.invitation_pass_admit(uuid,uuid,text,uuid,integer),
 private.pass_revoke(uuid,uuid),public.invitation_pass_revoke(uuid,uuid),
 private.pass_public(uuid,uuid,text),public.invitation_pass_public(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.pass_context(uuid),public.invitation_pass_context(uuid),
 private.pass_issue(uuid,uuid,text,integer,uuid,boolean,text),public.invitation_pass_issue(uuid,uuid,text,integer,uuid,boolean,text),
 private.pass_inspect(uuid,uuid,text),public.invitation_pass_inspect(uuid,uuid,text),
 private.pass_admit(uuid,uuid,text,uuid,integer),public.invitation_pass_admit(uuid,uuid,text,uuid,integer),
 private.pass_revoke(uuid,uuid),public.invitation_pass_revoke(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.pass_public(uuid,uuid,text),public.invitation_pass_public(uuid,uuid,text) TO anon,authenticated;
