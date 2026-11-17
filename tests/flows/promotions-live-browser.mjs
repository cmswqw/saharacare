// Public, data-free demo route only. No login, records, bookings or admin calls.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const url=new URL(process.argv[2]);if(url.protocol!=='https:'||url.pathname!=='/hospital-demo'||url.search)throw Error('Supply the HTTPS public hospital-demo URL only.');
const profile=await mkdtemp(join(tmpdir(),'saharacare-live-promotion-'));
const browser=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-pipe',`--user-data-dir=${profile}`],{stdio:['ignore','ignore','pipe','pipe','pipe'],windowsHide:true});
let id=0,buffer='';const pending=new Map();
browser.stdio[4].on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\0'))!==-1){const s=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!s)continue;const data=JSON.parse(s);const p=pending.get(data.id);if(p){pending.delete(data.id);data.error?p.reject(Error('Browser command failed')):p.resolve(data.result);}}});
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});browser.stdio[3].write(JSON.stringify({id:key,method,params,...(sessionId?{sessionId}:{})})+'\0');});
const {targetId}=await send('Target.createTarget',{url:'about:blank'});const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});await send('Page.enable',{},sessionId);
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true},sessionId);if(r.exceptionDetails)throw Error('Page evaluation failed');return r.result.value;};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(expression){for(let i=0;i<150;i++){try{if(await evaluate(`Boolean(${expression})`))return;}catch{/* navigation */}await wait(200);}throw Error('Public demo state did not appear');}
try{
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},sessionId);
  await send('Page.navigate',{url:url.href},sessionId);await until(`document.querySelector('[role=dialog]')`);await wait(300);
  assert.equal(await evaluate(`document.querySelectorAll('[role=dialog]').length`),1);
  assert.equal(await evaluate(`document.querySelector('[role=dialog]').textContent.includes('fictional')`),true);
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
  const links=await evaluate(`[...document.querySelector('[role=dialog]').querySelectorAll('a')].map(a=>({href:a.href,rel:a.rel}))`);
  assert.ok(links.length===2&&links.every(a=>a.href===url.origin+'/hospital-demo?details=1'&&a.rel.includes('noopener')&&a.rel.includes('noreferrer')));
  const screenshot=await send('Page.captureScreenshot',{format:'png'},sessionId);const path=join(profile,'live-demo-390.png');await writeFile(path,Buffer.from(screenshot.data,'base64'));console.log('Screenshot: '+path);
  const first=await evaluate(`localStorage.getItem('saharacare-hospital-promotion-v1')`);
  await evaluate(`document.querySelector('[role=dialog] button[aria-label]').click()`);await until(`!document.querySelector('[role=dialog]')`);
  assert.equal(await evaluate(`document.body.style.pointerEvents!=='none'`),true);
  await send('Page.reload',{},sessionId);await until(`document.querySelector('[role=dialog]')`);
  assert.notEqual(await evaluate(`localStorage.getItem('saharacare-hospital-promotion-v1')`),first);
  await evaluate(`document.querySelector('[role=dialog] button[aria-label]').click()`);await until(`!document.querySelector('[role=dialog]')`);
  await send('Page.navigate',{url:url.origin+'/hospital-demo?details=1'},sessionId);await until(`document.querySelector('#promotion-demo-information')`);await wait(600);
  assert.equal(await evaluate(`!!document.querySelector('[role=dialog]')`),false);
  console.log('PASS public production demo: fictional promotion, mobile containment, safe working information destination, close/scroll restoration, reload rotation, no destination popup; no login/database writes.');
}finally{await send('Browser.close');}
