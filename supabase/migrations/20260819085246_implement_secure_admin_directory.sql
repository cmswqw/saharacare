begin;

-- Admins use the existing Supabase Auth + profiles role model. Public signup
-- remains limited to patient, caregiver, and doctor in the auth trigger below.
alter table public.profiles
  add column account_status text not null default 'active';

alter table public.profiles
  add constraint profiles_account_status_check
    check (account_status in ('active', 'inactive'));

alter table public.profiles
  drop constraint profiles_role_check,
  add constraint profiles_role_check
    check (role in ('patient', 'caregiver', 'doctor', 'admin'));

alter table public.profiles
  drop constraint profiles_linking_code_role_check,
  add constraint profiles_linking_code_role_check check (
    (
      role = 'patient'
      and linking_code is not null
      and linking_code ~ '^SC-[0-9A-F]{10}$'
    )
    or (role in ('caregiver', 'doctor', 'admin') and linking_code is null)
  );

create index profiles_role_account_status_idx
  on public.profiles (role, account_status);

-- Browser-provided user metadata can never create an admin. Admin promotion is
-- an explicit, trusted database operation performed after account creation.
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
    when new.raw_user_meta_data ->> 'role' in ('patient', 'caregiver', 'doctor')
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

-- This is the only additional read boundary for an admin. It deliberately
-- returns no email, linking code, avatar, medication, dose, appointment,
-- medical-share, storage, or KYC fields.
create or replace function public.get_admin_directory()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  directory jsonb;
begin
  if (select auth.uid()) is null
    or not exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and role = 'admin'
    )
  then
    raise exception using
      errcode = '42501',
      message = 'Admin authorization is required.';
  end if;

  select jsonb_build_object(
    'summary', jsonb_build_object(
      'totalPatients', (
        select count(*) from public.profiles where role = 'patient'
      ),
      'patientsWithCaregiver', (
        select count(distinct links.patient_id)
        from public.caregiver_links as links
        join public.profiles as patients
          on patients.id = links.patient_id
         and patients.role = 'patient'
        join public.profiles as caregivers
          on caregivers.id = links.caregiver_id
         and caregivers.role = 'caregiver'
        where links.status = 'accepted'
      ),
      'patientsWithoutCaregiver', (
        select count(*)
        from public.profiles as patients
        where patients.role = 'patient'
          and not exists (
            select 1
            from public.caregiver_links as links
            join public.profiles as caregivers
              on caregivers.id = links.caregiver_id
             and caregivers.role = 'caregiver'
            where links.patient_id = patients.id
              and links.status = 'accepted'
          )
      ),
      'activeCaregivers', (
        select count(*)
        from public.profiles
        where role = 'caregiver' and account_status = 'active'
      ),
      'activeDoctors', (
        select count(*)
        from public.profiles
        where role = 'doctor' and account_status = 'active'
      )
    ),
    'patients', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', patients.id,
          'displayName', patients.full_name,
          'accountStatus', patients.account_status,
          'createdAt', patients.created_at,
          'caregivers', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', caregivers.id,
                'displayName', caregivers.full_name,
                'accountStatus', caregivers.account_status
              )
              order by caregivers.full_name, caregivers.id
            )
            from public.caregiver_links as links
            join public.profiles as caregivers
              on caregivers.id = links.caregiver_id
             and caregivers.role = 'caregiver'
            where links.patient_id = patients.id
              and links.status = 'accepted'
          ), '[]'::jsonb)
        )
        order by patients.full_name, patients.id
      )
      from public.profiles as patients
      where patients.role = 'patient'
    ), '[]'::jsonb),
    'caregivers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', caregivers.id,
          'displayName', caregivers.full_name,
          'accountStatus', caregivers.account_status,
          'createdAt', caregivers.created_at,
          'patients', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', patients.id,
                'displayName', patients.full_name
              )
              order by patients.full_name, patients.id
            )
            from public.caregiver_links as links
            join public.profiles as patients
              on patients.id = links.patient_id
             and patients.role = 'patient'
            where links.caregiver_id = caregivers.id
              and links.status = 'accepted'
          ), '[]'::jsonb)
        )
        order by caregivers.full_name, caregivers.id
      )
      from public.profiles as caregivers
      where caregivers.role = 'caregiver'
    ), '[]'::jsonb),
    'doctors', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', doctors.id,
          'displayName', doctors.full_name,
          'accountStatus', doctors.account_status,
          'role', doctors.role,
          'createdAt', doctors.created_at
        )
        order by doctors.full_name, doctors.id
      )
      from public.profiles as doctors
      where doctors.role = 'doctor'
    ), '[]'::jsonb)
  ) into directory;

  return directory;
end;
$$;

revoke all on function public.get_admin_directory()
  from public, anon, authenticated;
grant execute on function public.get_admin_directory()
  to authenticated;

comment on function public.get_admin_directory() is
  'Minimal, read-only admin account and accepted caregiver-link directory. Contains no medical data.';

commit;
