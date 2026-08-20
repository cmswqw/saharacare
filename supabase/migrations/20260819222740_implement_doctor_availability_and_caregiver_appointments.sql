begin;

-- SaharaCare final appointment system.
--
-- The appointment duration and care timezone are intentionally centralized in
-- database functions. Browsers display candidate slots, but these functions
-- remain the authoritative booking boundary.

create function private.appointment_duration()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '30 minutes';
$$;

revoke all on function private.appointment_duration()
  from public, anon, authenticated;
grant execute on function private.appointment_duration()
  to authenticated, service_role;

create table public.doctor_availability (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.profiles (id) on delete cascade,
  day_of_week smallint not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint doctor_availability_weekday_check
    check (day_of_week between 0 and 6),
  constraint doctor_availability_time_order_check
    check (start_time < end_time),
  constraint doctor_availability_minimum_duration_check
    check (end_time - start_time >= private.appointment_duration()),
  constraint doctor_availability_exact_block_key
    unique (doctor_id, day_of_week, start_time, end_time)
);

create index doctor_availability_doctor_weekday_idx
  on public.doctor_availability (doctor_id, day_of_week, start_time);

create trigger doctor_availability_set_updated_at
before update on public.doctor_availability
for each row execute function private.set_updated_at();

create table public.doctor_availability_overrides (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.profiles (id) on delete cascade,
  override_date date not null,
  override_type text not null,
  start_time time without time zone,
  end_time time without time zone,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint doctor_availability_overrides_type_check
    check (override_type in ('unavailable', 'custom_hours')),
  constraint doctor_availability_overrides_shape_check check (
    (
      override_type = 'unavailable'
      and (
        (start_time is null and end_time is null)
        or (
          start_time is not null
          and end_time is not null
          and start_time < end_time
          and end_time - start_time >= private.appointment_duration()
        )
      )
    )
    or (
      override_type = 'custom_hours'
      and start_time is not null
      and end_time is not null
      and start_time < end_time
      and end_time - start_time >= private.appointment_duration()
    )
  )
);

create unique index doctor_availability_overrides_exact_block_key
  on public.doctor_availability_overrides (
    doctor_id,
    override_date,
    override_type,
    coalesce(start_time, time '00:00'),
    coalesce(end_time, time '00:00')
  );

create index doctor_availability_overrides_doctor_date_idx
  on public.doctor_availability_overrides (doctor_id, override_date, override_type);

create trigger doctor_availability_overrides_set_updated_at
before update on public.doctor_availability_overrides
for each row execute function private.set_updated_at();

-- Existing patient-created appointments are backfilled before the audit fields
-- become mandatory. A caregiver remains an actor, never the appointment owner.
alter table public.appointments
  add column created_by uuid references public.profiles (id) on delete restrict,
  add column created_by_role text,
  add column updated_by uuid references public.profiles (id) on delete restrict,
  add column cancelled_by uuid references public.profiles (id) on delete restrict,
  add column cancelled_at timestamptz;

update public.appointments
set
  created_by = patient_id,
  created_by_role = 'patient'
where created_by is null;

alter table public.appointments
  alter column created_by set not null,
  alter column created_by_role set not null,
  add constraint appointments_created_by_role_check
    check (created_by_role in ('patient', 'caregiver')),
  add constraint appointments_cancelled_audit_check check (
    (status = 'cancelled' and cancelled_at is not null)
    or status <> 'cancelled'
  ) not valid,
  add constraint appointments_standard_duration_check
    check (ends_at = starts_at + private.appointment_duration()) not valid;

-- Fixed-duration slots make doctor + start time a complete collision key.
-- Cancelled rows remain as history but no longer reserve the slot.
create unique index appointments_doctor_active_start_key
  on public.appointments (doctor_id, starts_at)
  where status <> 'cancelled';

create index appointments_patient_active_starts_idx
  on public.appointments (patient_id, starts_at)
  where status <> 'cancelled';

alter table public.notifications
  drop constraint notifications_type_check,
  add constraint notifications_type_check check (
    type in (
      'medication_taken',
      'medication_late',
      'medication_missed',
      'appointment_booked',
      'appointment_rescheduled',
      'appointment_cancelled'
    )
  );

create function private.validate_doctor_availability_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = new.doctor_id
      and role = 'doctor'
      and account_status = 'active'
  ) then
    raise exception using
      errcode = '23514',
      message = 'Availability must belong to an active doctor.';
  end if;

  if tg_table_name = 'doctor_availability' and exists (
    select 1
    from public.doctor_availability as existing
    where existing.doctor_id = new.doctor_id
      and existing.day_of_week = new.day_of_week
      and existing.id <> new.id
      and existing.start_time < new.end_time
      and existing.end_time > new.start_time
  ) then
    raise exception using
      errcode = '23P01',
      message = 'Weekly availability blocks cannot overlap.';
  end if;

  if tg_table_name = 'doctor_availability_overrides'
    and new.override_type = 'custom_hours'
    and exists (
      select 1
      from public.doctor_availability_overrides as existing
      where existing.doctor_id = new.doctor_id
        and existing.override_date = new.override_date
        and existing.override_type = 'custom_hours'
        and existing.id <> new.id
        and existing.start_time < new.end_time
        and existing.end_time > new.start_time
    )
  then
    raise exception using
      errcode = '23P01',
      message = 'Custom availability blocks cannot overlap.';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_doctor_availability_role()
  from public, anon, authenticated;

create trigger doctor_availability_validate_role
before insert or update on public.doctor_availability
for each row execute function private.validate_doctor_availability_role();

create trigger doctor_availability_overrides_validate_role
before insert or update on public.doctor_availability_overrides
for each row execute function private.validate_doctor_availability_role();

create function private.current_actor_can_manage_patient_appointments(
  target_patient_id uuid
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
      from public.profiles as actor
      where actor.id = (select auth.uid())
        and actor.account_status = 'active'
        and (
          (
            actor.role = 'patient'
            and actor.id = target_patient_id
          )
          or (
            actor.role = 'caregiver'
            and exists (
              select 1
              from public.caregiver_links as links
              where links.caregiver_id = actor.id
                and links.patient_id = target_patient_id
                and links.status = 'accepted'
            )
          )
        )
    );
$$;

revoke all on function private.current_actor_can_manage_patient_appointments(uuid)
  from public, anon, authenticated;

create function private.appointment_slot_within_availability(
  target_doctor_id uuid,
  target_starts_at timestamptz
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  local_start timestamp without time zone;
  local_end timestamp without time zone;
  local_date date;
  local_time time without time zone;
  local_end_time time without time zone;
  weekday smallint;
  slot_seconds integer := extract(epoch from private.appointment_duration())::integer;
  has_custom_hours boolean;
  matches_base boolean;
begin
  if target_starts_at is null
    or target_starts_at <= statement_timestamp()
    or not exists (
      select 1
      from public.profiles
      where id = target_doctor_id
        and role = 'doctor'
        and account_status = 'active'
    )
  then
    return false;
  end if;

  local_start := target_starts_at at time zone 'Asia/Kathmandu';
  local_end := local_start + private.appointment_duration();
  local_date := local_start::date;
  local_time := local_start::time;
  local_end_time := local_end::time;
  weekday := extract(dow from local_date)::smallint;

  if local_end::date <> local_date then
    return false;
  end if;

  select exists (
    select 1
    from public.doctor_availability_overrides
    where doctor_id = target_doctor_id
      and override_date = local_date
      and override_type = 'custom_hours'
  ) into has_custom_hours;

  if has_custom_hours then
    select exists (
      select 1
      from public.doctor_availability_overrides as available
      where available.doctor_id = target_doctor_id
        and available.override_date = local_date
        and available.override_type = 'custom_hours'
        and local_time >= available.start_time
        and local_end_time <= available.end_time
        and mod(
          extract(epoch from (local_time - available.start_time))::integer,
          slot_seconds
        ) = 0
    ) into matches_base;
  else
    select exists (
      select 1
      from public.doctor_availability as available
      where available.doctor_id = target_doctor_id
        and available.day_of_week = weekday
        and local_time >= available.start_time
        and local_end_time <= available.end_time
        and mod(
          extract(epoch from (local_time - available.start_time))::integer,
          slot_seconds
        ) = 0
    ) into matches_base;
  end if;

  if not matches_base then
    return false;
  end if;

  if exists (
    select 1
    from public.doctor_availability_overrides as blocked
    where blocked.doctor_id = target_doctor_id
      and blocked.override_date = local_date
      and blocked.override_type = 'unavailable'
      and (
        blocked.start_time is null
        or (
          local_time < blocked.end_time
          and local_end_time > blocked.start_time
        )
      )
  ) then
    return false;
  end if;

  return true;
end;
$$;

create function private.appointment_slot_has_conflict(
  target_doctor_id uuid,
  target_starts_at timestamptz,
  excluded_appointment_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.appointments
    where doctor_id = target_doctor_id
      and status <> 'cancelled'
      and (excluded_appointment_id is null or id <> excluded_appointment_id)
      and starts_at < target_starts_at + private.appointment_duration()
      and ends_at > target_starts_at
  );
$$;

revoke all on function private.appointment_slot_within_availability(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function private.appointment_slot_has_conflict(uuid, timestamptz, uuid)
  from public, anon, authenticated;

create function public.get_available_appointment_slots(
  target_doctor_id uuid,
  appointment_date date
)
returns table (
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_role text;
  actor_status text;
  local_today date := (statement_timestamp() at time zone 'Asia/Kathmandu')::date;
begin
  select role, account_status
  into actor_role, actor_status
  from public.profiles
  where id = (select auth.uid());

  if actor_status is distinct from 'active'
    or actor_role not in ('patient', 'caregiver', 'doctor')
  then
    raise exception using
      errcode = '42501',
      message = 'An active SaharaCare care account is required.';
  end if;

  if actor_role = 'doctor' and target_doctor_id <> (select auth.uid()) then
    raise exception using
      errcode = '42501',
      message = 'Doctors can only preview their own free slots.';
  end if;

  if appointment_date < local_today
    or appointment_date > local_today + 180
  then
    raise exception using
      errcode = '22023',
      message = 'Choose a date within the next 180 days.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = target_doctor_id
      and role = 'doctor'
      and account_status = 'active'
  ) then
    raise exception using
      errcode = '22023',
      message = 'The selected doctor is not available for booking.';
  end if;

  return query
  with custom_day as (
    select exists (
      select 1
      from public.doctor_availability_overrides
      where doctor_id = target_doctor_id
        and override_date = appointment_date
        and override_type = 'custom_hours'
    ) as applies
  ),
  working_windows as (
    select custom.start_time, custom.end_time
    from public.doctor_availability_overrides as custom
    where custom.doctor_id = target_doctor_id
      and custom.override_date = appointment_date
      and custom.override_type = 'custom_hours'

    union all

    select weekly.start_time, weekly.end_time
    from public.doctor_availability as weekly
    cross join custom_day
    where not custom_day.applies
      and weekly.doctor_id = target_doctor_id
      and weekly.day_of_week = extract(dow from appointment_date)::smallint
  ),
  candidate_slots as (
    select distinct
      generated.local_start at time zone 'Asia/Kathmandu' as candidate_start
    from working_windows
    cross join lateral generate_series(
      appointment_date + working_windows.start_time,
      appointment_date + working_windows.end_time - private.appointment_duration(),
      private.appointment_duration()
    ) as generated(local_start)
  )
  select
    candidate_slots.candidate_start,
    candidate_slots.candidate_start + private.appointment_duration()
  from candidate_slots
  where private.appointment_slot_within_availability(
      target_doctor_id,
      candidate_slots.candidate_start
    )
    and not private.appointment_slot_has_conflict(
      target_doctor_id,
      candidate_slots.candidate_start,
      null
    )
  order by candidate_slots.candidate_start;
end;
$$;

revoke all on function public.get_available_appointment_slots(uuid, date)
  from public, anon, authenticated;
grant execute on function public.get_available_appointment_slots(uuid, date)
  to authenticated;

create function public.book_appointment(
  appointment_patient_id uuid,
  appointment_doctor_id uuid,
  appointment_starts_at timestamptz,
  appointment_facility text,
  appointment_purpose text,
  appointment_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_role text;
  new_appointment_id uuid;
begin
  select role into actor_role
  from public.profiles
  where id = actor_id
    and account_status = 'active';

  if not private.current_actor_can_manage_patient_appointments(appointment_patient_id)
    or actor_role not in ('patient', 'caregiver')
  then
    raise exception using
      errcode = '42501',
      message = 'You cannot book appointments for this patient.';
  end if;

  if nullif(btrim(appointment_facility), '') is null
    or char_length(btrim(appointment_facility)) > 200
    or nullif(btrim(appointment_purpose), '') is null
    or char_length(btrim(appointment_purpose)) > 500
    or char_length(coalesce(appointment_note, '')) > 2000
  then
    raise exception using
      errcode = '22023',
      message = 'Check the clinic, reason, and optional note.';
  end if;

  if not private.appointment_slot_within_availability(
    appointment_doctor_id,
    appointment_starts_at
  ) then
    raise exception using
      errcode = '22023',
      message = 'That time is outside the doctor''s current availability.';
  end if;

  if private.appointment_slot_has_conflict(
    appointment_doctor_id,
    appointment_starts_at,
    null
  ) then
    raise exception using
      errcode = '23P01',
      message = 'That appointment time has just been booked.';
  end if;

  insert into public.appointments (
    patient_id,
    doctor_id,
    facility,
    purpose,
    note,
    starts_at,
    ends_at,
    status,
    created_by,
    created_by_role,
    updated_by
  ) values (
    appointment_patient_id,
    appointment_doctor_id,
    btrim(appointment_facility),
    btrim(appointment_purpose),
    nullif(btrim(coalesce(appointment_note, '')), ''),
    appointment_starts_at,
    appointment_starts_at + private.appointment_duration(),
    'requested',
    actor_id,
    actor_role,
    actor_id
  )
  returning id into new_appointment_id;

  return new_appointment_id;
exception
  when unique_violation then
    raise exception using
      errcode = '23P01',
      message = 'That appointment time has just been booked.';
end;
$$;

revoke all on function public.book_appointment(uuid, uuid, timestamptz, text, text, text)
  from public, anon, authenticated;
grant execute on function public.book_appointment(uuid, uuid, timestamptz, text, text, text)
  to authenticated;

create function public.reschedule_appointment(
  target_appointment_id uuid,
  replacement_starts_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  existing public.appointments%rowtype;
begin
  select * into existing
  from public.appointments
  where id = target_appointment_id
  for update;

  if existing.id is null
    or not private.current_actor_can_manage_patient_appointments(existing.patient_id)
  then
    raise exception using
      errcode = '42501',
      message = 'You cannot reschedule this appointment.';
  end if;

  if existing.status not in ('requested', 'confirmed') then
    raise exception using
      errcode = '22023',
      message = 'Only upcoming appointments can be rescheduled.';
  end if;

  if not private.appointment_slot_within_availability(
    existing.doctor_id,
    replacement_starts_at
  ) then
    raise exception using
      errcode = '22023',
      message = 'That time is outside the doctor''s current availability.';
  end if;

  if private.appointment_slot_has_conflict(
    existing.doctor_id,
    replacement_starts_at,
    existing.id
  ) then
    raise exception using
      errcode = '23P01',
      message = 'That appointment time has just been booked.';
  end if;

  update public.appointments
  set
    starts_at = replacement_starts_at,
    ends_at = replacement_starts_at + private.appointment_duration(),
    updated_by = actor_id
  where id = existing.id;

  return existing.id;
exception
  when unique_violation then
    raise exception using
      errcode = '23P01',
      message = 'That appointment time has just been booked.';
end;
$$;

revoke all on function public.reschedule_appointment(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.reschedule_appointment(uuid, timestamptz)
  to authenticated;

create function public.cancel_appointment(target_appointment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  existing public.appointments%rowtype;
begin
  select * into existing
  from public.appointments
  where id = target_appointment_id
  for update;

  if existing.id is null
    or not private.current_actor_can_manage_patient_appointments(existing.patient_id)
  then
    raise exception using
      errcode = '42501',
      message = 'You cannot cancel this appointment.';
  end if;

  if existing.status not in ('requested', 'confirmed') then
    raise exception using
      errcode = '22023',
      message = 'This appointment can no longer be cancelled.';
  end if;

  update public.appointments
  set
    status = 'cancelled',
    cancelled_by = actor_id,
    cancelled_at = statement_timestamp(),
    updated_by = actor_id
  where id = existing.id;

  return existing.id;
end;
$$;

revoke all on function public.cancel_appointment(uuid)
  from public, anon, authenticated;
grant execute on function public.cancel_appointment(uuid)
  to authenticated;

-- Appointment notifications reuse the durable in-app notification table, but
-- run in a separate client request after the appointment transaction commits.
-- A notification failure therefore never rolls back a valid appointment.
create function public.notify_appointment_participants(
  target_appointment_id uuid,
  appointment_event text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_role text;
  existing public.appointments%rowtype;
begin
  if appointment_event is null or appointment_event not in (
    'appointment_booked',
    'appointment_rescheduled',
    'appointment_cancelled'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Unsupported appointment notification event.';
  end if;

  select role into actor_role
  from public.profiles
  where id = actor_id
    and account_status = 'active';

  select * into existing
  from public.appointments
  where id = target_appointment_id;

  if existing.id is null
    or actor_id is null
    or actor_role is distinct from 'caregiver'
    or (
      appointment_event = 'appointment_booked'
      and existing.created_by <> actor_id
    )
    or (
      appointment_event = 'appointment_rescheduled'
      and existing.updated_by <> actor_id
    )
    or (
      appointment_event = 'appointment_cancelled'
      and existing.cancelled_by <> actor_id
    )
  then
    return;
  end if;

  insert into public.notifications (
    user_id,
    patient_id,
    type,
    title,
    message
  ) values (
    existing.patient_id,
    existing.patient_id,
    appointment_event,
    'SaharaCare appointment update',
    case appointment_event
      when 'appointment_booked'
        then 'Your caregiver booked an appointment for you. Open SaharaCare to view the details.'
      when 'appointment_rescheduled'
        then 'Your appointment has been rescheduled. Open SaharaCare to view the new time.'
      else 'Your appointment has been cancelled. Open SaharaCare to view the details.'
    end
  );
end;
$$;

revoke all on function public.notify_appointment_participants(uuid, text)
  from public, anon, authenticated;
grant execute on function public.notify_appointment_participants(uuid, text)
  to authenticated;

-- Permit appointment participants to resolve the minimal display name of the
-- caregiver who made a booking. No email, phone, or auth metadata is stored in
-- profiles or returned by appointment queries.
create or replace function private.current_user_has_appointment_with(
  target_profile_id uuid
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
      from public.appointments
      where (
        patient_id = (select auth.uid())
        and doctor_id = target_profile_id
      ) or (
        doctor_id = (select auth.uid())
        and patient_id = target_profile_id
      ) or (
        (patient_id = (select auth.uid()) or doctor_id = (select auth.uid()))
        and created_by = target_profile_id
      ) or (
        created_by = (select auth.uid())
        and (patient_id = target_profile_id or doctor_id = target_profile_id)
      )
    );
$$;

revoke all on function private.current_user_has_appointment_with(uuid)
  from public, anon, authenticated;
grant execute on function private.current_user_has_appointment_with(uuid)
  to authenticated;

revoke all on table
  public.doctor_availability,
  public.doctor_availability_overrides
from anon, authenticated;

grant select, insert, update, delete on table
  public.doctor_availability,
  public.doctor_availability_overrides
to authenticated;

grant all on table
  public.doctor_availability,
  public.doctor_availability_overrides
to service_role;

-- Appointment mutations are exposed only through the authorization-enforcing
-- RPCs above. The browser roles retain participant-scoped read access.
revoke insert, update, delete on table public.appointments
  from authenticated;

alter table public.doctor_availability enable row level security;
alter table public.doctor_availability_overrides enable row level security;

create policy doctor_availability_select_own
on public.doctor_availability
for select
to authenticated
using (
  doctor_id = (select auth.uid())
  and (select private.current_user_has_role('doctor'))
);

create policy doctor_availability_insert_own
on public.doctor_availability
for insert
to authenticated
with check (
  doctor_id = (select auth.uid())
  and (select private.current_user_has_role('doctor'))
);

create policy doctor_availability_update_own
on public.doctor_availability
for update
to authenticated
using (
  doctor_id = (select auth.uid())
  and (select private.current_user_has_role('doctor'))
)
with check (
  doctor_id = (select auth.uid())
  and (select private.current_user_has_role('doctor'))
);

create policy doctor_availability_delete_own
on public.doctor_availability
for delete
to authenticated
using (
  doctor_id = (select auth.uid())
  and (select private.current_user_has_role('doctor'))
);

create policy doctor_availability_overrides_select_own
on public.doctor_availability_overrides
for select
to authenticated
using (
  doctor_id = (select auth.uid())
  and (select private.current_user_has_role('doctor'))
);

create policy doctor_availability_overrides_insert_own
on public.doctor_availability_overrides
for insert
to authenticated
with check (
  doctor_id = (select auth.uid())
  and (select private.current_user_has_role('doctor'))
);

create policy doctor_availability_overrides_update_own
on public.doctor_availability_overrides
for update
to authenticated
using (
  doctor_id = (select auth.uid())
  and (select private.current_user_has_role('doctor'))
)
with check (
  doctor_id = (select auth.uid())
  and (select private.current_user_has_role('doctor'))
);

create policy doctor_availability_overrides_delete_own
on public.doctor_availability_overrides
for delete
to authenticated
using (
  doctor_id = (select auth.uid())
  and (select private.current_user_has_role('doctor'))
);

drop policy "appointments_select_participant"
  on public.appointments;

create policy appointments_select_patient_doctor_or_caregiver
on public.appointments
for select
to authenticated
using (
  patient_id = (select auth.uid())
  or doctor_id = (select auth.uid())
  or (select private.is_accepted_caregiver(patient_id))
);

comment on table public.doctor_availability is
  'Doctor-owned recurring weekly appointment availability. Weekdays use PostgreSQL extract(dow): Sunday=0 through Saturday=6.';
comment on table public.doctor_availability_overrides is
  'Doctor-owned date exceptions. Custom hours replace the weekly windows for that date; unavailable rows subtract full or partial periods.';
comment on function public.get_available_appointment_slots(uuid, date) is
  'Returns privacy-safe, conflict-free 30-minute slots in Asia/Kathmandu for an active doctor and date.';
comment on function public.book_appointment(uuid, uuid, timestamptz, text, text, text) is
  'Atomically books a patient-owned appointment for the patient or an accepted caregiver actor.';

commit;
