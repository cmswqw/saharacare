// Explicit opt-in ONLY for a user-approved test project. Uses real Supabase Auth,
// PostgREST, Next login/SSR/server actions. Never prints tokens/passwords/rows.
import assert from 'node:assert/strict';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
const expected=process.argv[3];
if(process.argv[2]!=='--test-project'||!expected||new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname!==`${expected}.supabase.co`)throw Error('Explicit approved test-project target required.');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const admin=createClient(url,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const client=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const report={testProject:expected,runId:randomUUID(),users:[],appointmentId:null,checks:[]};
const directory=await mkdtemp(join(tmpdir(),'saharacare-auth-check-'));
const checked=(name)=>{report.checks.push(name);console.log('PASS '+name);};
const must=(result,stage)=>{if(result.error)throw Error(`${stage}: ${/^[0-9A-Z]{5}$|^PGRST\d{3}$/.test(result.error.code??'')?result.error.code:'request_failed'}`);return result.data;};
let browser;let diagnose;let stage='provision';const signedIn=[];
try{
  const accounts=[];
  for(const role of ['patient','doctor','patient']){
    const email=`sc-check-${randomUUID()}@example.invalid`,password=randomUUID()+randomUUID();
    const user=must(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{role,full_name:`TEST ONLY ${role} — disposable`},app_metadata:{saharacare_verification:report.runId}}),'test_user_create').user;
    report.users.push(user.id);
    const session=client();must(await session.auth.signInWithPassword({email,password}),'password_sign_in');signedIn.push(session);
    assert.equal(must(await session.auth.getUser(),'verified_auth').user.id,user.id);
    accounts.push({id:user.id,email,password,session});
  }
  checked('real password sign-in and server-verified Auth users');
  const [patient,doctor,other]=accounts;
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kathmandu',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+7*86400000));
  const weekday=new Date(date+'T12:00:00+05:45').getUTCDay();
  must(await doctor.session.from('doctor_availability').insert({doctor_id:doctor.id,day_of_week:weekday,start_time:'09:00',end_time:'11:00'}),'doctor_own_calendar');
  const source=await readFile('lib/data/appointments.ts','utf8');
  const selection=source.split('const appointmentSelection = ')[1].split(';')[0].trim().slice(1,-1);
  assert.deepEqual(must(await patient.session.from('appointments').select(selection).eq('patient_id',patient.id),'real_appointment_selection'),[]);
  const catalog=must(await patient.session.rpc('get_directory_specialties'),'real_catalog');assert.ok(Array.isArray(catalog));
  checked('authenticated PostgREST appointment selection and specialty RPC');

  stage='browser_login';
  browser=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-pipe',`--user-data-dir=${join(directory,'chrome')}`],{stdio:['ignore','ignore','pipe','pipe','pipe'],windowsHide:true});
  let id=0,buffer='';const pending=new Map();
  browser.stdio[4].on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\0'))!==-1){const part=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!part)continue;const data=JSON.parse(part);if(data.id&&pending.has(data.id)){const p=pending.get(data.id);pending.delete(data.id);data.error?p.reject(Error('Browser command failed')):p.resolve(data.result);}}});
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const messageId=++id;pending.set(messageId,{resolve,reject});browser.stdio[3].write(JSON.stringify({id:messageId,method,params,...(sessionId?{sessionId}:{})})+'\0');});
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});await send('Page.enable',{},sessionId);
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(result.exceptionDetails)throw Error('Browser evaluation failed');return result.result.value;};
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function until(expression){for(let i=0;i<150;i++){try{if(await evaluate(`Boolean(${expression})`))return;}catch{/* A real navigation can briefly destroy the JS context. */}await wait(200);}throw Error('page_state_timeout');}
  diagnose=()=>evaluate(`({path:['/login','/patient','/patient/appointments'].includes(location.pathname)?location.pathname:'other',hasEmailInput:!!document.querySelector('input[type=email]'),hasAlert:!!document.querySelector('[role=alert]'),hasBookingStep:document.body.textContent.includes('Step 1 of 4'),hydrated:!!document.querySelector('input')&&Object.keys(document.querySelector('input')).some(key=>key.startsWith('__reactProps'))})`);
  const visible=selector=>`[...document.querySelectorAll(${JSON.stringify(selector)})].filter(el=>el.checkVisibility())`;
  const change=(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const primary=()=>evaluate(`[...document.querySelector('input[name=bookingReview]').form.querySelectorAll('button')].find(el=>el.checkVisibility()&&el.classList.contains('bg-primary')).click()`);
  const atStep=n=>until(`${visible('h2')}.some(el=>el.previousElementSibling?.textContent==='Step ${n} of 4')`);
  stage='login_hydration';
  await send('Page.navigate',{url:'http://localhost:3000/login'},sessionId);await until(`document.querySelector('input[type=email]') && Object.keys(document.querySelector('input[type=email]')).some(key=>key.startsWith('__reactProps'))`);
  await change('input[type=email]',patient.email);await change('input[type=password]',patient.password);
  await wait(150);stage='password_form_submit';
  await evaluate(`document.querySelector('input[type=email]').form.requestSubmit()`);await until(`location.pathname==='/patient'`);
  stage='appointments_ssr';
  await send('Page.navigate',{url:'http://localhost:3000/patient/appointments'},sessionId);await atStep(1);
  assert.equal(await evaluate(`document.body.textContent.includes('medical sharing migration')`),false);
  checked('real Next login/session cookies and appointments SSR render');
  stage='browser_booking';
  await evaluate(`${visible('summary')}.find(el=>el.textContent==='Already know your doctor?').click()`);await atStep(2);
  await change('select[name=doctorId]',doctor.id);await change('input[name=facility]','TEST ONLY disposable clinic');await wait(80);await primary();await atStep(3);
  await change('input[type=date]',date);await until(`${visible('input[name$="available-slot"]')}.length`);
  await evaluate(`${visible('input[name$="available-slot"]')}[0].click()`);await wait(80);await primary();await atStep(4);
  const form=`document.querySelector('input[name=bookingReview]').form`;
  await evaluate(`(${form}).querySelector('input[type=checkbox]').click()`);await wait(80);
  const submitted=await evaluate(`[...new FormData(${form}).entries()]`);
  await primary();await until(`${visible('h3')}.some(el=>el.textContent==='Appointment requested')`);
  const appointmentPath=await evaluate(`document.querySelector('a[href^="/patient/appointments/"]').getAttribute('href')`);
  const appointmentId=appointmentPath.split('/').at(-1);report.appointmentId=appointmentId;
  const own=must(await patient.session.from('appointments').select('id,status,created_by,created_by_role,patient_id,booking_time_zone').eq('id',appointmentId).single(),'own_saved_row');
  assert.equal(own.created_by,patient.id);assert.equal(own.patient_id,patient.id);assert.equal(own.created_by_role,'patient');assert.equal(own.status,'requested');assert.equal(own.booking_time_zone,'Asia/Kathmandu');
  checked('real browser server action -> reviewed book RPC -> requested row with authenticated actor');
  const values=Object.fromEntries(submitted),review=JSON.parse(values.bookingReview);
  const args={appointment_patient_id:patient.id,appointment_doctor_id:doctor.id,appointment_starts_at:values.startsAt,appointment_facility:values.facility,appointment_purpose:values.purpose,appointment_note:values.note||null,booking_review:review};
  const replay=must(await patient.session.rpc('book_appointment',args),'real_retry');assert.equal(replay.appointment_id,appointmentId);assert.equal(replay.replayed,true);
  assert.deepEqual(must(await other.session.from('appointments').select('id').eq('id',appointmentId),'unrelated_read'),[]);
  const denied=await other.session.rpc('book_appointment',{...args,booking_review:{...review,requestId:randomUUID()}});assert.equal(denied.error?.code,'42501');
  const anon=client();const unauth=await anon.rpc('book_appointment',args);assert.ok(unauth.error);
  checked('real JWT/RLS: same-intent retry returns same ID; unrelated patient and unauthenticated booking denied');
  await send('Page.navigate',{url:'http://localhost:3000'+appointmentPath},sessionId);await until(`document.body.textContent.includes('TEST ONLY disposable clinic')`);
  await send('Page.reload',{},sessionId);await until(`document.body.textContent.includes('TEST ONLY disposable clinic')`);
  checked('real authenticated appointment detail and persistence after reload');
  must(await patient.session.rpc('cancel_appointment',{target_appointment_id:appointmentId}),'cancel_test_booking');
  checked('real patient cancellation');
  await send('Browser.close');browser=null;
}catch(error){console.error('FAIL '+stage+': '+(/^[a-z_]+: (?:[0-9A-Z]{5}|PGRST\d{3}|request_failed)$/.test(error.message)?error.message:'verification stopped; no credentials or patient data logged'));if(diagnose)console.error('Safe browser state:',await diagnose().catch(()=>({unavailable:true})));process.exitCode=1;
}finally{
  if(browser)browser.kill();
  for(const session of signedIn)await session.auth.signOut().catch(()=>{});
  const path=join(directory,'cleanup-report.json');await writeFile(path,JSON.stringify(report));
  console.log('Generated test-only cleanup report: '+path);
}
