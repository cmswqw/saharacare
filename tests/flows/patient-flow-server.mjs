// Opt-in loopback-only browser -> real route/actions -> disposable SQL -> real UI.
// Auth/JWT, PostgREST and Gemini are explicitly substituted test boundaries.
import {createServer} from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import loadTailwindConfig from 'tailwindcss/loadConfig.js';
import {createBookingFixture,uuid} from '../fixtures/directory-booking-db.mjs';
import {localSupabaseAdapter} from '../fixtures/local-supabase-adapter.mjs';
import {loadServerModule} from '../server-module.ts';
if(!process.argv[2])throw Error('Supply an installed PGlite runtime path. No hosted targets accepted.');
const {db,date}=await createBookingFixture(process.argv[2]);
const metrics={rpcs:[],modelCalls:0,actions:[],failDirectoryOnce:false,failSlotsOnce:false,diagnostics:0,scenario:'routine'};
const actorId=uuid(1);
const client=localSupabaseAdapter(db,actorId,metrics);
const profile={id:actorId,role:'patient',full_name:'Synthetic Patient',account_status:'active'};
const mocks={
  '@/lib/supabase/server':{createClient:async()=>client},
  '@/lib/auth':{requireProfile:async()=>profile,requireRole:async()=>profile},
  '@/lib/chat/gemini':{getChatProvider:()=>({streamText:async()=>{
    metrics.modelCalls++;return (async function*(){
      if(metrics.scenario==='clarification'&&metrics.modelCalls===1){yield JSON.stringify({urgency:'uncertain',specialtyIds:['general-medicine'],clarification:'duration'});return;}
      yield JSON.stringify({urgency:'routine',specialtyIds:['general-medicine'],clarification:null});
    })();
  }})},
  'next/cache':{revalidatePath:()=>{}},
  'test:console':{error:()=>{metrics.diagnostics++;}},
};
let route=loadServerModule('app/api/chat/route.ts',mocks,{NODE_ENV:'test'});
const actions=loadServerModule('app/actions/appointments.ts',mocks);
const appointments=loadServerModule('lib/data/appointments.ts',mocks);
await db.exec(`select set_config('request.jwt.claim.sub','${actorId}',false);set role authenticated`);
const transport=`const call=async(name,args)=>{const response=await fetch('/fixture-actions/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)});if(!response.ok)throw Error('Local test transport failed');return response.json();};
export const getAvailableAppointmentSlotsAction=(...args)=>call('getAvailableAppointmentSlotsAction',args);
export const getDirectoryBookingSlotsAction=(...args)=>call('getDirectoryBookingSlotsAction',args);
export const bookAppointmentAction=(state,form)=>call('bookAppointmentAction',[state,[...form.entries()]]);
export const rescheduleAppointmentAction=(state,form)=>call('rescheduleAppointmentAction',[state,[...form.entries()]]);
export const cancelAppointmentAction=(state,form)=>call('cancelAppointmentAction',[state,[...form.entries()]]);`;
const compiled=await build({entryPoints:[resolve('tests/flows/patient-flow-preview.tsx')],write:false,bundle:true,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'explicit-fixture-boundaries',setup(builder){
  builder.onResolve({filter:/^(@\/app\/actions\/appointments|next\/link|@\/components\/contacts\/ContactsSection)$/},args=>({path:args.path,namespace:'fixture'}));
  builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='next/link'?"import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{...props,href},children)}":args.path.includes('ContactsSection')?'export function ContactsSection(){return null}':transport,loader:'jsx',resolveDir:process.cwd()}));
}}]});
const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><script defer src="/app.js"></script><title>Disposable patient-flow test</title></head><body><div id="root"></div></body></html>';
const config=loadTailwindConfig(resolve('tailwind.config.ts'));
const css=await postcss([tailwindcss({...config,content:[...config.content,'./tests/flows/**/*.tsx']})]).process(await readFile(resolve('app/globals.css'),'utf8'),{from:resolve('app/globals.css')});
// Reuse locally built Next fonts, not a remote font request or invalid CSS vars.
const builtCssFiles=(await readdir(resolve('.next/static/css'))).filter(name=>name.endsWith('.css'));
const builtCss=(await Promise.all(builtCssFiles.map(name=>readFile(resolve('.next/static/css',name),'utf8')))).join('\n');
const fontFaces=builtCss.match(/@font-face\{[^}]+\}/g)?.join('\n')??'';
const fontVars=[...builtCss.matchAll(/--font-(?:sans|devanagari):[^;}]+/g)].map(match=>match[0]).join(';');
if(!fontFaces||!fontVars)throw Error('Run npm run build first to supply the existing application fonts.');
let queue=Promise.resolve();
const serial=fn=>{const job=queue.then(fn);queue=job.catch(()=>{});return job;};
async function handle(req,res){
  const url=new URL(req.url,'http://127.0.0.1:4175');
  const reply=(value,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
  if(url.pathname==='/app.js'){res.setHeader('content-type','text/javascript');res.end(compiled.outputFiles[0].contents);return;}
  if(url.pathname==='/app.css'){res.setHeader('content-type','text/css');res.end(fontFaces+'\n'+css.css+'\n:root{'+fontVars+'}');return;}
  if(/^\/_next\/static\/media\/[a-z0-9.-]+\.woff2$/.test(url.pathname)){res.setHeader('content-type','font/woff2');res.end(await readFile(resolve('.next/static/media',url.pathname.split('/').at(-1))));return;}
  if(url.pathname==='/fixture-state'){
    const data=await appointments.getAppointments();if(data.error)throw Error('Fixture participant read failed');
    reply({appointments:data.data,doctors:[{id:uuid(3),full_name:'Synthetic Doctor'}],date,modelCalls:metrics.modelCalls,actions:metrics.actions});return;
  }
  if(url.pathname==='/fixture-reset'){
    await db.exec(`reset role;delete from private.appointment_booking_requests;delete from public.appointments;update private.directory_affiliations set fee_amount=500 where id='${uuid(20)}';select set_config('request.jwt.claim.sub','${actorId}',false);set role authenticated`);
    // A fresh isolated route also resets its REAL in-memory rate limiter. Never
    // disable the application limiter just to make repeated fixture runs pass.
    route=loadServerModule('app/api/chat/route.ts',mocks,{NODE_ENV:'test'});
    metrics.rpcs=[];metrics.actions=[];metrics.modelCalls=0;metrics.failDirectoryOnce=false;metrics.failSlotsOnce=false;metrics.scenario='routine';reply({reset:true});return;
  }
  if(url.pathname==='/fixture-fail-directory-once'){metrics.failDirectoryOnce=true;reply({armed:true});return;}
  if(url.pathname==='/fixture-fail-slots-once'){metrics.failSlotsOnce=true;reply({armed:true});return;}
  if(url.pathname==='/fixture-clarification'){metrics.scenario='clarification';reply({armed:true});return;}
  if(url.pathname==='/fixture-change-fee'){await db.exec(`reset role;update private.directory_affiliations set fee_amount=600 where id='${uuid(20)}';set role authenticated`);reply({changed:true});return;}
  let body='';for await(const part of req){body+=part;if(body.length>30000)throw Error('Fixture body too large');}
  if(url.pathname==='/api/chat'){
    metrics.actions.push(JSON.parse(body).action);
    const result=await route.POST(new Request('http://127.0.0.1:4175/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body}));
    res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text());return;
  }
  if(url.pathname.startsWith('/fixture-actions/')){
    const name=url.pathname.split('/').at(-1);
    if(!['bookAppointmentAction','getDirectoryBookingSlotsAction','getAvailableAppointmentSlotsAction','rescheduleAppointmentAction','cancelAppointmentAction'].includes(name))return reply({error:'Unknown action'},404);
    const args=JSON.parse(body);
    if(name.endsWith('AppointmentAction')){const form=new FormData();for(const [key,value] of args[1])form.set(key,value);args[1]=form;}
    reply(await actions[name](...args));return;
  }
  res.setHeader('content-type','text/html');res.end(html);
}
const server=createServer((req,res)=>{void serial(()=>handle(req,res)).catch(()=>{res.writeHead(500);res.end('Local fixture failed; no provider or patient details logged.');});});
server.listen(4175,'127.0.0.1',()=>console.log('Disposable patient flow: http://127.0.0.1:4175 (real modules/SQL; synthetic Auth/Gemini, not Supabase HTTP).'));
process.on('SIGINT',()=>server.close(()=>{void db.close().finally(()=>process.exit());}));
