import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const profile=await mkdtemp(join(tmpdir(),'saharacare-promotions-'));
const browser=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-pipe',`--user-data-dir=${profile}`],{stdio:['ignore','ignore','pipe','pipe','pipe'],windowsHide:true});
let id=0,buffer='';const pending=new Map();
browser.stdio[4].on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\0'))!==-1){const s=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!s)continue;const data=JSON.parse(s);if(data.method==='Runtime.exceptionThrown')console.log('Preview exception: '+data.params.exceptionDetails.exception?.description);const p=pending.get(data.id);if(p){pending.delete(data.id);data.error?p.reject(Error(JSON.stringify(data.error))):p.resolve(data.result);}}});
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});browser.stdio[3].write(JSON.stringify({id:key,method,params,...(sessionId?{sessionId}:{})})+'\0');});
const {targetId}=await send('Target.createTarget',{url:'about:blank'});const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});await send('Page.enable',{},sessionId);
await send('Runtime.enable',{},sessionId);
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(expression){for(let i=0;i<60;i++){if(await evaluate(`Boolean(${expression})`))return;await wait(50);}throw Error('Timed out: '+expression);}
async function navigate(query=''){await send('Page.navigate',{url:'http://127.0.0.1:4176/'+query},sessionId);await until(`document.querySelector('#main-content')`);}
const dialog=`document.querySelector('[role=dialog]')`;
const close=async()=>{await evaluate(`${dialog}.querySelector('button[aria-label]').click()`);await until(`!${dialog}`);};
try{
  for(const [width,height,lang,reduced] of [[390,844,'en',false],[320,800,'ne',true],[844,390,'en',false],[1366,768,'en',false]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900},sessionId);
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]},sessionId);
    await navigate('?lang='+lang);await until(dialog);await wait(300);
    assert.equal(await evaluate(`document.querySelectorAll('[role=dialog]').length`),1);
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
    const rect=await evaluate(`(()=>{const r=${dialog}.querySelector('button[aria-label]').getBoundingClientRect();return {w:r.width,h:r.height,top:r.top,bottom:r.bottom,right:r.right}})()`);
    assert.ok(rect.w>=44&&rect.h>=44&&rect.top>=0&&rect.bottom<=height&&rect.right<=width);
    assert.equal(await evaluate(`${dialog}.contains(document.activeElement)`),true);
    for(let i=0;i<12;i++){await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},sessionId);assert.equal(await evaluate(`${dialog}.contains(document.activeElement)`),true);}
    const links=await evaluate(`[...${dialog}.querySelectorAll('a')].map(a=>({href:a.href,rel:a.rel,target:a.target}))`);
    assert.ok(links.length===2&&links.every(a=>a.href==='https://example.invalid/saharacare-demo'&&a.rel.includes('noopener')&&a.rel.includes('noreferrer')&&a.target==='_blank'));
    const screenshot=await send('Page.captureScreenshot',{format:'png'},sessionId);const path=join(profile,`promotion-${width}-${lang}.png`);await writeFile(path,Buffer.from(screenshot.data,'base64'));console.log('Screenshot: '+path);
    const last=await evaluate(`localStorage.getItem('saharacare-hospital-promotion-v1')`);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},sessionId);await until(`!${dialog}`);
    assert.equal(await evaluate(`document.body.style.pointerEvents!=='none' && document.body.getAttribute('data-scroll-locked')===null`),true);
    await until(`document.activeElement.id==='main-content'`);
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Remount').click()`);await wait(250);assert.equal(await evaluate(`!!${dialog}`),false);
    await evaluate(`location.hash='other';document.dispatchEvent(new Event('visibilitychange'))`);await wait(80);assert.equal(await evaluate(`!!${dialog}`),false);
    await navigate('?lang='+lang);await until(dialog);assert.notEqual(await evaluate(`localStorage.getItem('saharacare-hospital-promotion-v1')`),last);await close();
    console.log(`PASS ${width}x${height} ${lang}: focus containment/Escape, safe links, close, scroll/focus restore, strict remount/navigation suppression, reload rotation`);
  }
  await navigate('?broken');await until(dialog);await until(`${dialog}.textContent.includes('SaharaCare')`);await close();console.log('PASS broken image fallback and immediate dismissal');
  await navigate('?empty');await wait(300);assert.equal(await evaluate(`!!${dialog}`),false);console.log('PASS empty catalog does not interrupt');
  await navigate('?slow');await until(`typeof window.resolvePromotions==='function'`);await evaluate(`document.dispatchEvent(new Event('pointerdown',{bubbles:true}));window.resolvePromotions()`);await wait(150);assert.equal(await evaluate('window.launchShown'),false);console.log('PASS late data after interaction deferred');
  await navigate('?slow');await until(`typeof window.resolvePromotions==='function'`);await evaluate(`history.pushState({},'','/other');window.resolvePromotions()`);await wait(150);assert.equal(await evaluate('window.launchShown'),false);console.log('PASS navigation while loading defers promotion');
  await navigate('?slow');await until(`typeof window.resolvePromotions==='function'`);await evaluate(`window.rejectPromotions()`);await wait(150);assert.equal(await evaluate('window.launchShown'),false);console.log('PASS retrieval failure does not interrupt');
  await navigate('?slow');await until(`typeof window.resolvePromotions==='function'`);await evaluate(`const block=document.createElement('div');block.id='blocking';block.setAttribute('role','dialog');document.body.append(block);window.resolvePromotions()`);await wait(100);assert.equal(await evaluate('window.launchShown'),false);await evaluate(`document.getElementById('blocking').remove()`);await until('window.launchShown');console.log('PASS waits for existing blocking dialog');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`Object.defineProperty(Storage.prototype,'getItem',{value(){throw Error('denied')}});Object.defineProperty(Storage.prototype,'setItem',{value(){throw Error('denied')}});`},sessionId);
  await send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true},sessionId);
  await navigate('?lang=en');await until(dialog);await evaluate(`document.documentElement.style.fontSize='24px'`);await wait(100);
  const large=await evaluate(`(()=>{const r=${dialog}.querySelector('button[aria-label]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth})()`);assert.equal(large,true);await close();console.log('PASS denied storage and enlarged text remain usable');
  console.log('Local real components/Radix/animation/session policy; synthetic public configuration and simulated navigation, no hosted services.');
}finally{await send('Browser.close');}
