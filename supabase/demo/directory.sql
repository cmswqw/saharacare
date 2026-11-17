-- Opt-in LOCAL demo only. Run through scripts/demo/directory-demo.mjs.
-- Placeholders are replaced ONLY with validated Auth-admin-provisioned UUIDs.
-- No demo records belong in production migrations or automatic seed config.
begin;
create temporary table directory_demo_ids(patient uuid,doctor uuid,caregiver uuid,admin uuid) on commit drop;
insert into directory_demo_ids values('__PATIENT_ID__','__DOCTOR_ID__','__CAREGIVER_ID__','__ADMIN_ID__');
do $$
begin
  if (select count(*) from public.profiles where id in(select patient from directory_demo_ids union select doctor from directory_demo_ids union select caregiver from directory_demo_ids union select admin from directory_demo_ids)) <> 4 then
    raise exception 'Provision the four dedicated demo users through Supabase Auth first.';
  end if;
  if exists(select 1 from private.directory_providers where id in('dddddddd-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000002') and (not is_demo or display_name not like 'DEMO%')) then
    raise exception 'Refusing to overwrite a non-demo provider.';
  end if;
  if exists(select 1 from public.profiles where id=(select doctor from directory_demo_ids) and role<>'doctor') then raise exception 'Demo doctor has the wrong profile role.'; end if;
  if exists(select 1 from public.profiles where id in(select patient from directory_demo_ids union select doctor from directory_demo_ids union select caregiver from directory_demo_ids union select admin from directory_demo_ids) and full_name not like 'DEMO%') then raise exception 'Refusing to adopt a non-demo profile.'; end if;
  if exists(select 1 from private.directory_affiliations where id='dddddddd-0000-4000-8000-000000000003' and (not is_demo or doctor_provider_id<>'dddddddd-0000-4000-8000-000000000001' or facility_provider_id<>'dddddddd-0000-4000-8000-000000000002')) then raise exception 'Demo affiliation ID collision.'; end if;
  if exists(select 1 from private.directory_entitlements where (id in('dddddddd-0000-4000-8000-000000000004','dddddddd-0000-4000-8000-000000000005') or payment_reference in('DEMO-LOCAL-DOCTOR-V1','DEMO-LOCAL-HOSPITAL-V1')) and not is_demo) then raise exception 'Demo entitlement ID collision.'; end if;
end;
$$;
update public.profiles set demo_mode_enabled=true,account_status='active' where id in(select patient from directory_demo_ids union select doctor from directory_demo_ids union select caregiver from directory_demo_ids union select admin from directory_demo_ids);
update public.profiles set role='admin',linking_code=null where id=(select admin from directory_demo_ids);
insert into public.caregiver_links(patient_id,caregiver_id,status) select patient,caregiver,'accepted' from directory_demo_ids on conflict(patient_id,caregiver_id) do nothing;
select set_config('saharacare.directory_reason','Explicit local fictional demo seed',true);
insert into private.directory_specialties(id,name_en,name_ne) values('demo-general','DEMO general care — fictional','डेमो सामान्य हेरचाह — काल्पनिक') on conflict(id) do nothing;
insert into private.directory_providers(id,provider_type,doctor_profile_id,display_name,public_address,active,approval_status,verification_status,is_demo,publication_status,verification_reference)
select 'dddddddd-0000-4000-8000-000000000001'::uuid,'doctor',doctor,'DEMO Dr. Juniper Example — fictional','DEMO address — not a real clinic',true,'approved','verified',true,'published','FICTIONAL DEMO — NOT A LICENSE' from directory_demo_ids
union all select 'dddddddd-0000-4000-8000-000000000002','hospital',null,'DEMO Cloud Hospital — fictional','DEMO address — not a real hospital',true,'approved','verified',true,'published','FICTIONAL DEMO — NOT A LICENSE'
on conflict(id) do nothing;
insert into private.directory_provider_specialties(provider_id,specialty_id) values('dddddddd-0000-4000-8000-000000000001','demo-general'),('dddddddd-0000-4000-8000-000000000002','demo-general') on conflict do nothing;
insert into private.directory_affiliations(id,doctor_provider_id,facility_provider_id,active,approval_status,is_demo,fee_amount,currency)
values('dddddddd-0000-4000-8000-000000000003','dddddddd-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000002',true,'approved',true,null,null) on conflict do nothing;
insert into private.directory_affiliation_specialties values('dddddddd-0000-4000-8000-000000000003','demo-general') on conflict do nothing;
insert into private.directory_entitlements(id,provider_id,plan,payment_status,starts_at,ends_at,is_demo,payment_reference,internal_notes)
values('dddddddd-0000-4000-8000-000000000004','dddddddd-0000-4000-8000-000000000001','sponsored','paid',now()-interval '1 day',now()+interval '30 days',true,'DEMO-LOCAL-DOCTOR-V1','FICTIONAL — no money received'),
('dddddddd-0000-4000-8000-000000000005','dddddddd-0000-4000-8000-000000000002','listing','paid',now()-interval '1 day',now()+interval '30 days',true,'DEMO-LOCAL-HOSPITAL-V1','FICTIONAL — no money received') on conflict do nothing;

-- The existing doctor calendar is Kathmandu-based. These are future custom-hour
-- overrides in that SAME scheduling model, not a separate demo slot generator.
insert into public.doctor_availability_overrides(doctor_id,override_date,override_type,start_time,end_time)
select doctor, (statement_timestamp() at time zone 'Asia/Kathmandu')::date + day,'custom_hours','09:00'::time,'12:00'::time
from directory_demo_ids cross join generate_series(1,14) as days(day)
where not exists(select 1 from public.doctor_availability_overrides existing where existing.doctor_id=directory_demo_ids.doctor and existing.override_date=(statement_timestamp() at time zone 'Asia/Kathmandu')::date+day and existing.override_type='custom_hours' and existing.start_time='09:00'::time and existing.end_time='12:00'::time)
on conflict do nothing;

-- Use the real atomic booking RPC as the provisioned demo patient. Keep prior
-- demo history and reuse an existing future demo booking on repeated runs.
select set_config('request.jwt.claim.sub',(select patient::text from directory_demo_ids),true);
do $$
declare demo_patient_id uuid; demo_doctor_id uuid; chosen_start timestamptz;
begin
  select patient,doctor into demo_patient_id,demo_doctor_id from directory_demo_ids;
  if not exists(select 1 from public.appointments a where a.patient_id=demo_patient_id and a.doctor_id=demo_doctor_id and a.note='Local directory demo v1' and a.starts_at>statement_timestamp() and a.status<>'cancelled') then
    select starts_at into chosen_start from public.get_available_appointment_slots(demo_doctor_id,(statement_timestamp() at time zone 'Asia/Kathmandu')::date+7) limit 1;
    if chosen_start is null then raise exception 'No demo slot available.'; end if;
    perform public.book_appointment(demo_patient_id,demo_doctor_id,chosen_start,'DEMO Cloud Hospital — fictional','DEMO visit — fictional','Local directory demo v1');
  end if;
end;
$$;
commit;
