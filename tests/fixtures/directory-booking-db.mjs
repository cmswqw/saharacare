// Shared isolated booking fixture. Never reads credentials or contacts a service.
import {readFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
export const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export async function createBookingFixture(runtimePath) {
  const modulePath=resolve(runtimePath);
  const {PGlite}=await import(pathToFileURL(modulePath).href);
  const {btree_gist}=await import(pathToFileURL(join(dirname(modulePath),'contrib/btree_gist.js')).href);
  const db=new PGlite({extensions:{btree_gist}});
  const migration=async name=>readFile(new URL(`../../supabase/migrations/${name}.sql`,import.meta.url),'utf8');
  try {
  await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
    create schema auth;create schema private;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,private,auth to authenticated;grant usage on schema public,auth to anon,service_role;
    create table public.profiles(id uuid primary key,role text,account_status text,full_name text,demo_mode_enabled boolean not null default false,linking_code text);
    alter table public.profiles enable row level security;grant select on public.profiles to authenticated;
    create policy fixture_profile_read on public.profiles for select to authenticated using(id=auth.uid() or role='doctor');
    create table public.caregiver_links(patient_id uuid references public.profiles,caregiver_id uuid references public.profiles,status text,unique(patient_id,caregiver_id));
    create table public.notifications(user_id uuid,patient_id uuid,type text,title text,message text,constraint notifications_type_check check(type in('medication_taken')));
    create function private.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end;$$;
    create function private.current_user_has_role(requested_role text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and role=requested_role)$$;
    create function private.is_accepted_caregiver(target_patient_id uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.caregiver_links where caregiver_id=auth.uid() and patient_id=target_patient_id and status='accepted')$$;
    insert into public.profiles(id,role,account_status,full_name) values('${uuid(1)}','patient','active','Synthetic Patient'),('${uuid(2)}','caregiver','active','Synthetic Caregiver'),('${uuid(3)}','doctor','active','Synthetic Doctor'),('${uuid(4)}','admin','active','Synthetic Admin'),('${uuid(5)}','patient','active','Other Patient'),('${uuid(6)}','doctor','active','Other Doctor'),('${uuid(7)}','caregiver','active','Other Caregiver');
    insert into public.caregiver_links values('${uuid(1)}','${uuid(2)}','accepted');`);
  const original=await migration('20260817153031_implement_medical_kyc_appointment_sharing');
  await db.exec(original.slice(original.indexOf('create table public.appointments ('),original.indexOf('create table private.medical_share_config (')));
  await db.exec('alter table public.appointments enable row level security;grant select on public.appointments to authenticated;create policy appointments_select_participant on public.appointments for select to authenticated using(patient_id=auth.uid() or doctor_id=auth.uid());');
  for(const name of ['20260819222740_implement_doctor_availability_and_caregiver_appointments','20260820131745_repair_doctor_availability_trigger','20261115050707_establish_paid_partner_directory','20261115051432_directory_administration_and_demo_isolation','20261115053248_expose_active_directory_specialties','20261115061354_integrate_safe_directory_booking'])await db.exec(await migration(name));
  await db.exec(`insert into private.directory_specialties values('general-medicine','Synthetic General Medicine','सामान्य',true);
    insert into private.directory_providers(id,provider_type,doctor_profile_id,display_name,active,approval_status,verification_status,publication_status)
      values('${uuid(10)}','doctor','${uuid(3)}','Synthetic Listed Doctor',true,'approved','verified','published'),('${uuid(11)}','hospital',null,'Synthetic Hospital',true,'approved','verified','published');
    insert into private.directory_provider_specialties values('${uuid(10)}','general-medicine'),('${uuid(11)}','general-medicine');
    insert into private.directory_affiliations(id,doctor_provider_id,facility_provider_id,active,approval_status,fee_amount,currency)values('${uuid(20)}','${uuid(10)}','${uuid(11)}',true,'approved',500,'NPR');
    insert into private.directory_affiliation_specialties values('${uuid(20)}','general-medicine');
    insert into private.directory_entitlements(id,provider_id,plan,payment_status,starts_at,ends_at)values('${uuid(30)}','${uuid(10)}','listing','paid',now()-interval '1 day',now()+interval '1 day'),('${uuid(31)}','${uuid(11)}','listing','paid',now()-interval '1 day',now()+interval '1 day');
    insert into public.doctor_availability_overrides(doctor_id,override_date,override_type,start_time,end_time)
      select id,(clock_timestamp() at time zone 'Asia/Kathmandu')::date+7,'custom_hours','09:00','12:00' from public.profiles where role='doctor';`);
  await db.exec(await migration('20261115130918_exclude_demo_accounts_from_live_directory'));
    const date=(await db.query("select ((clock_timestamp() at time zone 'Asia/Kathmandu')::date+7)::text as date")).rows[0].date;
    return {db,date,uuid};
  } catch(error) {await db.close();throw error;}
}
