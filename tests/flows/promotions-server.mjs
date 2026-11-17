// Loopback-only component preview, no Auth/database/provider requests.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import loadConfig from 'tailwindcss/loadConfig.js';
const js=await build({entryPoints:[resolve('tests/flows/promotions-preview.tsx')],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env':'{}','process.env.NODE_ENV':'"development"'},plugins:[{name:'navigation-fixture',setup(b){
  b.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:"export const usePathname=()=>'/patient';"}));
}}]});
const config=loadConfig(resolve('tailwind.config.ts'));
const css=await postcss([tailwind({...config,content:[...config.content,'./tests/flows/promotions-preview.tsx']})]).process(await readFile('app/globals.css','utf8'),{from:resolve('app/globals.css')});
createServer(async(req,res)=>{
  try{
    const path=new URL(req.url,'http://127.0.0.1:4176').pathname;
    if(path==='/app.js'){res.setHeader('content-type','text/javascript');res.end(js.outputFiles[0].contents);}
    else if(path==='/app.css'){res.setHeader('content-type','text/css');res.end(css.css+'\n:root{--font-sans:system-ui;--font-devanagari:system-ui}');}
    else if(path==='/promotions/demo.svg'){res.setHeader('content-type','image/svg+xml');res.end(await readFile('public/promotions/demo.svg'));}
    else if(path==='/promotions/missing.svg'){res.writeHead(404);res.end();}
    else {res.setHeader('content-type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><script defer src="/app.js"></script></head><body><div id="root"></div></body></html>');}
  }catch{res.writeHead(500);res.end('Preview unavailable');}
}).listen(4176,'127.0.0.1',()=>console.log('Fictional promotion preview: http://127.0.0.1:4176'));
