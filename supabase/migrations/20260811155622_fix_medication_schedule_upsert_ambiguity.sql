begin;

-- PostgreSQL treats the unqualified medication_id in the previous
-- ON CONFLICT target as ambiguous because the PL/pgSQL input parameter has
-- the same name. Target the existing unique constraint explicitly while
-- preserving the RPC signature used by PostgREST and the application.
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
  on conflict on constraint medication_schedules_medication_time_key
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

commit;
