begin;

-- SaharaCare Phase 2: relational schema, integrity constraints, and RLS.
-- This migration intentionally contains no seed data, Realtime setup, or UI wiring.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_not_blank check (char_length(btrim(full_name)) > 0),
  constraint profiles_role_check check (role in ('patient', 'caregiver'))
);

create table public.caregiver_links (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  caregiver_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint caregiver_links_status_check check (status in ('pending', 'accepted')),
  constraint caregiver_links_distinct_users_check check (patient_id <> caregiver_id),
  constraint caregiver_links_patient_caregiver_key unique (patient_id, caregiver_id)
);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  dosage text not null,
  instructions text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medications_name_not_blank check (char_length(btrim(name)) > 0),
  constraint medications_dosage_not_blank check (char_length(btrim(dosage)) > 0),
  constraint medications_id_patient_key unique (id, patient_id)
);

create table public.medication_schedules (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications (id) on delete cascade,
  scheduled_time time without time zone not null,
  days_of_week smallint[] not null default array[0, 1, 2, 3, 4, 5, 6]::smallint[],
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medication_schedules_days_check check (
    cardinality(days_of_week) between 1 and 7
    and days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  ),
  constraint medication_schedules_date_range_check check (
    end_date is null or start_date is null or end_date >= start_date
  ),
  constraint medication_schedules_id_medication_key unique (id, medication_id)
);

create table public.dose_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  medication_id uuid not null,
  schedule_id uuid not null,
  scheduled_at timestamptz not null,
  taken_at timestamptz,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dose_records_status_check check (
    status in ('scheduled', 'taken', 'late', 'missed')
  ),
  constraint dose_records_taken_state_check check (
    (status = 'taken' and taken_at is not null)
    or (status <> 'taken' and taken_at is null)
  ),
  constraint dose_records_medication_patient_fkey
    foreign key (medication_id, patient_id)
    references public.medications (id, patient_id)
    on delete cascade,
  constraint dose_records_schedule_medication_fkey
    foreign key (schedule_id, medication_id)
    references public.medication_schedules (id, medication_id)
    on delete cascade,
  constraint dose_records_scheduled_dose_key unique (schedule_id, scheduled_at)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  patient_id uuid references public.profiles (id) on delete set null,
  type text not null,
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notifications_type_check check (
    type in ('medication_taken', 'medication_late', 'medication_missed')
  ),
  constraint notifications_title_not_blank check (char_length(btrim(title)) > 0),
  constraint notifications_message_not_blank check (char_length(btrim(message)) > 0)
);

-- Foreign keys do not create indexes automatically in PostgreSQL. The unique
-- caregiver pair already covers patient_id as its leading column.
create index caregiver_links_caregiver_id_idx
  on public.caregiver_links (caregiver_id);
create index medications_patient_id_idx
  on public.medications (patient_id);
create index medication_schedules_medication_id_idx
  on public.medication_schedules (medication_id);
create index dose_records_patient_id_idx
  on public.dose_records (patient_id);
create index dose_records_medication_id_idx
  on public.dose_records (medication_id);
create index dose_records_scheduled_at_idx
  on public.dose_records (scheduled_at);
create index notifications_user_id_idx
  on public.notifications (user_id);

-- One timestamp trigger function is shared by every table with updated_at.
create function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger caregiver_links_set_updated_at
before update on public.caregiver_links
for each row execute function private.set_updated_at();

create trigger medications_set_updated_at
before update on public.medications
for each row execute function private.set_updated_at();

create trigger medication_schedules_set_updated_at
before update on public.medication_schedules
for each row execute function private.set_updated_at();

create trigger dose_records_set_updated_at
before update on public.dose_records
for each row execute function private.set_updated_at();

revoke all on function private.set_updated_at()
  from public, anon, authenticated;

-- The trigger runs with its owner's privileges because auth inserts are made
-- by a restricted Auth role. Every referenced object is schema-qualified and
-- the function is not directly executable by API roles.
create function public.handle_new_saharacare_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'SaharaCare user'
    ),
    case
      when new.raw_user_meta_data ->> 'role' in ('patient', 'caregiver')
        then new.raw_user_meta_data ->> 'role'
      else 'patient'
    end,
    nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), '')
  );

  return new;
end;
$$;

revoke all on function public.handle_new_saharacare_user() from public, anon, authenticated;

create trigger saharacare_on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_saharacare_user();

-- Keep the schema usable if the Auth project already contains test users when
-- this migration is first applied. Future users are handled by the trigger.
insert into public.profiles (id, full_name, role, avatar_url, created_at, updated_at)
select
  users.id,
  coalesce(
    nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    'SaharaCare user'
  ),
  case
    when users.raw_user_meta_data ->> 'role' in ('patient', 'caregiver')
      then users.raw_user_meta_data ->> 'role'
    else 'patient'
  end,
  nullif(btrim(users.raw_user_meta_data ->> 'avatar_url'), ''),
  users.created_at,
  now()
from auth.users as users
on conflict (id) do nothing;

-- This integrity trigger prevents role-inverted caregiver links even for
-- privileged inserts that bypass RLS.
create function private.validate_caregiver_link_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = new.patient_id and role = 'patient'
  ) then
    raise exception 'patient_id must reference a patient profile'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = new.caregiver_id and role = 'caregiver'
  ) then
    raise exception 'caregiver_id must reference a caregiver profile'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_caregiver_link_roles()
  from public, anon, authenticated;

create trigger caregiver_links_validate_roles
before insert or update of patient_id, caregiver_id on public.caregiver_links
for each row execute function private.validate_caregiver_link_roles();

-- RLS helpers live in a non-exposed schema. They accept no caller identity,
-- always use auth.uid(), and reveal only authorization booleans.
create function private.current_user_has_role(expected_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and role = expected_role
    );
$$;

create function private.is_accepted_caregiver(target_patient_id uuid)
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
      where patient_id = target_patient_id
        and caregiver_id = (select auth.uid())
        and status = 'accepted'
    );
$$;

revoke all on function private.current_user_has_role(text)
  from public, anon, authenticated;
revoke all on function private.is_accepted_caregiver(uuid)
  from public, anon, authenticated;
grant execute on function private.current_user_has_role(text) to authenticated;
grant execute on function private.is_accepted_caregiver(uuid) to authenticated;

-- Explicit Data API privileges. The anon role receives no application-table
-- access; authenticated access remains constrained by the policies below.
revoke all on table
  public.profiles,
  public.caregiver_links,
  public.medications,
  public.medication_schedules,
  public.dose_records,
  public.notifications
from anon, authenticated;

grant select on table
  public.profiles,
  public.caregiver_links,
  public.medications,
  public.medication_schedules,
  public.dose_records,
  public.notifications
to authenticated;

-- Trusted backend jobs may need to create dose records and notifications in a
-- later phase. This is a database-role grant only; no secret key is stored here.
grant all on table
  public.profiles,
  public.caregiver_links,
  public.medications,
  public.medication_schedules,
  public.dose_records,
  public.notifications
to service_role;

grant update (full_name, avatar_url)
  on public.profiles to authenticated;

grant insert (patient_id, caregiver_id, status)
  on public.caregiver_links to authenticated;
grant update (status)
  on public.caregiver_links to authenticated;
grant delete
  on public.caregiver_links to authenticated;

grant insert (patient_id, name, dosage, instructions, active)
  on public.medications to authenticated;
grant update (name, dosage, instructions, active)
  on public.medications to authenticated;
grant delete
  on public.medications to authenticated;

grant insert (medication_id, scheduled_time, days_of_week, start_date, end_date)
  on public.medication_schedules to authenticated;
grant update (scheduled_time, days_of_week, start_date, end_date)
  on public.medication_schedules to authenticated;
grant delete
  on public.medication_schedules to authenticated;

grant insert (
  patient_id,
  medication_id,
  schedule_id,
  scheduled_at,
  taken_at,
  status
) on public.dose_records to authenticated;
grant update (taken_at, status)
  on public.dose_records to authenticated;

grant update (read)
  on public.notifications to authenticated;

alter table public.profiles enable row level security;
alter table public.caregiver_links enable row level security;
alter table public.medications enable row level security;
alter table public.medication_schedules enable row level security;
alter table public.dose_records enable row level security;
alter table public.notifications enable row level security;

-- Profiles: users see themselves. An accepted caregiver may additionally see
-- the linked patient's profile; no policy exposes all profiles.
create policy "profiles_select_own_or_linked_patient"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select private.is_accepted_caregiver(id))
);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Links: either participant can read/delete a link. Patients may authorize a
-- caregiver directly; caregivers can only create pending requests. Only the
-- patient can accept a pending request, preventing caregiver self-approval.
create policy "caregiver_links_select_participant"
on public.caregiver_links
for select
to authenticated
using (
  patient_id = (select auth.uid())
  or caregiver_id = (select auth.uid())
);

create policy "caregiver_links_insert_participant"
on public.caregiver_links
for insert
to authenticated
with check (
  (
    patient_id = (select auth.uid())
    and (select private.current_user_has_role('patient'))
    and status in ('pending', 'accepted')
  )
  or
  (
    caregiver_id = (select auth.uid())
    and (select private.current_user_has_role('caregiver'))
    and status = 'pending'
  )
);

create policy "caregiver_links_patient_accept_pending"
on public.caregiver_links
for update
to authenticated
using (
  patient_id = (select auth.uid())
  and status = 'pending'
)
with check (
  patient_id = (select auth.uid())
  and status = 'accepted'
);

create policy "caregiver_links_delete_participant"
on public.caregiver_links
for delete
to authenticated
using (
  patient_id = (select auth.uid())
  or caregiver_id = (select auth.uid())
);

-- Medication owners can manage their rows; accepted caregivers are read-only.
create policy "medications_select_patient_or_caregiver"
on public.medications
for select
to authenticated
using (
  patient_id = (select auth.uid())
  or (select private.is_accepted_caregiver(patient_id))
);

create policy "medications_insert_patient"
on public.medications
for insert
to authenticated
with check (
  patient_id = (select auth.uid())
  and (select private.current_user_has_role('patient'))
);

create policy "medications_update_patient"
on public.medications
for update
to authenticated
using (
  patient_id = (select auth.uid())
  and (select private.current_user_has_role('patient'))
)
with check (
  patient_id = (select auth.uid())
  and (select private.current_user_has_role('patient'))
);

create policy "medications_delete_patient"
on public.medications
for delete
to authenticated
using (
  patient_id = (select auth.uid())
  and (select private.current_user_has_role('patient'))
);

-- Schedule access is inherited from the owning medication. There is no policy
-- path from medication_schedules back to itself, avoiding RLS recursion.
create policy "medication_schedules_select_patient_or_caregiver"
on public.medication_schedules
for select
to authenticated
using (
  exists (
    select 1
    from public.medications
    where medications.id = medication_schedules.medication_id
      and (
        medications.patient_id = (select auth.uid())
        or (select private.is_accepted_caregiver(medications.patient_id))
      )
  )
);

create policy "medication_schedules_insert_patient"
on public.medication_schedules
for insert
to authenticated
with check (
  (select private.current_user_has_role('patient'))
  and exists (
    select 1
    from public.medications
    where medications.id = medication_schedules.medication_id
      and medications.patient_id = (select auth.uid())
  )
);

create policy "medication_schedules_update_patient"
on public.medication_schedules
for update
to authenticated
using (
  (select private.current_user_has_role('patient'))
  and exists (
    select 1
    from public.medications
    where medications.id = medication_schedules.medication_id
      and medications.patient_id = (select auth.uid())
  )
)
with check (
  (select private.current_user_has_role('patient'))
  and exists (
    select 1
    from public.medications
    where medications.id = medication_schedules.medication_id
      and medications.patient_id = (select auth.uid())
  )
);

create policy "medication_schedules_delete_patient"
on public.medication_schedules
for delete
to authenticated
using (
  (select private.current_user_has_role('patient'))
  and exists (
    select 1
    from public.medications
    where medications.id = medication_schedules.medication_id
      and medications.patient_id = (select auth.uid())
  )
);

-- Composite foreign keys guarantee that each dose's patient, medication, and
-- schedule all belong together. Caregivers remain read-only.
create policy "dose_records_select_patient_or_caregiver"
on public.dose_records
for select
to authenticated
using (
  patient_id = (select auth.uid())
  or (select private.is_accepted_caregiver(patient_id))
);

create policy "dose_records_insert_patient"
on public.dose_records
for insert
to authenticated
with check (
  patient_id = (select auth.uid())
  and (select private.current_user_has_role('patient'))
);

create policy "dose_records_update_patient"
on public.dose_records
for update
to authenticated
using (
  patient_id = (select auth.uid())
  and (select private.current_user_has_role('patient'))
)
with check (
  patient_id = (select auth.uid())
  and (select private.current_user_has_role('patient'))
);

-- Notifications are created by trusted server/database logic in a later phase.
-- Authenticated users can only read and mark their own notifications as read.
create policy "notifications_select_recipient"
on public.notifications
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "notifications_update_recipient"
on public.notifications
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

commit;
