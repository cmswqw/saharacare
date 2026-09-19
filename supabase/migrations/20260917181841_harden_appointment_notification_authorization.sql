begin;

-- Notification RPCs remain separate from booking transactions. A caller must
-- still be an active, linked caregiver and must match the recorded event actor.
-- Nullable audit columns must fail closed: NULL <> actor_id is NULL, not true.
create or replace function public.notify_appointment_participants(
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
    or private.current_actor_can_manage_patient_appointments(existing.patient_id) is not true
    or (
      appointment_event = 'appointment_booked'
      and (
        existing.created_by is distinct from actor_id
        or existing.status not in ('requested', 'confirmed')
      )
    )
    or (
      appointment_event = 'appointment_rescheduled'
      and (
        existing.updated_by is distinct from actor_id
        or existing.status not in ('requested', 'confirmed')
      )
    )
    or (
      appointment_event = 'appointment_cancelled'
      and (
        existing.cancelled_by is distinct from actor_id
        or existing.status is distinct from 'cancelled'
        or existing.cancelled_at is null
      )
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

commit;
