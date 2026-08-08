begin;

-- SaharaCare Phase 5: materialize today's patient doses and mark an owned dose
-- as taken. Untaken late/missed labels are derived at read time in the app;
-- this migration intentionally adds no cron, notification, or Realtime logic.

create index dose_records_patient_scheduled_at_idx
  on public.dose_records (patient_id, scheduled_at);

alter table public.medication_schedules
  add constraint medication_schedules_medication_time_key
  unique (medication_id, scheduled_time);

-- Phase 4 replaced every schedule row during an edit. Once dose history exists,
-- that would cascade-delete its records. Reconcile times in place instead:
-- preserve unchanged schedule IDs, delete removed schedules with no history,
-- and end-date removed schedules that already own dose records.
create or replace function public.save_patient_medication(
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
  local_today date := (
    statement_timestamp() at time zone 'Asia/Kathmandu'
  )::date;
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

    delete from public.medication_schedules as schedule
    where schedule.medication_id = saved_medication_id
      and not (schedule.scheduled_time = any(scheduled_times))
      and not exists (
        select 1
        from public.dose_records as dose
        where dose.schedule_id = schedule.id
      );

    update public.medication_schedules as schedule
    set end_date = least(
      coalesce(
        schedule.end_date,
        case
          -- Keep a dose that was already materialized for today, but do not
          -- let an older removed schedule produce a new dose later today.
          when exists (
            select 1
            from public.dose_records as dose
            where dose.schedule_id = schedule.id
              and (
                dose.scheduled_at at time zone 'Asia/Kathmandu'
              )::date = local_today
          ) then local_today
          else local_today - 1
        end
      ),
      case
        when exists (
          select 1
          from public.dose_records as dose
          where dose.schedule_id = schedule.id
            and (
              dose.scheduled_at at time zone 'Asia/Kathmandu'
            )::date = local_today
        ) then local_today
        else local_today - 1
      end
    )
    where schedule.medication_id = saved_medication_id
      and not (schedule.scheduled_time = any(scheduled_times));
  end if;

  insert into public.medication_schedules (
    medication_id,
    scheduled_time,
    days_of_week,
    start_date
  )
  select
    saved_medication_id,
    unique_time,
    schedule_days,
    local_today
  from (
    select distinct unnest(scheduled_times) as unique_time
  ) as unique_times
  on conflict (medication_id, scheduled_time)
  do update set
    days_of_week = excluded.days_of_week,
    end_date = null;

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

-- Called when an authenticated patient opens today's dashboard. The insert is
-- idempotent because Phase 2 already enforces UNIQUE(schedule_id, scheduled_at).
-- SECURITY INVOKER keeps table grants and RLS active for every inserted row.
create function public.ensure_today_doses()
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  current_patient_id uuid := (select auth.uid());
  local_today date;
  inserted_count integer;
begin
  if current_patient_id is null
    or not private.current_user_has_role('patient') then
    raise exception 'Only an authenticated patient can create today''s doses'
      using errcode = '42501';
  end if;

  local_today := (
    statement_timestamp() at time zone 'Asia/Kathmandu'
  )::date;

  insert into public.dose_records (
    patient_id,
    medication_id,
    schedule_id,
    scheduled_at,
    status
  )
  select
    current_patient_id,
    medication.id,
    schedule.id,
    (
      (local_today + schedule.scheduled_time)
      at time zone 'Asia/Kathmandu'
    ),
    'scheduled'
  from public.medications as medication
  join public.medication_schedules as schedule
    on schedule.medication_id = medication.id
  where medication.patient_id = current_patient_id
    and medication.active
    and extract(dow from local_today)::smallint = any(schedule.days_of_week)
    and (schedule.start_date is null or schedule.start_date <= local_today)
    and (schedule.end_date is null or schedule.end_date >= local_today)
  on conflict (schedule_id, scheduled_at) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.ensure_today_doses()
  from public, anon, authenticated;
grant execute on function public.ensure_today_doses()
  to authenticated;

-- Uses the database clock for taken_at and returns the original successful
-- value on repeated submissions. The caller supplies only a dose ID; patient
-- identity and ownership come from auth.uid(), the profile role, and RLS.
create function public.mark_dose_as_taken(target_dose_id uuid)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  current_patient_id uuid := (select auth.uid());
  local_today date;
  result jsonb;
begin
  if current_patient_id is null
    or not private.current_user_has_role('patient') then
    raise exception 'Only an authenticated patient can mark a dose as taken'
      using errcode = '42501';
  end if;

  local_today := (
    statement_timestamp() at time zone 'Asia/Kathmandu'
  )::date;

  update public.dose_records
  set
    status = 'taken',
    taken_at = statement_timestamp()
  where id = target_dose_id
    and patient_id = current_patient_id
    and status <> 'taken'
    and (scheduled_at at time zone 'Asia/Kathmandu')::date = local_today
  returning jsonb_build_object(
    'id', id,
    'status', status,
    'taken_at', taken_at
  ) into result;

  -- If a double click or retry reaches an already-taken row, return the same
  -- persisted result without changing taken_at a second time.
  if result is null then
    select jsonb_build_object(
      'id', id,
      'status', status,
      'taken_at', taken_at
    )
    into result
    from public.dose_records
    where id = target_dose_id
      and patient_id = current_patient_id
      and status = 'taken'
      and (scheduled_at at time zone 'Asia/Kathmandu')::date = local_today;
  end if;

  if result is null then
    raise exception 'Dose not found, not owned by the patient, or not scheduled today'
      using errcode = '42501';
  end if;

  return result;
end;
$$;

revoke all on function public.mark_dose_as_taken(uuid)
  from public, anon, authenticated;
grant execute on function public.mark_dose_as_taken(uuid)
  to authenticated;

commit;
