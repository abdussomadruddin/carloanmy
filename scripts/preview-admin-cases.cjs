// Isolated loopback-only preview. No Supabase credentials, production data or writes.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {PGlite}=require('@electric-sql/pglite');
const endpoint=require('../lib/admin-cases.cjs');
const root=path.resolve(__dirname,'..');
async function start(port=4208){
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql as $$select null::uuid$$;`);
  for(const file of ['backend/schema.sql','backend/pro.sql'])await db.exec(fs.readFileSync(path.join(root,file),'utf8'));
  await db.exec(`alter table public.car_agent_cases add column agent_deleted_at timestamptz;create function public.car_emit_live_signal() returns trigger language plpgsql as $$begin return null;end;$$;alter table public.car_agent_cases disable trigger car_case_stamp;`);
  await db.exec(fs.readFileSync(path.join(root,'backend/admin-cases.sql'),'utf8'));
  const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
  await db.query('insert into auth.users values($1,$2,$3),($4,$5,$6)',[a,'demo-a@example.test',{name:'Ejen Demo A'},b,'demo-b@example.test',{name:'Ejen Demo B'}]);
  const statuses=['Document collected','Submission','LOU received','Delivered','Rejected','Cancelled','Pending allocation','Prepare delivery'];
  for(let i=0;i<25;i++)await db.query(`insert into public.car_agent_cases(id,owner_id,name,phone,brand,model,variant,status,remark,created_at,activity_at,agent_deleted_at) values($1,$2,$3,'+60123456789',$4,$5,$6,$7,$8,now()-make_interval(days=>$9),now()-interval '4 days',$10)`,[
    '33333333-3333-4333-8333-'+String(i).padStart(12,'0'),i%2?a:b,'Pelanggan Demo '+(i+1),i%2?'Honda':'Proton',i%2?'HR-V':'NEW S70 1.5 i-GT',i%2?'1.5L RS e:HEV':'Flagship X',statuses[i%statuses.length],i===0?'<img src=x onerror=alert(1)>':'Dokumen diterima. Menunggu maklum balas seterusnya.',i%12,i===2?new Date().toISOString():null]);
  let version=0;
  const fail=(code,message)=>{const e=Error(message);e.status=code;throw e;};
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');res.setHeader('Cache-Control','no-store');
    if(url.pathname==='/api/app'){
      res.setHeader('Content-Type','application/json');res.status=code=>{res.statusCode=code;return res;};res.json=value=>res.end(JSON.stringify(value));
      if(req.method!=='GET')return res.status(403).json({error:'Preview baca sahaja. Data demo, bukan production.'});
      const action=url.searchParams.get('action');
      if(['admin-cases','admin-case-analysis','admin-case-detail'].includes(action)){
        try{await endpoint({method:'GET',query:Object.fromEntries(url.searchParams)},res,{fail,uuid:v=>{if(!/^[0-9a-f-]{36}$/.test(v||''))fail(400,'ID tidak sah.');return v;},supabase:async(route,{body})=>({data:(await db.query(route.endsWith('car_admin_case_detail')?'select public.car_admin_case_detail($1) as result':'select public.car_admin_cases($1,$2,$3) as result',route.endsWith('car_admin_case_detail')?[body.case_id]:[body.filters,body.page_number,body.analysis])).rows[0].result})});}catch(e){res.status(e.status||500).json({error:e.message});}return;
      }
      const responses={config:{ready:true,pushReady:false},admin:{email:'PREVIEW — DATA DEMO SAHAJA',announcements:[],pushReady:false,activeSubscriptions:0},stats:{traffic:[],notifications:0,phoneApps:0,phoneAppsWithNotifications:0},'agent-stats':{total:2,daily:[]},'manage-agent-list':{records:[],hasNext:false},'admin-realtime':null};
      if(action==='admin-realtime')return res.status(503).json({error:'Preview tempatan.'});
      return res.status(action in responses?200:404).json(responses[action]||{error:'Tidak tersedia dalam preview.'});
    }
    const file=url.pathname==='/'||url.pathname==='/admin'?'admin.html':url.pathname.slice(1);
    if(!['admin.html','styles.css','admin.css','admin.js','favicon.png','icon-192.png','apple-touch-icon.png'].includes(file)&&!/^assets\/vendor\/[a-zA-Z0-9_.-]+\.js$/.test(file)){res.writeHead(404);return res.end();}
    try{let body=fs.readFileSync(path.join(root,file));if(file==='admin.html')body=Buffer.from(body.toString().replace('<body>','<body><p style="text-align:center;color:#b52d4f;font-size:12px">PREVIEW — DATA DEMO SAHAJA</p>'));
      res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(body);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {server,db,url:'http://localhost:'+server.address().port,async update(){version++;await db.query("update public.car_agent_cases set remark=$1 where name='Pelanggan Demo 1'",['Kemaskini realtime '+version]);},async close(){await new Promise(resolve=>server.close(resolve));await db.close();}};
}
module.exports={start};
if(require.main===module)start(Number(process.argv[2])||4208).then(({url})=>console.log('Admin Case preview (data demo): '+url+'/admin')).catch(e=>{console.error(e);process.exitCode=1;});
