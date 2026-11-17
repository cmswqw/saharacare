begin;

create table private.directory_audit (
  id uuid primary key default gen_random_uuid(),
  entity_table text not null,
  entity_id uuid not null,
  operation text not null,
  actor_id uuid references public.profiles(id) on delete restrict,
  changed_at timestamptz not null default statement_timestamp(),
  source text not null,
  reason text,
  before_state jsonb,
  after_state jsonb
);
create index directory_audit_actor_idx on private.directory_audit(actor_id);
create index directory_audit_entity_idx on private.directory_audit(entity_table, entity_id, changed_at desc);
alter table private.directory_audit enable row level security;
revoke all on private.directory_audit from public, anon, authenticated, service_role;
grant select on private.directory_audit to service_role;

create function private.audit_directory_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into private.directory_audit(entity_table,entity_id,operation,actor_id,source,reason,before_state,after_state)
  values(tg_table_name,coalesce(new.id,old.id),tg_op,(select auth.uid()),
    case when (select auth.uid()) is null then 'trusted_server' else 'authenticated_admin' end,
    nullif(current_setting('saharacare.directory_reason',true),''),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new,old);
end;
$$;
revoke all on function private.audit_directory_change() from public,anon,authenticated;
create trigger directory_providers_audit after insert or update or delete on private.directory_providers for each row execute function private.audit_directory_change();
create trigger directory_affiliations_audit after insert or update or delete on private.directory_affiliations for each row execute function private.audit_directory_change();
create trigger directory_entitlements_audit after insert or update or delete on private.directory_entitlements for each row execute function private.audit_directory_change();

create function private.require_directory_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and account_status='active') then
    raise exception using errcode='42501',message='Active admin authorization is required.';
  end if;
end;
$$;
revoke all on function private.require_directory_admin() from public,anon,authenticated;

create function private.get_directory_admin_state()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform private.require_directory_admin();
  select jsonb_build_object(
    'providers',coalesce((select jsonb_agg(to_jsonb(p)) from (select id,provider_type,display_name,active,approval_status,verification_status,verification_reference,publication_status,is_demo,review_notes,reviewed_by,reviewed_at from private.directory_providers order by display_name,id limit 200) p),'[]'::jsonb),
    'affiliations',coalesce((select jsonb_agg(to_jsonb(a)) from (select a.*,d.display_name as doctor_name,f.display_name as facility_name from private.directory_affiliations a join private.directory_providers d on d.id=a.doctor_provider_id join private.directory_providers f on f.id=a.facility_provider_id order by d.display_name,f.display_name limit 400) a),'[]'::jsonb),
    'entitlements',coalesce((select jsonb_agg(to_jsonb(e)) from (select e.*, (e.payment_status='paid' and e.starts_at<=statement_timestamp() and e.ends_at>statement_timestamp()) as in_period from private.directory_entitlements e order by ends_at desc,id limit 200) e),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(to_jsonb(a)) from (select id,entity_table,entity_id,operation,actor_id,changed_at,source,reason from private.directory_audit order by changed_at desc,id limit 100) a),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function private.get_directory_admin_state() from public,anon,authenticated;
grant execute on function private.get_directory_admin_state() to authenticated;

create function private.manage_directory_listing(requested_operation text, payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target_id uuid; reference text; reason text; result_id uuid;
  provider private.directory_providers%rowtype;
  entitlement private.directory_entitlements%rowtype;
  start_time timestamptz; end_time timestamptz;
begin
  perform private.require_directory_admin();
  if jsonb_typeof(payload) is distinct from 'object' then raise exception using errcode='22023',message='Invalid listing update.'; end if;
  reason:=nullif(btrim(payload->>'reason'),'');
  if reason is null or char_length(reason)>1000 then raise exception using errcode='22023',message='A short audit reason is required.'; end if;
  perform set_config('saharacare.directory_reason',reason,true);
  target_id:=(payload->>'id')::uuid;
  if target_id is null then raise exception using errcode='22023',message='Choose a listing record.'; end if;

  if requested_operation='provider' then
    if payload - array['id','reason','active','approval_status','verification_status','publication_status','verification_reference'] <> '{}'::jsonb
      or jsonb_typeof(payload->'active') is distinct from 'boolean'
      or coalesce(payload->>'approval_status','') not in ('pending','approved','rejected')
      or coalesce(payload->>'verification_status','') not in ('unverified','verified','rejected')
      or coalesce(payload->>'publication_status','') not in ('draft','published','suspended')
    then raise exception using errcode='22023',message='Invalid listing state.'; end if;
    reference:=nullif(btrim(payload->>'verification_reference'),'');
    if payload->>'verification_status'='verified' and (reference is null or char_length(reference)>200) then
      raise exception using errcode='22023',message='Record evidence for manual verification.';
    end if;
    update private.directory_providers set active=(payload->>'active')::boolean,
      approval_status=payload->>'approval_status',verification_status=payload->>'verification_status',
      publication_status=payload->>'publication_status',review_notes=reason,
      verification_reference=case when payload->>'verification_status'='verified' then reference end,
      reviewed_by=(select auth.uid()),reviewed_at=statement_timestamp()
    where id=target_id returning id into result_id;
  elsif requested_operation='affiliation' then
    if payload - array['id','reason','active','approval_status'] <> '{}'::jsonb
      or jsonb_typeof(payload->'active') is distinct from 'boolean'
      or coalesce(payload->>'approval_status','') not in ('pending','approved','rejected') then
      raise exception using errcode='22023',message='Invalid affiliation state.'; end if;
    update private.directory_affiliations set active=(payload->>'active')::boolean,approval_status=payload->>'approval_status'
      where id=target_id returning id into result_id;
  elsif requested_operation='record_payment' then
    if payload - array['id','reason','plan','payment_reference','starts_at','ends_at'] <> '{}'::jsonb
      or coalesce(payload->>'plan','') not in ('listing','sponsored') then
      raise exception using errcode='22023',message='Invalid manual payment.'; end if;
    reference:=nullif(btrim(payload->>'payment_reference'),'');
    start_time:=(payload->>'starts_at')::timestamptz; end_time:=(payload->>'ends_at')::timestamptz;
    if reference is null or char_length(reference)>200 or start_time is null or end_time is null
      or not isfinite(start_time) or not isfinite(end_time) or end_time<=start_time then
      raise exception using errcode='22023',message='Record an external reference and valid entitlement dates.'; end if;
    select * into provider from private.directory_providers where id=target_id for update;
    if provider.id is null then raise exception using errcode='22023',message='Listing not found.'; end if;
    insert into private.directory_entitlements(provider_id,plan,payment_status,starts_at,ends_at,is_demo,payment_reference,internal_notes)
      values(target_id,payload->>'plan','paid',start_time,end_time,provider.is_demo,reference,'Manual external listing payment: '||reason)
      on conflict(payment_reference) do nothing returning id into result_id;
    if result_id is null then
      select * into entitlement from private.directory_entitlements where payment_reference=reference;
      if entitlement.provider_id is distinct from target_id or entitlement.plan is distinct from payload->>'plan'
        or entitlement.starts_at is distinct from start_time or entitlement.ends_at is distinct from end_time
        or entitlement.payment_status is distinct from 'paid' then
        raise exception using errcode='22023',message='Payment reference already recorded with different or revoked terms.'; end if;
      result_id:=entitlement.id;
    end if;
  elsif requested_operation='revoke_entitlement' then
    if payload - array['id','reason'] <> '{}'::jsonb then raise exception using errcode='22023',message='Invalid revocation.'; end if;
    update private.directory_entitlements set payment_status='revoked',internal_notes='Manual revocation: '||reason
      where id=target_id returning id into result_id;
  else raise exception using errcode='22023',message='Unknown listing operation.';
  end if;
  if result_id is null then raise exception using errcode='22023',message='Listing record not found.'; end if;
  return result_id;
end;
$$;
revoke all on function private.manage_directory_listing(text,jsonb) from public,anon,authenticated;
grant execute on function private.manage_directory_listing(text,jsonb) to authenticated;

create function public.get_directory_admin_state() returns jsonb language sql stable security invoker set search_path='' as $$ select private.get_directory_admin_state(); $$;
create function public.manage_directory_listing(requested_operation text,payload jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.manage_directory_listing(requested_operation,payload); $$;
revoke all on function public.get_directory_admin_state() from public,anon,authenticated;
revoke all on function public.manage_directory_listing(text,jsonb) from public,anon,authenticated;
grant execute on function public.get_directory_admin_state() to authenticated;
grant execute on function public.manage_directory_listing(text,jsonb) to authenticated;

-- Demo accounts are explicitly flagged by the opt-in LOCAL seed, never here.
-- A demo patient, doctor and booking actor must belong to the same mode.
create function private.enforce_directory_demo_booking()
returns trigger language plpgsql security definer set search_path='' as $$
declare patient_demo boolean; doctor_demo boolean; actor_demo boolean;
begin
  select demo_mode_enabled into patient_demo from public.profiles where id=new.patient_id;
  select demo_mode_enabled into doctor_demo from public.profiles where id=new.doctor_id;
  select demo_mode_enabled into actor_demo from public.profiles where id=(select auth.uid());
  if coalesce(patient_demo,false) <> coalesce(doctor_demo,false)
    or coalesce(patient_demo,false) <> coalesce(actor_demo,false)
  then raise exception using errcode='42501',message='Demo appointments must use isolated demo accounts.'; end if;
  return new;
end;
$$;
revoke all on function private.enforce_directory_demo_booking() from public,anon,authenticated;
create trigger appointments_directory_demo_isolation before insert or update on public.appointments
  for each row execute function private.enforce_directory_demo_booking();

create function private.directory_profile_in_same_mode(target_profile_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles target join public.profiles actor on actor.id=(select auth.uid())
    where target.id=target_profile_id and target.demo_mode_enabled=actor.demo_mode_enabled);
$$;
revoke all on function private.directory_profile_in_same_mode(uuid) from public,anon,authenticated;
grant execute on function private.directory_profile_in_same_mode(uuid) to authenticated;
create policy profiles_directory_demo_visibility on public.profiles as restrictive for select to authenticated
  using(id=(select auth.uid()) or role <> 'doctor' or private.directory_profile_in_same_mode(id));
create policy appointments_directory_demo_visibility on public.appointments as restrictive for select to authenticated
  using(private.directory_profile_in_same_mode(patient_id) and private.directory_profile_in_same_mode(doctor_id));

commit;
