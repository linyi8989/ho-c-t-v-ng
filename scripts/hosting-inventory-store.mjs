import fs from 'node:fs';
import promises from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { MaintenanceError } from './maintenance-core.mjs';

export const nanosecondsToMilliseconds = value => Number(value/1000000n)+Number(value%1000000n)/1000000;
export async function metadataStat(file) {
  const s=await promises.lstat(file,{bigint:true});
  return {isFile:()=>s.isFile(),isDirectory:()=>s.isDirectory(),isSymbolicLink:()=>s.isSymbolicLink(),size:Number(s.size),mtimeMs:nanosecondsToMilliseconds(s.mtimeNs),ctimeMs:nanosecondsToMilliseconds(s.ctimeNs),ino:String(s.ino),dev:String(s.dev),nlink:Number(s.nlink),blocks:Number(s.blocks)};
}
export const VERSION = 'hosting-inventory-v1.2';
export const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export const within = (root, target) => { const r=path.relative(root,target); return r==='' || (!path.isAbsolute(r) && r!=='..' && !r.startsWith('..'+path.sep)); };
export const relativePath = (root, target) => path.relative(root,target).split(path.sep).join('/');
export function inventoryConfig(core, env=process.env) {
  const number=(name,fallback,min,max)=>Math.min(max,Math.max(min,Number(env[name])||fallback));
  return {...core, version:VERSION, file:path.join(core.stateRoot,'inventory.sqlite'),
    enabled:core.nativeSqlite, executor:env.MAINTENANCE_INVENTORY_EXECUTOR==='process',
    budgetBytes:number('MAINTENANCE_INVENTORY_BUDGET_MB',128,8,1024)*1048576,
    freeReserveBytes:number('MAINTENANCE_INVENTORY_FREE_MB',32,1,1024)*1048576,
    memoryBytes:number('MAINTENANCE_INVENTORY_MEMORY_MB',256,64,512)*1048576,
    batchSize:number('MAINTENANCE_INVENTORY_BATCH',100,10,500),
    batchMs:number('MAINTENANCE_INVENTORY_BATCH_MS',250,20,2000),
    delayMs:number('MAINTENANCE_INVENTORY_DELAY_MS',50,1,2000),
    windowMs:number('MAINTENANCE_INVENTORY_WINDOW_SECONDS',60,1,300)*1000,
    timezone:env.MAINTENANCE_INVENTORY_TIMEZONE||'Asia/Bangkok',
    growthBytes:number('MAINTENANCE_INVENTORY_GROWTH_MB',100,1,102400)*1048576,
    growthRatio:number('MAINTENANCE_INVENTORY_GROWTH_PERCENT',20,1,10000)/100,
    nodeDiscovery:env.MAINTENANCE_NODE_SELECTOR_DISCOVERY==='true',
    processDiscovery:env.MAINTENANCE_PROCESS_DISCOVERY==='true',
    sourceTimeoutMs:5000,
    scope:hash(JSON.stringify([core.accountRoot,core.deployRoot,core.dbPath,core.stateRoot,core.audioRoot,core.listeningRoot,core.vocabRoot,core.speakingRoot,core.backupRoots,core.quotaHost,core.quotaUser,core.cronDiscovery,env.MAINTENANCE_NODE_SELECTOR_DISCOVERY==='true',env.MAINTENANCE_PROCESS_DISCOVERY==='true',VERSION])),
  };
}
export function safeParents(target, create=false) {
  const absolute=path.resolve(target); let current=path.parse(absolute).root;
  for(const part of path.relative(current,absolute).split(path.sep).filter(Boolean)) {
    current=path.join(current,part);
    try { const s=fs.lstatSync(current); if(s.isSymbolicLink() || !s.isDirectory()) throw new MaintenanceError(409,'Parent chỉ mục/root không an toàn.'); }
    catch(e) { if(e.code!=='ENOENT' || !create)throw e; fs.mkdirSync(current,{mode:0o700}); }
  }
}
export function alive(pid) { if(!pid)return false; try{process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';} }
export function budget(config, reserve=1048576) {
  let bytes=0;
  for(const suffix of ['','-wal','-shm','-journal'])try{bytes+=fs.lstatSync(config.file+suffix).size;}catch(e){if(e.code!=='ENOENT')throw e;}
  const stat=fs.statfsSync(config.stateRoot), free=Number(stat.bavail)*Number(stat.bsize);
  return {bytes,limitBytes:config.budgetBytes,freeBytes:free,freeReserveBytes:config.freeReserveBytes,
    allowed:bytes+reserve<config.budgetBytes && free>config.freeReserveBytes+reserve};
}
const schema=`
CREATE TABLE meta(version INTEGER NOT NULL); INSERT INTO meta VALUES(1);
CREATE TABLE scans(id TEXT PRIMARY KEY,scope TEXT NOT NULL,root TEXT NOT NULL,version TEXT NOT NULL,actor TEXT NOT NULL,status TEXT NOT NULL,phase TEXT NOT NULL,started_at TEXT NOT NULL,finished_at TEXT,heartbeat TEXT,pid INTEGER,request TEXT,reason TEXT,files INTEGER DEFAULT 0,dirs INTEGER DEFAULT 0,logical_bytes INTEGER DEFAULT 0,unique_bytes INTEGER DEFAULT 0,allocated_bytes INTEGER,fs_complete INTEGER DEFAULT 0,dependency_complete INTEGER DEFAULT 0,current_path TEXT,baseline TEXT,source_json TEXT DEFAULT '[]',task_json TEXT DEFAULT '[]',alerts_json TEXT DEFAULT '[]',retained INTEGER DEFAULT 1);
CREATE TABLE entries(scan TEXT NOT NULL,id TEXT NOT NULL,rel TEXT NOT NULL,parent TEXT,name TEXT NOT NULL,type TEXT NOT NULL,size INTEGER DEFAULT 0,mtime REAL,ctime REAL,dev TEXT,ino TEXT,nlink INTEGER,blocks INTEGER,status TEXT NOT NULL,role TEXT NOT NULL,protected INTEGER NOT NULL,reason TEXT NOT NULL,issue TEXT,target TEXT,seen TEXT,bytes INTEGER DEFAULT 0,unique_bytes INTEGER DEFAULT 0,allocated_bytes INTEGER,files INTEGER DEFAULT 0,dirs INTEGER DEFAULT 0,PRIMARY KEY(scan,rel),UNIQUE(scan,id));
CREATE INDEX entry_parent ON entries(scan,parent,size DESC); CREATE INDEX entry_inode ON entries(scan,dev,ino);
CREATE TABLE queue(scan TEXT NOT NULL,rel TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',token TEXT,PRIMARY KEY(scan,rel));
CREATE TABLE evidence(scan TEXT NOT NULL,id TEXT NOT NULL,source TEXT NOT NULL,status TEXT NOT NULL,at TEXT NOT NULL,from_node TEXT NOT NULL,to_node TEXT NOT NULL,relation TEXT NOT NULL,reason TEXT NOT NULL,version TEXT NOT NULL,PRIMARY KEY(scan,id));
CREATE INDEX evidence_scan ON evidence(scan);
CREATE TABLE deltas(scan TEXT NOT NULL,rel TEXT NOT NULL,kind TEXT NOT NULL,before_bytes INTEGER,after_bytes INTEGER,attribution TEXT NOT NULL,PRIMARY KEY(scan,rel));
CREATE TABLE backup_sets(scan TEXT NOT NULL,id TEXT NOT NULL,entry_id TEXT NOT NULL,kind TEXT NOT NULL,recognition TEXT NOT NULL,PRIMARY KEY(scan,id));
CREATE TABLE audit(id INTEGER PRIMARY KEY AUTOINCREMENT,at TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,scan TEXT,reason TEXT);
`;
export function openStore(config, write=false) {
  if(!config.enabled)throw new MaintenanceError(503,'Inventory cần Node22 và SQLite native đã cấu hình.');
  safeParents(config.stateRoot,write);
  for(const suffix of ['','-wal','-shm','-journal']) {
    try {const s=fs.lstatSync(config.file+suffix);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1)throw new MaintenanceError(409,'Chỉ mục inventory không an toàn.');}
    catch(e){if(e.code!=='ENOENT')throw e;if(!write && suffix==='')return null;}
  }
  if(write && !budget(config).allowed)throw new MaintenanceError(507,'Thiếu dung lượng dự phòng cho chỉ mục inventory.');
  const exists=fs.existsSync(config.file);
  const db=new Database(config.file,{readonly:!write,fileMustExist:!write,timeout:3000});
  try {
    const validate=()=>{const meta=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='meta'").get();if(!meta){const table=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' LIMIT 1").get();if(!write||table)throw new MaintenanceError(503,'File chỉ mục không có schema inventory; không ghi vào database khác.');db.exec(schema);}if(db.prepare('SELECT version FROM meta').get()?.version!==1)throw new MaintenanceError(503,'Schema inventory chưa được hỗ trợ.');};
    if(write)db.transaction(validate).immediate();else validate();
    if(!exists&&process.platform!=='win32')fs.chmodSync(config.file,0o600);
    if(write) { db.pragma('journal_mode = WAL');db.pragma('wal_autocheckpoint = 100');db.pragma('synchronous = FULL'); }
    else db.pragma('query_only = ON');
    return db;
  }catch(e){db.close();throw e;}
}
export function withStore(config,write,fn) { const db=openStore(config,write);if(!db)return null;try{return fn(db);}finally{db.close();} }
export function scanDTO(row) {
  if(!row)return null;
  const interrupted=['queued','running'].includes(row.status) && (row.pid ? !alive(row.pid) : Date.now()-Date.parse(row.heartbeat||row.started_at)>30000);
  const sources=JSON.parse(row.source_json).map(s=>s.status==='available'&&(Date.now()-Date.parse(s.at)>86400000||s.version!==VERSION)?{...s,status:'stale',reason:'Bằng chứng quá 24h hoặc phiên bản bộ kiểm tra đã đổi; đọc lại nguồn.'}:s);
  return {id:row.id,root:row.root,scope:row.scope,version:row.version,actor:row.actor,status:interrupted?'interrupted':row.status,
    phase:row.phase,startedAt:row.started_at,finishedAt:row.finished_at,heartbeat:row.heartbeat,reason:interrupted?'Executor đã dừng; cần tiếp tục có chủ đích.':row.reason,
    fileCount:row.files,directoryCount:row.dirs,logicalBytes:row.logical_bytes,uniqueBytes:row.unique_bytes,allocatedBytes:row.allocated_bytes,
    filesystemComplete:Boolean(row.fs_complete),dependencyComplete:Boolean(row.dependency_complete)&&sources.every(s=>s.status==='available'),currentPath:row.current_path,
    sources,tasks:JSON.parse(row.task_json),alerts:JSON.parse(row.alerts_json),baseline:row.baseline,retained:Boolean(row.retained)};
}
export function entryDTO(row) {
  return {id:row.id,parent:row.parent,name:row.name,relative:row.rel,type:row.type,bytes:row.type==='directory'?row.bytes:row.size,
    uniqueBytes:row.unique_bytes,allocatedBytes:row.allocated_bytes,fileCount:row.files,directoryCount:row.dirs,
    modifiedAt:row.mtime?new Date(row.mtime).toISOString():null,status:row.status,role:row.role,protected:Boolean(row.protected),reason:row.reason,issue:row.issue,linkTarget:row.target};
}
export function audit(db,actor,action,scan,reason='') { db.prepare('INSERT INTO audit(at,actor,action,scan,reason) VALUES(?,?,?,?,?)').run(new Date().toISOString(),actor,action,scan,reason);db.exec('DELETE FROM audit WHERE id NOT IN (SELECT id FROM audit ORDER BY id DESC LIMIT 500)'); }
export function getScan(db,id) {
  if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))throw new MaintenanceError(400,'Scan ID không hợp lệ.');
  const row=db.prepare('SELECT * FROM scans WHERE id=?').get(id);if(!row)throw new MaintenanceError(404,'Không có lần quét.');return row;
}
export function counts(db,id) {
  const row=db.prepare("SELECT COUNT(CASE WHEN type='file' THEN 1 END) files,COUNT(CASE WHEN type='directory' THEN 1 END) dirs,COALESCE(SUM(CASE WHEN type='file' THEN size ELSE 0 END),0) bytes FROM entries WHERE scan=?").get(id);
  db.prepare('UPDATE scans SET files=?,dirs=?,logical_bytes=?,heartbeat=? WHERE id=?').run(row.files,row.dirs,row.bytes,new Date().toISOString(),id);
}
export function finalize(db,config,id) {
  // Bottom-up totals. A parent already includes children; API never adds tree rows into an account total.
  db.pragma('temp_store = MEMORY');
  db.exec('CREATE TEMP TABLE charges(id INTEGER PRIMARY KEY)');
  db.prepare("INSERT INTO charges SELECT MIN(rowid) FROM entries WHERE scan=? AND type='file' GROUP BY dev,ino").run(id);
  let cursor=0;
  while(true){const rows=db.prepare('SELECT rowid FROM entries WHERE scan=? AND rowid>? ORDER BY rowid LIMIT 500').all(id,cursor);if(!rows.length)break;cursor=rows.at(-1).rowid;const low=rows[0].rowid;
    db.prepare("UPDATE entries SET bytes=size,unique_bytes=CASE WHEN rowid IN (SELECT id FROM charges) THEN size ELSE 0 END,allocated_bytes=CASE WHEN type='file' AND blocks IS NULL THEN NULL WHEN rowid IN (SELECT id FROM charges) THEN blocks*512 ELSE 0 END,files=CASE WHEN type='file' THEN 1 ELSE 0 END,dirs=0 WHERE scan=? AND rowid BETWEEN ? AND ?").run(id,low,cursor);
  }
  db.exec('DROP TABLE charges');
  const dirs=db.prepare("SELECT rel FROM entries WHERE scan=? AND type='directory' ORDER BY length(rel) DESC").all(id);
  const sum=db.prepare('SELECT COALESCE(SUM(bytes),0) bytes,COALESCE(SUM(unique_bytes),0) unique_bytes,CASE WHEN COUNT(*)=COUNT(allocated_bytes) THEN COALESCE(SUM(allocated_bytes),0) ELSE NULL END allocated_bytes,COALESCE(SUM(files),0) files,COALESCE(SUM(dirs),0)+COUNT(CASE WHEN type=\'directory\' THEN 1 END) dirs FROM entries WHERE scan=? AND parent=?');
  const update=db.prepare('UPDATE entries SET bytes=?,unique_bytes=?,allocated_bytes=?,files=?,dirs=? WHERE scan=? AND rel=?');
  db.transaction(()=>{for(const dir of dirs){const n=sum.get(id,dir.rel);update.run(n.bytes,n.unique_bytes,n.allocated_bytes,n.files,n.dirs,id,dir.rel);}})();
  const root=db.prepare("SELECT * FROM entries WHERE scan=? AND rel=''").get(id);
  const issue=db.prepare("SELECT COUNT(*) n FROM entries WHERE scan=? AND issue IS NOT NULL AND issue NOT IN ('symlink_excluded','metadata_excluded')").get(id).n;
  const fsComplete=Boolean(root && !issue);
  const scan=getScan(db,id),sources=JSON.parse(scan.source_json);
  const dependencyComplete=sources.length>0 && sources.every(s=>s.status==='available');
  const prior=fsComplete?db.prepare("SELECT * FROM scans WHERE scope=? AND fs_complete=1 AND status='completed' AND id<>? AND retained=1 ORDER BY started_at DESC LIMIT 1").get(config.scope,id):null;
  const alerts=[];
  if(!fsComplete)alerts.push({key:'filesystem',severity:'warning',message:'Có phần chưa đọc; không suy ra file mất hoặc dung lượng bằng 0.'});
  if(!dependencyComplete)alerts.push({key:'dependency',severity:'warning',message:'Bằng chứng phụ thuộc còn thiếu. Xem trạng thái từng nguồn.'});
  db.transaction(()=>{
    if(prior) {
      db.prepare(`INSERT INTO deltas SELECT ?,n.rel,CASE WHEN o.rel IS NULL THEN 'observed_new' ELSE 'changed' END,o.size,n.size,'unknown' FROM entries n LEFT JOIN entries o ON o.scan=? AND o.rel=n.rel WHERE n.scan=? AND n.type='file' AND (o.rel IS NULL OR n.size<>o.size OR n.mtime<>o.mtime OR n.ino<>o.ino OR n.dev<>o.dev)`).run(id,prior.id,id);
      db.prepare(`INSERT OR IGNORE INTO deltas SELECT ?,o.rel,'not_observed',o.size,NULL,'unknown' FROM entries o LEFT JOIN entries n ON n.scan=? AND n.rel=o.rel WHERE o.scan=? AND o.type='file' AND n.rel IS NULL`).run(id,id,prior.id);
      for(const writer of [config.audioRoot,config.listeningRoot,config.vocabRoot,config.speakingRoot]){if(!within(config.accountRoot,writer))continue;const rel=relativePath(config.accountRoot,writer)+'/';db.prepare("UPDATE deltas SET attribution='path_time_correlation' WHERE scan=? AND kind<>'not_observed' AND substr(rel,1,?)=? AND rel IN (SELECT rel FROM entries WHERE scan=? AND mtime>=?)").run(id,rel.length,rel,id,Date.parse(prior.started_at));}
      const growth=root.bytes-prior.logical_bytes;
      if(growth>=config.growthBytes && growth/Math.max(prior.logical_bytes,1)>=config.growthRatio)alerts.push({key:'growth',severity:'warning',message:'Tăng '+growth+' byte từ lần quét đầy đủ trước; nguồn tạo chưa được xác minh.'});
    }
    db.prepare('UPDATE scans SET status=\'completed\',phase=\'complete\',finished_at=?,heartbeat=?,pid=NULL,request=NULL,files=?,dirs=?,logical_bytes=?,unique_bytes=?,allocated_bytes=?,fs_complete=?,dependency_complete=?,baseline=?,alerts_json=? WHERE id=?')
      .run(new Date().toISOString(),new Date().toISOString(),root?.files||0,(root?.dirs||0)+1,root?.bytes||0,root?.unique_bytes||0,root?.allocated_bytes??null,Number(fsComplete),Number(dependencyComplete),prior?.id||null,JSON.stringify(alerts),id);
    const retained=[id,prior?.id].filter(Boolean);
    // Only our inventory metadata is pruned. Keep the latest complete baseline when a scan is partial.
    if(!fsComplete){const baseline=db.prepare("SELECT id FROM scans WHERE fs_complete=1 AND status='completed' AND retained=1 ORDER BY started_at DESC LIMIT 1").get();if(baseline)retained.push(baseline.id);}
    for(const old of db.prepare('SELECT id FROM scans WHERE retained=1').all())if(!retained.includes(old.id)) {
      for(const table of ['entries','queue','evidence','deltas','backup_sets'])db.prepare('DELETE FROM '+table+' WHERE scan=?').run(old.id);
      db.prepare('UPDATE scans SET retained=0 WHERE id=?').run(old.id);
    }
    db.exec("DELETE FROM scans WHERE retained=0 AND id NOT IN (SELECT id FROM scans ORDER BY started_at DESC LIMIT 120)");
    audit(db,scan.actor,'inventory.completed',id,fsComplete?'Filesystem đọc đủ; xem coverage phụ thuộc.':'Filesystem partial.');
  })();
  db.pragma('wal_checkpoint(TRUNCATE)');
}