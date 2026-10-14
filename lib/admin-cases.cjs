const statuses=['Document collected','More document needed','Submission','Rejected','LOU received','Pending sign agreement','Pending allocation','Registered','Prepare delivery','Delivered','Cancelled'];
module.exports=async(req,res,{supabase,fail,uuid})=>{
  if(req.method!=='GET')fail(405,'Gunakan GET.');
  if(req.query.action==='admin-case-detail'){
    const {data}=await supabase('/rest/v1/rpc/car_admin_case_detail',{method:'POST',body:{case_id:uuid(req.query.id)}});
    if(!data)fail(404,'Case tidak ditemui.');
    return res.status(200).json(data);
  }
  const q=req.query,filters={},page=Number(q.page||1);
  if(!Number.isSafeInteger(page)||page<1||page>100000)fail(400,'Halaman tidak sah.');
  if(q.agent)filters.agent=uuid(q.agent);
  if(q.status){if(!statuses.includes(q.status))fail(400,'Status tidak sah.');filters.status=q.status;}
  filters.deleted=q.deleted||'all';if(!['all','deleted','visible'].includes(filters.deleted))fail(400,'Filter tidak sah.');
  filters.search=String(q.search||'').trim();if(filters.search.length>100)fail(400,'Carian terlalu panjang.');
  const period=q.period||'all',today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
  const day=value=>{const parsed=Date.parse(value+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==value)fail(400,'Tarikh tidak sah.');return Date.parse(value+'T00:00:00+08:00');};
  if(period==='7'||period==='30'){
    filters.from=new Date(day(today)-(Number(period)-1)*86400000).toISOString();filters.to=new Date(day(today)+86400000).toISOString();
  }else if(period==='month'){
    filters.from=new Date(day(today.slice(0,7)+'-01')).toISOString();filters.to=new Date(day(today)+86400000).toISOString();
  }else if(period==='custom'){
    const start=day(String(q.from||'')),end=day(String(q.to||''));if(end<start)fail(400,'Julat tarikh tidak sah.');
    filters.from=new Date(start).toISOString();filters.to=new Date(end+86400000).toISOString();
  }else if(period!=='all')fail(400,'Tempoh tidak sah.');
  const {data}=await supabase('/rest/v1/rpc/car_admin_cases',{method:'POST',body:{filters,page_number:page,analysis:q.action==='admin-case-analysis'}});
  return res.status(200).json(data);
};
