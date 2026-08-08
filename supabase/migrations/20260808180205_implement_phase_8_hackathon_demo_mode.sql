begin;

-- SaharaCare Phase 8: an explicitly enabled, patient-scoped hackathon demo.
-- The app environment variable controls whether controls are rendered. This
-- database flag is the independent authorization boundary for privileged demo
-- mutations, and it cannot be changed through the authenticated Data API.
alter table public.profiles
  add column demo_mode_enabled boolean not null default false;

comment on column public.profiles.demo_mode_enabled is
  'Allows the authenticated patient to use SaharaCare hackathon demo RPCs. Enable only on disposable demo patients.';

-- Demo profiles own a deliberately materialized set of today rows whose
-- timestamps can move to simulate due/late/missed states. Do not recreate the
-- fixed schedule-time rows for those profiles. Normal patients retain the
-- Phase 5 behavior without any changes.
create or replace function public.ensure_today_doses()
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

  if exists (
    select 1
    from public.profiles as profile
    where profile.id = current_patient_id
      and profile.demo_mode_enabled
  ) then
    return 0;
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

-- SECURITY DEFINER is narrowly required here because reset must remove the
-- linked caregiver's generated notifications and simulated actions must move
-- scheduled_at, neither of which a patient can normally mutate. The caller
-- supplies no identity: auth.uid(), patient role, and the non-user-writable
-- profile flag are checked before any write. The empty search path and fully
-- qualified objects prevent search-path substitution.
create function public.run_own_demo_action(demo_action text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  requested_action text := lower(btrim(coalesce(demo_action, '')));
  current_patient_id uuid;
  demo_now timestamptz := statement_timestamp();
  local_today date := (
    statement_timestamp() at time zone 'Asia/Kathmandu'
  )::date;
  local_today_start timestamptz;
  local_tomorrow_start timestamptz;
  metformin_id uuid := gen_random_uuid();
  vitamin_d_id uuid := gen_random_uuid();
  blood_pressure_id uuid := gen_random_uuid();
  metformin_schedule_id uuid := gen_random_uuid();
  vitamin_d_schedule_id uuid := gen_random_uuid();
  blood_pressure_schedule_id uuid := gen_random_uuid();
  target_medication_name text;
  target_dose_id uuid;
  target_scheduled_at timestamptz;
  target_status text;
begin
  if requested_action not in ('reset', 'due_now', 'taken', 'late', 'missed') then
    raise exception 'Unknown demo action'
      using errcode = '22023';
  end if;

  -- The row lock serializes reset/action requests for this patient. It makes
  -- retries deterministic even if two browser clicks arrive together.
  select profile.id
  into current_patient_id
  from public.profiles as profile
  where profile.id = (select auth.uid())
    and profile.role = 'patient'
    and profile.demo_mode_enabled
  for update;

  if current_patient_id is null then
    raise exception 'Demo actions require an authenticated demo-enabled patient'
      using errcode = '42501';
  end if;

  local_today_start := local_today::timestamp
    at time zone 'Asia/Kathmandu';
  local_tomorrow_start := (local_today + 1)::timestamp
    at time zone 'Asia/Kathmandu';

  if requested_action = 'reset' then
    -- Only medication-event notifications belonging to this patient are
    -- removed. Auth users and caregiver links are intentionally preserved.
    delete from public.notifications as notification
    where notification.patient_id = current_patient_id;

    -- Cascades remove this demo patient's schedules and dose records only.
    delete from public.medications as medication
    where medication.patient_id = current_patient_id;

    insert into public.medications (
      id,
      patient_id,
      name,
      dosage,
      instructions,
      active
    )
    values
      (
        metformin_id,
        current_patient_id,
        'Metformin',
        '500 mg',
        'Take with breakfast.',
        true
      ),
      (
        vitamin_d_id,
        current_patient_id,
        'Vitamin D',
        '1 tablet',
        'Take with food.',
        true
      ),
      (
        blood_pressure_id,
        current_patient_id,
        'Blood Pressure Medicine',
        '5 mg',
        'Take in the evening.',
        true
      );

    insert into public.medication_schedules (
      id,
      medication_id,
      scheduled_time,
      days_of_week,
      start_date
    )
    values
      (
        metformin_schedule_id,
        metformin_id,
        time '08:00',
        array[0, 1, 2, 3, 4, 5, 6]::smallint[],
        local_today - 7
      ),
      (
        vitamin_d_schedule_id,
        vitamin_d_id,
        time '13:00',
        array[0, 1, 2, 3, 4, 5, 6]::smallint[],
        local_today - 7
      ),
      (
        blood_pressure_schedule_id,
        blood_pressure_id,
        time '20:00',
        array[0, 1, 2, 3, 4, 5, 6]::smallint[],
        local_today - 7
      );

    -- Seven days x three schedules = 21 real history rows. Nineteen are
    -- taken (including several taken late) and two are missed: 90% overall.
    with demo_schedules (
      medication_id,
      schedule_id,
      scheduled_time
    ) as (
      values
        (metformin_id, metformin_schedule_id, time '08:00'),
        (vitamin_d_id, vitamin_d_schedule_id, time '13:00'),
        (blood_pressure_id, blood_pressure_schedule_id, time '20:00')
    ),
    history_rows as (
      select
        schedule.medication_id,
        schedule.schedule_id,
        history_day,
        (
          ((local_today - history_day) + schedule.scheduled_time)
          at time zone 'Asia/Kathmandu'
        ) as scheduled_at
      from demo_schedules as schedule
      cross join generate_series(1, 7) as days(history_day)
    )
    insert into public.dose_records (
      patient_id,
      medication_id,
      schedule_id,
      scheduled_at,
      taken_at,
      status
    )
    select
      current_patient_id,
      history.medication_id,
      history.schedule_id,
      history.scheduled_at,
      case
        when (
          history.medication_id = blood_pressure_id
          and history.history_day = 4
        ) or (
          history.medication_id = metformin_id
          and history.history_day = 7
        ) then null
        when history.medication_id = vitamin_d_id
          and history.history_day in (1, 3, 5)
          then history.scheduled_at + interval '24 minutes'
        else history.scheduled_at + interval '4 minutes'
      end,
      case
        when (
          history.medication_id = blood_pressure_id
          and history.history_day = 4
        ) or (
          history.medication_id = metformin_id
          and history.history_day = 7
        ) then 'missed'
        else 'taken'
      end
    from history_rows as history;

    -- Today is kept dynamic so Metformin is always immediately demonstrable.
    -- The schedule definitions above still retain the presentation's 8/1/8
    -- care plan, while these three dose events can move independently. Three
    -- future rollover rows keep the reset usable if setup happens just before
    -- Kathmandu midnight; they are excluded from today's views and analytics.
    insert into public.dose_records (
      patient_id,
      medication_id,
      schedule_id,
      scheduled_at,
      status
    )
    values
      (
        current_patient_id,
        metformin_id,
        metformin_schedule_id,
        demo_now,
        'scheduled'
      ),
      (
        current_patient_id,
        vitamin_d_id,
        vitamin_d_schedule_id,
        least(
          demo_now + interval '45 minutes',
          local_tomorrow_start - interval '2 seconds'
        ),
        'scheduled'
      ),
      (
        current_patient_id,
        blood_pressure_id,
        blood_pressure_schedule_id,
        least(
          demo_now + interval '90 minutes',
          local_tomorrow_start - interval '1 second'
        ),
        'scheduled'
      ),
      (
        current_patient_id,
        metformin_id,
        metformin_schedule_id,
        local_tomorrow_start,
        'scheduled'
      ),
      (
        current_patient_id,
        vitamin_d_id,
        vitamin_d_schedule_id,
        local_tomorrow_start + interval '45 minutes',
        'scheduled'
      ),
      (
        current_patient_id,
        blood_pressure_id,
        blood_pressure_schedule_id,
        local_tomorrow_start + interval '90 minutes',
        'scheduled'
      );

    return jsonb_build_object(
      'action', requested_action,
      'medications', 3,
      'today_doses', 3,
      'rollover_doses', 3,
      'history_doses', 21,
      'history_adherence_percent', 90,
      'completed_at', demo_now
    );
  end if;

  target_medication_name := case
    when requested_action in ('due_now', 'taken') then 'Metformin'
    when requested_action = 'late' then 'Vitamin D'
    else 'Blood Pressure Medicine'
  end;

  select dose.id
  into target_dose_id
  from public.dose_records as dose
  join public.medications as medication
    on medication.id = dose.medication_id
   and medication.patient_id = dose.patient_id
  where dose.patient_id = current_patient_id
    and medication.name = target_medication_name
    and (dose.scheduled_at at time zone 'Asia/Kathmandu')::date = local_today
  order by dose.scheduled_at desc
  limit 1
  for update of dose;

  if target_dose_id is null then
    raise exception 'Demo dose not found. Reset demo data and try again.'
      using errcode = '55000';
  end if;

  -- Remove only prior notifications for the same reusable demo event so each
  -- repeated presentation produces one fresh caregiver notification.
  delete from public.notifications as notification
  where notification.dose_record_id = target_dose_id;

  target_scheduled_at := case
    when requested_action in ('due_now', 'taken') then demo_now
    when requested_action = 'late' then greatest(
      demo_now - interval '20 minutes',
      local_today_start
    )
    else greatest(
      demo_now - interval '130 minutes',
      local_today_start
    )
  end;

  -- First normalize the reusable event. This makes repeated clicks and a
  -- second presentation run deterministic; the subsequent state transition
  -- is what produces the durable notification.
  update public.dose_records
  set
    scheduled_at = target_scheduled_at,
    taken_at = null,
    status = 'scheduled'
  where id = target_dose_id
    and patient_id = current_patient_id;

  if requested_action = 'taken' then
    update public.dose_records
    set
      taken_at = demo_now,
      status = 'taken'
    where id = target_dose_id
      and patient_id = current_patient_id;
    target_status := 'taken';
  elsif requested_action = 'late' then
    update public.dose_records
    set status = 'late'
    where id = target_dose_id
      and patient_id = current_patient_id;
    target_status := 'late';
  elsif requested_action = 'missed' then
    update public.dose_records
    set status = 'missed'
    where id = target_dose_id
      and patient_id = current_patient_id;
    target_status := 'missed';
  else
    target_status := 'scheduled';
  end if;

  return jsonb_build_object(
    'action', requested_action,
    'dose_id', target_dose_id,
    'medication', target_medication_name,
    'status', target_status,
    'scheduled_at', target_scheduled_at,
    'completed_at', demo_now
  );
end;
$$;

revoke all on function public.run_own_demo_action(text)
  from public, anon, authenticated;
grant execute on function public.run_own_demo_action(text)
  to authenticated;

comment on function public.run_own_demo_action(text) is
  'Runs a fixed hackathon scenario for auth.uid() only when that patient profile is explicitly demo-enabled.';

commit;
