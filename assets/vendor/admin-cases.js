(()=>{
  const panel=document.querySelector('#adminCasesPanel');
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const icon=name=>{const i=el('i');i.dataset.lucide=name;return i;};
  const button=(text,run,name)=>{const b=el('button',undefined,'secondary-action');b.type='button';if(name)b.append(icon(name));b.append(document.createTextNode(text));b.onclick=run;return b;};
  const time=value=>value?new Date(value).toLocaleString('ms-MY',{timeZone:'Asia/Kuala_Lumpur'}):'—';
  let page=1,view='list',generation=0,timer,hasData=false;
  panel.className='admin-cases';const title=el('h2');title.append(icon('folder-open'),document.createTextNode('Semua Case'));
  const modes=el('div',undefined,'agent-periods');const listButton=button('Senarai',()=>switchView('list'),'list'),analysisButton=button('Analisis',()=>switchView('analysis'),'chart-no-axes-combined');modes.append(listButton,analysisButton);
  const heading=el('div',undefined,'analytics-heading');heading.append(title,modes);panel.append(heading);
  const form=el('form',undefined,'case-filters');
  function field(label,input){const wrap=el('label');input.setAttribute('aria-label',label);wrap.append(el('span',label),input);form.append(wrap);return input;}
  function select(label,items){const input=el('select');for(const [value,text] of items)input.add(new Option(text,value));return field(label,input);}
  const search=el('input');search.type='search';search.placeholder='Nama / WhatsApp / model';search.maxLength=100;field('Carian',search);
  const agent=select('Ejen',[['','Semua ejen']]);
  const status=select('Status',[['','Semua status'],...['Document collected','More document needed','Submission','Rejected','LOU received','Pending sign agreement','Pending allocation','Registered','Prepare delivery','Delivered','Cancelled'].map(s=>[s,s])]);
  const deleted=select('Rekod',[['all','Semua rekod'],['visible','Dalam paparan ejen'],['deleted','Dipadam oleh ejen']]);
  const period=select('Tempoh',[['all','Semua masa'],['7','7 hari'],['30','30 hari'],['month','Bulan ini'],['custom','Julat tarikh']]);
  const from=el('input'),to=el('input');from.type=to.type='date';field('Dari',from);field('Hingga',to);from.parentElement.hidden=to.parentElement.hidden=true;
  panel.append(form,el('p','Tempoh mengikut tarikh case dicipta; status ialah status terkini. Waktu Malaysia.','admin-subtitle'));
  const feedback=el('p',undefined,'admin-subtitle');feedback.setAttribute('role','status');const content=el('div');panel.append(feedback,content);
  function params(){const q=new URLSearchParams({page,search:search.value,agent:agent.value,status:status.value,deleted:deleted.value,period:period.value});if(period.value==='custom'){q.set('from',from.value);q.set('to',to.value);}return q;}
  async function api(action,q){const r=await fetch('/api/app?action='+action+'&'+q,{cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error||'Sambungan gagal.');return data;}
  function switchView(next){view=next;load();}
  async function load(quiet=false){if(panel.hidden||document.querySelector('#adminDashboard').hidden)return;
    const version=++generation;listButton.setAttribute('aria-pressed',String(view==='list'));analysisButton.setAttribute('aria-pressed',String(view==='analysis'));
    if(period.value==='custom'&&(!from.value||!to.value)){feedback.textContent='Pilih tarikh mula dan akhir.';content.replaceChildren();return;}
    if(!quiet)feedback.textContent='Memuatkan case...';panel.setAttribute('aria-busy','true');
    try{const data=await api(view==='list'?'admin-cases':'admin-case-analysis',params());if(version!==generation)return;
      content.replaceChildren();hasData=true;feedback.textContent='';
      if(view==='list')renderList(data);else renderAnalysis(data);
      window.lucide?.createIcons();
    }catch(error){if(version!==generation)return;feedback.textContent=(quiet?'Kemaskini gagal; paparan mungkin lama. ':'')+error.message;if(!quiet)content.replaceChildren();content.querySelector('.case-retry')?.remove();const retry=button('Cuba semula',()=>load(),'rotate-ccw');retry.classList.add('case-retry');content.append(retry);
    }finally{if(version===generation)panel.setAttribute('aria-busy','false');}
  }
  function renderList(data){const current=agent.value;const signature=JSON.stringify(data.agents);if(agent.dataset.signature!==signature){agent.replaceChildren(new Option('Semua ejen',''),...data.agents.map(a=>new Option(a.name,a.id)));if([...agent.options].some(o=>o.value===current))agent.value=current;agent.dataset.signature=signature;}
    feedback.textContent=data.total+' case · Halaman '+page;
    if(!data.records.length)content.append(el('p','Tiada case menepati filter.','admin-subtitle'));
    for(const row of data.records){const card=el('article',undefined,'admin-case-row');const top=el('div',undefined,'analytics-heading');top.append(el('h3',row.name),el('span',row.status,'announcement-badge'));card.append(top,el('p',row.phone),el('p',[row.brand,row.model,row.variant].filter(Boolean).join(' ')),el('small','Ejen: '+row.agent_name+' · Aktiviti: '+time(row.activity_at)));
      if(row.agent_deleted_at)card.append(el('p','Dipadam oleh ejen','case-deleted-label'));
      if(row.remark)card.append(el('p',row.remark,'case-remark'));card.append(button('Lihat Butiran',()=>details(row.id),'eye'));content.append(card);}
    const paging=el('div',undefined,'case-paging'),prev=button('Sebelum',()=>{page--;load();},'chevron-left'),next=button('Seterusnya',()=>{page++;load();},'chevron-right');prev.disabled=page===1;next.disabled=page*20>=data.total;paging.append(prev,next);content.append(paging);
  }
  function bars(title,rows,labelKey){const section=el('section',undefined,'case-chart');section.append(el('h3',title));const max=Math.max(1,...rows.map(r=>Number(r.count)));if(!rows.length)section.append(el('p','Tiada data.','admin-subtitle'));
    for(const r of rows){const row=el('div',undefined,'case-bar-row');const label=el('span',r[labelKey]);const track=el('div',undefined,'case-bar-track'),fill=el('span');fill.style.width=(Number(r.count)/max*100)+'%';track.append(fill);row.append(label,track,el('strong',String(r.count)));section.append(row);}content.append(section);}
  function table(title,headers,rows){const section=el('section',undefined,'case-breakdown');section.append(el('h3',title));const wrap=el('div',undefined,'case-table-scroll'),table=el('table'),head=el('thead'),tr=el('tr');headers.forEach(h=>tr.append(el('th',h)));head.append(tr);const body=el('tbody');rows.forEach(cells=>{const row=el('tr');cells.forEach(v=>row.append(el('td',String(v))));body.append(row);});table.append(head,body);wrap.append(table);section.append(wrap);if(!rows.length)section.append(el('p','Tiada data.','admin-subtitle'));content.append(section);}
  function renderAnalysis(data){const s=data.summary,metrics=el('dl',undefined,'case-summary');
    for(const [key,label]of[['total','Jumlah case'],['active','Case aktif'],['lou','LOU received'],['delivered','Delivered'],['rejected','Rejected'],['cancelled','Cancelled'],['followup','Follow up'],['deleted','Dipadam ejen']]){const cell=el('div');cell.append(el('dt',label),el('dd',String(s[key])));metrics.append(cell);}content.append(metrics);
    content.append(el('p','Kadar Delivered: '+(s.total?(s.delivered/s.total*100).toFixed(1):'0')+'% ('+s.delivered+' / '+s.total+' case dalam filter).','admin-subtitle'));
    bars('Case mengikut status',data.statuses,'status');bars('Case baharu mengikut hari',data.daily,'date');
    table('Prestasi ejen',['Ejen','Jumlah','Aktif','Delivered','Rejected','Cancelled','Follow up'],data.agents.map(a=>[a.agent_name,a.total,a.active,a.delivered,a.rejected,a.cancelled,a.followup]));
    table('Brand / model',['Brand / model','Jumlah','Delivered','Kadar Delivered'],data.models.map(m=>[m.brand+' '+m.model,m.total,m.delivered,(m.delivered/m.total*100).toFixed(1)+'% ('+m.delivered+'/'+m.total+')']));
    feedback.textContent='Kemaskini: '+time(data.checkedAt);
  }
  async function details(id){const d=el('dialog',undefined,'app-dialog admin-case-detail');const head=el('div',undefined,'analytics-heading');head.append(el('h2','Butiran Case'),button('Tutup',()=>d.close(),'x'));const body=el('div');body.textContent='Memuatkan...';d.append(head,body);document.body.append(d);d.onclose=()=>d.remove();d.showModal();
    try{const data=await api('admin-case-detail',new URLSearchParams({id}));if(!d.open)return;body.replaceChildren();for(const [key,label]of[['name','Pelanggan'],['phone','WhatsApp'],['agent_name','Ejen'],['brand','Brand'],['model','Model'],['variant','Varian'],['color','Warna'],['status','Status'],['remark','Remark']]){body.append(el('strong',label),el('p',data.record[key]||'—'));}
      body.append(el('p','Dicipta: '+time(data.record.created_at)),el('p','Aktiviti terakhir: '+time(data.record.activity_at)));if(data.record.agent_deleted_at)body.append(el('p','Dipadam oleh ejen · '+time(data.record.agent_deleted_at),'case-deleted-label'));
      body.append(el('h3','Sejarah'));if(!data.history.length)body.append(el('p','Tiada sejarah.'));for(const e of data.history){const item=el('article',undefined,'admin-case-row');item.append(el('strong',e.status),el('p',e.remark||'—'),el('small',time(e.created_at)));body.append(item);}
    }catch(error){body.textContent=error.message;}window.lucide?.createIcons();
  }
  form.onsubmit=e=>e.preventDefault();form.onchange=()=>{from.parentElement.hidden=to.parentElement.hidden=period.value!=='custom';page=1;load();};search.oninput=()=>{clearTimeout(timer);page=1;generation++;timer=setTimeout(()=>load(),250);};
  addEventListener('carloan-admin-case-open',()=>load(hasData));addEventListener('carloan-admin-live',()=>{if(!panel.hidden)load(true);});
})();
