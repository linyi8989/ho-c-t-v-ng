import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';

const root=await fs.mkdtemp(path.join(os.tmpdir(),'vhomework-maintenance-bundle-'));
const listener=net.createServer();
await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));
const port=listener.address().port;
await new Promise(resolve=>listener.close(resolve));
const dbPath=path.join(root,'app.sqlite');new Database(dbPath).close();
const env={...process.env,NODE_ENV:'production',PORT:String(port),STORAGE_MODE:'sqlite',SQLITE_DRIVER:'better-sqlite3',SQLITE_DB_PATH:dbPath,SQLITE_ALLOW_CREATE:'false',SQLITE_ALLOW_JSON_IMPORT:'false',SQLITE_ALLOW_DEMO_SEED:'false',SEED_DATA_ENABLED:'false',DIAGNOSTIC_SECRET:'maintenance-fixture-diagnostic',LISTENING_TICKET_SECRET:'maintenance-fixture-ticket',GUEST_PUBLIC_ID_SECRET:'maintenance-fixture-identity',
 LOCAL_AUTH_BYPASS_ENABLED:'false',VITE_LOCAL_AUTH_BYPASS_ENABLED:'false',MAINTENANCE_ACCOUNT_ROOT:root,MAINTENANCE_DEPLOY_ROOT:path.join(root,'deployment'),MAINTENANCE_STATE_DIR:path.join(root,'maintenance'),MAINTENANCE_CPANEL_TOKEN:'',MAINTENANCE_CRON_DISCOVERY:'false',
 TTS_AUDIO_DIR:path.join(root,'audio'),LISTENING_MEDIA_DIR:path.join(root,'listening-media'),VOCAB_IMAGE_DIR:path.join(root,'vocab-images'),SPEAKING_FEEDBACK_PROVIDER:'none'};
const child=spawn(process.execPath,['dist/server.cjs'],{cwd:process.cwd(),env,stdio:['ignore','pipe','pipe'],windowsHide:true});
let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);
const origin='http://127.0.0.1:'+port;
try{
 const rejected=spawnSync(process.execPath,['dist/server.cjs'],{cwd:process.cwd(),env:{...env,LOCAL_AUTH_BYPASS_ENABLED:'true'},encoding:'utf8',timeout:10000,windowsHide:true});
 assert.equal(rejected.status,1);assert.match(rejected.stderr,/must never be enabled in production/);
 let ready=false;
 for(let i=0;i<100;i++){
  if(child.exitCode!==null)throw Error('Bundle exited before ready: '+(output.match(/^Error:[^\r\n]+/m)?.[0] || 'startup configuration rejected'));
  try{const r=await fetch(origin+'/api/admin/maintenance/summary');if(r.status===401){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.ok(ready,'Compiled native server becomes ready');
 assert.equal((await fetch(origin+'/api/admin/maintenance/inventory/summary')).status,401,'Hosting inventory enforces authentication in compiled bundle');
 assert.equal((await fetch(origin+'/api/admin/maintenance/summary',{headers:{Authorization:'Bearer local-test-auth-bypass'}})).status,401,'Production refuses local QA bypass');
 assert.equal((await fetch(origin+'/api/admin/maintenance/download/'+'a'.repeat(64))).status,404,'Unissued capability is rejected');
 await assert.rejects(fs.stat(path.join(root,'maintenance')),{code:'ENOENT'},'Startup/unauthorized GET never creates maintenance files');
 const db=new Database(dbPath,{readonly:true});assert.equal(db.pragma('quick_check',{simple:true}),'ok');assert.equal(db.pragma('journal_mode',{simple:true}),'wal');db.close();
 const result={compiledServer:true,nativeSqlite:true,productionTestFlagStartupRejected:true,unauthorizedSummary:401,productionBypass:401,unissuedDownload:404,noStartupMaintenanceWrites:true};
 await fs.mkdir(path.resolve('.data/maintenance-qa'),{recursive:true});await fs.writeFile(path.resolve('.data/maintenance-qa/bundle-report.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}catch(error){console.error(error.message);process.exitCode=1;}
finally{
 if(child.exitCode===null){child.kill();await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise((_,reject)=>setTimeout(()=>reject(Error('Fixture shutdown timed out')),10000))]);}
 assert.ok(root.startsWith(os.tmpdir()+path.sep)&&path.basename(root).startsWith('vhomework-maintenance-bundle-'));
 await fs.rm(root,{recursive:true,force:true});
}
