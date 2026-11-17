import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateLocalDemoTarget(url, password, explicitlySelected) {
  if (!explicitlySelected) throw new Error('Select --local-demo explicitly.');
  const parsed=new URL(url);
  if (parsed.origin!=='http://127.0.0.1:54321' || parsed.pathname!=='/' || parsed.search || parsed.hash || parsed.username || parsed.password) throw new Error('Only the standard isolated local Supabase API is supported.');
  if (typeof password!=='string' || password.length<12) throw new Error('Set DEMO_ACCOUNT_PASSWORD with at least 12 characters.');
}

const accounts=[['PATIENT','patient','DEMO Patient Example — fictional'],['DOCTOR','doctor','DEMO Dr. Juniper Example — fictional'],['CAREGIVER','caregiver','DEMO Caregiver Example — fictional'],['ADMIN','patient','DEMO Listing Admin — fictional']];
export async function provisionDemoUsers(authAdmin,password) {
  const existing=[];
  for(let page=1;page<=100;page++) {
    const {data,error}=await authAdmin.listUsers({page,perPage:100});
    if(error)throw new Error('Local Auth account listing failed.');
    existing.push(...data.users);
    if(data.users.length<100)break;
    if(page===100)throw new Error('Unexpectedly large local Auth database.');
  }
  // Preflight every collision before creating any user; never adopt another account.
  for(const [key] of accounts) {
    const email=`${key.toLowerCase()}@directory-demo.example.invalid`;
    const user=existing.find(user=>user.email===email);
    if(user && user.app_metadata?.saharacare_demo!=='local-directory-v1')throw new Error('A demo email belongs to an unrelated account; refusing to overwrite.');
  }
  const ids={};
  for(const [key,role,name] of accounts) {
    const email=`${key.toLowerCase()}@directory-demo.example.invalid`;
    let user=existing.find(user=>user.email===email);
    if(!user) {
      const result=await authAdmin.createUser({email,password,email_confirm:true,user_metadata:{role,full_name:name},app_metadata:{saharacare_demo:'local-directory-v1'}});
      if(result.error||!result.data.user)throw new Error('Local Auth demo provisioning failed; rerun safely after checking local Auth.');
      user=result.data.user;
    }
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id))throw new Error('Local Auth returned an invalid ID.');
    ids[key]=user.id;
  }
  return ids;
}

async function main() {
  const password=process.env.DEMO_ACCOUNT_PASSWORD;
  const url=process.env.DEMO_SUPABASE_URL;
  validateLocalDemoTarget(url,password,process.argv.length===3&&process.argv[2]==='--local-demo');
  const cli=process.env.SUPABASE_CLI || 'supabase';
  const status=spawnSync(cli,['status','--output','json'],{encoding:'utf8',windowsHide:true});
  if(status.error||status.status!==0)throw new Error('Start the isolated local Supabase stack first; no users were created.');
  const local=JSON.parse(status.stdout);
  if(local.API_URL!==new URL(url).origin || !local.SERVICE_ROLE_KEY)throw new Error('Could not verify the local Supabase target and service key.');
  const client=createClient(url,local.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const ids=await provisionDemoUsers(client.auth.admin,password);
  let sql=await readFile(new URL('../../supabase/demo/directory.sql',import.meta.url),'utf8');
  for(const [key,id] of Object.entries(ids))sql=sql.replaceAll(`__${key}_ID__`,id);
  const directory=await mkdtemp(join(tmpdir(),'saharacare-local-demo-'));
  try {
    const file=join(directory,'demo.sql'); await writeFile(file,sql);
    const result=spawnSync(cli,['db','query','--local','--file',file],{encoding:'utf8',windowsHide:true});
    if(result.error||result.status!==0)throw new Error('Local seed transaction failed. Check local migrations; dedicated Auth users may remain and will be reused.');
    console.log('Local fictional directory demo ready. Accounts: patient/doctor/caregiver/admin@directory-demo.example.invalid. Use the password you supplied. No online payments or live listings were created.');
  } finally {
    // Only remove this invocation's verified temporary SQL directory.
    if(resolve(directory).startsWith(resolve(tmpdir())+'\\') || resolve(directory).startsWith(resolve(tmpdir())+'/')) {
      await rm(directory,{recursive:true,force:true});
    }
  }
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().catch(()=>{console.error('Local demo setup failed. Verify --local-demo, DEMO_SUPABASE_URL, password, local CLI/stack and migrations. No hosted target is supported.');process.exitCode=1;});
}
