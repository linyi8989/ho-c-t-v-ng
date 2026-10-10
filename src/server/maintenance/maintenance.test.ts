import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import express from 'express';
import { createMaintenance, maintenanceConfig, maintenanceInodeKey } from '../../../scripts/maintenance-core.mjs';
import { createMaintenanceRouter } from './router';
const require = createRequire(import.meta.url), Database = require('better-sqlite3');
const digest = (data: Buffer) => crypto.createHash('sha256').update(data).digest('hex');
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vhomework-maintenance-test-'));
  const data = path.join(root,'data'), backups = path.join(data,'backups');
  await fs.mkdir(backups,{recursive:true}); const dbPath=path.join(data,'app.sqlite');
  const db = new Database(dbPath);
  db.exec("CREATE TABLE users(id TEXT PRIMARY KEY); INSERT INTO users VALUES('preserved'); CREATE TABLE leaderboard_events(id TEXT); INSERT INTO leaderboard_events VALUES('gold'); CREATE TABLE listening_assets(storage_key TEXT,public_url TEXT); CREATE TABLE vocab_items(audio_url TEXT,data_json TEXT); CREATE TABLE vocab_sets(data_json TEXT); CREATE TABLE speaking_attempts(id TEXT,status TEXT,data_json TEXT); CREATE TABLE speaking_jobs(attempt_id TEXT,status TEXT);");
  db.close();
  const backup=path.join(backups,'app-fixture.sqlite'); await fs.copyFile(dbPath,backup);
  const env={STORAGE_MODE:'sqlite',SQLITE_DRIVER:'better-sqlite3',SQLITE_DB_PATH:dbPath,SQLITE_BACKUP_DIR:backups,MAINTENANCE_ACCOUNT_ROOT:root,MAINTENANCE_DEPLOY_ROOT:path.join(root,'deployment'),MAINTENANCE_STATE_DIR:path.join(data,'maintenance')};
  const config=maintenanceConfig(env,root), service=createMaintenance(config);
  const before=await fs.readFile(dbPath);
  const cleanup=async()=>{assert.ok(root.startsWith(os.tmpdir()+path.sep) && path.basename(root).startsWith('vhomework-maintenance-test-'));await fs.rm(root,{recursive:true,force:true});};
  return {root,data,backups,dbPath,backup,env,config,service,before,cleanup};
}
test('summary is read-only and never creates metadata or backup',async()=>{
  const f=await fixture();try{
    const result=await f.service.summary('admin');assert.equal(result.latest,null);
    await assert.rejects(fs.stat(f.config.stateRoot),{code:'ENOENT'});
    assert.equal((await fs.readdir(f.backups)).length,1);
    assert.deepEqual(await fs.readFile(f.dbPath),f.before);
  }finally{await f.cleanup();}
});
test('wrong local checksum/actor/pin/confirmation cannot delete; last host backup can be deleted after proof',async()=>{
  const f=await fixture();try{
    await f.service.scan('admin');
    const entry=(await f.service.summary('admin')).latest!.entries.find(e=>e.kind==='backup')!;
    const bytes=await fs.readFile(f.backup);
    await assert.rejects(f.service.verifyBackup('admin',entry.id,'0'.repeat(64),bytes.length),/Checksum/);
    await assert.rejects(f.service.previewDelete('admin',entry.id),/xác minh/);
    await f.service.verifyBackup('admin',entry.id,digest(bytes),bytes.length);
    assert.equal((await f.service.summary('admin')).latest!.entries.find(e=>e.id===entry.id)!.verified,true);
    assert.equal((await f.service.summary('other')).latest!.entries.find(e=>e.id===entry.id)!.verified,false);
    await assert.rejects(f.service.previewDelete('other',entry.id),/xác minh/);
    await f.service.pin('admin',entry.id,true);await assert.rejects(f.service.previewDelete('admin',entry.id),/ghim/);
    await f.service.pin('admin',entry.id,false);
    const preview=await f.service.previewDelete('admin',entry.id);
    await assert.rejects(f.service.deleteBackup('admin',entry.id,preview.approval,'wrong'),/xác nhận/);
    const result=await f.service.deleteBackup('admin',entry.id,preview.approval,entry.name);
    assert.equal(result.removedBytes,bytes.length);assert.equal(result.quotaDeltaBytes,null);
    await assert.rejects(fs.stat(f.backup),{code:'ENOENT'});
    assert.deepEqual(await fs.readFile(f.dbPath),f.before);
    const db=new Database(f.dbPath,{readonly:true});assert.equal(db.prepare('SELECT COUNT(*) n FROM leaderboard_events').get().n,1);db.close();
    const audit=(await f.service.summary('admin')).audit;
    assert.ok(audit.some(a=>a.action==='backup.delete-intent'));assert.ok(audit.some(a=>a.action==='backup.deleted'));
  }finally{await f.cleanup();}
});
test('changed backup invalidates evidence and stale previews',async()=>{
  const f=await fixture();try{
    await f.service.scan('admin');const entry=(await f.service.summary('admin')).latest!.entries.find(e=>e.kind==='backup')!;
    const bytes=await fs.readFile(f.backup);await f.service.verifyBackup('admin',entry.id,digest(bytes),bytes.length);
    const preview=await f.service.previewDelete('admin',entry.id);await fs.appendFile(f.backup,'changed');
    await assert.rejects(f.service.deleteBackup('admin',entry.id,preview.approval,entry.name),/thay đổi/);
    assert.ok((await fs.stat(f.backup)).size>bytes.length);
  }finally{await f.cleanup();}
});
test('single-use download streams original bytes and blocks concurrent maintenance',async()=>{
  const f=await fixture();try{
    await f.service.scan('admin');const entry=(await f.service.summary('admin')).latest!.entries.find(e=>e.kind==='backup')!;
    const {ticket}=await f.service.downloadTicket('admin',entry.id);
    let release!:()=>void,entered!:()=>void;
    const started=new Promise<void>(resolve=>entered=resolve),hold=new Promise<void>(resolve=>release=resolve);
    const chunks:Buffer[]=[];
    const running=f.service.download(ticket,async handle=>{entered();for await(const chunk of handle.createReadStream({autoClose:false}))chunks.push(chunk);await hold;});
    await started;await assert.rejects(f.service.pin('admin',entry.id,true),/đang chạy/);release();await running;
    assert.deepEqual(Buffer.concat(chunks),await fs.readFile(f.backup));
    await assert.rejects(f.service.download(ticket,async()=>{}),/hết hạn/);
    assert.equal((await fs.readdir(f.backups)).length,1);
  }finally{await f.cleanup();}
});
test('temporary dry-run, keep, quarantine and restore never touch database',async()=>{
  const f=await fixture();try{
    const dir=path.join(f.config.listeningRoot,'.tmp-pdf-import');await fs.mkdir(dir,{recursive:true});
    const name=crypto.randomUUID()+'.png',file=path.join(dir,name);await fs.writeFile(file,'temporary');
    const old=new Date(Date.now()-3*86400000);await fs.utimes(file,old,old);
    await f.service.scan('admin');let entry=(await f.service.summary('admin')).latest!.entries.find(e=>e.name===name)!;assert.equal(entry.status,'eligible');
    const dry=await f.service.automate(false);assert.equal(dry.candidates.length,1);assert.equal(dry.candidates[0].policyEnabled,false);assert.ok(await fs.stat(file));
    await f.service.hold('admin',entry.id,30,'test hold');
    await assert.rejects(f.service.cleanup('admin',entry.id,'delete-expired',name),/đang được giữ/);
    await f.service.hold('admin',entry.id,0,'release');await f.service.cleanup('admin',entry.id,'quarantine',name);
    await assert.rejects(fs.stat(file),{code:'ENOENT'});let result=await f.service.summary('admin');
    assert.equal(result.quarantine[0].bytes,9);
    await f.service.quarantineAction('admin',result.quarantine[0].id,'restore',name);assert.equal(await fs.readFile(file,'utf8'),'temporary');
    assert.deepEqual(await fs.readFile(f.dbPath),f.before);
  }finally{await f.cleanup();}
});
test('automation requires opt-in and rechecks file eligibility',async()=>{
  const f=await fixture();try{
    const dir=path.join(f.config.listeningRoot,'.tmp-pdf-import');await fs.mkdir(dir,{recursive:true});
    const name=crypto.randomUUID()+'.png',file=path.join(dir,name);await fs.writeFile(file,'expired');const old=new Date(Date.now()-3*86400000);await fs.utimes(file,old,old);
    await f.service.automate(true);assert.ok(await fs.stat(file)); // Execute remains harmless while policy is off.
    await assert.rejects(f.service.policy('admin',{temporary:true},''),/xác nhận/);
    await f.service.policy('admin',{temporary:true},'BẬT DỌN TỰ ĐỘNG');
    const dry=await f.service.automate(false);assert.equal(dry.candidates.length,1);assert.ok(await fs.stat(file));
    await f.service.automate(true);await assert.rejects(fs.stat(file),{code:'ENOENT'});
    assert.deepEqual(await fs.readFile(f.dbPath),f.before);
  }finally{await f.cleanup();}
});
test('speaking pending jobs and unknown media remain protected',async()=>{
  const f=await fixture();try{
    const id=crypto.randomUUID(), db=new Database(f.dbPath);
    db.prepare('INSERT INTO speaking_attempts VALUES(?,?,?)').run(id,'queued',JSON.stringify({audioExpiresAt:new Date(Date.now()-1000).toISOString()}));
    db.prepare('INSERT INTO speaking_jobs VALUES(?,?)').run(id,'waiting');db.close();
    await fs.mkdir(f.config.speakingRoot,{recursive:true});const file=path.join(f.config.speakingRoot,id+'.wav');await fs.writeFile(file,'wav');
    const old=new Date(Date.now()-2*86400000);await fs.utimes(file,old,old);
    await f.service.scan('admin');const entry=(await f.service.summary('admin')).latest!.entries.find(e=>e.kind==='speaking')!;
    assert.equal(entry.status,'blocked');await assert.rejects(f.service.cleanup('admin',entry.id,'delete-expired',entry.name),/điều kiện/);
    assert.ok(await fs.stat(file));
  }finally{await f.cleanup();}
});
test('symlink and hardlink aliases are not actionable',async(t)=>{
  const f=await fixture();try{
    const alias=path.join(f.backups,'app-alias.sqlite');await fs.link(f.backup,alias);
    await f.service.scan('admin');const entry=(await f.service.summary('admin')).latest!.entries.find(e=>e.kind==='backup')!;
    assert.equal(entry.status,'protected');await assert.rejects(f.service.verifyBackup('admin',entry.id,digest(await fs.readFile(f.backup)),(await fs.stat(f.backup)).size),/hardlink/);
    await fs.unlink(alias);
    const link=path.join(f.root,'linked');
    try{await fs.symlink(f.backups,link,'junction');}catch(e:any){if(e.code==='EPERM'){t.diagnostic('Junction unavailable');return;}throw e;}
    await f.service.scan('admin');assert.ok((await f.service.summary('admin')).latest!.issues.some(i=>i.status==='symlink-excluded'));
  }finally{await f.cleanup();}
});
test('corrupt reference JSON stops orphan classification instead of guessing',async()=>{
  const f=await fixture();try{
    const db=new Database(f.dbPath);db.prepare('INSERT INTO vocab_sets VALUES(?)').run('{broken');db.close();
    await f.service.scan('admin');assert.equal((await f.service.summary('admin')).latest!.referenceStatus,'unknown');
    assert.ok((await f.service.summary('admin')).latest!.alerts.length);
  }finally{await f.cleanup();}
});
test('scan limits report partial instead of claiming all hosting counted',async()=>{
  const f=await fixture();try{
    const many=path.join(f.root,'many');await fs.mkdir(many);for(let i=0;i<160;i++)await fs.writeFile(path.join(many,i+'.txt'),'x');
    const limited=createMaintenance({...f.config,maxFiles:100});await limited.scan('admin');
    assert.equal((await limited.summary('admin')).latest!.complete,false);
  }finally{await f.cleanup();}
});
test('HTTP API enforces server role and streams ticketed downloads',async()=>{
  const f=await fixture();const app=express();app.use(express.json());
  const authenticate:express.RequestHandler=(req,res,next)=>{const role=req.headers['x-test-role'];if(!role)return void res.status(401).json({error:'auth'});req.user={id:'admin',role:role as any,name:'test',email:'test@example.invalid',status:'active',createdAt:''};next();};
  const superAdmin:express.RequestHandler=(req,res,next)=>{if(req.user?.role!=='super_admin')return void res.status(403).json({error:'role'});next();};
  app.use('/api/admin/maintenance',createMaintenanceRouter({service:f.service,authenticateUser:authenticate,requireSuperAdmin:superAdmin}));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const origin='http://127.0.0.1:'+(server.address() as any).port+'/api/admin/maintenance';
  try{
    assert.equal((await fetch(origin+'/summary')).status,401);assert.equal((await fetch(origin+'/summary',{headers:{'x-test-role':'teacher'}})).status,403);
    assert.equal((await fetch(origin+'/summary',{headers:{'x-test-role':'super_admin'}})).status,200);
    await fs.mkdir(f.config.listeningRoot,{recursive:true});
    const name='f'.repeat(64)+'.png';await fs.writeFile(path.join(f.config.listeningRoot,name),previewPng);
    await f.service.scan('admin');const image=(await f.service.summary('admin')).latest!.entries.find(e=>e.name===name)!;
    const previewUrl=origin+'/files/'+image.id+'/preview';
    assert.equal((await fetch(previewUrl,{method:'POST'})).status,401);
    assert.equal((await fetch(previewUrl,{method:'POST',headers:{'x-test-role':'teacher'}})).status,403);
    const preview=await fetch(previewUrl,{method:'POST',headers:{'x-test-role':'super_admin'}});
    assert.equal(preview.status,200);assert.equal(preview.headers.get('content-type'),'image/png');
    assert.equal(preview.headers.get('x-content-type-options'),'nosniff');assert.match(preview.headers.get('cache-control')!,/no-store/);
    assert.deepEqual(Buffer.from(await preview.arrayBuffer()),previewPng);
    for(let i=0;i<100&&(await f.service.summary('admin')).busy;i++)await new Promise(resolve=>setTimeout(resolve,20));
    const entry=(await f.service.summary('admin')).latest!.entries.find(e=>e.kind==='backup')!;
    const ticket=await (await fetch(origin+'/backups/'+entry.id+'/download-ticket',{method:'POST',headers:{'x-test-role':'super_admin','Content-Type':'application/json'},body:'{}'})).json();
    const response=await fetch('http://127.0.0.1:'+(server.address() as any).port+ticket.url);assert.equal(response.status,200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),await fs.readFile(f.backup));
    assert.match(response.headers.get('content-disposition')!,/attachment/);
  }finally{for(let i=0;i<100&&(await f.service.summary('admin')).busy;i++)await new Promise(resolve=>setTimeout(resolve,20));server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await f.cleanup();}
});

test('live manifest protects current/rollback and only old known assets become eligible',async()=>{
  const f=await fixture();try{
    const dir=path.join(f.data,'frontend-releases'),assets=path.join(f.config.deployRoot,'assets'),client=path.join(f.config.deployRoot,'dist/client');
    await fs.mkdir(dir,{recursive:true});await fs.mkdir(assets,{recursive:true});await fs.mkdir(client,{recursive:true});
    await fs.writeFile(path.join(f.config.deployRoot,'index.html'),'<script src="/assets/current.js"></script>');
    await fs.writeFile(path.join(client,'index.html'),'<script src="/assets/current.js"></script>');
    for(const name of ['old.js','rollback.js','current.js','legacy.js'])await fs.writeFile(path.join(assets,name),'asset');
    const names=['old.js','rollback.js','current.js'];
    for(let i=0;i<3;i++){
      const manifest=path.join(dir,'release-'+i+'.json');await fs.writeFile(manifest,JSON.stringify({version:1,files:[{path:'assets/'+names[i],sha256:digest(Buffer.from('asset'))}]}));
      const when=new Date(Date.now()-(i===0?400:2-i)*86400000);await fs.utimes(manifest,when,when);
    }
    await f.service.scan('admin');
    const entries=(await f.service.summary('admin')).latest!.entries;
    assert.equal(entries.find(e=>e.name==='old.js')!.status,'eligible');
    assert.equal(entries.find(e=>e.name==='current.js')!.status,'protected');
    assert.equal(entries.find(e=>e.name==='rollback.js')!.status,'protected');
    assert.equal(entries.find(e=>e.name==='legacy.js')!.status,'protected');
    const old=entries.find(e=>e.name==='old.js')!;
    // Even restoring the same size/mtime cannot bypass manifest content verification.
    const oldPath=path.join(assets,'old.js'),before=await fs.stat(oldPath);
    await fs.writeFile(oldPath,'other');await fs.utimes(oldPath,before.atime,before.mtime);
    await f.service.scan('admin');const changed=(await f.service.summary('admin')).latest!.entries.find(e=>e.name==='old.js')!;
    await assert.rejects(f.service.cleanup('admin',changed.id,'delete-expired','old.js'),/manifest/);
    assert.equal(await fs.readFile(oldPath,'utf8'),'other');
    await fs.writeFile(oldPath,'asset');await f.service.scan('admin');
    const restored=(await f.service.summary('admin')).latest!.entries.find(e=>e.name==='old.js')!;
    await f.service.cleanup('admin',restored.id,'quarantine','old.js');
    assert.ok(await fs.stat(path.join(assets,'current.js')));
  }finally{await f.cleanup();}
});
test('backup creation reuses online snapshot and protected tables remain identical',async()=>{
  const f=await fixture();try{
    const result=await f.service.createBackup('admin');assert.equal(result.quickCheck,'ok');
    const db=new Database(path.join(f.backups,result.name),{readonly:true});assert.equal(db.pragma('journal_mode',{simple:true}),'delete');assert.equal(db.prepare('SELECT COUNT(*) n FROM leaderboard_events').get().n,1);db.close();
    assert.deepEqual(await fs.readFile(f.dbPath),f.before);
  }finally{await f.cleanup();}
});
test('metadata corruption stops destructive operation; unknown ids and malformed policy fail safely',async()=>{
  const f=await fixture();try{
    await f.service.scan('admin');
    await assert.rejects(f.service.verifyBackup('admin','../../app.sqlite','a'.repeat(64),100),/không còn/);
    await assert.rejects(f.service.policy('admin',undefined as any,''),/không hợp lệ/);
    await fs.writeFile(path.join(f.config.stateRoot,'state.json'),'{invalid');
    await assert.rejects(f.service.downloadTicket('admin','a'.repeat(64)));
    assert.ok(await fs.stat(f.backup));assert.deepEqual(await fs.readFile(f.dbPath),f.before);
  }finally{await f.cleanup();}
});

test('nonempty backup WAL blocks single-file local verification',async()=>{
  const f=await fixture();try{
    await f.service.scan('admin');const entry=(await f.service.summary('admin')).latest!.entries.find(e=>e.kind==='backup')!;
    const bytes=await fs.readFile(f.backup);await fs.writeFile(f.backup+'-wal',Buffer.alloc(64,1));
    await assert.rejects(f.service.verifyBackup('admin',entry.id,digest(bytes),bytes.length),/WAL/);
    assert.ok(await fs.stat(f.backup));assert.deepEqual(await fs.readFile(f.dbPath),f.before);
  }finally{await f.cleanup();}
});

test('account root reports hidden/cache/runtime folders without granting deletion',async()=>{
  const f=await fixture();try{
    for(const name of ['.npm','nodevenv','deploy-staging']){
      const folder=path.join(f.root,name);await fs.mkdir(folder);await fs.writeFile(path.join(folder,'sample.txt'),name);
    }
    await f.service.scan('admin');const report=(await f.service.summary('admin')).latest!;
    for(const name of ['.npm','nodevenv','deploy-staging']){
      const group=report.groups.find(g=>g.id==='account:'+name)!;
      assert.equal(group.root,path.join(f.root,name));assert.equal(group.bytes,Buffer.byteLength(name));
      const entry=report.entries.find(e=>e.rootId==='account'&&e.relative===path.join(name,'sample.txt'))!;
      assert.equal(entry.status,'protected');await assert.rejects(f.service.cleanup('admin',entry.id,'delete-expired',entry.name),/chưa được cấp/);
    }
    assert.deepEqual(await fs.readFile(f.dbPath),f.before);
    assert.equal(maintenanceConfig({...f.env,MAINTENANCE_RESERVE_MB:'invalid'},f.root).reserveBytes,256*1024*1024);
  }finally{await f.cleanup();}
});

test('hold and release immediately update status without moving/deleting files; expiry only removes protection',async()=>{
  const f=await fixture();try{
    const dir=path.join(f.config.listeningRoot,'.tmp-pdf-import');await fs.mkdir(dir,{recursive:true});
    const name=crypto.randomUUID()+'.png',file=path.join(dir,name);await fs.writeFile(file,'held-data');
    const old=new Date(Date.now()-3*86400000);await fs.utimes(file,old,old);
    await f.service.scan('admin');const entry=(await f.service.summary('admin')).latest!.entries.find(e=>e.name===name)!;
    await f.service.hold('admin',entry.id,30,'hold preview test');
    const held=(await f.service.summary('admin')).latest!.entries.find(e=>e.id===entry.id)!;
    assert.equal(held.status,'held');assert.ok(Date.parse(held.heldUntil!)>Date.now());
    assert.equal(await fs.readFile(file,'utf8'),'held-data');
    await f.service.scan('admin');assert.equal((await f.service.summary('admin')).latest!.entries.find(e=>e.id===entry.id)!.status,'held');
    await f.service.hold('admin',entry.id,0,'release');
    assert.equal((await f.service.summary('admin')).latest!.entries.find(e=>e.id===entry.id)!.status,'eligible');
    await f.service.hold('admin',entry.id,1,'expiring');
    const metadata=path.join(f.config.stateRoot,'state.json'),state=JSON.parse(await fs.readFile(metadata,'utf8'));
    state.holds[entry.id].until=Date.now()-1000;await fs.writeFile(metadata,JSON.stringify(state));
    assert.equal((await f.service.summary('admin')).latest!.entries.find(e=>e.id===entry.id)!.status,'eligible');
    assert.equal(await fs.readFile(file,'utf8'),'held-data');assert.deepEqual(await fs.readFile(f.dbPath),f.before);
  }finally{await f.cleanup();}
});
const previewPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXo0AAAAASUVORK5CYII=','base64');
function previewWav(){
 const data=Buffer.alloc(32044);data.write('RIFF',0);data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);
 data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(16000,24);data.writeUInt32LE(32000,28);
 data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(data.length-44,40);return data;
}
test('preview streams scoped raster/audio bytes, protects originals and rejects stale/oversize/fake/nonmedia files',async()=>{
 const f=await fixture();try{
  await fs.mkdir(f.config.listeningRoot,{recursive:true});
  const image=path.join(f.config.listeningRoot,'a'.repeat(64)+'.png'),audio=path.join(f.config.listeningRoot,'b'.repeat(64)+'.wav');
  await fs.writeFile(image,previewPng);await fs.writeFile(audio,previewWav());
  await fs.writeFile(path.join(f.data,'private.png'),previewPng);
  await fs.writeFile(path.join(f.config.listeningRoot,'fake.png'),'<html>not a picture</html>');
  const huge=path.join(f.config.listeningRoot,'huge.wav');const h=await fs.open(huge,'w');await h.truncate(33*1024*1024);await h.close();
  await f.service.scan('admin');const entries=(await f.service.summary('admin')).latest!.entries;
  const picture=entries.find(e=>e.name===path.basename(image))!,sound=entries.find(e=>e.name===path.basename(audio))!;
  assert.equal(picture.previewType,'image');assert.equal(sound.previewType,'audio');
  for(const [entry,expected,mime] of [[picture,previewPng,'image/png'],[sound,previewWav(),'audio/wav']] as const){
   const chunks:Buffer[]=[];
   await f.service.previewMedia('admin',entry.id,async(handle,meta)=>{
    assert.equal(meta.mime,mime);for await(const chunk of handle.createReadStream({autoClose:false,start:0}))chunks.push(chunk);
   });assert.deepEqual(Buffer.concat(chunks),expected);
  }
  const privateEntry=entries.find(e=>e.name==='private.png')!;assert.equal(privateEntry.previewType,null);
  await assert.rejects(f.service.previewMedia('admin',privateEntry.id,async()=>{}),/Chỉ xem trước/);
  await assert.rejects(f.service.previewMedia('admin',entries.find(e=>e.name==='fake.png')!.id,async()=>{}),/Nội dung/);
  await assert.rejects(f.service.previewMedia('admin',entries.find(e=>e.name==='huge.wav')!.id,async()=>{}),/Giới hạn/);
  await fs.appendFile(image,'changed');await assert.rejects(f.service.previewMedia('admin',picture.id,async()=>{}),/thay đổi/);
  assert.deepEqual(await fs.readFile(audio),previewWav());assert.deepEqual(await fs.readFile(f.dbPath),f.before);
 }finally{await f.cleanup();}
});
test('preview keeps maintenance lease until stream ends and rejects symlink/hardlink replacement',async()=>{
 const f=await fixture();try{
  await fs.mkdir(f.config.listeningRoot,{recursive:true});
  const file=path.join(f.config.listeningRoot,'c'.repeat(64)+'.png');await fs.writeFile(file,previewPng);
  await f.service.scan('admin');const entry=(await f.service.summary('admin')).latest!.entries.find(e=>e.name===path.basename(file))!;
  let entered!:()=>void,release!:()=>void;const started=new Promise<void>(r=>entered=r),hold=new Promise<void>(r=>release=r);
  const running=f.service.previewMedia('admin',entry.id,async()=>{entered();await hold;});await started;
  await assert.rejects(f.service.cleanup('admin',entry.id,'delete-expired',entry.name),/đang chạy/);
  release();await running;
  const alias=path.join(f.root,'hardlink.png');await fs.link(file,alias);
  await assert.rejects(f.service.previewMedia('admin',entry.id,async()=>{}),/hardlink/);await fs.unlink(alias);
  await fs.unlink(file);await fs.symlink(f.backup,file);
  await assert.rejects(f.service.previewMedia('admin',entry.id,async()=>{}),/symlink/);
 }finally{await f.cleanup();}
});

test('64-bit inode keys distinguish unrelated NTFS files beyond Number precision',()=>{
 const first=18014398509481984n,second=18014398509481985n;assert.equal(Number(first),Number(second));assert.notEqual(maintenanceInodeKey({dev:1n,ino:first}),maintenanceInodeKey({dev:1n,ino:second}));assert.equal(maintenanceInodeKey({dev:1,ino:100}),'1:100');
});