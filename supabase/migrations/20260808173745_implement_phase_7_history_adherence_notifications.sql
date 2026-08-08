begin;

-- Tie durable medication notifications to the dose event that produced them.
-- Existing notification rows remain valid with a null dose_record_id.
alter table public.notifications
  add column dose_record_id uuid
  references public.dose_records (id)
  on delete set null;

create unique index notifications_dose_event_key
  on public.notifications (dose_record_id, user_id, type)
  where dose_record_id is not null;

create index notifications_user_read_created_idx
  on public.notifications (user_id, read, created_at desc);

-- Postgres Changes remains protected by the existing recipient-only SELECT
-- policy. Publishing the table only enables its replication stream.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end;
$$;

-- This private trigger function is the narrow privileged boundary needed to
-- insert a caregiver-owned notification from a patient-owned dose update.
-- It is not exposed through the Data API and validates the authenticated
-- patient that caused the update before performing any privileged insert.
create function private.create_caregiver_dose_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  patient_name text;
  medication_name text;
  notification_type text;
  notification_title text;
  notification_message text;
  scheduled_label text;
  taken_label text;
begin
  if new.status not in ('taken', 'late', 'missed')
    or new.status is not distinct from old.status then
    return new;
  end if;

  if (select auth.uid()) is null
    or new.patient_id <> (select auth.uid())
    or not private.current_user_has_role('patient') then
    raise exception 'Dose notifications require an authenticated patient update'
      using errcode = '42501';
  end if;

  select profile.full_name, medication.name
  into patient_name, medication_name
  from public.profiles as profile
  join public.medications as medication
    on medication.id = new.medication_id
   and medication.patient_id = profile.id
  where profile.id = new.patient_id;

  if patient_name is null or medication_name is null then
    raise exception 'Dose notification context could not be resolved'
      using errcode = '23503';
  end if;

  scheduled_label := to_char(
    new.scheduled_at at time zone 'Asia/Kathmandu',
    'FMMon FMDD at FMHH12:MI AM'
  );

  if new.status = 'taken' then
    notification_type := 'medication_taken';
    notification_title := 'Medication taken';
    taken_label := to_char(
      new.taken_at at time zone 'Asia/Kathmandu',
      'FMHH12:MI AM'
    );
    notification_message := patient_name || ' took ' || medication_name
      || ' at ' || taken_label || '.';
  elsif new.status = 'late' then
    notification_type := 'medication_late';
    notification_title := medication_name || ' is late';
    notification_message := patient_name || '''s ' || medication_name
      || ' dose scheduled for ' || scheduled_label || ' is late.';
  else
    notification_type := 'medication_missed';
    notification_title := medication_name || ' was missed';
    notification_message := patient_name || '''s ' || medication_name
      || ' dose scheduled for ' || scheduled_label || ' was missed.';
  end if;

  insert into public.notifications (
    user_id,
    patient_id,
    dose_record_id,
    type,
    title,
    message
  )
  select
    link.caregiver_id,
    new.patient_id,
    new.id,
    notification_type,
    notification_title,
    notification_message
  from public.caregiver_links as link
  where link.patient_id = new.patient_id
    and link.status = 'accepted'
  on conflict (dose_record_id, user_id, type)
    where dose_record_id is not null
    do nothing;

  return new;
end;
$$;

revoke all on function private.create_caregiver_dose_notification()
  from public, anon, authenticated;

create trigger dose_records_create_caregiver_notification
after update of status on public.dose_records
for each row
when (old.status is distinct from new.status)
execute function private.create_caregiver_dose_notification();

-- Patient activity persists the same 15/120-minute states that Phase 5
-- derives for display. The trigger above then records durable late/missed
-- caregiver notifications once per dose and event type.
create function public.evaluate_own_due_doses()
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  current_patient_id uuid := (select auth.uid());
  evaluated_at timestamptz := statement_timestamp();
  updated_count integer;
begin
  if current_patient_id is null
    or not private.current_user_has_role('patient') then
    raise exception 'Only an authenticated patient can evaluate dose status'
      using errcode = '42501';
  end if;

  update public.dose_records
  set status = case
    when scheduled_at <= evaluated_at - interval '120 minutes' then 'missed'
    else 'late'
  end
  where patient_id = current_patient_id
    and taken_at is null
    and (
      (
        scheduled_at <= evaluated_at - interval '120 minutes'
        and status <> 'missed'
      )
      or (
        scheduled_at > evaluated_at - interval '120 minutes'
        and scheduled_at <= evaluated_at - interval '15 minutes'
        and status = 'scheduled'
      )
    );

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.evaluate_own_due_doses()
  from public, anon, authenticated;
grant execute on function public.evaluate_own_due_doses()
  to authenticated;

commit;
