import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createVerifiedBackup } from './sqlite-cli-common.mjs';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'vhomework-maintenance-browser-'));
const artifacts=path.resolve('.data/maintenance-qa');await fs.mkdir(artifacts,{recursive:true});
const env={...process.env,NODE_ENV:'development',PORT:'3177',LOCAL_AUTH_BYPASS_ENABLED:'true',VITE_LOCAL_AUTH_BYPASS_ENABLED:'true',VITE_FIREBASE_API_KEY:'local-test-api-key',VITE_FIREBASE_AUTH_DOMAIN:'local-test.invalid',VITE_FIREBASE_PROJECT_ID:'local-test',VITE_FIREBASE_STORAGE_BUCKET:'local-test.invalid',VITE_FIREBASE_MESSAGING_SENDER_ID:'000000000000',VITE_FIREBASE_APP_ID:'1:000000000000:web:localtest',STORAGE_MODE:'sqlite',SQLITE_DRIVER:'better-sqlite3',SQLITE_DB_PATH:path.join(root,'app.sqlite'),SQLITE_ALLOW_CREATE:'true',SQLITE_ALLOW_JSON_IMPORT:'false',SQLITE_ALLOW_DEMO_SEED:'false',
 TTS_AUDIO_DIR:path.join(root,'audio'),LISTENING_MEDIA_DIR:path.join(root,'listening-media'),VOCAB_IMAGE_DIR:path.join(root,'vocab-images'),SQLITE_BACKUP_DIR:path.join(root,'backups'),MAINTENANCE_ACCOUNT_ROOT:root,MAINTENANCE_DEPLOY_ROOT:path.join(root,'deployment'),MAINTENANCE_STATE_DIR:path.join(root,'maintenance'),MAINTENANCE_CPANEL_TOKEN:'',MAINTENANCE_CRON_DISCOVERY:'false',MAINTENANCE_INVENTORY_EXECUTOR:'process',MAINTENANCE_INVENTORY_DELAY_MS:'20',MAINTENANCE_INVENTORY_BATCH:'10'};
const child=spawn(process.execPath,['node_modules/tsx/dist/cli.mjs','server.ts'],{cwd:process.cwd(),env,stdio:'inherit',windowsHide:true});
await fs.writeFile(path.join(artifacts,'fixture.json'),JSON.stringify({root,pid:child.pid,origin:'http://127.0.0.1:3177'}));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
for(let i=0;i<120;i++){
  try {const r=await fetch('http://127.0.0.1:3177/api/admin/maintenance/summary',{headers:{Authorization:'Bearer local-test-auth-bypass'}});if(r.ok)break;}catch{}
  await new Promise(resolve=>setTimeout(resolve,500));
}

await fs.mkdir(env.LISTENING_MEDIA_DIR,{recursive:true});
const imageName='d'.repeat(64)+'.png',audioName='e'.repeat(64)+'.wav';
await fs.writeFile(path.join(env.LISTENING_MEDIA_DIR,imageName),await fs.readFile(path.resolve('public/logo.png')));
const sound=Buffer.alloc(64044);sound.write('RIFF',0);sound.writeUInt32LE(sound.length-8,4);sound.write('WAVEfmt ',8);sound.writeUInt32LE(16,16);
sound.writeUInt16LE(1,20);sound.writeUInt16LE(1,22);sound.writeUInt32LE(16000,24);sound.writeUInt32LE(32000,28);
sound.writeUInt16LE(2,32);sound.writeUInt16LE(16,34);sound.write('data',36);sound.writeUInt32LE(sound.length-44,40);
await fs.writeFile(path.join(env.LISTENING_MEDIA_DIR,audioName),sound);
const oldMedia=new Date(Date.now()-8*86400000);
for(const name of [imageName,audioName])await fs.utimes(path.join(env.LISTENING_MEDIA_DIR,name),oldMedia,oldMedia);

for (const [relative,text] of [['.npm/_cacache/blob','cache fixture'],['nodevenv/app/22/lib/runtime','runtime fixture'],['node_modules-app-backup-20261007-223115/lib.js','dependency recovery'],['deploy-staging/release/index.html','staged'],['public_html/index.html','domain fixture'],['external-backups/release-a/db-backup.json','fixture backup']]) {const file=path.join(root,relative);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,text);}
await fs.mkdir(path.join(root,'paginated'),{recursive:true});for(let i=0;i<123;i++)await fs.writeFile(path.join(root,'paginated','file-'+String(i).padStart(3,'0')+'.bin'),'x');
const temporaryDir=path.join(env.LISTENING_MEDIA_DIR,'.tmp-pdf-import');await fs.mkdir(temporaryDir,{recursive:true});
const temporaryFile=path.join(temporaryDir,'11111111-1111-4111-8111-111111111111.png');await fs.writeFile(temporaryFile,await fs.readFile(path.resolve('public/logo.png')));await fs.utimes(temporaryFile,oldMedia,oldMedia);
await createVerifiedBackup(env.SQLITE_DB_PATH,env.SQLITE_BACKUP_DIR);
console.log('[Maintenance QA] Fixture ready. No production data is used.');
child.once('exit',code=>process.exitCode=code??1);
