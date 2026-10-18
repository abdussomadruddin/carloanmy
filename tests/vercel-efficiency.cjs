const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const vm=require('node:vm');
const Module=require('node:module');
const html=fs.readFileSync('index.html','utf8');
const file=html.match(/assets\/vendor\/lucide-([a-f0-9]{12})\.js/);
assert.ok(file,'content-addressed icon bundle');
const code=fs.readFileSync(file[0],'utf8');
assert.equal(crypto.createHash('sha256').update(code).digest('hex').slice(0,12),file[1]);
assert.ok(Buffer.byteLength(code)<60000,'small icon bundle');
assert.ok(fs.readFileSync('admin.html','utf8').includes(file[0]));
const context={window:{}};vm.createContext(context);vm.runInContext(code,context);assert.equal(typeof context.window.lucide.createIcons,'function');
const loaded=[],original=Module._load;
Module._load=function(name,...args){loaded.push(name);return original.call(this,name,...args);};
try{require('../api/app.js');require('../lib/pro.cjs');}finally{Module._load=original;}
assert.ok(!loaded.includes('exceljs'),'Excel remains export-only');
assert.ok(!loaded.includes('web-push'),'push library remains send-only');
console.log('PASS Vercel efficiency: small hash-verified shared icons; Excel/push excluded from initial module load.');
