const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const endpoint=require('../lib/admin-cases.cjs');
(async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql as $$select null::uuid$$;`);
    await db.exec(fs.readFileSync('backend/schema.sql','utf8'));
    await db.exec(fs.readFileSync('backend/pro.sql','utf8'));
    await db.exec(`alter table public.car_agent_cases add column agent_deleted_at timestamptz;create table public.car_live_signals(topic text primary key,revision int default 0);insert into public.car_live_signals(topic) values('admin');create function public.car_emit_live_signal() returns trigger language plpgsql as $$begin update public.car_live_signals set revision=revision+1 where topic=tg_argv[0];return null;end;$$;`);
    await db.exec(fs.readFileSync('backend/admin-cases.sql','utf8'));
    await db.exec('alter table public.car_agent_cases disable trigger car_case_stamp');
    const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
    await db.query('insert into auth.users values($1,$2,$3),($4,$5,$6)',[a,'a@example.test',{name:'Agent A'},b,'b@example.test',{name:'Agent B'}]);
    for(let i=0;i<25;i++)await db.query(`insert into public.car_agent_cases(id,owner_id,name,phone,brand,model,variant,status,remark,created_at,activity_at,agent_deleted_at)
      values($1,$2,$3,'+60173559147',$4,'Model long','Variant long',$5,'<img src=x onerror=alert(1)>',$6,now()-interval '4 days',$7)`,[
      '33333333-3333-4333-8333-'+String(i).padStart(12,'0'),i%2?a:b,'Customer '+i,i%2?'Honda':'Proton',i<5?'Delivered':i===5?'Rejected':i===6?'Cancelled':i===7?'LOU received':'Submission',i===0?'2026-10-01T15:59:59Z':'2026-10-01T16:00:00Z',i===8?'2026-10-02T00:00:00Z':null]);
    const run=async(filters={},analysis=false,page=1)=>(await db.query('select public.car_admin_cases($1,$2,$3) as result',[filters,page,analysis])).rows[0].result;
    const first=await run(),second=await run({},false,2),stats=await run({},true);
    assert.equal(first.total,25);assert.equal(first.records.length,20);assert.equal(second.records.length,5);assert.equal(first.agents.length,2);
    assert.deepEqual(stats.summary,{total:25,active:18,lou:1,delivered:5,rejected:1,cancelled:1,followup:17,deleted:1});
    assert.equal(stats.daily.find(d=>d.date==='2026-10-01').count,1);assert.equal(stats.daily.find(d=>d.date==='2026-10-02').count,24);
    assert.equal(stats.agents.reduce((n,r)=>n+r.total,0),25);assert.equal(stats.models.reduce((n,r)=>n+r.delivered,0),5);
    assert.equal((await run({from:'2026-10-01T16:00:00Z',to:'2026-10-02T16:00:00Z'},true)).summary.total,24);
    assert.equal((await run({deleted:'deleted'},true)).summary.followup,0);assert.equal((await run({deleted:'visible'},true)).summary.total,24);
    assert.equal((await run({agent:a},true)).summary.total,12);assert.equal((await run({status:'Delivered'},true)).summary.total,5);
    assert.equal((await run({search:'customer 24'})).total,1);assert.equal((await run({search:'%'})).total,0);
    const empty=await run({search:'not found'},true);assert.equal(empty.summary.total,0);assert.deepEqual(empty.daily,[]);
    const detail=(await db.query('select public.car_admin_case_detail($1) as result',[first.records[0].id])).rows[0].result;
    assert.ok(detail.record.agent_name);assert.equal(detail.history.length,1);
    const revision=(await db.query('select revision from public.car_live_signals')).rows[0].revision;assert.equal(revision,50);
    assert.equal((await db.query("select has_function_privilege('anon','public.car_admin_cases(jsonb,integer,boolean)','execute') as allowed")).rows[0].allowed,false);
    await db.exec('set role authenticated');await assert.rejects(db.query('select public.car_admin_cases()'));await assert.rejects(db.query('select public.car_admin_case_detail($1)',[first.records[0].id]));await db.exec('reset role');
    let payload;
    const fail=(code,message)=>{const e=Error(message);e.status=code;throw e;};
    const context={fail,uuid:v=>{if(!/^[0-9a-f-]{36}$/.test(v||''))fail(400,'ID');return v;},supabase:async(path,opts)=>{payload={path,...opts};return {data:{records:[]}};}};
    const response={status(){return this;},json(v){return v;}};
    await endpoint({method:'GET',query:{action:'admin-cases',period:'custom',from:'2026-10-01',to:'2026-10-02'}},response,context);
    assert.equal(payload.body.filters.from,'2026-09-30T16:00:00.000Z');assert.equal(payload.body.filters.to,'2026-10-02T16:00:00.000Z');
    const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10),midnight=Date.parse(today+'T00:00:00+08:00');
    for(const period of ['7','30','month']){
      await endpoint({method:'GET',query:{action:'admin-case-analysis',period}},response,context);
      assert.equal(payload.body.analysis,true);assert.equal(payload.body.filters.to,new Date(midnight+86400000).toISOString());
      assert.equal(payload.body.filters.from,period==='month'?new Date(today.slice(0,7)+'-01T00:00:00+08:00').toISOString():new Date(midnight-(Number(period)-1)*86400000).toISOString());
    }
    for(const query of [{page:'0'},{status:'Invalid'},{deleted:'bad'},{period:'custom',from:'2026-02-30',to:'2026-03-02'},{period:'custom',from:'2026-10-03',to:'2026-10-01'},{period:'custom',from:'2026-99-99',to:'2026-10-01'}])await assert.rejects(endpoint({method:'GET',query:{action:'admin-cases',...query}},response,context),e=>e.status===400);
    await assert.rejects(endpoint({method:'POST',query:{action:'admin-cases'}},response,context),e=>e.status===405);
    console.log('PASS admin cases: complete aggregates, deleted/follow-up, all pages, literal search, agents, dates Malaysia, history, realtime signals, private grants and API validation.');
  }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
