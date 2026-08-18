begin;

-- SaharaCare medical KYC and appointment-scoped sharing.
-- The medical questionnaire and generated summary never enter Postgres. This
-- migration stores only appointment and temporary-file metadata.

alter table public.profiles
  drop constraint profiles_role_check,
  add constraint profiles_role_check
    check (role in ('patient', 'caregiver', 'doctor'));

alter table public.profiles
  drop constraint profiles_linking_code_role_check,
  add constraint profiles_linking_code_role_check check (
    (
      role = 'patient'
      and linking_code is not null
      and linking_code ~ '^SC-[0-9A-F]{10}$'
    )
    or (role in ('caregiver', 'doctor') and linking_code is null)
  );

-- New doctor accounts use the same authoritative profile creation boundary as
-- the existing patient and caregiver accounts.
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

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  doctor_id uuid not null references public.profiles (id) on delete restrict,
  facility text not null,
  purpose text not null,
  note text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_distinct_participants_check
    check (patient_id <> doctor_id),
  constraint appointments_facility_not_blank_check
    check (char_length(btrim(facility)) between 1 and 200),
  constraint appointments_purpose_not_blank_check
    check (char_length(btrim(purpose)) between 1 and 500),
  constraint appointments_note_length_check
    check (note is null or char_length(note) <= 2000),
  constraint appointments_time_order_check
    check (starts_at < ends_at),
  constraint appointments_status_check
    check (status in ('requested', 'confirmed', 'completed', 'cancelled'))
);

create index appointments_patient_starts_at_idx
  on public.appointments (patient_id, starts_at desc);
create index appointments_doctor_starts_at_idx
  on public.appointments (doctor_id, starts_at desc);
create index appointments_status_starts_at_idx
  on public.appointments (status, starts_at);

create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function private.set_updated_at();

create function private.validate_appointment_roles()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  patient_role text;
  doctor_role text;
begin
  select role into patient_role
  from public.profiles
  where id = new.patient_id;

  select role into doctor_role
  from public.profiles
  where id = new.doctor_id;

  if patient_role is distinct from 'patient' then
    raise exception using
      errcode = '23514',
      message = 'Appointment patient must have the patient role.';
  end if;

  if doctor_role is distinct from 'doctor' then
    raise exception using
      errcode = '23514',
      message = 'Appointment doctor must have the doctor role.';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_appointment_roles()
  from public, anon, authenticated;

create trigger appointments_validate_roles
before insert or update of patient_id, doctor_id on public.appointments
for each row execute function private.validate_appointment_roles();

-- The grace period is centralized server-side in the database and can be
-- changed by an administrator without accepting a browser-provided expiry.
create table private.medical_share_config (
  singleton boolean primary key default true,
  grace_minutes integer not null default 60,
  constraint medical_share_config_singleton_check check (singleton),
  constraint medical_share_config_grace_check
    check (grace_minutes between 0 and 1440)
);

insert into private.medical_share_config (singleton, grace_minutes)
values (true, 60);

revoke all on table private.medical_share_config
  from public, anon, authenticated;

create table public.appointment_medical_shares (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint appointment_medical_shares_revoke_order_check
    check (revoked_at is null or revoked_at >= created_at)
);

create index appointment_medical_shares_appointment_created_idx
  on public.appointment_medical_shares (appointment_id, created_at desc);
create index appointment_medical_shares_cleanup_idx
  on public.appointment_medical_shares (expires_at)
  where revoked_at is null;

create function private.set_medical_share_expiry()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  appointment_end timestamptz;
  appointment_status text;
  configured_grace integer;
begin
  select ends_at, status
  into appointment_end, appointment_status
  from public.appointments
  where id = new.appointment_id;

  if appointment_end is null then
    raise exception using
      errcode = '23503',
      message = 'The appointment does not exist.';
  end if;

  if appointment_status = 'cancelled' then
    raise exception using
      errcode = '23514',
      message = 'Cancelled appointments cannot receive medical files.';
  end if;

  select grace_minutes into configured_grace
  from private.medical_share_config
  where singleton = true;

  new.expires_at := appointment_end
    + make_interval(mins => coalesce(configured_grace, 60));

  if new.expires_at <= statement_timestamp() then
    raise exception using
      errcode = '23514',
      message = 'The appointment sharing window has ended.';
  end if;

  return new;
end;
$$;

revoke all on function private.set_medical_share_expiry()
  from public, anon, authenticated;

create trigger appointment_medical_shares_set_expiry
before insert or update of appointment_id, expires_at
on public.appointment_medical_shares
for each row execute function private.set_medical_share_expiry();

create table public.appointment_medical_files (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.appointment_medical_shares (id) on delete cascade,
  storage_reference text not null unique,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  content_sha256 text not null,
  kind text not null,
  upload_status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint appointment_medical_files_path_check check (
    storage_reference = 'share/' || share_id::text || '/' || id::text
  ),
  constraint appointment_medical_files_name_check check (
    char_length(btrim(original_filename)) between 1 and 180
    and position('/' in original_filename) = 0
    and position(chr(92) in original_filename) = 0
  ),
  constraint appointment_medical_files_mime_check check (
    mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  ),
  constraint appointment_medical_files_size_check check (
    size_bytes between 1 and 10485760
  ),
  constraint appointment_medical_files_sha_check check (
    content_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint appointment_medical_files_kind_check check (
    kind in ('medical_summary', 'supporting')
  ),
  constraint appointment_medical_files_upload_status_check check (
    upload_status in ('pending', 'ready')
  )
);

create index appointment_medical_files_share_created_idx
  on public.appointment_medical_files (share_id, created_at);

-- This helper is used only by RLS and prevents policy recursion while exposing
-- a profile solely to an appointment participant.
create function private.current_user_has_appointment_with(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.appointments
      where (
        patient_id = (select auth.uid())
        and doctor_id = target_profile_id
      ) or (
        doctor_id = (select auth.uid())
        and patient_id = target_profile_id
      )
    );
$$;

revoke all on function private.current_user_has_appointment_with(uuid)
  from public, anon, authenticated;
grant execute on function private.current_user_has_appointment_with(uuid)
  to authenticated;

drop policy "profiles_select_own_or_link_participant"
  on public.profiles;

create policy "profiles_select_authorized_participant"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or role = 'doctor'
  or (select private.is_accepted_caregiver(id))
  or (select private.current_patient_is_linked_to_caregiver(id))
  or (select private.current_user_has_appointment_with(id))
);

revoke all on table
  public.appointments,
  public.appointment_medical_shares,
  public.appointment_medical_files
from anon, authenticated;

grant select on table
  public.appointments,
  public.appointment_medical_shares,
  public.appointment_medical_files
to authenticated;

grant all on table
  public.appointments,
  public.appointment_medical_shares,
  public.appointment_medical_files
to service_role;

alter table public.appointments enable row level security;
alter table public.appointment_medical_shares enable row level security;
alter table public.appointment_medical_files enable row level security;

create policy "appointments_select_participant"
on public.appointments
for select
to authenticated
using (
  patient_id = (select auth.uid())
  or doctor_id = (select auth.uid())
);

create policy "appointment_medical_shares_select_patient_or_active_doctor"
on public.appointment_medical_shares
for select
to authenticated
using (
  exists (
    select 1
    from public.appointments
    where appointments.id = appointment_medical_shares.appointment_id
      and (
        appointments.patient_id = (select auth.uid())
        or (
          appointments.doctor_id = (select auth.uid())
          and appointments.status <> 'cancelled'
          and appointment_medical_shares.revoked_at is null
          and appointment_medical_shares.expires_at > statement_timestamp()
        )
      )
  )
);

create policy "appointment_medical_files_select_patient_or_active_doctor"
on public.appointment_medical_files
for select
to authenticated
using (
  upload_status = 'ready'
  and exists (
    select 1
    from public.appointment_medical_shares
    join public.appointments
      on appointments.id = appointment_medical_shares.appointment_id
    where appointment_medical_shares.id = appointment_medical_files.share_id
      and (
        appointments.patient_id = (select auth.uid())
        or (
          appointments.doctor_id = (select auth.uid())
          and appointments.status <> 'cancelled'
          and appointment_medical_shares.revoked_at is null
          and appointment_medical_shares.expires_at > statement_timestamp()
        )
      )
  )
);

-- All application downloads pass through an authenticated server route. The
-- bucket stays private and has no authenticated storage.objects policy, so a
-- copied object path or publishable-key request cannot retrieve a file.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'appointment-medical-files',
  'appointment-medical-files',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
