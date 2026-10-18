const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const library=require('lucide');
const files=['index.html','admin.html',...fs.readdirSync(root).filter(f=>f.endsWith('.js')),
 ...fs.readdirSync(path.join(root,'assets/vendor')).filter(f=>f.endsWith('.js')&&!/^lucide/.test(f)).map(f=>'assets/vendor/'+f)];
const text=files.map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
const used=Object.keys(library.icons).filter(name=>{
 const kebab=name.replace(/([a-z0-9])([A-Z])/g,'$1-$2').toLowerCase();
 return text.includes(kebab)||text.includes(name);
});
if(used.length<20||used.length>250)throw Error('Unexpected icon count '+used.length);
const source=`import {createIcons,${used.join(',')}} from 'lucide';\nwindow.lucide={createIcons:(options={})=>createIcons({...options,icons:{${used.join(',')}}})};`;
const result=spawnSync('npx',['--yes','esbuild@0.25.12','--bundle','--minify','--format=iife','--loader=js','--log-level=warning'],{cwd:root,input:source,encoding:'utf8',maxBuffer:10*1024*1024});
if(result.status!==0)throw Error(result.stderr);
const hash=crypto.createHash('sha256').update(result.stdout).digest('hex').slice(0,12);
const filename=`lucide-${hash}.js`;
fs.writeFileSync(path.join(root,'assets/vendor',filename),result.stdout);
for(const f of ['index.html','admin.html']){
 const p=path.join(root,f),old=fs.readFileSync(p,'utf8');
 fs.writeFileSync(p,old.replace(/assets\/vendor\/lucide(?:-[a-f0-9]{12})?\.js/g,'assets/vendor/'+filename));
}
console.log(JSON.stringify({icons:used.length,file:filename,bytes:Buffer.byteLength(result.stdout),originalBytes:fs.statSync(path.join(root,'assets/vendor/lucide.js')).size}));
