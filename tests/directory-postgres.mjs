// Explicit, isolated SQL verification. No network/Auth credentials are read.
// Supply an installed @electric-sql/pglite module path as the first argument.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Provide a local PGlite module path; see the booking handoff.');
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
let checks = 0;
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor = async n => db.exec(`select set_config('request.jwt.claim.sub', '${n ? uuid(n) : ''}', false); set role authenticated;`);
const owner = async () => db.exec('reset role;');
const matches = async (specialties = null, type = null, id = null) => (await db.query(
  'select * from public.get_directory_matches($1::text[], $2::text, $3::uuid)', [specialties, type, id],
)).rows;
async function check(name, run) { await owner(); await run(); checks++; console.log(`PASS ${name}`); }
async function rejected(sql, code) {
  await assert.rejects(db.exec(sql), error => error.code === code);
}

try {
  // Minimal existing Supabase auth/profile boundary, not a full stack emulator.
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public, auth, private to authenticated;
    grant usage on schema public, auth to anon, service_role;
    create table public.profiles(id uuid primary key, role text not null, account_status text not null);
    grant select on public.profiles to service_role;
    insert into public.profiles values
      ('${uuid(1)}','patient','active'),('${uuid(2)}','caregiver','active'),
      ('${uuid(3)}','doctor','active'),('${uuid(4)}','admin','active'),
      ('${uuid(5)}','patient','inactive');
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261115050707_establish_paid_partner_directory.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261115053248_expose_active_directory_specialties.sql', import.meta.url), 'utf8'));
  await db.exec(`
    insert into private.directory_specialties values ('general','General test','सामान्य',true),('skin','Skin test','छाला',true);
    insert into private.directory_providers(id,provider_type,doctor_profile_id,display_name,public_address,active,approval_status,verification_status,publication_status,review_notes,verification_reference)
    values ('${uuid(10)}','doctor','${uuid(3)}','Test doctor','Public address',true,'approved','verified','published','PRIVATE REVIEW','PRIVATE LICENSE'),
      ('${uuid(11)}','hospital',null,'Test hospital','Hospital address',true,'approved','verified','published','PRIVATE','PRIVATE'),
      ('${uuid(12)}','clinic',null,'Test clinic','Clinic address',true,'approved','verified','published',null,null);
    insert into private.directory_provider_specialties select p.id,s.id from private.directory_providers p cross join private.directory_specialties s;
    insert into private.directory_affiliations(id,doctor_provider_id,facility_provider_id,active,approval_status,fee_amount,currency)
      values ('${uuid(20)}','${uuid(10)}','${uuid(11)}',true,'approved',null,null),
      ('${uuid(21)}','${uuid(10)}','${uuid(12)}',true,'approved',0,'NPR');
    insert into private.directory_affiliation_specialties select a.id,s.id from private.directory_affiliations a cross join private.directory_specialties s;
    insert into private.directory_entitlements(id,provider_id,plan,payment_status,starts_at,ends_at,payment_reference,internal_notes)
      select p.id,p.id,'listing','paid',now()-interval '1 day',now()+interval '1 day','PRIVATE-'||p.id,'PRIVATE' from private.directory_providers p;
  `);

  await check('all active account roles can read; multiple specialties/facilities and unknown/zero fees survive', async () => {
    for (const n of [1,2,3,4]) {
      await actor(n); const rows = await matches(['general'], 'doctor');
      assert.equal(rows.length,2); assert.equal(rows[0].is_sponsored,false);
      assert.ok(rows.some(r=>r.fee_amount===null && r.currency===null));
      assert.ok(rows.some(r=>Number(r.fee_amount)===0 && r.currency==='NPR'));
      assert.equal((await matches(null,'doctor')).length,4); await owner();
    }
  });
  await check('no auth/inactive actor denied; anon cannot execute even public wrapper', async () => {
    for(const n of [null,5]) { await actor(n); await assert.rejects(matches(), e=>e.code==='42501'); await owner(); }
    await db.exec('set role anon'); await assert.rejects(matches(),e=>e.code==='42501');
  });
  await check('raw catalog/private payment reads and trusted status mutations denied to browser roles', async () => {
    for(const n of [1,2,3,4]) {
      await actor(n);
      for(const table of ['directory_specialties','directory_providers','directory_provider_specialties','directory_affiliations','directory_affiliation_specialties','directory_entitlements']) {
        await rejected(`select * from private.${table}`, '42501');
        await rejected(`delete from private.${table}`, '42501');
      }
      await rejected(`update private.directory_providers set verification_status='verified',approval_status='approved'`, '42501');
      await rejected(`update private.directory_entitlements set payment_status='paid'`, '42501');
      await owner();
    }
  });
  await check('public DTO omits all approval/billing/reviewer fields', async () => {
    await actor(1); const row = (await matches(['general'],'doctor'))[0];
    for(const key of ['review_notes','verification_reference','reviewed_by','payment_reference','internal_notes','payment_status','approval_status','verification_status']) assert.ok(!(key in row));
    assert.ok(!JSON.stringify(row).includes('PRIVATE'));
  });
  await check('RLS still denies raw rows if a SELECT grant were accidentally added', async () => {
    await db.exec('begin; grant select on private.directory_providers, private.directory_entitlements to authenticated;');
    await actor(1);
    assert.equal((await db.query('select * from private.directory_providers')).rows.length,0);
    assert.equal((await db.query('select * from private.directory_entitlements')).rows.length,0);
    await owner(); await db.exec('rollback');
  });
  await check('each activity/approval/verification/demo/publication gate excludes doctor', async () => {
    for(const [column,value] of [['active','false'],['approval_status',"'pending'"],['approval_status',"'rejected'"],['verification_status',"'unverified'"],['verification_status',"'rejected'"],['is_demo','true'],['publication_status',"'draft'"],['publication_status',"'suspended'"]]) {
      await db.exec('begin');
      await db.exec(`update private.directory_providers set ${column}=${value} where id='${uuid(10)}'`);
      await actor(1); assert.equal((await matches(null,'doctor')).length,0);
      await owner(); await db.exec('rollback');
    }
    await db.exec(`update public.profiles set account_status='inactive' where id='${uuid(3)}'`);
    await actor(1); assert.equal((await matches(null,'doctor')).length,0); await owner();
    await db.exec(`update public.profiles set account_status='active' where id='${uuid(3)}'`);
  });
  await check('paid interval boundaries and revoked/pending/demo entitlement fail closed', async () => {
    for(const assignment of ["ends_at=statement_timestamp()", "starts_at=now()+interval '1 hour'", "payment_status='pending'", "payment_status='revoked'", 'is_demo=true']) {
      await db.exec('begin');
      await db.exec(`update private.directory_entitlements set ${assignment} where provider_id='${uuid(10)}'`);
      await actor(1); assert.equal((await matches(null,'doctor')).length,0); await owner();
      await db.exec('rollback');
    }
    await db.exec(`update private.directory_entitlements set starts_at=statement_timestamp() where provider_id='${uuid(10)}'`);
    await actor(1); assert.equal((await matches(['general'],'doctor')).length,2);
  });
  await check('facility eligibility, affiliation approval and specialty intersections are mandatory', async () => {
    await db.exec(`update private.directory_providers set verification_status='unverified' where id='${uuid(11)}'`);
    await actor(1); assert.equal((await matches(['general'],'doctor')).length,1); await owner();
    await db.exec(`update private.directory_providers set verification_status='verified' where id='${uuid(11)}'; update private.directory_affiliations set approval_status='pending' where id='${uuid(20)}'`);
    await actor(1); assert.equal((await matches(['general'],'doctor')).length,1); await owner();
    await db.exec(`update private.directory_affiliations set approval_status='approved' where id='${uuid(20)}'; delete from private.directory_affiliation_specialties where affiliation_id='${uuid(20)}' and specialty_id='skin'`);
    await actor(1); assert.equal((await matches(['skin'],'doctor')).length,1); await owner();
    await db.exec(`insert into private.directory_affiliation_specialties values ('${uuid(20)}','skin')`);
    await db.exec(`delete from private.directory_provider_specialties where provider_id='${uuid(11)}' and specialty_id='skin'`);
    await actor(1); assert.equal((await matches(['skin'],'doctor')).length,1); await owner();
    await db.exec(`insert into private.directory_provider_specialties values ('${uuid(11)}','skin')`);
    await db.exec(`update private.directory_entitlements set payment_status='revoked' where provider_id='${uuid(11)}'`);
    await actor(1); assert.equal((await matches(['general'],'doctor')).length,1); await owner();
    await db.exec(`update private.directory_entitlements set payment_status='paid' where provider_id='${uuid(11)}'`);
  });
  await check('sponsorship is paid, date-bound, disclosed and never broadens specialty matches', async () => {
    await db.exec(`insert into private.directory_entitlements(provider_id,plan,payment_status,starts_at,ends_at) values ('${uuid(10)}','sponsored','paid',now()-interval '1 day',now()+interval '1 day')`);
    await actor(1); const rows=await matches(['general'],'doctor'); assert.equal(rows.length,2);
    assert.ok(rows.every(r=>r.is_sponsored && r.sponsorship_label_en.includes('Paid placement') && r.sponsorship_label_ne));
    assert.equal((await matches(['no-such-specialty'])).length,0); assert.equal((await matches([])).length,0);
    await owner(); await db.exec(`update private.directory_entitlements set ends_at=statement_timestamp() where plan='sponsored'`);
    await actor(1); assert.ok((await matches(['general'],'doctor')).every(r=>!r.is_sponsored && r.sponsorship_label_en===null));
  });
  await check('identity/fee/currency/date constraints and RLS are enforced', async () => {
    await rejected(`insert into private.directory_providers(provider_type,doctor_profile_id,display_name) values ('doctor','${uuid(1)}','Invalid')`,'23514');
    await rejected(`update private.directory_affiliations set facility_provider_id='${uuid(10)}' where id='${uuid(20)}'`,'23514');
    await rejected(`update private.directory_providers set fee_amount=10,currency=null`,'23514');
    await rejected(`update private.directory_providers set fee_amount=-1,currency='NPR'`,'23514');
    await rejected(`update private.directory_providers set currency='npr'`,'23514');
    await rejected(`update private.directory_entitlements set ends_at=starts_at`,'23514');
    const tables=(await db.query("select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r'")).rows;
    assert.equal(tables.length,6); assert.ok(tables.every(t=>t.relrowsecurity));
    await db.exec('set role service_role'); assert.equal((await db.query('select count(*)::int as n from private.directory_providers')).rows[0].n,3);
  });
  await check('catalog audit finds no unindexed directory FK or PUBLIC function execution', async () => {
    const missing=(await db.query(`select c.conname from pg_constraint c join pg_class t on t.oid=c.conrelid
      join pg_namespace n on n.oid=t.relnamespace where c.contype='f' and n.nspname='private'
      and not exists(select 1 from pg_index i where i.indrelid=c.conrelid and i.indisvalid
        and i.indkey[0]=c.conkey[1])`)).rows;
    assert.deepEqual(missing,[]);
    const publicExec=(await db.query(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
      lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
      where p.proname in ('get_directory_matches','get_eligible_directory_matches','validate_directory_identity')
        and n.nspname in ('public','private') and acl.grantee=0 and acl.privilege_type='EXECUTE'`)).rows;
    assert.deepEqual(publicExec,[]);
  });

  await check('canonical specialty read is active-account only, public-fields only and payment independent', async () => {
    for(const n of [1,2,3,4]) {
      await actor(n); const rows=(await db.query('select * from public.get_directory_specialties()')).rows;
      assert.deepEqual(rows.map(row=>Object.keys(row).sort()),[['id','name_en','name_ne'],['id','name_en','name_ne']]);
      await owner();
    }
    for(const n of [null,5]) {await actor(n);await rejected('select * from public.get_directory_specialties()','42501');await owner();}
    await db.exec('set role anon');await rejected('select * from public.get_directory_specialties()','42501');await owner();
    await db.exec("begin; insert into private.directory_specialties values('demo-only','DEMO fictional','डेमो',true); update private.directory_entitlements set payment_status='revoked'; update private.directory_specialties set active=false where id='skin';");
    await actor(1);assert.equal((await db.query('select * from public.get_directory_specialties()')).rows.length,1);
    assert.equal((await matches()).length,0);await owner();await db.exec('rollback');
    const grants=(await db.query(`select p.proname from pg_proc p,lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl where p.proname in('get_directory_specialties') and acl.grantee=0 and acl.privilege_type='EXECUTE'`)).rows;
    assert.deepEqual(grants,[]);
  });
  console.log(`${checks} PostgreSQL directory checks passed (isolated PGlite; minimal auth/profile fixture).`);
} catch(error) {
  console.error({message:error.message,code:error.code,detail:error.detail,where:error.where});process.exitCode=1;
} finally { await db.close(); }
