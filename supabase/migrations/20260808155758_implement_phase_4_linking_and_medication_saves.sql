begin;

-- SaharaCare Phase 4: patient-caregiver linking codes and atomic medication
-- plus schedule saves. Dose tracking, Realtime, and seed data are intentionally
-- excluded from this migration.

alter table public.profiles
  add column linking_code text;

create function private.generate_saharacare_linking_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  generated_code text;
begin
  loop
    generated_code := 'SC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

    exit when not exists (
      select 1
      from public.profiles
      where linking_code = generated_code
    );
  end loop;

  return generated_code;
end;
$$;

revoke all on function private.generate_saharacare_linking_code()
  from public, anon, authenticated;

update public.profiles
set linking_code = private.generate_saharacare_linking_code()
where role = 'patient';

alter table public.profiles
  add constraint profiles_linking_code_key unique (linking_code),
  add constraint profiles_linking_code_role_check check (
    (
      role = 'patient'
      and linking_code is not null
      and linking_code ~ '^SC-[0-9A-F]{10}$'
    )
    or (role = 'caregiver' and linking_code is null)
  );

-- New patient profiles receive their private linking code during Auth signup.
-- The role is still derived only during account creation and authorization
-- continues to use the public.profiles row, not mutable JWT user metadata.
create or replace function public.handle_new_saharacare_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_role text;
begin
  new_role := case
    when new.raw_user_meta_data ->> 'role' in ('patient', 'caregiver')
      then new.raw_user_meta_data ->> 'role'
    else 'patient'
  end;

  insert into public.profiles (
    id,
    full_name,
    role,
    avatar_url,
    linking_code
  )
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'SaharaCare user'
    ),
    new_role,
    nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    case
      when new_role = 'patient'
        then private.generate_saharacare_linking_code()
      else null
    end
  );

  return new;
end;
$$;

revoke all on function public.handle_new_saharacare_user()
  from public, anon, authenticated;

-- Patients need the caregiver's display name to review pending requests. This
-- helper reveals only whether the target caregiver participates in one of the
-- current patient's links; unrelated profiles remain hidden.
create function private.current_patient_is_linked_to_caregiver(
  target_caregiver_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.caregiver_links
      where patient_id = (select auth.uid())
        and caregiver_id = target_caregiver_id
    );
$$;

revoke all on function private.current_patient_is_linked_to_caregiver(uuid)
  from public, anon, authenticated;
grant execute on function private.current_patient_is_linked_to_caregiver(uuid)
  to authenticated;

drop policy "profiles_select_own_or_linked_patient"
  on public.profiles;

create policy "profiles_select_own_or_link_participant"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select private.is_accepted_caregiver(id))
  or (select private.current_patient_is_linked_to_caregiver(id))
);

-- Linking requests must go through the code-based RPC. Direct table inserts
-- are no longer exposed to authenticated API callers, so knowing a UUID is not
-- enough to initiate a relationship.
revoke insert on table public.caregiver_links from authenticated;

create function public.request_caregiver_link(patient_code text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_caregiver_id uuid := (select auth.uid());
  target_patient_id uuid;
  resulting_status text;
begin
  if current_caregiver_id is null
    or not private.current_user_has_role('caregiver') then
    raise exception 'Only an authenticated caregiver can request a link'
      using errcode = '42501';
  end if;

  if upper(btrim(patient_code)) !~ '^SC-[0-9A-F]{10}$' then
    raise exception 'Invalid patient linking code'
      using errcode = '22023';
  end if;

  select id
  into target_patient_id
  from public.profiles
  where linking_code = upper(btrim(patient_code))
    and role = 'patient';

  if target_patient_id is null then
    raise exception 'Invalid patient linking code'
      using errcode = '22023';
  end if;

  if target_patient_id = current_caregiver_id then
    raise exception 'A user cannot link to themselves'
      using errcode = '23514';
  end if;

  insert into public.caregiver_links (patient_id, caregiver_id, status)
  values (target_patient_id, current_caregiver_id, 'pending')
  on conflict (patient_id, caregiver_id) do nothing;

  select status
  into resulting_status
  from public.caregiver_links
  where patient_id = target_patient_id
    and caregiver_id = current_caregiver_id;

  return resulting_status;
end;
$$;

revoke all on function public.request_caregiver_link(text)
  from public, anon, authenticated;
grant execute on function public.request_caregiver_link(text)
  to authenticated;

-- A medication and its simple list of daily/weekday times are saved in one
-- transaction. SECURITY INVOKER keeps all existing table RLS policies active,
-- while auth.uid() supplies the only patient identity used by the function.
create function public.save_patient_medication(
  medication_id uuid,
  medication_name text,
  medication_dosage text,
  medication_instructions text,
  medication_active boolean,
  scheduled_times time without time zone[],
  schedule_days smallint[]
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  current_patient_id uuid := (select auth.uid());
  saved_medication_id uuid;
  affected_rows integer;
begin
  if current_patient_id is null
    or not private.current_user_has_role('patient') then
    raise exception 'Only an authenticated patient can save medications'
      using errcode = '42501';
  end if;

  if nullif(btrim(medication_name), '') is null
    or nullif(btrim(medication_dosage), '') is null then
    raise exception 'Medication name and dosage are required'
      using errcode = '22023';
  end if;

  if scheduled_times is null
    or cardinality(scheduled_times) < 1
    or cardinality(scheduled_times) > 8
    or array_position(scheduled_times, null) is not null then
    raise exception 'Provide between one and eight valid scheduled times'
      using errcode = '22023';
  end if;

  if schedule_days is null
    or cardinality(schedule_days) < 1
    or cardinality(schedule_days) > 7
    or not schedule_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[] then
    raise exception 'Provide at least one valid day of the week'
      using errcode = '22023';
  end if;

  if medication_id is null then
    insert into public.medications (
      patient_id,
      name,
      dosage,
      instructions,
      active
    )
    values (
      current_patient_id,
      btrim(medication_name),
      btrim(medication_dosage),
      nullif(btrim(medication_instructions), ''),
      medication_active
    )
    returning id into saved_medication_id;
  else
    update public.medications
    set
      name = btrim(medication_name),
      dosage = btrim(medication_dosage),
      instructions = nullif(btrim(medication_instructions), ''),
      active = medication_active
    where id = medication_id
      and patient_id = current_patient_id
    returning id into saved_medication_id;

    get diagnostics affected_rows = row_count;

    if affected_rows <> 1 then
      raise exception 'Medication not found or not owned by the patient'
        using errcode = '42501';
    end if;

    delete from public.medication_schedules
    where medication_schedules.medication_id = saved_medication_id;
  end if;

  insert into public.medication_schedules (
    medication_id,
    scheduled_time,
    days_of_week
  )
  select
    saved_medication_id,
    unique_time,
    schedule_days
  from (
    select distinct unnest(scheduled_times) as unique_time
  ) as unique_times;

  return saved_medication_id;
end;
$$;

revoke all on function public.save_patient_medication(
  uuid,
  text,
  text,
  text,
  boolean,
  time without time zone[],
  smallint[]
) from public, anon, authenticated;
grant execute on function public.save_patient_medication(
  uuid,
  text,
  text,
  text,
  boolean,
  time without time zone[],
  smallint[]
) to authenticated;

commit;
