begin;
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
set local search_path=public,extensions,pg_catalog;

-- The existing calendar is Kathmandu-only. Make the facility contract explicit;
-- do not pretend a different zone is supported by the existing scheduling model.
alter table private.directory_providers add column booking_time_zone text not null default 'Asia/Kathmandu'
  check(booking_time_zone='Asia/Kathmandu');
alter table public.appointments
  add column directory_affiliation_id uuid references private.directory_affiliations(id) on delete restrict,
  add column directory_specialty_id text references private.directory_specialties(id) on delete restrict,
  add column booked_fee_amount numeric(12,2), add column booked_currency text,
  add column booking_time_zone text,
  add constraint appointments_directory_snapshot_check check(
    directory_affiliation_id is null or (directory_specialty_id is not null and booking_time_zone is not null and booking_time_zone='Asia/Kathmandu'
      and (booked_fee_amount is null or (booked_fee_amount>=0 and booked_fee_amount<>'NaN'::numeric and booked_currency is not null))
      and (booked_currency is null or booked_currency ~ '^[A-Z]{3}$')));
create index appointments_directory_affiliation_idx on public.appointments(directory_affiliation_id);
create index appointments_directory_specialty_idx on public.appointments(directory_specialty_id);

-- Abort rather than delete/alter any pre-existing conflicting appointment.
-- Unlike doctor/start uniqueness this also protects shifted/overlapping slots.
alter table public.appointments add constraint appointments_doctor_no_overlap
  exclude using gist(doctor_id with =,tstzrange(starts_at,ends_at,'[)') with &&) where(status<>'cancelled');
alter table public.appointments add constraint appointments_patient_no_overlap
  exclude using gist(patient_id with =,tstzrange(starts_at,ends_at,'[)') with &&) where(status<>'cancelled');

create table private.appointment_booking_requests(
  actor_id uuid not null references public.profiles(id) on delete restrict,
  request_id uuid not null, fingerprint text not null,
  appointment_id uuid unique references public.appointments(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  primary key(actor_id,request_id)
);
alter table private.appointment_booking_requests enable row level security;
revoke all on private.appointment_booking_requests from public,anon,authenticated,service_role;
-- No raw access is necessary; authorized RPCs own the retry transaction.

create function private.lock_doctor_calendar()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then
    perform id from public.profiles where id=old.doctor_id for update;
    return old;
  end if;
  perform id from public.profiles where id=new.doctor_id or (tg_op='UPDATE' and id=old.doctor_id) order by id for update;
  return new;
end;
$$;
revoke all on function private.lock_doctor_calendar() from public,anon,authenticated;
create trigger a_directory_calendar_lock before insert or update or delete on public.doctor_availability for each row execute function private.lock_doctor_calendar();
create trigger a_directory_calendar_lock before insert or update or delete on public.doctor_availability_overrides for each row execute function private.lock_doctor_calendar();

-- Use one fresh clock cutoff AFTER locks, not a stale statement-start expiry.
create or replace function private.get_eligible_directory_matches(
  requested_specialty_ids text[] default null,
  requested_provider_type text default null,
  requested_provider_id uuid default null
)
returns table (
  provider_id uuid, provider_type text, doctor_profile_id uuid, display_name text,
  public_phone text, public_email text, public_address text,
  specialty_id text, specialty_name_en text, specialty_name_ne text,
  affiliation_id uuid, facility_id uuid, facility_name text,
  facility_phone text, facility_address text, fee_amount numeric, currency text,
  is_sponsored boolean, sponsorship_label_en text, sponsorship_label_ne text
)
language plpgsql volatile security definer set search_path = '' as $$
declare eligibility_time timestamptz := clock_timestamp();
begin
  if not exists (select 1 from public.profiles where id = (select auth.uid())
    and account_status = 'active' and role in ('patient', 'caregiver', 'doctor', 'admin')) then
    raise exception using errcode = '42501', message = 'An active SaharaCare account is required.';
  end if;
  if (requested_provider_type is not null and requested_provider_type not in ('doctor', 'hospital', 'clinic'))
    or (requested_specialty_ids is not null and (
      cardinality(requested_specialty_ids) > 20 or array_position(requested_specialty_ids, null) is not null
    )) then raise exception using errcode = '22023', message = 'Invalid directory filters.'; end if;

  return query
  with live_providers as (
    select p.*, exists (
      select 1 from private.directory_entitlements e where e.provider_id = p.id
        and e.plan = 'sponsored' and e.payment_status = 'paid' and not e.is_demo
        and e.starts_at <= eligibility_time and e.ends_at > eligibility_time
    ) as sponsored
    from private.directory_providers p
    where p.active and p.approval_status = 'approved' and p.verification_status = 'verified'
      and not p.is_demo and p.publication_status = 'published'
      and (p.provider_type <> 'doctor' or exists (
        select 1 from public.profiles pr where pr.id = p.doctor_profile_id
          and pr.role = 'doctor' and pr.account_status = 'active'
      ))
      and exists (select 1 from private.directory_entitlements e where e.provider_id = p.id
        and e.payment_status = 'paid' and not e.is_demo
        and e.starts_at <= eligibility_time and e.ends_at > eligibility_time)
  )
  select p.id, p.provider_type, p.doctor_profile_id, p.display_name,
    p.public_phone, p.public_email, p.public_address,
    s.id, s.name_en, s.name_ne, a.id, f.id, f.display_name, f.public_phone, f.public_address,
    case when p.provider_type = 'doctor' then a.fee_amount else p.fee_amount end,
    case when p.provider_type = 'doctor' then a.currency else p.currency end,
    p.sponsored,
    case when p.sponsored then 'Sponsored · Paid placement'::text else null::text end,
    case when p.sponsored then 'प्रायोजित · सशुल्क स्थान'::text else null::text end
  from live_providers p
  join private.directory_provider_specialties ps on ps.provider_id = p.id
  join private.directory_specialties s on s.id = ps.specialty_id and s.active
  left join private.directory_affiliations a on a.doctor_provider_id = p.id
    and a.active and a.approval_status = 'approved' and not a.is_demo
  left join live_providers f on f.id = a.facility_provider_id and f.provider_type in ('hospital', 'clinic')
  where (requested_specialty_ids is null or s.id = any(requested_specialty_ids))
    and (requested_provider_type is null or p.provider_type = requested_provider_type)
    and (requested_provider_id is null or p.id = requested_provider_id)
    and (p.provider_type <> 'doctor' or (f.id is not null and exists (
      select 1 from private.directory_affiliation_specialties afs where afs.affiliation_id = a.id and afs.specialty_id = s.id
    ) and exists (
      select 1 from private.directory_provider_specialties fps where fps.provider_id = f.id and fps.specialty_id = s.id
    )))
  order by p.display_name, p.id, s.id, a.id
  limit 200;
end;
$$;
alter function public.get_directory_matches(text[],text,uuid) volatile;

create function private.lock_directory_booking_match(provider_id uuid,affiliation_id uuid,specialty_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare selected record; facility_zone text;
begin
  -- Consistent affiliation -> provider -> mapping -> entitlement order. These
  -- SHARE locks prevent approval/fee/publication changes during persistence.
  perform a.id from private.directory_affiliations a where a.id=affiliation_id for share;
  perform p.id from private.directory_providers p where p.id=provider_id or p.id=(select a.facility_provider_id from private.directory_affiliations a where a.id=affiliation_id) order by p.id for share;
  perform s.id from private.directory_specialties s where s.id=specialty_id for share;
  perform ps.provider_id from private.directory_provider_specialties ps where ps.specialty_id=specialty_id and ps.provider_id in(select p.id from private.directory_providers p where p.id=provider_id or p.id=(select a.facility_provider_id from private.directory_affiliations a where a.id=affiliation_id)) order by ps.provider_id for share;
  perform a.affiliation_id from private.directory_affiliation_specialties a where a.affiliation_id=affiliation_id and a.specialty_id=specialty_id for share;
  perform e.id from private.directory_entitlements e where e.provider_id=provider_id or e.provider_id=(select a.facility_provider_id from private.directory_affiliations a where a.id=affiliation_id) order by e.id for share;
  select m.* into selected from private.get_eligible_directory_matches(array[specialty_id],'doctor',provider_id) m where m.affiliation_id=affiliation_id limit 1;
  if selected.provider_id is null then raise exception using errcode='P0001',message='The directory listing is no longer eligible. Review a current listing.'; end if;
  select p.booking_time_zone into facility_zone from private.directory_providers p where p.id=selected.facility_id;
  return jsonb_build_object('providerId',selected.provider_id,'doctorId',selected.doctor_profile_id,'providerName',selected.display_name,
    'affiliationId',selected.affiliation_id,'specialtyId',selected.specialty_id,'facilityId',selected.facility_id,
    'facilityName',selected.facility_name,'feeAmount',selected.fee_amount,'currency',selected.currency,'timeZone',facility_zone);
end;
$$;
revoke all on function private.lock_directory_booking_match(uuid,uuid,text) from public,anon,authenticated;

create function private.get_directory_booking_slots(provider_id uuid,affiliation_id uuid,specialty_id text,appointment_date date,requested_patient_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor_role text; subject_id uuid; selected record; quote jsonb; slots jsonb;
begin
  select p.role into actor_role from public.profiles p where p.id=(select auth.uid()) and p.account_status='active';
  subject_id:=case when actor_role='patient' then (select auth.uid()) else requested_patient_id end;
  if actor_role is null or actor_role not in('patient','caregiver') or not private.current_actor_can_manage_patient_appointments(subject_id) then
    raise exception using errcode='42501',message='You cannot book for this patient.'; end if;
  select m.* into selected from private.get_eligible_directory_matches(array[specialty_id],'doctor',provider_id) m where m.affiliation_id=affiliation_id limit 1;
  if selected.provider_id is null then raise exception using errcode='P0001',message='The directory listing is no longer eligible.'; end if;
  select jsonb_build_object('providerId',selected.provider_id,'doctorId',selected.doctor_profile_id,'providerName',selected.display_name,
    'affiliationId',selected.affiliation_id,'specialtyId',selected.specialty_id,'facilityId',selected.facility_id,'facilityName',selected.facility_name,
    'feeAmount',selected.fee_amount,'currency',selected.currency,'timeZone',p.booking_time_zone) into quote
    from private.directory_providers p where p.id=selected.facility_id;
  select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) into slots from public.get_available_appointment_slots(selected.doctor_profile_id,appointment_date) s
    where not exists(select 1 from public.appointments a where a.patient_id=subject_id and a.status<>'cancelled'
      and a.starts_at<s.ends_at and a.ends_at>s.starts_at);
  return jsonb_build_object('quote',quote,'slots',slots);
end;
$$;
revoke all on function private.get_directory_booking_slots(uuid,uuid,text,date,uuid) from public,anon,authenticated;
grant execute on function private.get_directory_booking_slots(uuid,uuid,text,date,uuid) to authenticated;
create function public.get_directory_booking_slots(provider_id uuid,affiliation_id uuid,specialty_id text,appointment_date date,requested_patient_id uuid default null)
returns jsonb language sql security invoker set search_path='' as $$select private.get_directory_booking_slots(provider_id,affiliation_id,specialty_id,appointment_date,requested_patient_id);$$;
revoke all on function public.get_directory_booking_slots(uuid,uuid,text,date,uuid) from public,anon,authenticated;
grant execute on function public.get_directory_booking_slots(uuid,uuid,text,date,uuid) to authenticated;

create function private.enforce_appointment_booking_integrity()
returns trigger language plpgsql security definer set search_path='' as $$
declare fresh_slot boolean; quote jsonb; provider_id uuid;
begin
  if new.status='cancelled' then return new; end if;
  fresh_slot:=tg_op='INSERT';
  if tg_op='UPDATE' then
    fresh_slot:=new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at
      or new.doctor_id is distinct from old.doctor_id or old.status='cancelled';
  end if;
  if not fresh_slot then return new; end if;
  perform p.id from public.profiles p where p.id in(new.doctor_id,new.patient_id) order by p.id for update;
  if new.starts_at is null or not isfinite(new.starts_at) or new.starts_at<=clock_timestamp()
    or new.starts_at<>date_trunc('second',new.starts_at)
    or (new.starts_at at time zone 'Asia/Kathmandu')::date>(clock_timestamp() at time zone 'Asia/Kathmandu')::date+180
    or new.ends_at is distinct from new.starts_at+private.appointment_duration()
    or not private.appointment_slot_within_availability(new.doctor_id,new.starts_at) then
    raise exception using errcode='22023',message='That time is outside current availability. Refresh the free slots.'; end if;
  -- Rescheduling preserves the agreed snapshot. Cancellation never requires a
  -- paid listing; a new slot requires eligible affiliation and unchanged fees.
  if new.directory_affiliation_id is not null then
    select a.doctor_provider_id into provider_id from private.directory_affiliations a where a.id=new.directory_affiliation_id;
    quote:=private.lock_directory_booking_match(provider_id,new.directory_affiliation_id,new.directory_specialty_id);
    if (quote->>'doctorId')::uuid is distinct from new.doctor_id or (quote->>'feeAmount')::numeric is distinct from new.booked_fee_amount
      or quote->>'currency' is distinct from new.booked_currency or quote->>'timeZone' is distinct from new.booking_time_zone
      or quote->>'facilityName' is distinct from new.facility then
      raise exception using errcode='P0001',message='Listing or fee changed. Review the provider before requesting another time.'; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_appointment_booking_integrity() from public,anon,authenticated;
create trigger appointments_booking_integrity before insert or update of doctor_id,patient_id,starts_at,ends_at,status on public.appointments for each row execute function private.enforce_appointment_booking_integrity();

create function private.book_appointment_with_review(
  appointment_patient_id uuid,appointment_doctor_id uuid,appointment_starts_at timestamptz,
  appointment_facility text,appointment_purpose text,appointment_note text,booking_review jsonb
)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor_id uuid:=(select auth.uid()); actor_role text; subject_id uuid; request_id uuid;
  request_hash text; existing_request private.appointment_booking_requests%rowtype;
  quote jsonb; created_id uuid; replayed boolean:=false; current_status text;
begin
  select p.role into actor_role from public.profiles p where p.id=actor_id and p.account_status='active';
  subject_id:=case when actor_role='patient' then actor_id else appointment_patient_id end;
  if actor_id is null or actor_role is null or actor_role not in('patient','caregiver')
    or (actor_role='patient' and appointment_patient_id is distinct from actor_id)
    or not private.current_actor_can_manage_patient_appointments(subject_id) then
    raise exception using errcode='42501',message='You cannot book for this patient.'; end if;
  if jsonb_typeof(booking_review) is distinct from 'object' or booking_review->'confirmed' is distinct from 'true'::jsonb
    or booking_review - array['requestId','providerId','affiliationId','specialtyId','facilityId','providerName','facilityName','feeAmount','currency','timeZone','confirmed']<>'{}'::jsonb
    or booking_review->>'timeZone' is distinct from 'Asia/Kathmandu'
    or char_length(coalesce(booking_review->>'providerName','')) not between 1 and 200
    or char_length(coalesce(booking_review->>'facilityName','')) not between 1 and 200 then
    raise exception using errcode='22023',message='Explicit booking review is required.'; end if;
  request_id:=(booking_review->>'requestId')::uuid;
  if request_id is null then raise exception using errcode='22023',message='A booking retry key is required.'; end if;
  request_hash:=encode(sha256(convert_to(jsonb_build_object('patient',subject_id,'doctor',appointment_doctor_id,
    'start',extract(epoch from appointment_starts_at),'facility',btrim(appointment_facility),'purpose',btrim(appointment_purpose),
    'note',nullif(btrim(appointment_note),''),'review',booking_review-'requestId')::text,'UTF8')),'hex');
  insert into private.appointment_booking_requests(actor_id,request_id,fingerprint) values(actor_id,request_id,request_hash) on conflict do nothing;
  select r.* into existing_request from private.appointment_booking_requests r where r.actor_id=actor_id and r.request_id=request_id for update;
  if existing_request.fingerprint is distinct from request_hash then raise exception using errcode='22023',message='This retry key belongs to different booking details.'; end if;
  if existing_request.appointment_id is not null then
    created_id:=existing_request.appointment_id; replayed:=true;
  else
    -- Lock profiles in ID order, including account/relationship boundaries.
    perform p.id from public.profiles p where p.id in(actor_id,subject_id,appointment_doctor_id) order by p.id for update;
    if actor_role='caregiver' then
      perform l.patient_id from public.caregiver_links l where l.caregiver_id=actor_id and l.patient_id=subject_id and l.status='accepted' for share;
    end if;
    if not private.current_actor_can_manage_patient_appointments(subject_id) then raise exception using errcode='42501',message='The patient link is no longer accepted.'; end if;
    if booking_review->>'affiliationId' is not null then
      quote:=private.lock_directory_booking_match((booking_review->>'providerId')::uuid,(booking_review->>'affiliationId')::uuid,booking_review->>'specialtyId');
      if (quote->>'doctorId')::uuid is distinct from appointment_doctor_id
        or quote - array['doctorId'] is distinct from booking_review - array['requestId','confirmed'] then
        raise exception using errcode='P0001',message='Provider, facility or fee changed. Refresh and review before booking.'; end if;
      appointment_facility:=quote->>'facilityName';
    else
      if booking_review->>'providerId' is not null or booking_review->>'specialtyId' is not null or booking_review->>'facilityId' is not null
        or booking_review->'feeAmount' is distinct from 'null'::jsonb or booking_review->'currency' is distinct from 'null'::jsonb
        or booking_review->>'facilityName' is distinct from btrim(appointment_facility)
        or not exists(select 1 from public.profiles p where p.id=appointment_doctor_id and p.full_name=booking_review->>'providerName') then
        raise exception using errcode='P0001',message='Review the current doctor and facility.'; end if;
    end if;
    -- Reuse the original actor-derived, 30-minute booking RPC and its single
    -- appointment INSERT. All snapshot/retry changes commit in the same transaction.
    created_id:=public.book_appointment(subject_id,appointment_doctor_id,appointment_starts_at,appointment_facility,appointment_purpose,appointment_note);
    update public.appointments set directory_affiliation_id=(quote->>'affiliationId')::uuid,
      directory_specialty_id=quote->>'specialtyId',booked_fee_amount=(quote->>'feeAmount')::numeric,
      booked_currency=quote->>'currency',booking_time_zone='Asia/Kathmandu' where id=created_id;
    update private.appointment_booking_requests r set appointment_id=created_id where r.actor_id=actor_id and r.request_id=request_id;
  end if;
  select a.status into current_status from public.appointments a where a.id=created_id;
  return jsonb_build_object('appointment_id',created_id,'status',current_status,'replayed',replayed);
end;
$$;
revoke all on function private.book_appointment_with_review(uuid,uuid,timestamptz,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function private.book_appointment_with_review(uuid,uuid,timestamptz,text,text,text,jsonb) to authenticated;
-- Seven required named arguments avoid ambiguity with the existing six-argument
-- RPC (which still returns UUID and remains compatible with old callers).
create function public.book_appointment(appointment_patient_id uuid,appointment_doctor_id uuid,appointment_starts_at timestamptz,appointment_facility text,appointment_purpose text,appointment_note text,booking_review jsonb)
returns jsonb language sql security invoker set search_path='' as $$select private.book_appointment_with_review(appointment_patient_id,appointment_doctor_id,appointment_starts_at,appointment_facility,appointment_purpose,appointment_note,booking_review);$$;
revoke all on function public.book_appointment(uuid,uuid,timestamptz,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.book_appointment(uuid,uuid,timestamptz,text,text,text,jsonb) to authenticated;

create or replace function public.reschedule_appointment(
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
  -- Match booking's profile-before-appointment lock order; recheck after locking.
  select * into existing from public.appointments where id=target_appointment_id;
  if existing.id is null or not private.current_actor_can_manage_patient_appointments(existing.patient_id) then
    raise exception using errcode='42501',message='You cannot reschedule this appointment.';
  end if;
  perform p.id from public.profiles p where p.id in(existing.patient_id,existing.doctor_id,(select auth.uid())) order by p.id for update;
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

commit;
