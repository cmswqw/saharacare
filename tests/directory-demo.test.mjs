import assert from 'node:assert/strict';
import test from 'node:test';
import { provisionDemoUsers, validateLocalDemoTarget } from '../scripts/demo/directory-demo.mjs';

test('demo setup requires explicit local selection and never accepts a hosted/LAN target', () => {
  const password='local-test-password-only';
  validateLocalDemoTarget('http://127.0.0.1:54321',password,true);
  for(const url of ['https://example.supabase.co','http://192.168.1.3:54321','http://127.0.0.1:54321/hosted','http://secret@127.0.0.1:54321','http://127.0.0.1:54321?host=production']) assert.throws(()=>validateLocalDemoTarget(url,password,true));
  assert.throws(()=>validateLocalDemoTarget('http://127.0.0.1:54321',password,false));
  assert.throws(()=>validateLocalDemoTarget('http://127.0.0.1:54321','short',true));
});

test('Auth-admin provisioning is repeatable, fictional and never adopts unrelated users', async () => {
  const users=[]; const requests=[];
  const admin={
    listUsers: async()=>({data:{users},error:null}),
    createUser: async(request)=>{
      requests.push(request);
      const user={...request,id:`00000000-0000-4000-8000-${String(users.length+1).padStart(12,'0')}`};
      users.push(user); return {data:{user},error:null};
    },
  };
  const first=await provisionDemoUsers(admin,'local-test-password-only');
  assert.deepEqual(await provisionDemoUsers(admin,'different-password-not-applied'),first);
  assert.equal(requests.length,4);
  assert.ok(requests.every(r=>r.email.endsWith('@directory-demo.example.invalid')&&r.user_metadata.full_name.startsWith('DEMO')&&r.app_metadata.saharacare_demo==='local-directory-v1'));
  assert.equal(requests[3].user_metadata.role,'patient'); // Trusted SQL promotes only this dedicated local admin.
  users[0].app_metadata={};
  await assert.rejects(provisionDemoUsers(admin,'local-test-password-only'),/unrelated account/);
  assert.equal(requests.length,4);
});
