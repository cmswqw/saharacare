-- OPTIONAL OWNER-RUN TEST: use an isolated local/staging database only, after
-- applying the migrations. This was not run against a hosted project by Codex.
-- Requires the database owner because it creates synthetic auth/profile rows.
-- All fixtures and notifications roll back. No real account or credential is used.
-- This exercises the SQL function with synthetic auth.uid() claims; it does not
-- replace a separate authenticated Data API/RLS integration test.
begin;

do $$
declare
  fixture_patient_id uuid := gen_random_uuid();
  fixture_doctor_id uuid := gen_random_uuid();
  fixture_caregiver_id uuid := gen_random_uuid();
  fixture_unrelated_id uuid := gen_random_uuid();
  fixture_appointment_id uuid := gen_random_uuid();
  actor_id uuid;
  event_name text;
  notification_count integer;
begin
  perform set_config('request.jwt.claims', '{}', true);
  if has_function_privilege(
    'anon', 'public.notify_appointment_participants(uuid,text)', 'EXECUTE'
  ) or not has_function_privilege(
    'authenticated', 'public.notify_appointment_participants(uuid,text)', 'EXECUTE'
  ) then
    raise exception 'Unexpected notification RPC privileges';
  end if;

  insert into auth.users (id, email, raw_user_meta_data)
  values
    (fixture_patient_id, fixture_patient_id::text || '@example.invalid', '{"role":"patient","full_name":"Synthetic audit patient"}'::jsonb),
    (fixture_doctor_id, fixture_doctor_id::text || '@example.invalid', '{"role":"doctor","full_name":"Synthetic audit doctor"}'::jsonb),
    (fixture_caregiver_id, fixture_caregiver_id::text || '@example.invalid', '{"role":"caregiver","full_name":"Synthetic audit caregiver"}'::jsonb),
    (fixture_unrelated_id, fixture_unrelated_id::text || '@example.invalid', '{"role":"caregiver","full_name":"Synthetic unrelated caregiver"}'::jsonb);

  insert into public.caregiver_links (patient_id, caregiver_id, status)
  values (fixture_patient_id, fixture_caregiver_id, 'accepted');

  insert into public.appointments (
    id, patient_id, doctor_id, facility, purpose, starts_at, ends_at,
    status, created_by, created_by_role, updated_by
  ) values (
    fixture_appointment_id, fixture_patient_id, fixture_doctor_id, 'Synthetic audit clinic', 'Security test',
    statement_timestamp() + interval '1 day',
    statement_timestamp() + interval '1 day 30 minutes',
    'requested', fixture_caregiver_id, 'caregiver', null
  );

  -- NULL cancelled_by/updated_by must not authorize any claimant, including an
  -- accepted caregiver. Missing authentication and patient/doctor roles deny.
  foreach actor_id in array array[
    null::uuid, fixture_patient_id, fixture_doctor_id, fixture_caregiver_id, fixture_unrelated_id
  ] loop
    perform set_config('request.jwt.claim.sub', coalesce(actor_id::text, ''), true);
    foreach event_name in array array['appointment_rescheduled', 'appointment_cancelled'] loop
      perform public.notify_appointment_participants(fixture_appointment_id, event_name);
    end loop;
  end loop;
  select count(*) into notification_count
  from public.notifications where patient_id = fixture_patient_id;
  if notification_count <> 0 then
    raise exception 'NULL actor or unauthorized role created a notification';
  end if;

  -- The current linked creator may notify a genuine booking.
  perform set_config('request.jwt.claim.sub', fixture_caregiver_id::text, true);
  perform public.notify_appointment_participants(fixture_appointment_id, 'appointment_booked');
  select count(*) into notification_count
  from public.notifications where patient_id = fixture_patient_id;
  if notification_count <> 1 then
    raise exception 'Linked booking creator was not authorized';
  end if;

  -- Reschedule requires its persisted actor, not just an accepted relationship.
  update public.appointments set updated_by = fixture_unrelated_id
  where id = fixture_appointment_id;
  perform public.notify_appointment_participants(fixture_appointment_id, 'appointment_rescheduled');
  select count(*) into notification_count
  from public.notifications where patient_id = fixture_patient_id;
  if notification_count <> 1 then
    raise exception 'Mismatched reschedule actor created a notification';
  end if;
  update public.appointments set updated_by = fixture_caregiver_id
  where id = fixture_appointment_id;
  perform public.notify_appointment_participants(fixture_appointment_id, 'appointment_rescheduled');
  select count(*) into notification_count
  from public.notifications where patient_id = fixture_patient_id;
  if notification_count <> 2 then
    raise exception 'Linked reschedule actor was not authorized';
  end if;

  -- Even matching cancellation audit fields cannot assert a cancellation while
  -- the appointment remains requested/confirmed.
  update public.appointments
  set cancelled_by = fixture_caregiver_id, cancelled_at = statement_timestamp()
  where id = fixture_appointment_id;
  perform public.notify_appointment_participants(fixture_appointment_id, 'appointment_cancelled');
  select count(*) into notification_count
  from public.notifications where patient_id = fixture_patient_id;
  if notification_count <> 2 then
    raise exception 'Uncancelled appointment produced a cancellation notice';
  end if;
  update public.appointments set status = 'cancelled'
  where id = fixture_appointment_id;
  perform public.notify_appointment_participants(fixture_appointment_id, 'appointment_cancelled');
  perform public.notify_appointment_participants(fixture_appointment_id, 'appointment_booked');
  perform public.notify_appointment_participants(fixture_appointment_id, 'appointment_rescheduled');
  select count(*) into notification_count
  from public.notifications where patient_id = fixture_patient_id;
  if notification_count <> 3 then
    raise exception 'Cancellation state authorized the wrong event';
  end if;

  -- Inactive accounts and revoked links cannot reuse a previously valid actor.
  update public.profiles set account_status = 'inactive'
  where id = fixture_caregiver_id;
  perform public.notify_appointment_participants(fixture_appointment_id, 'appointment_cancelled');
  update public.profiles set account_status = 'active'
  where id = fixture_caregiver_id;
  delete from public.caregiver_links
  where patient_id = fixture_patient_id and caregiver_id = fixture_caregiver_id;
  perform public.notify_appointment_participants(fixture_appointment_id, 'appointment_cancelled');
  perform set_config('request.jwt.claim.sub', fixture_unrelated_id::text, true);
  perform public.notify_appointment_participants(fixture_appointment_id, 'appointment_cancelled');
  select count(*) into notification_count
  from public.notifications where patient_id = fixture_patient_id;
  if notification_count <> 3 then
    raise exception 'Inactive, revoked, or unrelated caregiver created a notification';
  end if;

  raise notice 'Appointment notification authorization checks passed; all fixtures will roll back.';
end;
$$;

rollback;
