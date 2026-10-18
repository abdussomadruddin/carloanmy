const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite(),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  for(const file of ['backend/schema.sql','backend/pro.sql','backend/downloads.sql'])await db.exec(fs.readFileSync(file,'utf8'));
  await db.exec('alter table public.car_agent_cases add column agent_deleted_at timestamptz;alter table public.car_agent_appointments add column agent_deleted_at timestamptz;');
  await db.exec(fs.readFileSync('backend/usage-read-optimization.sql','utf8'));
  assert.deepEqual((await db.query('select public.car_admin_announcement_summary() as data')).rows[0].data,{activeSubscriptions:0,announcements:[]});
  const emptyContacts=(await db.query('select public.car_admin_agent_totals() as data')).rows[0].data;
  assert.equal(emptyContacts.total,0);assert.equal(emptyContacts.daily.length,30);assert.ok(emptyContacts.daily.every(row=>row.count===0));
  await db.exec(`insert into public.car_download_requests(id,created_at,name,whatsapp,snapshot,client_hash)
   select gen_random_uuid(),now()-interval '60 days','Test','+60111111111','{}'::jsonb,'test' from generate_series(1,500);
   insert into public.car_download_requests(id,created_at,name,whatsapp,snapshot,client_hash) values
   (gen_random_uuid(),now(),'Test','+60111111111','{}','test'),
   (gen_random_uuid(),now(),'Test','+60122222222','{}','test'),
   (gen_random_uuid(),now()+interval '1 day','Future','+60133333333','{}','test');`);
  const contacts=(await db.query('select public.car_admin_agent_totals() as data')).rows[0].data;
  assert.equal(contacts.total,2);assert.equal(contacts.daily.at(-1).count,1);assert.equal(contacts.daily.reduce((n,d)=>n+d.count,0),1);
  await db.query('insert into auth.users values($1),($2)',[a,b]);
  await db.exec(`alter table public.car_agent_cases disable trigger car_case_stamp;
   insert into public.car_agent_cases(id,owner_id,name,phone,brand,model,variant,status,activity_at)
   select gen_random_uuid(),'${a}','Test','+60123456789','Proton','S70','Lite',s,now()-interval '72 hours' from (values('Submission'),('Delivered'),('Rejected'),('Cancelled')) v(s);
   insert into public.car_agent_cases(id,owner_id,name,phone,brand,model,variant,status,activity_at) values(gen_random_uuid(),'${b}','Other','+60123456789','Proton','S70','Lite','Submission',now()-interval '4 days');
   insert into public.car_agent_appointments(id,owner_id,name,phone,type,starts_at) values(gen_random_uuid(),'${a}','Test','+60123456789','Delivery',now()+interval '1 hour');`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);await db.exec('set role authenticated');
  assert.deepEqual((await db.query('select public.car_agent_counts() as data')).rows[0].data,{case:4,followup:1,appointment:1});
  await assert.rejects(db.query('select public.car_admin_announcement_summary()'));
  await assert.rejects(db.query('select public.car_admin_agent_totals()'));
  await assert.rejects(db.query('select public.car_link_agent_device(gen_random_uuid(),gen_random_uuid())'));
  await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[b]);await db.exec('set role authenticated');
  assert.deepEqual((await db.query('select public.car_agent_counts() as data')).rows[0].data,{case:1,followup:1,appointment:0});
  await db.exec('reset role;set role anon');await assert.rejects(db.query('select public.car_agent_counts()'));await db.exec('reset role');
  await db.exec(`insert into public.car_announcements(title,message,active) values('Old','Preserve inactive history',false);
   insert into public.car_push_subscriptions(endpoint_hash,token_hash,subscription) select 'endpoint-'||i,'token-'||i,'{}'::jsonb from generate_series(1,510) i;
   insert into public.car_push_deliveries(announcement_id,subscription_id,state)
   select a.id,s.id,case row_number() over() when 1 then 'failed' when 2 then 'processing' else 'sent' end from public.car_announcements a cross join public.car_push_subscriptions s;`);
  const summary=(await db.query('select public.car_admin_announcement_summary() as data')).rows[0].data;
  assert.equal(summary.activeSubscriptions,510);assert.equal(summary.announcements[0].active,false);
  assert.equal(summary.announcements[0].delivery.total,510);assert.equal(summary.announcements[0].delivery.sent,508);
  const sid=(await db.query('select id from public.car_push_subscriptions limit 1')).rows[0].id;
  await db.query('select public.car_link_agent_device($1,$2)',[sid,a]);
  const version=(await db.query('select ctid from public.car_agent_devices')).rows[0].ctid;
  await db.query('select public.car_link_agent_device($1,$2)',[sid,a]);assert.equal((await db.query('select ctid from public.car_agent_devices')).rows[0].ctid,version);
  await db.query('select public.car_link_agent_device($1,$2)',[sid,b]);assert.equal((await db.query('select owner_id from public.car_agent_devices')).rows[0].owner_id,b);
  console.log('PASS usage SQL: empty/multi-page aggregates, inactive history, owner isolation, 72-hour boundary, role restrictions and unchanged device write suppression.');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
