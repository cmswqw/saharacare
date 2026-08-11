begin;

-- Phase 8 skipped all schedule materialization for demo-enabled patients. That
-- also skipped normal medications those patients created through the app.
-- Preserve an existing demo/moved dose for a schedule on the Kathmandu day,
-- but materialize every eligible schedule that has no dose for that day.
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
    and not exists (
      select 1
      from public.dose_records as existing_dose
      where existing_dose.patient_id = current_patient_id
        and existing_dose.schedule_id = schedule.id
        and (
          existing_dose.scheduled_at at time zone 'Asia/Kathmandu'
        )::date = local_today
    )
  on conflict on constraint dose_records_scheduled_dose_key do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.ensure_today_doses()
  from public, anon, authenticated;
grant execute on function public.ensure_today_doses()
  to authenticated;

commit;
