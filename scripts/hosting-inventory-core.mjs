import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { MaintenanceError } from './maintenance-core.mjs';
import { VERSION,metadataStat,hash,within,relativePath,safeParents,alive,budget,openStore,withStore,getScan,scanDTO,entryDTO,audit,counts,finalize } from './hosting-inventory-store.mjs';
import { classify,collectSources } from './hosting-inventory-sources.mjs';
import { assessmentContext,assessEntry } from './hosting-inventory-assessment.mjs';
const now=()=>new Date().toISOString(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const issue=e=>['EACCES','EPERM'].includes(e.code)?'permission_denied':e.code==='ENOENT'?'vanished':e instanceof MaintenanceError?'unsafe_parent':'read_failed';
const idFor=rel=>hash(rel).slice(0,32);
function recordSources(db,id,result) {
  db.transaction(()=>{
    db.prepare('DELETE FROM evidence WHERE scan=? AND source<>\'symlink\'').run(id);
    const insert=db.prepare('INSERT OR REPLACE INTO evidence VALUES(?,?,?,?,?,?,?,?,?,?)');
    for(const e of result.edges)insert.run(id,hash(JSON.stringify([e.source,e.from,e.to,e.relation])),e.source,e.status,e.at,e.from,e.to,e.relation,e.reason,VERSION);
    db.prepare('UPDATE scans SET source_json=?,task_json=?,dependency_complete=0 WHERE id=?').run(JSON.stringify(result.sources),JSON.stringify(result.tasks),id);
  })();
}
export async function runInventory(config,id,options={}) {
  safeParents(config.accountRoot);
  const db=openStore(config,true);const started=Date.now();let batch=[],closed=false,sourceEdges=[],claimed=false;
  const put=db.prepare(`INSERT INTO entries(scan,id,rel,parent,name,type,size,mtime,ctime,dev,ino,nlink,blocks,status,role,protected,reason,issue,target,seen) VALUES(@scan,@id,@rel,@parent,@name,@type,@size,@mtime,@ctime,@dev,@ino,@nlink,@blocks,@status,@role,@protected,@reason,@issue,@target,@seen) ON CONFLICT(scan,rel) DO UPDATE SET type=excluded.type,size=excluded.size,mtime=excluded.mtime,ctime=excluded.ctime,dev=excluded.dev,ino=excluded.ino,nlink=excluded.nlink,blocks=excluded.blocks,status=excluded.status,role=excluded.role,protected=excluded.protected,reason=excluded.reason,issue=excluded.issue,target=excluded.target,seen=excluded.seen`);
  const previous=db.prepare('SELECT type,size,mtime,dev,ino,issue FROM entries WHERE scan=? AND rel=?');
  const flush=()=>{
    if(!batch.length)return 0;
    let files=0,dirs=0,bytes=0,work=0;
    db.transaction(()=>{for(const row of batch){const old=previous.get(id,row.rel);const changed=!old||old.type!==row.type||old.size!==row.size||old.mtime!==row.mtime||old.ino!==row.ino||old.dev!==row.dev;
      if(changed)work++;
      if(old&&old.type==='file'&&changed&&!row.issue){row.issue='changed_during_scan';row.reason='Metadata file đổi giữa các batch/lần tiếp tục; cần quét mới.';}
      else if(old?.issue==='changed_during_scan'&&!row.issue){row.issue=old.issue;row.reason='Metadata file đã đổi trong cửa sổ quét; cần quét mới.';}
      files+=(row.type==='file'?1:0)-(old?.type==='file'?1:0);dirs+=(row.type==='directory'?1:0)-(old?.type==='directory'?1:0);bytes+=(row.type==='file'?row.size:0)-(old?.type==='file'?old.size:0);put.run(row);if(row.type==='directory'&&!row.issue)db.prepare('INSERT OR IGNORE INTO queue(scan,rel) VALUES(?,?)').run(id,row.rel);
      if(row.type==='link'&&row.target)db.prepare('INSERT OR REPLACE INTO evidence VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,hash(row.rel), 'symlink','available',now(),path.join(config.accountRoot,row.rel),row.target,'symlink_target',within(config.accountRoot,row.target)?'Đích trong tài khoản; không đi theo.':'Đích ngoài scope; protected, không cộng dung lượng.',VERSION);
      if(!row.protected || row.role.includes('backup') || row.role.includes('rollback')) {const name=row.name;if(row.type==='directory'&&/(backup|restore|migration-smoke)/i.test(name)&&!/^node_modules/i.test(name))db.prepare('INSERT OR IGNORE INTO backup_sets VALUES(?,?,?,?,?)').run(id,row.id,row.id,'unknown','Tên/vị trí thư mục; chưa chứng minh một bộ bất biến.');
        else if(row.type==='file'&&row.rel!==relativePath(config.accountRoot,config.dbPath)&&/(\.(?:sqlite|db|zip|tar|gz)$|db-backup.*\.json$)/i.test(name))db.prepare('INSERT OR IGNORE INTO backup_sets VALUES(?,?,?,?,?)').run(id,row.id,row.id,/\.(sqlite|db)$/i.test(name)?'sqlite':/\.json$/i.test(name)?'json':'archive','Chỉ tên/đuôi/vị trí; chưa kiểm tra format, restore hoặc đủ media/code.');}
    }
    db.prepare('UPDATE scans SET files=files+?,dirs=dirs+?,logical_bytes=logical_bytes+?,heartbeat=? WHERE id=?').run(files,dirs,bytes,now(),id);
    })();batch=[];return work;
  };
  const pause=(status,reason)=>{flush();db.prepare('UPDATE scans SET status=?,reason=?,heartbeat=?,pid=NULL,request=NULL WHERE id=?').run(status,reason,now(),id);audit(db,getScan(db,id).actor,'inventory.'+status,id,reason);};
  const checkpoint=()=>{
    const row=getScan(db,id);
    if(row.scope!==config.scope){pause('paused','Cấu hình scope đã đổi; cần quét mới.');return false;}
    if(row.request){pause(row.request==='cancel'?'cancelled':'paused','Người quản trị yêu cầu '+row.request+'.');return false;}
    if(Date.now()-started>=config.windowMs){pause('paused','Hết cửa sổ thời gian; có thể tiếp tục từ hàng chờ.');return false;}
    if(process.memoryUsage().rss>config.memoryBytes){pause('paused','Chạm ngân sách bộ nhớ mềm; giảm batch/nguồn hoặc điều chỉnh sau pilot.');return false;}
    if(!budget(config).allowed){pause('paused','Chạm ngân sách index/WAL hoặc free space; tăng ngân sách/dọn đúng phạm vi rồi tiếp tục.');return false;}
    return true;
  };
  try {
    const scan=getScan(db,id);
    if(!['queued','paused','interrupted','running','failed'].includes(scan.status))throw new MaintenanceError(409,'Tác vụ không thể chạy.');
    if(!scan.retained)throw new MaintenanceError(409,'Chi tiết job đã thu gọn; cần quét mới.');
    if(scan.scope!==config.scope)throw new MaintenanceError(409,'Scope đã đổi; cần quét mới.');
    if(scan.pid&&scan.pid!==process.pid&&alive(scan.pid))throw new MaintenanceError(409,'Executor khác đang giữ tác vụ.');
    db.transaction(()=>{const current=getScan(db,id);if(current.pid&&current.pid!==process.pid&&alive(current.pid))throw new MaintenanceError(409,'Executor khác đang giữ tác vụ.');db.prepare("UPDATE scans SET status='running',phase='sources',pid=?,heartbeat=?,reason=NULL WHERE id=?").run(process.pid,now(),id);claimed=true;})();
    const collected=await collectSources(config,options.adapters);sourceEdges=collected.edges;recordSources(db,id,collected);
    db.prepare("UPDATE scans SET phase='filesystem' WHERE id=?").run(id);
    db.prepare("UPDATE queue SET status='pending' WHERE scan=? AND status='running'").run(id);
    const rootStat=await metadataStat(config.accountRoot),c=classify(config,config.accountRoot,rootStat,'directory');
    put.run({scan:id,id:idFor(''),rel:'',parent:null,name:path.basename(config.accountRoot),type:'directory',size:0,mtime:rootStat.mtimeMs,ctime:rootStat.ctimeMs,dev:String(rootStat.dev),ino:String(rootStat.ino),nlink:rootStat.nlink,blocks:null,status:c.status,role:c.role,protected:1,reason:c.reason,issue:null,target:null,seen:''});
    db.prepare('INSERT OR IGNORE INTO queue(scan,rel) VALUES(?,\'\')').run(id);counts(db,id);
    while(true) {
      if(!checkpoint())return scanDTO(getScan(db,id));
      const next=db.prepare("SELECT * FROM queue WHERE scan=? AND status='pending' ORDER BY length(rel),rel LIMIT 1").get(id);
      if(!next)break;
      const dir=path.resolve(config.accountRoot,next.rel);if(!within(config.accountRoot,dir))throw new MaintenanceError(403,'Hàng chờ ngoài root.');
      const token=crypto.randomUUID();db.prepare("UPDATE queue SET status='running',token=? WHERE scan=? AND rel=?").run(token,id,next.rel);
      db.prepare('UPDATE scans SET current_path=?,heartbeat=? WHERE id=?').run(next.rel,now(),id);
      let handle,initial;
      try { safeParents(dir);initial=await metadataStat(dir);handle=await fs.opendir(dir); }
      catch(e){db.prepare('UPDATE entries SET issue=?,reason=? WHERE scan=? AND rel=?').run(issue(e),'Không đọc được thư mục; không coi dung lượng là 0.',id,next.rel);db.prepare("UPDATE queue SET status='done' WHERE scan=? AND rel=?").run(id,next.rel);continue;}
      let batchStart=Date.now(),stop=false;
      try {
        for await(const item of handle) {
          const absolute=path.join(dir,item.name),rel=relativePath(config.accountRoot,absolute);let s,target=null,problem=null,type='unknown';
          try {s=await (options.lstat||metadataStat)(absolute);type=s.isSymbolicLink()?'link':s.isDirectory()?'directory':s.isFile()?'file':'other';if(type==='link'){target=await fs.readlink(absolute);target=path.resolve(dir,target);problem='symlink_excluded';}}
          catch(e){problem=issue(e);}
          if(rel.length>8192){problem='path_limit';}
          const c=classify(config,absolute,s,type);
          if(['unknown','candidate'].includes(c.status)&&sourceEdges.some(e=>e.to===absolute&&e.status==='available'&&e.relation!=='backup_destination')){c.status='active';c.role='Phụ thuộc được cấu hình/quan sát';c.reason='Có cạnh phụ thuộc tại thời điểm quét; xem nguồn, không suy ra toàn bộ nội dung đang chạy.';}
          if(['','-wal','-shm','-journal'].some(suffix=>absolute===config.file+suffix)){type='metadata';problem='metadata_excluded';}
          batch.push({scan:id,id:idFor(rel),rel,parent:next.rel,name:item.name,type,size:type==='file'?s.size:0,mtime:s?.mtimeMs??null,ctime:s?.ctimeMs??null,dev:s?String(s.dev):null,ino:s?String(s.ino):null,nlink:s?.nlink??null,blocks:type==='file'&&process.platform==='linux'&&Number.isFinite(s.blocks)?s.blocks:null,status:problem&&!['symlink_excluded','metadata_excluded'].includes(problem)?'unknown':c.status,role:c.role,protected:1,reason:problem&&!['symlink_excluded','metadata_excluded'].includes(problem)?'Không đọc đầy đủ metadata; bảo vệ.':c.reason,issue:problem,target,seen:token});
          if(batch.length>=config.batchSize || Date.now()-batchStart>=config.batchMs) {
            safeParents(dir);const changed=flush();if(options.onBatch)await options.onBatch({id,relative:next.rel});
            if(!checkpoint()){stop=true;break;}await sleep(changed?config.delayMs:1);batchStart=Date.now();
          }
        }
      }catch(e){batch=[];db.prepare('UPDATE entries SET issue=?,reason=? WHERE scan=? AND rel=?').run(issue(e),'Thư mục đổi/lỗi giữa batch; cần xác minh lại.',id,next.rel);}
      finally{try{await handle.close();}catch(e){if(e.code!=='ERR_DIR_CLOSED')throw e;}}
      if(stop)return scanDTO(getScan(db,id));
      safeParents(dir);flush();
      // Revisited directory replaces its previous attempt without trusting readdir order or double counting.
      const stale=db.prepare('SELECT rel FROM entries WHERE scan=? AND parent=? AND seen<>?').all(id,next.rel,token);
      db.transaction(()=>{for(const row of stale){db.prepare('DELETE FROM entries WHERE scan=? AND (rel=? OR substr(rel,1,?)=?)').run(id,row.rel,row.rel.length+1,row.rel+'/');db.prepare('DELETE FROM queue WHERE scan=? AND (rel=? OR substr(rel,1,?)=?)').run(id,row.rel,row.rel.length+1,row.rel+'/');}
        db.prepare("UPDATE queue SET status='done' WHERE scan=? AND rel=?").run(id,next.rel);
      })();
      if(stale.length){counts(db,id);db.prepare('DELETE FROM backup_sets WHERE scan=? AND entry_id NOT IN (SELECT id FROM entries WHERE scan=?)').run(id,id);}
      const after=await metadataStat(dir);if(after.ino!==initial.ino||(dir!==config.stateRoot&&after.mtimeMs!==initial.mtimeMs))db.prepare('UPDATE entries SET issue=\'changed_during_scan\',reason=\'Thư mục thay đổi trong cửa sổ quét; cần quét lại.\' WHERE scan=? AND rel=?').run(id,next.rel);
    }
    if(!checkpoint())return scanDTO(getScan(db,id));
    const reserve=getScan(db,id).files*256+1048576;if(!budget(config,reserve).allowed){pause('paused','Thiếu ngân sách dự phòng cho tổng hợp/delta; báo cáo trước vẫn được giữ.');return scanDTO(getScan(db,id));}
    db.prepare("UPDATE scans SET phase='aggregate',heartbeat=? WHERE id=?").run(now(),id);finalize(db,config,id);return scanDTO(getScan(db,id));
  }catch(e) {
    if(claimed)try{flush();db.prepare("UPDATE scans SET status='failed',reason='Executor lỗi; báo cáo trước được giữ. Kiểm tra nguồn/quyền và tiếp tục có chủ đích.',pid=NULL,heartbeat=? WHERE id=?").run(now(),id);audit(db,getScan(db,id).actor,'inventory.failed',id);}catch{}
    throw e;
  }finally{if(!closed){db.close();closed=true;}}
}
export function createHostingInventory(config,options={}) {
  const read=fn=>{try{return withStore(config,false,fn);}catch(e){if(e.code==='ENOENT')return null;throw e;}};
  const contexts=new WeakMap();
  const describe=(db,scan,row)=>{
    let context=contexts.get(db);if(!context){const saved=db.prepare('SELECT * FROM evidence WHERE scan=? ORDER BY CASE WHEN source=\'symlink\' THEN 1 ELSE 0 END,source,id LIMIT 1001').all(scan.id),sources=scanDTO(scan).sources;
      const edges=saved.slice(0,1000).map(e=>({...e,status:sources.find(s=>s.id===e.source)?.status||e.status}));context=assessmentContext(config,scan,edges,saved.length>1000);contexts.set(db,context);}
    return assessEntry(context,entryDTO(row));
  };
  const page=(value,max=100)=>Math.max(1,Math.min(max,Number.isInteger(Number(value))?Number(value):1));
  const launch=id=>{
    if(options.launch)return options.launch(id);
    const worker=path.resolve(process.cwd(),'scripts/hosting-inventory-run.mjs'); safeParents(path.dirname(worker));
    const child=spawn(process.execPath,[worker,'--scan-id',id],{cwd:process.cwd(),env:process.env,stdio:'ignore',windowsHide:true});
    child.once('error',()=>{try{withStore(config,true,db=>db.prepare("UPDATE scans SET status='failed',pid=NULL,reason='Không khởi chạy được executor process.' WHERE id=?").run(id));}catch{}});child.unref();
    withStore(config,true,db=>db.prepare('UPDATE scans SET pid=? WHERE id=? AND status=\'queued\'').run(child.pid||null,id));
  };
  return {
    summary() {
      const result=config.enabled?read(db=>{
        const scans=db.prepare('SELECT * FROM scans ORDER BY started_at DESC LIMIT 120').all(),latest=scans.find(s=>s.retained===1);
        const budgetInfo=budget(config,0);
        const growth=[1,7,30].map(days=>{if(!latest?.fs_complete||latest.scope!==config.scope)return {days,bytes:null,reason:'Mốc hiện tại chưa đủ/cùng scope.'};const older=scans.find(s=>s.fs_complete&&s.scope===latest.scope&&Date.parse(s.started_at)<=Date.parse(latest.started_at)-days*86400000);return {days,bytes:older?latest.logical_bytes-older.logical_bytes:null,reason:older?'Hai mốc đầy đủ cùng scope.':'Chưa có mốc đủ '+days+' ngày.'};});
        return {latest:scanDTO(latest),scans:scans.slice(0,20).map(scanDTO),storage:budgetInfo,growth,audit:db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 50').all()};
      }):null;
      return {enabled:config.enabled,executor:config.executor?'process':'unconfigured',root:config.accountRoot,scope:config.scope,version:VERSION,timezone:config.timezone,readOnly:true,latest:null,scans:[],storage:null,growth:[],audit:[],...result};
    },
    start(actor,cli=false) {
      if(!config.executor&&!cli&&!options.launch)throw new MaintenanceError(503,'Chưa cấu hình executor. Bật process sau pilot hoặc dùng CLI inventory.');
      if(config.accountRoot===path.parse(config.accountRoot).root)throw new MaintenanceError(403,'Không kiểm kê gốc filesystem/máy chủ. Cần root tài khoản riêng.');
      safeParents(config.accountRoot);
      const id=crypto.randomUUID();withStore(config,true,db=>db.transaction(()=>{
        const current=db.prepare("SELECT * FROM scans WHERE status IN ('queued','running','paused') ORDER BY started_at DESC LIMIT 1").get();
        if(current&&['queued','running'].includes(scanDTO(current).status))throw new MaintenanceError(409,'Đang có tác vụ inventory.');
        if(current&&current.status==='paused')throw new MaintenanceError(409,'Có tác vụ tạm dừng; tiếp tục hoặc hủy trước khi quét mới.');
        const keep=db.prepare("SELECT id FROM scans WHERE status='completed' AND fs_complete=1 AND retained=1 ORDER BY started_at DESC LIMIT 1").get();
        for(const old of db.prepare('SELECT id FROM scans WHERE retained=1 AND status NOT IN (\'running\',\'queued\')').all())if(old.id!==keep?.id){for(const table of ['entries','queue','evidence','deltas','backup_sets'])db.prepare('DELETE FROM '+table+' WHERE scan=?').run(old.id);db.prepare('UPDATE scans SET retained=0 WHERE id=?').run(old.id);}
        db.prepare('INSERT INTO scans(id,scope,root,version,actor,status,phase,started_at,heartbeat) VALUES(?,?,?,?,?,\'queued\',\'queued\',?,?)').run(id,config.scope,config.accountRoot,VERSION,actor,now(),now());audit(db,actor,'inventory.requested',id);
      })());if(!cli)launch(id);return {id,accepted:true};
    },
    control(actor,id,action) {
      if(!['pause','resume','cancel'].includes(action))throw new MaintenanceError(400,'Control không hợp lệ.');
      withStore(config,true,db=>db.transaction(()=>{const row=getScan(db,id),s=scanDTO(row);
        if(!row.retained)throw new MaintenanceError(409,'Chi tiết job đã thu gọn; cần quét mới.');
        if(row.scope!==config.scope&&action!=='cancel')throw new MaintenanceError(409,'Scope đã đổi; hủy job cũ rồi quét mới.');
        if(['completed','cancelled'].includes(s.status))throw new MaintenanceError(409,'Tác vụ đã kết thúc.');
        if(action==='resume') {
          const others=db.prepare("SELECT * FROM scans WHERE id<>? AND status IN ('queued','running')").all(id);if(others.some(job=>['queued','running'].includes(scanDTO(job).status)))throw new MaintenanceError(409,'Executor khác đang chạy job inventory.');
          if(!['paused','interrupted','failed'].includes(s.status))throw new MaintenanceError(409,'Chỉ tiếp tục tác vụ đã dừng.');
          if(!config.executor&&!options.launch)throw new MaintenanceError(503,'Executor chưa cấu hình; dùng CLI --scan-id.');
          db.prepare("UPDATE scans SET status='queued',pid=NULL,request=NULL,heartbeat=?,reason=NULL WHERE id=?").run(now(),id);
        }else if(['running','queued'].includes(s.status))db.prepare('UPDATE scans SET request=? WHERE id=?').run(action,id);
        else db.prepare('UPDATE scans SET status=?,request=NULL,pid=NULL,reason=? WHERE id=?').run(action==='cancel'?'cancelled':'paused','Yêu cầu quản trị.',id);
        audit(db,actor,'inventory.'+action+'-requested',id);
      })());if(action==='resume')launch(id);return {accepted:true};
    },
    tree(id,parentId='',query={}) {return read(db=>{
      const scan=getScan(db,id);if(!scan.retained)throw new MaintenanceError(410,'Chi tiết mốc đã được thu gọn; chỉ còn tổng hợp.');
      let parent='';if(parentId){const row=db.prepare('SELECT rel,type FROM entries WHERE scan=? AND id=?').get(id,parentId);if(!row||row.type!=='directory')throw new MaintenanceError(404,'Không có thư mục.');parent=row.rel;}
      const p=page(query.page,100000),limit=50,filter=typeof query.filter==='string'?query.filter.slice(0,200):'',status=['protected','active','unknown','candidate','verified'].includes(query.status)?query.status:'';
      const sort=query.sort==='name'?'type DESC,name COLLATE NOCASE':'bytes DESC,size DESC,name COLLATE NOCASE';
      const args=[id,parent,'%'+filter+'%',status,status,Math.max(0,Number(query.minBytes)||0)];
      const role=typeof query.role==='string'?query.role.slice(0,100):'';args.push(role,role);
      const where='scan=? AND parent=? AND name LIKE ? AND (?=\'\' OR status=?) AND max(bytes,size)>=? AND (?=\'\' OR role=?)';
      const n=db.prepare('SELECT COUNT(*) n FROM entries WHERE '+where).get(...args).n;
      const items=db.prepare('SELECT * FROM entries WHERE '+where+' ORDER BY '+sort+' LIMIT ? OFFSET ?').all(...args,limit,(p-1)*limit).map(e=>describe(db,scan,e));
      const crumbs=[{id:idFor(''),name:'Tài khoản',relative:''}];let current='';for(const part of parent.split('/').filter(Boolean)){current=current?current+'/'+part:part;crumbs.push({id:idFor(current),name:part,relative:current});}
      return {items,page:p,pages:Math.max(1,Math.ceil(n/limit)),total:n,breadcrumbs:crumbs,partial:!scan.fs_complete,roles:db.prepare('SELECT DISTINCT role FROM entries WHERE scan=? AND parent=? ORDER BY role').all(id,parent).map(r=>r.role)};
    });},
    evidence(id,entryId,query={}) {return read(db=>{
      getScan(db,id);const e=db.prepare('SELECT * FROM entries WHERE scan=? AND id=?').get(id,entryId);if(!e)throw new MaintenanceError(404,'Không có đối tượng.');
      const absolute=path.join(config.accountRoot,e.rel),p=page(query.page,10000);
      const where='scan=? AND (from_node=? OR to_node=? OR substr(to_node,1,?)=? OR substr(?,1,length(to_node)+1)=to_node||?)';
      const args=[id,absolute,absolute,absolute.length+1,absolute+path.sep,absolute,path.sep];
      const edges=db.prepare('SELECT * FROM evidence WHERE '+where+' ORDER BY source,to_node LIMIT 50 OFFSET ?').all(...args,(p-1)*50),n=db.prepare('SELECT COUNT(*) n FROM evidence WHERE '+where).get(...args).n;
      return {entry:describe(db,getScan(db,id),e),edges,page:p,pages:Math.max(1,Math.ceil(n/50)),total:n,at:getScan(db,id).heartbeat,sources:scanDTO(getScan(db,id)).sources.map(s=>getScan(db,id).scope!==config.scope&&s.status==='available'?{...s,status:'stale',reason:'Scope cấu hình đã đổi; cần quét mới.'}:s),scopeChanged:getScan(db,id).scope!==config.scope};
    });},
    async reverify(actor,id,entryId) {
      const scan=read(db=>getScan(db,id));if(!scan||scan.scope!==config.scope)throw new MaintenanceError(409,'Scope đã đổi; quét lại.');
      if(['running','queued'].includes(scanDTO(scan).status))throw new MaintenanceError(409,'Đợi collector dừng trước khi xác minh lại nguồn.');
      const entry=read(db=>db.prepare('SELECT * FROM entries WHERE scan=? AND id=?').get(id,entryId));if(!entry)throw new MaintenanceError(404,'Không có đối tượng.');
      const target=path.join(config.accountRoot,entry.rel);safeParents(path.dirname(target));
      let s;try{s=await metadataStat(target);}catch(e){throw new MaintenanceError(409,'Đối tượng đã biến mất/không đọc được; cần quét mới.');}
      if(String(s.ino)!==entry.ino||s.mtimeMs!==entry.mtime||s.size!==entry.size&&entry.type==='file')throw new MaintenanceError(409,'Đối tượng đã đổi; cần quét mới, không cấp quyền xóa.');
      const result=await collectSources(config,options.adapters);withStore(config,true,db=>{recordSources(db,id,result);audit(db,actor,'inventory.sources-reverified',id,entry.rel);});return {verifiedAt:now(),deleteAllowed:false};
    },
    backups(id,query={}) {return read(db=>{getScan(db,id);const p=page(query.page,100000),total=db.prepare('SELECT COUNT(*) n FROM backup_sets WHERE scan=?').get(id).n;
      return {page:p,pages:Math.max(1,Math.ceil(total/50)),total,items:db.prepare('SELECT b.*,e.* FROM backup_sets b JOIN entries e ON e.scan=b.scan AND e.id=b.entry_id WHERE b.scan=? ORDER BY max(e.bytes,e.size) DESC LIMIT 50 OFFSET ?').all(id,(p-1)*50).map(e=>({...describe(db,getScan(db,id),e),kind:e.kind,recognition:e.recognition,membership:'observed',formatCheck:'unverified',restoreCheck:'unverified',offHost:'unverified',mayBeWriting:Date.now()-e.mtime<60000,deleteAllowed:false}))};});},
    deltas(id,query={}) {return read(db=>{const scan=getScan(db,id),p=page(query.page,100000),total=db.prepare('SELECT COUNT(*) n FROM deltas WHERE scan=?').get(id).n;
      return {page:p,pages:Math.max(1,Math.ceil(total/50)),total,comparable:Boolean(scan.baseline&&scan.fs_complete),baseline:scan.baseline,items:db.prepare('SELECT * FROM deltas WHERE scan=? ORDER BY abs(COALESCE(after_bytes,0)-COALESCE(before_bytes,0)) DESC LIMIT 50 OFFSET ?').all(id,(p-1)*50)};});},
  };
}