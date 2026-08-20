begin;

-- This trigger is shared by weekly availability and date overrides. Keep
-- table-specific NEW fields inside separate branches so PostgreSQL never tries
-- to resolve override_type on doctor_availability (or day_of_week on the
-- overrides table).
create or replace function private.validate_doctor_availability_role()
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

  if tg_table_name = 'doctor_availability' then
    if exists (
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
  elsif tg_table_name = 'doctor_availability_overrides' then
    if new.override_type = 'custom_hours' and exists (
      select 1
      from public.doctor_availability_overrides as existing
      where existing.doctor_id = new.doctor_id
        and existing.override_date = new.override_date
        and existing.override_type = 'custom_hours'
        and existing.id <> new.id
        and existing.start_time < new.end_time
        and existing.end_time > new.start_time
    ) then
      raise exception using
        errcode = '23P01',
        message = 'Custom availability blocks cannot overlap.';
    end if;
  else
    raise exception using
      errcode = '22023',
      message = 'Unsupported doctor availability trigger target.';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_doctor_availability_role()
  from public, anon, authenticated;

comment on function private.validate_doctor_availability_role() is
  'Validates doctor ownership and non-overlap without referencing fields absent from the active trigger table.';

commit;
