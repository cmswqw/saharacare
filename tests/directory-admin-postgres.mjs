// Opt-in, disposable SQL runtime test. No .env or hosted connection is read.
// Uses the actual calendar/booking migrations over a minimal prior-schema fixture.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if(!process.argv[2])throw new Error('Supply an installed PGlite module path; see the booking handoff.');
const {PGlite}=await import(pathToFileURL(resolve(process.argv[2])).href);
const db=new PGlite();
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const owner=async()=>db.exec('reset role;');
const actor=async n=>{await owner();await db.exec(`select set_config('request.jwt.claim.sub','${n?uuid(n):''}',false); set role authenticated;`);};
const readMigration=async name=>readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8');
const manage=async(operation,payload)=>(await db.query('select public.manage_directory_listing($1,$2::jsonb) as id',[operation,JSON.stringify(payload)])).rows[0].id;
const matches=async()=>(await db.query('select * from public.get_directory_matches(null,null,null)')).rows;
const state=async()=>(await db.query('select public.get_directory_admin_state() as state')).rows[0].state;
const rejected=async(run,code)=>assert.rejects(run,error=>error.code===code);
let checks=0;
async function check(name,run){await owner();await run();checks++;console.log(`PASS ${name}`);}
const providerPayload={id:uuid(10),reason:'Evidence checked externally',active:true,approval_status:'approved',verification_status:'verified',publication_status:'published',verification_reference:'Synthetic evidence only'};
let payment;
let entitlementId;
let seed;
try {
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth,private to authenticated;
    grant usage on schema public,auth to anon,service_role;
    create table public.profiles(id uuid primary key,role text not null,account_status text not null,full_name text not null,demo_mode_enabled boolean not null default false,linking_code text);
    alter table public.profiles enable row level security;
    grant select on public.profiles to authenticated;
    create policy fixture_profiles_read on public.profiles for select to authenticated using(id=(select auth.uid()) or role='doctor');
    create table public.caregiver_links(patient_id uuid references public.profiles,caregiver_id uuid references public.profiles,status text,unique(patient_id,caregiver_id));
    create table public.notifications(user_id uuid,patient_id uuid,type text,title text,message text,constraint notifications_type_check check(type in('medication_taken')));
    create function private.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now(); return new; end;$$;
    create function private.current_user_has_role(requested_role text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and role=requested_role)$$;
    create function private.is_accepted_caregiver(target_patient_id uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.caregiver_links where caregiver_id=auth.uid() and patient_id=target_patient_id and status='accepted')$$;
    insert into public.profiles(id,role,account_status,full_name) values
      ('${uuid(1)}','patient','active','Synthetic live patient'),('${uuid(2)}','caregiver','active','Synthetic live caregiver'),
      ('${uuid(3)}','doctor','active','Synthetic live doctor'),('${uuid(4)}','admin','active','Synthetic admin'),
      ('${uuid(5)}','admin','inactive','Synthetic inactive admin'),
      ('${uuid(101)}','patient','active','DEMO Patient Example — fictional'),('${uuid(102)}','doctor','active','DEMO Dr. Juniper Example — fictional'),
      ('${uuid(103)}','caregiver','active','DEMO Caregiver Example — fictional'),('${uuid(104)}','patient','active','DEMO Listing Admin — fictional');
    insert into public.caregiver_links values('${uuid(1)}','${uuid(2)}','accepted');
  `);
  // Reuse the original appointment table, constraints and validation trigger verbatim.
  const original=await readMigration('20260817153031_implement_medical_kyc_appointment_sharing');
  await db.exec(original.slice(original.indexOf('create table public.appointments ('),original.indexOf('create table private.medical_share_config (')));
  await db.exec('alter table public.appointments enable row level security; grant select on public.appointments to authenticated; create policy appointments_select_participant on public.appointments for select to authenticated using(patient_id=auth.uid() or doctor_id=auth.uid());');
  await db.exec(await readMigration('20260819222740_implement_doctor_availability_and_caregiver_appointments'));
  await db.exec(await readMigration('20260820131745_repair_doctor_availability_trigger'));
  await db.exec(await readMigration('20261115050707_establish_paid_partner_directory'));
  await db.exec(await readMigration('20261115051432_directory_administration_and_demo_isolation'));
  await owner(); await db.exec(`select set_config('request.jwt.claim.sub','',false);
    insert into private.directory_specialties values('synthetic','Synthetic only','काल्पनिक',true);
    insert into private.directory_providers(id,provider_type,display_name) values('${uuid(10)}','hospital','Synthetic test facility');
    insert into private.directory_provider_specialties values('${uuid(10)}','synthetic');
    insert into public.doctor_availability_overrides(doctor_id,override_date,override_type,start_time,end_time)
      values('${uuid(3)}',(statement_timestamp() at time zone 'Asia/Kathmandu')::date+7,'custom_hours','09:00','12:00');
  `);
  const dates=(await db.query("select now()-interval '1 hour' as start,now()+interval '1 day' as finish")).rows[0];
  payment={id:uuid(10),reason:'External bank receipt reconciled',plan:'listing',payment_reference:'TEST-EXTERNAL-RECEIPT-1',starts_at:dates.start,ends_at:dates.finish};

  await check('only active stored admins may read or mutate; missing/anon/other/inactive callers denied',async()=>{
    for(const n of [null,1,2,3,5]) {
      await actor(n);await rejected(()=>manage('provider',providerPayload),'42501');await rejected(()=>state(),'42501');
    }
    await owner();await db.exec('set role anon');await rejected(()=>state(),'42501');await rejected(()=>manage('provider',providerPayload),'42501');
    await actor(4);assert.equal((await state()).providers.length,1);
  });
  await check('verification needs evidence; actor, paid status and demo mode cannot be injected',async()=>{
    await actor(4);
    await rejected(()=>manage('provider',{...providerPayload,verification_reference:''}),'22023');
    for(const extra of [{reviewed_by:uuid(1)},{is_demo:true},{payment_status:'paid'}]) await rejected(()=>manage('provider',{...providerPayload,...extra}),'22023');
    await manage('provider',providerPayload);
    assert.equal((await matches()).length,0); // Approval alone never creates entitlement.
  });
  await check('manual external receipt activates a dated listing, without changing clinical review or consultation fee',async()=>{
    await actor(4);entitlementId=await manage('record_payment',payment);
    assert.equal((await matches()).length,1);
    await owner();
    const provider=(await db.query(`select * from private.directory_providers where id='${uuid(10)}'`)).rows[0];
    assert.equal(provider.reviewed_by,uuid(4));assert.ok(provider.reviewed_at);
    assert.equal(provider.fee_amount,null);assert.equal(provider.currency,null);
    const audit=(await db.query("select * from private.directory_audit where entity_table='directory_entitlements' order by changed_at desc limit 1")).rows[0];
    assert.equal(audit.actor_id,uuid(4));assert.equal(audit.reason,payment.reason);assert.equal(audit.operation,'INSERT');assert.equal(audit.before_state,null);assert.equal(audit.after_state.payment_reference,payment.payment_reference);
  });
  await check('duplicate receipt is idempotent; different terms and revoked receipt reuse are denied',async()=>{
    await actor(4);assert.equal(await manage('record_payment',payment),entitlementId);
    await rejected(()=>manage('record_payment',{...payment,plan:'sponsored'}),'22023');
    await manage('revoke_entitlement',{id:entitlementId,reason:'Reconciliation reversed'});
    assert.equal((await matches()).length,0);
    await rejected(()=>manage('record_payment',payment),'22023');
    entitlementId=await manage('record_payment',{...payment,payment_reference:'TEST-EXTERNAL-RECEIPT-2'});
    await owner();assert.equal((await db.query("select count(*)::int as n from private.directory_entitlements where payment_reference='TEST-EXTERNAL-RECEIPT-1'")).rows[0].n,1);
  });
  await check('publication suspension and expired/future dates remove eligibility without deleting records',async()=>{
    await actor(4);await manage('provider',{...providerPayload,publication_status:'suspended',reason:'Temporary suspension'});assert.equal((await matches()).length,0);
    await manage('provider',providerPayload);assert.equal((await matches()).length,1);
    await owner();await db.exec(`update private.directory_entitlements set ends_at=statement_timestamp() where id='${entitlementId}'`);
    await actor(1);assert.equal((await matches()).length,0);
    await owner();await db.exec(`update private.directory_entitlements set starts_at=now()+interval '1 day',ends_at=now()+interval '2 days' where id='${entitlementId}'`);
    await actor(1);assert.equal((await matches()).length,0);
    await owner();await db.exec(`update private.directory_entitlements set starts_at=now()-interval '1 day',ends_at=now()+interval '1 day' where id='${entitlementId}'`);
  });
  await check('audit rows are append-only to server callers; browser roles cannot read private state directly',async()=>{
    for(const n of [1,2,3,4]) {await actor(n);await rejected(()=>db.query('select * from private.directory_audit'),'42501');await rejected(()=>db.exec('delete from private.directory_entitlements'),'42501');}
    await owner();await db.exec('set role service_role');assert.ok((await db.query('select * from private.directory_audit')).rows.length>0);
    await rejected(()=>db.exec('delete from private.directory_audit'),'42501');await rejected(()=>db.exec("update private.directory_audit set actor_id=null"),'42501');
    await owner();const tables=(await db.query("select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r'")).rows;assert.equal(tables.length,7);assert.ok(tables.every(t=>t.relrowsecurity));
  });
  seed=await readFile(new URL('../supabase/demo/directory.sql',import.meta.url),'utf8');
  for(const [name,n] of [['PATIENT',101],['DOCTOR',102],['CAREGIVER',103],['ADMIN',104]])seed=seed.replaceAll(`__${name}_ID__`,uuid(n));
  await check('explicit fictional seed uses actual availability and atomic booking, Nepal dates and unknown fees',async()=>{
    await owner();await db.exec("select set_config('request.jwt.claim.sub','',false)");await db.exec(seed);
    const booking=(await db.query(`select *, (starts_at at time zone 'Asia/Kathmandu')::time::text as local_time from public.appointments where patient_id='${uuid(101)}'`)).rows[0];
    assert.equal(booking.created_by,uuid(101));assert.equal(booking.created_by_role,'patient');assert.equal(booking.local_time,'09:00:00');assert.equal(new Date(booking.ends_at)-new Date(booking.starts_at),30*60_000);assert.ok(new Date(booking.starts_at)>new Date());assert.ok(booking.facility.startsWith('DEMO'));
    assert.equal((await db.query(`select count(*)::int as n from public.doctor_availability_overrides where doctor_id='${uuid(102)}'`)).rows[0].n,14);
    assert.equal((await db.query("select count(*)::int as n from private.directory_providers where is_demo and (display_name not like 'DEMO%' or fee_amount is not null)")).rows[0].n,0);
  });
  await check('repeated seed does not duplicate identities, affiliations, entitlements, calendars or bookings',async()=>{
    const counts=async()=>(await db.query("select (select count(*) from private.directory_providers) as providers,(select count(*) from private.directory_affiliations) as affiliations,(select count(*) from private.directory_entitlements) as entitlements,(select count(*) from public.doctor_availability_overrides) as availability,(select count(*) from public.appointments) as appointments,(select count(*) from private.directory_audit) as audit")).rows[0];
    const before=await counts();await db.exec(seed);assert.deepEqual(await counts(),before);
  });
  await check('demo listings never qualify for live query; legacy doctor picker and appointment reads separate modes',async()=>{
    await actor(1);assert.ok((await matches()).every(p=>!p.display_name.startsWith('DEMO')));
    assert.equal((await db.query(`select id from public.profiles where role='doctor' and id='${uuid(102)}'`)).rows.length,0);
    assert.equal((await db.query(`select id from public.appointments where patient_id='${uuid(101)}'`)).rows.length,0);
    await actor(101);assert.equal((await db.query(`select id from public.appointments where patient_id='${uuid(101)}'`)).rows.length,1);
    assert.equal((await db.query(`select id from public.profiles where role='doctor' and id='${uuid(3)}'`)).rows.length,0);
    await actor(103);assert.equal((await db.query(`select id from public.appointments where patient_id='${uuid(101)}'`)).rows.length,1);
  });
  const book=async(patient,doctor,offset=0)=>db.query(`select public.book_appointment($1,$2,(((statement_timestamp() at time zone 'Asia/Kathmandu')::date+7+time '10:00') at time zone 'Asia/Kathmandu')+($3*interval '30 minutes'),'Synthetic facility','Synthetic purpose',null)`,[uuid(patient),uuid(doctor),offset]);
  await check('mixed demo/live patient, doctor and caregiver actors cannot create bookings',async()=>{
    await actor(1);await rejected(()=>book(1,102),'42501');
    await actor(101);await rejected(()=>book(101,3),'42501');
    await owner();await db.exec(`insert into public.caregiver_links values('${uuid(101)}','${uuid(2)}','accepted'),('${uuid(1)}','${uuid(103)}','accepted')`);
    await actor(2);await rejected(()=>book(101,102),'42501');
    await actor(103);await rejected(()=>book(1,3),'42501');
  });
  await check('live patient/caregiver booking and demo caregiver booking still use real RPC and collision protection',async()=>{
    await actor(1);await book(1,3);await rejected(()=>book(1,3),'23P01');
    await actor(2);await book(1,3,1);
    await actor(103);await book(101,102);
    await owner();const roles=(await db.query("select created_by_role,count(*)::int as n from public.appointments group by created_by_role")).rows;
    assert.equal(roles.find(r=>r.created_by_role==='caregiver').n,2);
  });
  await check('admin catalog does not return appointment or patient fields, no PUBLIC admin function grants',async()=>{
    await actor(4);const adminState=await state();assert.ok(adminState.audit.length>0);assert.ok(adminState.providers.some(p=>p.is_demo));assert.ok(!JSON.stringify(adminState).includes('patient_id'));
    await owner();const grants=(await db.query(`select p.proname from pg_proc p,lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl where p.proname in('get_directory_admin_state','manage_directory_listing','audit_directory_change','require_directory_admin','enforce_directory_demo_booking','directory_profile_in_same_mode') and acl.grantee=0 and acl.privilege_type='EXECUTE'`)).rows;assert.deepEqual(grants,[]);
  });
  console.log(`${checks} directory admin/demo PostgreSQL checks passed (isolated PGlite fixture; real scheduling migrations).`);
} catch(error) {
  console.error({message:error.message,code:error.code,detail:error.detail,where:error.where});process.exitCode=1;
} finally {await db.close();}
