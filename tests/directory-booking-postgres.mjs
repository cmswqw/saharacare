// Isolated PGlite SQL execution, never .env/hosted. Requires installed runtime.
import assert from 'node:assert/strict';
import {createBookingFixture,uuid} from './fixtures/directory-booking-db.mjs';
if(!process.argv[2])throw Error('Supply an installed PGlite module path.');
const {db,date:fixtureDate}=await createBookingFixture(process.argv[2]);
const owner=()=>db.exec('reset role');
const actor=async n=>{await owner();await db.exec(`select set_config('request.jwt.claim.sub','${n?uuid(n):''}',false);set role authenticated`);};
const reject=(fn,code)=>assert.rejects(fn,e=>e.code===code);
let checks=0;
const check=async(name,fn)=>{await owner();await fn();checks++;console.log(`PASS ${name}`);};
let date,quote,starts,review,booking;
const slots=async()=> (await db.query('select public.get_directory_booking_slots($1,$2,$3,$4,$5) as result',[uuid(10),uuid(20),'general-medicine',date,uuid(1)])).rows[0].result;
const book=async({request=review,start=starts,patient=1,doctor=3,purpose='Synthetic checkup',facility='Synthetic Hospital'}={})=>(await db.query('select public.book_appointment($1,$2,$3,$4,$5,$6,$7::jsonb) as result',[uuid(patient),uuid(doctor),start,facility,purpose,null,JSON.stringify(request)])).rows[0].result;
try{
  date=(await db.query("select ((clock_timestamp() at time zone 'Asia/Kathmandu')::date+7)::text as date")).rows[0].date;
  await actor(1);const initial=await slots();quote=initial.quote;starts=initial.slots[0].starts_at;
  const {doctorId,...reviewQuote}=quote;review={...reviewQuote,requestId:uuid(100),confirmed:true};
  await check('quotes reuse actual free slots with canonical affiliation, fee/currency and Kathmandu time',async()=>{
    await actor(1);const data=await slots();assert.equal(data.quote.timeZone,'Asia/Kathmandu');assert.equal(data.quote.feeAmount,500);assert.equal(data.quote.currency,'NPR');assert.equal(data.quote.facilityName,'Synthetic Hospital');assert.equal(data.slots.length,6);
    assert.equal(new Date(data.slots[0].starts_at).toISOString().slice(11,16),'03:15');
  });
  await check('missing/doctor/unrelated caregiver/patient impersonation denied before persistence',async()=>{
    for(const n of [null,3,7]){await actor(n);await reject(()=>book(),'42501');}
    await actor(1);await reject(()=>book({patient:5}),'42501');
    await owner();assert.equal((await db.query('select count(*)::int as n from public.appointments')).rows[0].n,0);
  });
  await check('a demo doctor account cannot qualify through a mistakenly live paid provider row',async()=>{
    await db.exec(`update public.profiles set demo_mode_enabled=true where id='${uuid(3)}'`);
    await actor(1);
    assert.equal((await db.query('select * from public.get_directory_matches(null,$1,$2)',['doctor',uuid(10)])).rows.length,0);
    await reject(()=>slots(),'P0001');
    await owner();await db.exec(`update public.profiles set demo_mode_enabled=false where id='${uuid(3)}'`);
  });
  await check('explicit review, provider/affiliation identity, fee/currency/zone tampering fail closed',async()=>{
    await actor(1);
    await reject(()=>book({request:{...review,confirmed:false}}),'22023');
    for(const patch of [{providerName:'Fake Doctor'},{facilityName:'Fake Facility'},{facilityId:uuid(10)},{feeAmount:0},{currency:'USD'},{affiliationId:uuid(11)}])await reject(()=>book({request:{...review,...patch}}),'P0001');
    await reject(()=>book({request:{...review,timeZone:'UTC'}}),'22023');
    await reject(()=>book({request:{...review,created_by:uuid(5)}}),'22023');
  });
  await check('patient request commits appointment+snapshot+retry atomically with authenticated audit',async()=>{
    await actor(1);booking=await book();assert.equal(booking.status,'requested');assert.equal(booking.replayed,false);
    await owner();const row=(await db.query('select * from public.appointments where id=$1',[booking.appointment_id])).rows[0];
    assert.equal(row.patient_id,uuid(1));assert.equal(row.created_by,uuid(1));assert.equal(row.created_by_role,'patient');assert.equal(Number(row.booked_fee_amount),500);assert.equal(row.booked_currency,'NPR');assert.equal(row.directory_affiliation_id,uuid(20));assert.equal(row.facility,'Synthetic Hospital');assert.equal(row.booking_time_zone,'Asia/Kathmandu');
    assert.equal(new Date(row.ends_at)-new Date(row.starts_at),30*60_000);
  });
  await check('identical retries return the same persisted record; changed intent cannot reuse the nonce',async()=>{
    await actor(1);assert.deepEqual(await book(),{...booking,replayed:true});await reject(()=>book({purpose:'Different purpose'}),'22023');
    assert.equal((await book({start:date+'T09:00:00+05:45'})).appointment_id,booking.appointment_id);
    await owner();assert.equal((await db.query('select count(*)::int as n from public.appointments')).rows[0].n,1);
    await db.query("update public.appointments set status='confirmed' where id=$1",[booking.appointment_id]);
    await actor(1);assert.equal((await book()).status,'confirmed');await owner();
    await db.exec(`update private.directory_entitlements set payment_status='revoked' where id='${uuid(30)}'`);
    await actor(1);assert.equal((await book()).appointment_id,booking.appointment_id); // replay, NOT a fresh booking
    await reject(()=>book({request:{...review,requestId:uuid(101)},start:new Date(new Date(starts).getTime()+3600000).toISOString()}),'P0001');
    await owner();await db.exec(`update private.directory_entitlements set payment_status='paid' where id='${uuid(30)}'`);
  });
  await check('stale fee, listing suspension/expiry, affiliation rejection and inactive doctor are rejected',async()=>{
    const candidate=new Date(new Date(starts).getTime()+3600000).toISOString();
    for(const sql of [`update private.directory_affiliations set fee_amount=600 where id='${uuid(20)}'`,`update private.directory_providers set publication_status='suspended' where id='${uuid(10)}'`,`update private.directory_entitlements set ends_at=clock_timestamp() where id='${uuid(31)}'`,`update private.directory_affiliations set approval_status='rejected' where id='${uuid(20)}'`,`update public.profiles set account_status='inactive' where id='${uuid(3)}'`]){
      await owner();await db.exec('begin');await db.exec(sql);await actor(1);await reject(()=>book({start:candidate,request:{...review,requestId:uuid(102)}}),'P0001');await db.exec('rollback');
    }
  });
  await check('removed/custom blocked availability, past slots and wrong duration fail without orphan retry rows',async()=>{
    await owner();await db.exec(`insert into public.doctor_availability_overrides(doctor_id,override_date,override_type,start_time,end_time) values('${uuid(3)}','${date}','unavailable','10:00','10:30')`);
    await actor(1);await reject(()=>book({start:new Date(new Date(starts).getTime()+3600000).toISOString(),request:{...review,requestId:uuid(103)}}),'22023');
    await reject(()=>book({start:'2020-01-01T03:15:00Z',request:{...review,requestId:uuid(104)}}),'22023');
    await reject(()=>book({start:new Date(new Date(starts).getTime()+30*60000+100).toISOString(),request:{...review,requestId:uuid(112)}}),'22023');
    await owner();assert.equal((await db.query('select count(*)::int as n from private.appointment_booking_requests')).rows[0].n,1);
    await reject(()=>db.query(`insert into public.appointments(patient_id,doctor_id,facility,purpose,starts_at,ends_at,status,created_by,created_by_role)
      values($1,$2,'Test','Test',$3,$3::timestamptz+interval '15 minutes','requested',$1,'patient')`,[uuid(1),uuid(3),new Date(new Date(starts).getTime()+30*60000).toISOString()]),'22023');
  });
  await check('same-slot submissions and shifted overlapping intervals cannot reserve the doctor twice',async()=>{
    await actor(5);await reject(()=>book({patient:5,request:{...review,requestId:uuid(105)}}),'23P01');
    // Shifted custom hours model the formerly unsafe different-start overlap.
    await owner();await db.exec(`update public.doctor_availability_overrides set start_time='09:15' where doctor_id='${uuid(3)}' and override_type='custom_hours'`);
    await actor(5);await reject(()=>book({patient:5,start:new Date(new Date(starts).getTime()+15*60000).toISOString(),request:{...review,requestId:uuid(106)}}),'23P01');
    await owner();await db.exec(`update public.doctor_availability_overrides set start_time='09:00' where doctor_id='${uuid(3)}' and override_type='custom_hours'`);
    assert.equal((await db.query("select count(*)::int as n from pg_constraint where conname in('appointments_doctor_no_overlap','appointments_patient_no_overlap') and contype='x'")).rows[0].n,2);
  });
  await check('legacy RPC still works and patient cannot book overlapping doctors',async()=>{
    await actor(1);await reject(()=>db.query('select public.book_appointment($1,$2,$3,$4,$5,null)',[uuid(1),uuid(6),starts,'Legacy Clinic','Checkup']),'23P01');
    const later=new Date(new Date(starts).getTime()+30*60000).toISOString();
    const data=(await db.query('select public.book_appointment($1,$2,$3,$4,$5,null) as id',[uuid(1),uuid(6),later,'Legacy Clinic','Checkup'])).rows[0];assert.ok(data.id);
  });
  await check('existing patient form review supports legacy doctor/facility with unknown consultation fee',async()=>{
    await actor(1);const legacyReview={...review,requestId:uuid(113),providerId:null,affiliationId:null,specialtyId:null,facilityId:null,
      providerName:'Other Doctor',facilityName:'Legacy Clinic',feeAmount:null,currency:null};
    const value=await book({doctor:6,facility:'Legacy Clinic',start:date+'T11:30:00+05:45',request:legacyReview});assert.equal(value.status,'requested');
    await owner();const row=(await db.query('select booked_fee_amount,directory_affiliation_id from public.appointments where id=$1',[value.appointment_id])).rows[0];assert.equal(row.booked_fee_amount,null);assert.equal(row.directory_affiliation_id,null);
  });
  await check('reschedule retains quote, rechecks eligibility and cancellation is still allowed after expiry',async()=>{
    await actor(1);const replacement=new Date(new Date(starts).getTime()+90*60000).toISOString();
    await db.query('select public.reschedule_appointment($1,$2)',[booking.appointment_id,replacement]);
    await owner();await db.exec(`update private.directory_providers set publication_status='suspended' where id='${uuid(10)}'`);
    await actor(1);await reject(()=>db.query('select public.reschedule_appointment($1,$2)',[booking.appointment_id,new Date(new Date(starts).getTime()+120*60000).toISOString()]),'P0001');
    await db.query('select public.cancel_appointment($1)',[booking.appointment_id]);
    const retry=await book();assert.equal(retry.status,'cancelled');assert.equal(retry.replayed,true);
    await owner();const row=(await db.query('select cancelled_by,cancelled_at from public.appointments where id=$1',[booking.appointment_id])).rows[0];assert.equal(row.cancelled_by,uuid(1));assert.ok(row.cancelled_at);
    await db.exec(`update private.directory_providers set publication_status='published' where id='${uuid(10)}'`);
  });
  await check('caregiver uses linked patient and its own audit identity; retry does not create a second row',async()=>{
    await actor(2);const data=await book({request:{...review,requestId:uuid(107)}});assert.equal(data.status,'requested');assert.equal((await book({request:{...review,requestId:uuid(107)}})).replayed,true);
    await owner();const row=(await db.query('select * from public.appointments where id=$1',[data.appointment_id])).rows[0];assert.equal(row.created_by,uuid(2));assert.equal(row.patient_id,uuid(1));assert.equal(row.created_by_role,'caregiver');
    await db.exec(`update public.caregiver_links set status='revoked' where caregiver_id='${uuid(2)}'`);await actor(2);await reject(()=>book({request:{...review,requestId:uuid(107)}}),'42501');
  });
  await check('retry data is private/RLS-enabled, RPC helpers not PUBLIC and non-Kathmandu configuration rejected',async()=>{
    await actor(1);await reject(()=>db.query('select * from private.appointment_booking_requests'),'42501');await reject(()=>db.query('select * from private.directory_entitlements'),'42501');
    await reject(()=>db.exec('delete from public.appointments'),'42501');
    await owner();await db.exec('set role anon');await reject(()=>book(),'42501');await reject(()=>slots(),'42501');
    await owner();await reject(()=>db.exec(`update private.directory_providers set booking_time_zone='UTC' where id='${uuid(11)}'`),'23514');
    await reject(()=>db.exec('update public.appointments set booking_time_zone=null where directory_affiliation_id is not null'),'23514');
    const grants=(await db.query("select p.proname from pg_proc p,lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.proname in('book_appointment','get_directory_booking_slots','book_appointment_with_review','lock_directory_booking_match','enforce_appointment_booking_integrity','lock_doctor_calendar') and a.grantee=0 and a.privilege_type='EXECUTE'")).rows;assert.deepEqual(grants,[]);
  });
  await check('queued simultaneous submissions with same key reuse one result (single-session simulation only)',async()=>{
    await actor(1);const request={...review,requestId:uuid(110)};const start=new Date(new Date(starts).getTime()+120*60000).toISOString();
    const results=await Promise.all([book({request,start}),book({request,start})]);
    assert.equal(results[0].appointment_id,results[1].appointment_id);assert.equal(results.filter(r=>r.replayed).length,1);
  });
  await check('expiry after statement start is checked against fresh clock, not statement_timestamp',async()=>{
    await owner();await db.exec(`update private.directory_entitlements set ends_at=clock_timestamp()+interval '100 milliseconds' where id='${uuid(30)}'`);
    await actor(1);
    await reject(()=>db.query(`with delayed as materialized(select pg_sleep(0.15)) select public.book_appointment($1,$2,$3,$4,$5,$6,$7::jsonb) from delayed`,[uuid(1),uuid(3),new Date(new Date(starts).getTime()+150*60000).toISOString(),'Synthetic Hospital','Test',null,JSON.stringify({...review,requestId:uuid(111)})]),'P0001');
  });
  console.log(`${checks} booking SQL checks passed. PGlite is single-session: actual independent-transaction concurrency NOT tested.`);
}catch(e){console.error({message:e.message,code:e.code,detail:e.detail,where:e.where});process.exitCode=1;}finally{await db.close();}
