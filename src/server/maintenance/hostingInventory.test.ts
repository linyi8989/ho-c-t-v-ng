import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import express from 'express';
import {maintenanceConfig,createMaintenance} from '../../../scripts/maintenance-core.mjs';
import {inventoryConfig,withStore,getScan,budget,hash,nanosecondsToMilliseconds} from '../../../scripts/hosting-inventory-store.mjs';
import {createHostingInventory,runInventory} from '../../../scripts/hosting-inventory-core.mjs';
import {linkApplicationCatalog} from '../../../scripts/hosting-inventory-assessment.mjs';
import {parsePassenger,parseNodeSelector,parseDomains} from '../../../scripts/hosting-inventory-sources.mjs';
import {createMaintenanceRouter} from './router';
const Database=createRequire(import.meta.url)('better-sqlite3');
const digest=(b:Buffer)=>crypto.createHash('sha256').update(b).digest('hex');
async function fixture() {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'vhomework-hosting-test-')),data=path.join(root,'app-data','vhomework'),deploy=path.join(root,'app.msdieu.com');
  await fs.mkdir(data,{recursive:true});await fs.mkdir(deploy,{recursive:true});
  const dbPath=path.join(data,'app.sqlite'),db=new Database(dbPath);db.exec("CREATE TABLE users(id TEXT);INSERT INTO users VALUES('keep-user');CREATE TABLE leaderboard_events(id TEXT);INSERT INTO leaderboard_events VALUES('keep-gold');CREATE TABLE speaking_jobs(status TEXT);INSERT INTO speaking_jobs VALUES('pending');");db.close();
  const env={STORAGE_MODE:'sqlite',SQLITE_DRIVER:'better-sqlite3',SQLITE_DB_PATH:dbPath,MAINTENANCE_ACCOUNT_ROOT:root,MAINTENANCE_DEPLOY_ROOT:deploy,MAINTENANCE_STATE_DIR:path.join(data,'maintenance'),MAINTENANCE_INVENTORY_EXECUTOR:'process',MAINTENANCE_INVENTORY_WINDOW_SECONDS:'300',MAINTENANCE_INVENTORY_DELAY_MS:'1'};
  const core=maintenanceConfig(env,root),config=inventoryConfig(core,env),service=createHostingInventory(config,{launch:()=>{}});
  const files:Record<string,Buffer>={};
  const add=async(rel:string,text='fixture')=>{const file=path.join(root,rel);await fs.mkdir(path.dirname(file),{recursive:true});const b=Buffer.from(text);await fs.writeFile(file,b);files[rel]=b;return file;};
  await add('.npm/_cacache/content/blob','cache');await add('.trash/old.bin','trash');await add('tmp/unknown.tmp','temp');await add('deploy-staging/release/file.js','staged');await add('nodevenv/app/22/lib/runtime','runtime');await add('node_modules-app-backup-20261007-223115/lib.js','dependency recovery');await add('public_html/index.html','domain');await add('mail/message','private mail body');await add('external-backups/release-a/db-backup.json','backup json');await add('external-backups/release-a/audio.zip','fake zip is only a hint');await add('app-data/vhomework/vocab-images/image.png','media');await add('app.msdieu.com/.env','KEEP_PRIVATE_SENTINEL');await add('app.msdieu.com/.htaccess','PassengerAppRoot "'+deploy+'"\nPassengerNodejs /opt/alt/alt-nodejs22/root/usr/bin/node\nSetEnv HIDDEN KEEP_PRIVATE_SENTINEL\n');await add('app.msdieu.com/app.js',"require('./dist/server.cjs')");await add('app.msdieu.com/.cpanel.yml','DEPLOYPATH='+deploy);await add('app.msdieu.com/.git/HEAD','ref: refs/heads/main\n');
  const before=digest(await fs.readFile(dbPath));
  const preserved=async()=>{assert.equal(digest(await fs.readFile(dbPath)),before);for(const [rel,b]of Object.entries(files))assert.deepEqual(await fs.readFile(path.join(root,rel)),b);};
  const cleanup=async()=>{assert.ok(root.startsWith(os.tmpdir()+path.sep)&&path.basename(root).startsWith('vhomework-hosting-test-'));await fs.rm(root,{recursive:true,force:true});};
  return {root,data,deploy,dbPath,env,core,config,service,add,files,before,preserved,cleanup};
}
async function scan(f:Awaited<ReturnType<typeof fixture>>,options={}){const {id}=f.service.start('admin');await runInventory(f.config,id,options);return id;}

test('GET/constructor are cached and never create a database, backup or collector',async()=>{const f=await fixture();try{assert.equal(f.service.summary().latest,null);await assert.rejects(fs.stat(f.config.stateRoot),{code:'ENOENT'});await f.preserved();}finally{await f.cleanup();}});

test('complete nested inventory sees hidden/external folders, preserves all source data and reports missing dependency sources',async()=>{const f=await fixture();try{
  const id=await scan(f),s=f.service.summary();assert.equal(s.latest!.status,'completed');assert.equal(s.latest!.filesystemComplete,true);assert.equal(s.latest!.dependencyComplete,false);
  const tree=f.service.tree(id)!;for(const name of ['.npm','.trash','app-data','public_html','external-backups','nodevenv'])assert.ok(tree.items.some(e=>e.name===name));
  assert.equal(tree.items.find(e=>e.name==='node_modules-app-backup-20261007-223115')!.status,'unknown');assert.equal(tree.items.find(e=>e.name==='nodevenv')!.status,'protected');
  const dep=tree.items.find(e=>e.name==='app.msdieu.com')!;const child=f.service.tree(id,dep.id)!.items.find(e=>e.name==='.git')!;assert.equal(child.status,'active');const metadataChild=f.service.tree(id,child.id)!.items.find(e=>e.name==='HEAD')!;assert.equal(metadataChild.status,'unknown','Being in a used deploy root is not exact file usage evidence');
  const npm=tree.items.find(e=>e.name==='.npm')!;assert.equal(npm.bytes,5);assert.equal(npm.fileCount,1);assert.equal(npm.status,'candidate');
  const total=Object.values(f.files).reduce((n,b)=>n+b.length,0)+(await fs.stat(f.dbPath)).size;assert.equal(s.latest!.logicalBytes,total);assert.equal(s.latest!.uniqueBytes,total);if(process.platform==='win32')assert.equal(s.latest!.allocatedBytes,null);
  assert.ok(s.latest!.sources.some(source=>source.id==='domains'&&source.status==='unconfigured'));assert.ok(!JSON.stringify(s).includes('KEEP_PRIVATE_SENTINEL'));
  const e=tree.items.find(e=>e.name==='app.msdieu.com')!;const evidence=f.service.evidence(id,e.id)!;assert.ok(evidence.edges.some(edge=>edge.relation==='PassengerAppRoot'));assert.ok(!JSON.stringify(evidence).includes('KEEP_PRIVATE_SENTINEL'));
  assert.equal(f.service.backups(id)!.items.find(e=>e.name==='external-backups')!.deleteAllowed,false);await f.preserved();
}finally{await f.cleanup();}});

test('tree pagination returns every entry, filters do not truncate or count parent plus child',async()=>{const f=await fixture();try{
  for(let i=0;i<123;i++)await f.add('many/item-'+String(i).padStart(3,'0')+'.bin','x');const id=await scan(f),dir=f.service.tree(id)!.items.find(e=>e.name==='many')!;
  const names=new Set<string>();for(let p=1;p<=3;p++)for(const row of f.service.tree(id,dir.id,{page:p})!.items)names.add(row.name);assert.equal(names.size,123);assert.equal(dir.bytes,123);
  assert.equal(f.service.tree(id,dir.id,{filter:'item-00'})!.total,10);assert.equal(f.service.tree(id,dir.id,{minBytes:2})!.total,0);
  assert.throws(()=>f.service.tree(id,'../../etc'),/thư mục/);await f.preserved();
}finally{await f.cleanup();}});

test('pause/resume re-visits a partial directory idempotently and cancel never removes source files',async()=>{const f=await fixture();try{
  for(let i=0;i<140;i++)await f.add('large/'+i+'.bin','data');const {id}=f.service.start('admin');let stopped=false;
  const result=await runInventory(f.config,id,{onBatch:async()=>{if(!stopped){stopped=true;f.service.control('admin',id,'pause');}}});assert.equal(result.status,'paused');
  f.service.control('admin',id,'resume');await runInventory(f.config,id);const complete=f.service.summary().latest!;assert.equal(complete.status,'completed');const unique=withStore(f.config,false,db=>db.prepare('SELECT count(*) n FROM entries WHERE scan=? AND type=\'file\'').get(id).n);assert.equal(complete.fileCount,unique);
  const second=f.service.start('admin');f.service.control('admin',second.id,'cancel');await runInventory(f.config,second.id);assert.equal(f.service.summary().latest!.status,'cancelled');await f.preserved();
}finally{await f.cleanup();}});

test('dead executor is observed as interrupted without GET writes; resume requires explicit control',async()=>{const f=await fixture();try{
  const {id}=f.service.start('admin');withStore(f.config,true,db=>db.prepare("UPDATE scans SET status='running',pid=2147483000 WHERE id=?").run(id));
  assert.equal(f.service.summary().latest!.status,'interrupted');assert.equal(withStore(f.config,false,db=>getScan(db,id).status),'running');
  f.service.control('admin',id,'resume');await runInventory(f.config,id);assert.equal(f.service.summary().latest!.status,'completed');await f.preserved();
}finally{await f.cleanup();}});

test('time window pauses honestly instead of pretending full coverage',async()=>{const f=await fixture();try{
  for(let i=0;i<40;i++)await f.add('slow/'+i,'data');f.config.windowMs=1;const {id}=f.service.start('admin');const result=await runInventory(f.config,id);assert.equal(result.status,'paused');assert.equal(result.filesystemComplete,false);f.config.windowMs=300000;f.config.memoryBytes=1;f.service.control('admin',id,'resume');const memory=await runInventory(f.config,id);assert.equal(memory.status,'paused');assert.match(memory.reason!,/bộ nhớ/);await f.preserved();
}finally{await f.cleanup();}});

test('budget/free-space refuses or pauses writes while keeping source and cached report',async()=>{const f=await fixture();try{
  f.config.freeReserveBytes=Number.MAX_SAFE_INTEGER;assert.throws(()=>f.service.start('admin'),/dung lượng/);await assert.rejects(fs.stat(f.config.file),{code:'ENOENT'});
  f.config.freeReserveBytes=1048576;for(let i=0;i<2200;i++)await f.add('budget/'+i+'.bin','x');f.config.budgetBytes=1800000;
  const {id}=f.service.start('admin');const result=await runInventory(f.config,id);assert.equal(result.status,'paused');assert.match(result.reason!,/ngân sách/);assert.ok(budget(f.config,0).bytes<f.config.budgetBytes);await f.preserved();
}finally{await f.cleanup();}});

test('unreadable/vanished item marks filesystem partial and cannot infer deletions',async()=>{const f=await fixture();try{
  const first=await scan(f);const privateFile=path.join(f.root,'.npm/_cacache/content/blob');const second=await scan(f,{lstat:async(file:string)=>{if(file===privateFile)throw Object.assign(new Error('Denied'),{code:'EACCES'});return fs.lstat(file);}});
  assert.equal(f.service.summary().latest!.filesystemComplete,false);assert.equal(f.service.deltas(second)!.comparable,false);assert.equal(f.service.deltas(second)!.total,0);
  assert.equal(withStore(f.config,false,db=>getScan(db,first).retained),1);await f.preserved();
}finally{await f.cleanup();}});

test('symlink loops/outside targets are excluded, hardlinks count once physically and stay protected',async()=>{const f=await fixture();try{
  const file=await f.add('hard-a.bin','shared');await fs.link(file,path.join(f.root,'hard-b.bin'));await fs.symlink(f.root,path.join(f.root,'loop'),'junction');await fs.symlink(os.tmpdir(),path.join(f.root,'outside'),'junction');
  const id=await scan(f),tree=f.service.tree(id)!,s=f.service.summary().latest!;
  assert.equal(tree.items.find(e=>e.name==='loop')!.issue,'symlink_excluded');assert.equal(tree.items.find(e=>e.name==='hard-b.bin')!.status,'protected');assert.equal(s.logicalBytes-s.uniqueBytes,6);
  const ev=f.service.evidence(id,tree.items.find(e=>e.name==='outside')!.id)!;assert.ok(ev.edges.some(e=>e.relation==='symlink_target'&&e.reason.includes('ngoài scope')));assert.ok(s.fileCount<100);await f.preserved();
}finally{await f.cleanup();}});

test('snapshots/deltas use comparable complete scope, distinguish observed-new from creation, retain bounded detail',async()=>{const f=await fixture();try{
  const first=await scan(f);await f.add('new-file.bin','new');await fs.writeFile(path.join(f.root,'tmp/unknown.tmp'),'longer');await fs.unlink(path.join(f.root,'.trash/old.bin'));
  const second=await scan(f),changes=f.service.deltas(second)!;assert.equal(changes.baseline,first);assert.equal(changes.comparable,true);
  assert.ok(changes.items.some(d=>d.rel==='new-file.bin'&&d.kind==='observed_new'));assert.ok(changes.items.some(d=>d.rel==='.trash/old.bin'&&d.kind==='not_observed'));assert.ok(changes.items.some(d=>d.rel==='tmp/unknown.tmp'&&d.kind==='changed'));assert.ok(changes.items.every(d=>d.attribution==='unknown'));
  const third=await scan(f);assert.equal(withStore(f.config,false,db=>getScan(db,first).retained),0);assert.equal(withStore(f.config,false,db=>getScan(db,second).retained),1);assert.equal(f.service.deltas(third)!.total,0);
  const changed={...f.config,scope:hash('different-scope')};const changedService=createHostingInventory(changed,{launch:()=>{}});const next=changedService.start('admin');await runInventory(changed,next.id);assert.equal(changedService.deltas(next.id)!.comparable,false);
}finally{await f.cleanup();}});

test('changed files and config invalidate reverify; source errors are explicit and secrets excluded',async()=>{const f=await fixture();try{
  const id=await scan(f,{adapters:{domains:async()=>{throw Object.assign(new Error('PRIVATE_RAW_ERROR'),{code:'EACCES'});}}});const sources=f.service.summary().latest!.sources;assert.equal(sources.find(s=>s.id==='domains')!.status,'permission_denied');assert.ok(!JSON.stringify(sources).includes('PRIVATE_RAW_ERROR'));
  const row=f.service.tree(id)!.items.find(e=>e.name==='tmp')!;const file=f.service.tree(id,row.id)!.items[0];await fs.appendFile(path.join(f.root,file.relative),'changed');await assert.rejects(f.service.reverify('admin',id,file.id),/đổi/);
  const changedService=createHostingInventory({...f.config,scope:hash('new-config')},{launch:()=>{}});await assert.rejects(changedService.reverify('admin',id,row.id),/Scope/);
}finally{await f.cleanup();}});

test('native source parsers only retain allowlisted paths, never env vars/credentials/raw commands',()=>{
  const config={accountRoot:path.resolve('fixture'),quotaUser:'user'};
  const passenger=parsePassenger('SetEnv secret RAW_SENTINEL\nPassengerAppRoot "/home/user/app"\nPassengerNodejs /opt/node\n',config.accountRoot);assert.equal(passenger.length,2);assert.ok(!JSON.stringify(passenger).includes('RAW_SENTINEL'));
  const selector=parseNodeSelector({result:'success',available_versions:{'22.16.0':{users:{user:{homedir:config.accountRoot,applications:{app:{startup_file:'app.js',domain:'app.example.test',env_vars:{secret:'RAW_SENTINEL'}}}}}}}},config);assert.ok(selector.length>=3);assert.ok(!JSON.stringify(selector).includes('RAW_SENTINEL'));
  assert.throws(()=>parseNodeSelector({result:'success'},config));const domains=parseDomains({status:1,data:{main_domain:{domain:'example.test',documentroot:path.resolve('public_html'),secret:'RAW_SENTINEL'},addon_domains:[],sub_domains:[]}});assert.equal(domains.length,1);assert.ok(!JSON.stringify(domains).includes('RAW_SENTINEL'));assert.throws(()=>parseDomains({status:0,data:{}}));
});

test('API rejects non-superadmin, arbitrary IDs/controls/deletion; GET has no disk writes',async()=>{const f=await fixture();let server:ReturnType<express.Express['listen']>|undefined;try{
  const app=express();app.use(express.json());app.use('/api/admin/maintenance',createMaintenanceRouter({service:createMaintenance(f.core),inventory:f.service,authenticateUser:(req,res,next)=>{if(!req.headers.authorization)return res.status(401).end();req.user={id:'actor',role:req.headers.authorization==='admin'?'super_admin':'teacher'} as never;next();},requireSuperAdmin:(req,res,next)=>{if(req.user!.role!=='super_admin')return res.status(403).end();next();}}));server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server!.once('listening',resolve));const origin='http://127.0.0.1:'+((server.address() as {port:number}).port);
  const request=(url:string,method='GET',body?:unknown,authorization='admin')=>fetch(origin+'/api/admin/maintenance/inventory'+url,{method,headers:{authorization,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await request('/summary','GET',undefined,'')).status,401);assert.equal((await request('/summary','GET',undefined,'teacher')).status,403);assert.equal((await request('/summary')).status,200);await assert.rejects(fs.stat(f.config.file),{code:'ENOENT'});
  const id=await scan(f);assert.equal((await request('/scans/invalid/tree')).status,400);assert.equal((await request('/scans/'+id+'/delete','POST',{})).status,404);assert.equal((await request('/scans/'+id+'/control','POST',{action:'rm -rf'})).status,400);assert.equal((await request('/scans/'+id+'/tree?parent=../../etc')).status,404);assert.equal((await request('/scans/'+id+'/tree')).status,200);await f.preserved();
}finally{if(server)await new Promise<void>(resolve=>server!.close(()=>resolve()));await f.cleanup();}});

test('large fixture inventories 100,123 files with pagination and bounded SQLite metadata, preserves baseline',async()=>{const f=await fixture();try{
  // Files are empty; each directory is capped so fixture setup/cleanup and readdir memory remain bounded.
  for(let group=0;group<101;group++){const dir=path.join(f.root,'large-'+group);await fs.mkdir(dir);const count=group===100?123:1000;for(let start=0;start<count;start+=100)await Promise.all(Array.from({length:Math.min(100,count-start)},(_,i)=>fs.writeFile(path.join(dir,'file-'+(start+i)),'')));}
  const id=await scan(f),s=f.service.summary().latest!;assert.equal(s.status,'completed');assert.equal(s.filesystemComplete,true);assert.ok(s.fileCount>=100123);assert.ok(budget(f.config,0).bytes<f.config.budgetBytes);
  const total=withStore(f.config,false,db=>db.prepare("SELECT count(*) n FROM entries WHERE scan=? AND rel LIKE 'large-%/%'").get(id).n);assert.equal(total,100123);await fs.mkdir(path.resolve('.data/maintenance-qa'),{recursive:true});await fs.writeFile(path.resolve('.data/maintenance-qa/hosting-large-report.json'),JSON.stringify({generatedFiles:100123,observedFiles:s.fileCount,filesystemComplete:s.filesystemComplete,dependencyComplete:s.dependencyComplete,index:budget(f.config,0),mainDatabasePreserved:true,policyGrantsDelete:false},null,2));const dirs=Array.from({length:3},(_,i)=>f.service.tree(id,'',{page:i+1})!.items).flat();assert.equal(dirs.filter(d=>d.name.startsWith('large-')).length,101);await f.preserved();
}finally{await f.cleanup();}});
test('flat directory progresses across short time windows without repeating throttle for unchanged entries',async()=>{const f=await fixture();try{
  for(let i=0;i<450;i++)await f.add('flat/file-'+i,'x');f.config.batchSize=10;f.config.delayMs=100;f.config.windowMs=1500;const {id}=f.service.start('admin');let result=await runInventory(f.config,id),rounds=1,previous=result.fileCount;
  while(result.status==='paused'&&rounds<12){f.service.control('admin',id,'resume');result=await runInventory(f.config,id);assert.ok(result.fileCount>=previous);previous=result.fileCount;rounds++;}
  assert.equal(result.status,'completed');assert.ok(rounds>1&&rounds<12);assert.ok(result.fileCount>=450);await f.preserved();
}finally{await f.cleanup();}});

test('stale evidence and account filesystem root never become verified cleanup',async()=>{const f=await fixture();try{
  const id=await scan(f);withStore(f.config,true,db=>{const s=getScan(db,id),sources=JSON.parse(s.source_json).map((source:Record<string,unknown>)=>({...source,at:'2020-01-01T00:00:00.000Z'}));db.prepare('UPDATE scans SET source_json=? WHERE id=?').run(JSON.stringify(sources),id);});
  assert.ok(f.service.summary().latest!.sources.some(s=>s.status==='stale'));assert.equal(f.service.summary().latest!.dependencyComplete,false);
  const unsafe=createHostingInventory({...f.config,accountRoot:path.parse(f.root).root},{launch:()=>{}});assert.throws(()=>unsafe.start('admin'),/gốc filesystem/);await f.preserved();
}finally{await f.cleanup();}});

test('file changed during a paused directory is flagged partial rather than trusted as an atomic snapshot',async()=>{const f=await fixture();try{
  for(let i=0;i<140;i++)await f.add('changing/'+i+'.bin','x');const {id}=f.service.start('admin');let stopped=false,relative:string|undefined;
  await runInventory(f.config,id,{onBatch:async()=>{if(!stopped){relative=withStore(f.config,false,db=>db.prepare("SELECT rel FROM entries WHERE scan=? AND rel LIKE 'changing/%' AND type='file' LIMIT 1").get(id)?.rel);if(relative){stopped=true;f.service.control('admin',id,'pause');}}}});
  assert.ok(relative);await fs.appendFile(path.join(f.root,relative!),'changed');f.service.control('admin',id,'resume');const result=await runInventory(f.config,id);assert.equal(result.filesystemComplete,false);
  const issue=withStore(f.config,false,db=>db.prepare('SELECT issue FROM entries WHERE scan=? AND rel=?').get(id,relative).issue);assert.equal(issue,'changed_during_scan');assert.equal(f.service.deltas(id)!.comparable,false);
}finally{await f.cleanup();}});
test('index self-exclusion still inventories quarantine and old state; duplicate executor cannot change another running job',async()=>{const f=await fixture();try{
  await f.add('app-data/vhomework/maintenance/quarantine/held.png','quarantine');await f.add('app-data/vhomework/maintenance/state.json','{"version":1}');const id=await scan(f),s=f.service.summary().latest!;assert.equal(s.filesystemComplete,true);
  const quarantined=withStore(f.config,false,db=>db.prepare("SELECT size FROM entries WHERE scan=? AND rel LIKE '%/quarantine/held.png'").get(id));assert.equal(quarantined.size,10);
  const next=f.service.start('admin');withStore(f.config,true,db=>db.prepare("UPDATE scans SET status='running',pid=? WHERE id=?").run(process.pid,next.id));
  // Spawn a second process through the trusted CLI with exactly the same ID.
  const {spawnSync}=await import('node:child_process');const result=spawnSync(process.execPath,['scripts/hosting-inventory-run.mjs','--scan-id',next.id],{cwd:process.cwd(),env:{...process.env,...f.env},encoding:'utf8',windowsHide:true});assert.equal(result.status,1);assert.equal(withStore(f.config,false,db=>getScan(db,next.id).status),'running');await f.preserved();
}finally{await f.cleanup();}});
test('existing unrelated SQLite at inventory path is rejected without initializing or changing its tables',async()=>{const f=await fixture();try{
  await fs.mkdir(f.config.stateRoot,{recursive:true});await fs.copyFile(f.dbPath,f.config.file);const before=await fs.readFile(f.config.file);assert.throws(()=>f.service.start('admin'),/schema inventory/);assert.deepEqual(await fs.readFile(f.config.file),before);await f.preserved();
}finally{await f.cleanup();}});
test('cleanup assessment distinguishes other projects, linked runtime, services, mixed folders and unverified names',async()=>{
  const f=await fixture();try{
    await f.add('other.example.test/index.html','other project');await f.add('other.example.test/backup.zip','other backup');
    await f.add('unknown.example.test/file.bin','unverified domain');await f.add('app.msdieu.com/node_modules/pkg/lib.js','installed dependency');
    await f.add('shared/ours/sound.mp3','app data');await f.add('shared/another/index.html','another app');
    f.config.audioRoot=path.join(f.root,'shared/ours');
    const id=await scan(f,{adapters:{
      domains:async()=>({status:'available',reason:'fixture domain API',edges:[
        {from:'domain:app.example.test',to:f.deploy,relation:'document_root',reason:'fixture'},
        {from:'domain:other.example.test',to:path.join(f.root,'other.example.test'),relation:'document_root',reason:'fixture'},
        {from:'domain:another.example.test',to:path.join(f.root,'shared/another'),relation:'document_root',reason:'fixture'}]}),
      nodeSelector:async()=>({status:'available',reason:'fixture node API',edges:[{from:f.deploy,to:path.join(f.root,'nodevenv/app/22'),relation:'runtime_layout',reason:'fixture'}]})
    }});
    const entries=f.service.tree(id)!.items;
    const own=entries.find(e=>e.name==='app.msdieu.com')!;assert.equal(f.service.tree(id,own.id)!.items.find(e=>e.name==='node_modules')!.cleanup.category,'protected');
    const other=entries.find(e=>e.name==='other.example.test')!;
    assert.equal(other.association.kind,'other_project');assert.deepEqual(other.association.owners,['other.example.test']);assert.equal(other.cleanup.category,'protected');
    const zip=f.service.tree(id,other.id)!.items.find(e=>e.name==='backup.zip')!;assert.equal(zip.cleanup.category,'protected','Backup name cannot remove protection of another project');
    const runtime=entries.find(e=>e.name==='nodevenv')!;assert.equal(runtime.association.kind,'runtime');assert.deepEqual(runtime.association.owners,['app.example.test']);assert.equal(runtime.cleanup.category,'protected');
    assert.equal(entries.find(e=>e.name==='mail')!.association.kind,'hosting_service');
    assert.equal(entries.find(e=>e.name==='shared')!.association.kind,'mixed');
    assert.equal(entries.find(e=>e.name==='.npm')!.cleanup.category,'review');
    assert.equal(entries.find(e=>e.name==='external-backups')!.cleanup.category,'review');
    const unknown=entries.find(e=>e.name==='unknown.example.test')!;assert.equal(unknown.association.kind,'unknown');assert.equal(unknown.cleanup.category,'unverified');
    for(const e of entries)assert.equal(e.cleanup.deleteAllowed,false);await f.preserved();
  }finally{await f.cleanup();}
});

test('application catalog bridge exposes existing eligible actions and blocks stale, changed, held or protected entries',async()=>{
  const f=await fixture();try{
    const name=crypto.randomUUID()+'.png',relative='app-data/vhomework/listening-media/.tmp-pdf-import/'+name,file=await f.add(relative,'temporary');
    const old=new Date(Date.now()-3*86400000);await fs.utimes(file,old,old);
    const application=createMaintenance(f.core);await application.scan('admin');
    const id=await scan(f),entry=f.service.evidence(id,hash(relative).slice(0,32))!.entry;
    const summary=await application.summary('admin'),linked=linkApplicationCatalog(entry,f.root,summary);
    assert.equal(linked.cleanup.category,'ready',JSON.stringify({inventory:{bytes:entry.bytes,modifiedAt:entry.modifiedAt,cleanup:entry.cleanup,association:entry.association},catalog:summary.latest?.entries.filter(e=>e.name===name).map(e=>({bytes:e.bytes,modifiedAt:e.modifiedAt,status:e.status,rootId:e.rootId,relative:e.relative}))}));assert.equal(linked.cleanup.action,'manage-application');assert.ok(linked.cleanup.applicationId);assert.equal(linked.cleanup.deleteAllowed,false);
    assert.equal(linkApplicationCatalog({...entry,bytes:entry.bytes+1},f.root,summary).cleanup.applicationId,undefined);
    assert.equal(linkApplicationCatalog(entry,f.root,{...summary,latest:{...summary.latest!,at:'2020-01-01T00:00:00.000Z'}}).cleanup.applicationId,undefined);
    const changedScope=createHostingInventory({...f.config,scope:hash('new assessment scope')},{launch:()=>{}});
    assert.equal(linkApplicationCatalog(changedScope.evidence(id,entry.id)!.entry,f.root,summary).cleanup.applicationId,undefined);
    await application.hold('admin',linked.cleanup.applicationId!,30,'test protection');
    const held=linkApplicationCatalog(entry,f.root,await application.summary('admin'));assert.equal(held.cleanup.category,'protected');assert.equal(held.cleanup.applicationStatus,'held');
    const dbEntry=f.service.evidence(id,hash('app-data/vhomework/app.sqlite').slice(0,32))!.entry;
    assert.equal(dbEntry.cleanup.category,'protected');assert.equal(linkApplicationCatalog(dbEntry,f.root,summary).cleanup.applicationId,undefined);
    withStore(f.config,true,db=>db.prepare('UPDATE scans SET heartbeat=? WHERE id=?').run('2020-01-01T00:00:00.000Z',id));
    assert.equal(linkApplicationCatalog(f.service.evidence(id,entry.id)!.entry,f.root,summary).cleanup.applicationId,undefined);
    await f.preserved();
  }finally{await f.cleanup();}
});

test('nanosecond conversion preserves milliseconds without loosening matching; old-scope paused jobs can be cancelled',async()=>{
  for(let ms=1791333786490n;ms<1791333786590n;ms++)assert.equal(nanosecondsToMilliseconds(ms*1000000n),Number(ms));
  const f=await fixture();try{
    const {id}=f.service.start('admin');withStore(f.config,true,db=>db.prepare("UPDATE scans SET status='paused',pid=NULL WHERE id=?").run(id));
    const changed=createHostingInventory({...f.config,scope:hash('scope changed during UI upgrade')},{launch:()=>{}});
    assert.throws(()=>changed.control('admin',id,'resume'),/Scope/);
    changed.control('admin',id,'cancel');assert.equal(changed.summary().latest!.status,'cancelled');assert.ok(changed.start('admin').accepted);await f.preserved();
  }finally{await f.cleanup();}
});
