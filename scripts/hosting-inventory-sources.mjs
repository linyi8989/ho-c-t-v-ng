import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import Database from 'better-sqlite3';
import { hash, within, safeParents, VERSION } from './hosting-inventory-store.mjs';
const exec=promisify(execFile);
const cleanPath=value=>typeof value==='string' && value.length<4096 && !/[\x00-\x1f\x7f]/.test(value)?value:null;
const errorStatus=e=>['EACCES','EPERM'].includes(e.code)?'permission_denied':e.code==='ENOENT'?'unsupported':'failed';
export async function readConfigFile(file,max=131072) {
  safeParents(path.dirname(file));
  const handle=await fs.open(file,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
  try { const s=await handle.stat();if(!s.isFile()||s.nlink!==1||s.size>max)throw Object.assign(new Error('Unsafe configuration'),{code:'EACCES'});return await handle.readFile('utf8'); }
  finally{await handle.close();}
}
export function parsePassenger(text,root) {
  const edges=[];
  const appMatch=text.match(/^\s*PassengerAppRoot\s+(?:"([^"\r\n]+)"|([^\s#]+))\s*(?:#.*)?$/im);
  const configuredRoot=appMatch&&cleanPath(appMatch[1]||appMatch[2])?path.resolve(root,appMatch[1]||appMatch[2]):root;
  for(const line of text.split(/\r?\n/)) {
    const match=line.match(/^\s*(PassengerAppRoot|PassengerNodejs|PassengerStartupFile)\s+(?:"([^"\r\n]+)"|([^\s#]+))\s*(?:#.*)?$/i);
    if(!match)continue;const value=cleanPath(match[2]||match[3]);if(!value)continue;
    const startup=match[1].toLowerCase()==='passengerstartupfile';
    edges.push({from:startup?configuredRoot:root,to:path.resolve(startup?configuredRoot:root,value),relation:match[1],reason:'Chỉ trường Passenger allowlist; không thu thập SetEnv.'});
  }
  return edges;
}
export function parseDomains(result) {
  if(result?.status!==1||!result.data||typeof result.data!=='object')throw new Error('Unsupported domain schema');
  const data=result.data,rows=[data.main_domain,...Object.values(data.addon_domains||{}),...Object.values(data.sub_domains||{})].flat().filter(Boolean),edges=[];
  for(const row of rows) {
    const domain=typeof row.domain==='string'&&/^[a-z0-9._-]{1,253}$/i.test(row.domain)?row.domain:null;
    const target=cleanPath(row.documentroot);
    if(domain&&target&&path.isAbsolute(target))edges.push({from:'domain:'+domain,to:target,relation:'document_root',reason:'cPanel DomainInfo/domains_data.'});
  }
  if(!edges.length)throw new Error('Unsupported/empty domain schema');return edges;
}
export function parseNodeSelector(value,config) {
  if(value?.result!=='success'||!value.available_versions||typeof value.available_versions!=='object')throw new Error('Unsupported selector schema');
  const edges=[];let recognized=false;
  for(const [version,data] of Object.entries(value.available_versions)) {
    if(!/^[0-9.]{1,20}$/.test(version))continue;
    for(const [user,info] of Object.entries(data.users||{})) {
      if(config.quotaUser && user!==config.quotaUser)continue;
      if(path.resolve(info.homedir||'/invalid')!==config.accountRoot)continue;
      if(!info.applications||typeof info.applications!=='object')continue;recognized=true;
      for(const [relative,app] of Object.entries(info.applications)) {
        const r=cleanPath(relative);if(!r)continue;const appRoot=path.resolve(config.accountRoot,r);if(!within(config.accountRoot,appRoot))continue;
        edges.push({from:'node-selector:'+version,to:appRoot,relation:'application_root',reason:'CloudLinux app được đăng ký; không suy ra trạng thái chạy từ tên.'});
        const start=cleanPath(app.startup_file);if(start)edges.push({from:appRoot,to:path.resolve(appRoot,start),relation:'startup',reason:'CloudLinux startup_file.'});
        edges.push({from:appRoot,to:path.join(config.accountRoot,'nodevenv',path.relative(config.accountRoot,appRoot),version),relation:'runtime_layout',reason:'Đường dẫn runtime theo layout CloudLinux; cần symlink/process đối chiếu.'});
        if(typeof app.domain==='string'&&/^[a-z0-9._-]+$/i.test(app.domain))edges.push({from:'domain:'+app.domain,to:appRoot,relation:'registered_app',reason:'CloudLinux domain mapping.'});
      }
    }
  }
  if(!recognized)throw new Error('User application schema absent');return edges;
}
export async function cpanelDomains(config) {
  if(!config.quotaHost||!config.quotaUser||!config.quotaToken)return {status:'unconfigured',reason:'Chưa cấu hình API cPanel ở server.',edges:[]};
  const url=new URL(config.quotaHost.startsWith('https://')?config.quotaHost:'https://'+config.quotaHost);
  if(url.protocol!=='https:'||url.username||url.password)throw new Error('Invalid cPanel endpoint');
  url.pathname='/execute/DomainInfo/domains_data';url.search='?format=hash';
  const res=await fetch(url,{headers:{Authorization:'cpanel '+config.quotaUser+':'+config.quotaToken},signal:AbortSignal.timeout(config.sourceTimeoutMs),redirect:'error'});
  if([401,403].includes(res.status))return {status:'permission_denied',reason:'API từ chối quyền xem domain.',edges:[]};
  if(!res.ok)throw new Error('cPanel response failure');
  if(Number(res.headers.get('content-length')||0)>1048576)throw new Error('Response too large');
  const reader=res.body.getReader();let bytes=0;const chunks=[];
  try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>1048576)throw new Error('Response too large');chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
  return {status:'available',reason:'DomainInfo đã trả schema nhận diện được.',edges:parseDomains(JSON.parse(Buffer.concat(chunks).toString()).result)};
}
export async function collectSources(config,adapters={}) {
  const sources=[],edges=[],tasks=[],at=new Date().toISOString();
  const source=async(id,label,collect)=>{
    let result;try{result=await collect();}catch(e){result={status:errorStatus(e),reason:'Không đọc được nguồn hoặc schema chưa hỗ trợ; không suy ra không dùng.',edges:[]};}
    const allowed=['available','unconfigured','permission_denied','unsupported','partial','failed','stale'];
    if(!allowed.includes(result.status))result={status:'failed',reason:'Trạng thái nguồn không hợp lệ.',edges:[]};
    sources.push({id,label,status:result.status,reason:result.reason,at,version:VERSION});
    for(const edge of result.edges||[])if(cleanPath(edge.from)&&cleanPath(edge.to))edges.push({...edge,source:id,status:result.status,at,version:VERSION});
    tasks.push(...(result.tasks||[]));return result;
  };
  await source('app-config','Đường dẫn ứng dụng',async()=>({status:'available',reason:'Đường dẫn resolved từ allowlist cấu hình server.',edges:[
    ...['deployRoot','dataRoot','dbPath','audioRoot','listeningRoot','vocabRoot','speakingRoot','stateRoot'].map(key=>({from:'application:vhomework',to:config[key],relation:key,reason:'Cấu hình server đã nạp; không đọc .env.'})),
    {from:'process:inventory',to:process.execPath,relation:'runtime',reason:'Runtime thực thi collector.'},
    ...config.backupRoots.map(to=>({from:'application:vhomework',to,relation:'backup_destination',reason:'Đích backup cấu hình; bản sẵn có cần kiểm kê riêng.'}))]}));
  await source('domains','Domain cPanel',()=>adapters.domains?adapters.domains(config):cpanelDomains(config));
  await source('node-selector','CloudLinux Node.js Selector',async()=>{
    if(adapters.nodeSelector)return adapters.nodeSelector(config);
    if(!config.nodeDiscovery)return {status:'unconfigured',reason:'Discovery chỉ chạy khi opt-in ở server.',edges:[]};
    if(process.platform!=='linux')return {status:'unsupported',reason:'CLI CloudLinux cần host Linux.',edges:[]};
    const args=['get','--json','--interpreter','nodejs'];if(config.quotaUser)args.push('--user',config.quotaUser);
    const result=await exec('/usr/bin/cloudlinux-selector',args,{timeout:config.sourceTimeoutMs,maxBuffer:1048576,windowsHide:true});
    return {status:'available',reason:'Chỉ CLI get; trạng thái recovery/migration chưa có adapter.',edges:parseNodeSelector(JSON.parse(result.stdout),config)};
  });
  await source('passenger','Passenger / startup',async()=>{
    const roots=new Set([config.deployRoot,...edges.filter(e=>e.relation==='document_root'||e.relation==='application_root').map(e=>e.to)]);const found=[];let errors=0;
    for(const root of roots){if(!within(config.accountRoot,root))continue;try{found.push(...parsePassenger(await readConfigFile(path.join(root,'.htaccess')),root));}catch(e){if(e.code!=='ENOENT')errors++;}}
    try{const text=await readConfigFile(path.join(config.deployRoot,'app.js'),32768);for(const m of text.matchAll(/(?:require\(|(?:from|import)\s+)['"](\.\.?\/[^'"\r\n]{1,256})['"]/g))found.push({from:path.join(config.deployRoot,'app.js'),to:path.resolve(config.deployRoot,m[1]),relation:'startup_import',reason:'Import tĩnh được nhận diện; không thực thi file.'});}catch(e){if(e.code!=='ENOENT')errors++;}
    return {status:errors?'partial':found.length?'available':'unconfigured',reason:found.length?'Đọc trường allowlist, không sửa cấu hình.':'Chưa có cấu hình Passenger/startup đọc được.',edges:found};
  });
  await source('git-deploy','Git và cấu hình deploy',async()=>{
    const found=[];let errors=0;
    try{const text=await readConfigFile(path.join(config.deployRoot,'.cpanel.yml'));for(const m of text.matchAll(/DEPLOYPATH\s*=\s*["']?(\/[a-zA-Z0-9_./-]+)/g))found.push({from:path.join(config.deployRoot,'.cpanel.yml'),to:m[1],relation:'configured_deploy_target',reason:'Cấu hình pipeline; chưa chứng minh đã triển khai.'});}catch(e){if(e.code!=='ENOENT')errors++;}
    try{const text=await readConfigFile(path.join(config.deployRoot,'.git','HEAD'),1024);if(/^(?:ref: refs\/[a-zA-Z0-9_./-]+|[a-f0-9]{40,64})\s*$/.test(text))found.push({from:config.deployRoot,to:path.join(config.deployRoot,'.git'),relation:'git_metadata',reason:'Repository metadata tồn tại; không chạy Git/hook, không thu remote credential.'});}catch(e){if(e.code!=='ENOENT')errors++;}
    for(const file of ['release-manifest.json','dist/client/release-manifest.json'])try{const text=await readConfigFile(path.join(config.deployRoot,file));const value=JSON.parse(text);if(value&&typeof value==='object')found.push({from:path.join(config.deployRoot,file),to:config.deployRoot,relation:'release_manifest',reason:'Manifest tồn tại; cleanup asset vẫn theo verifier cũ.'});}catch(e){if(e.code!=='ENOENT')errors++;}
    return {status:errors?'partial':found.length?'available':'unconfigured',reason:'Chỉ quan sát metadata deploy; thiếu lịch sử thực thi thì chưa xác minh.',edges:found};
  });
  await source('cron','Lịch cron',async()=>{
    if(adapters.cron)return adapters.cron(config);
    if(!config.cronDiscovery)return {status:'unconfigured',reason:'Chưa bật đọc crontab ở server.',edges:[]};
    if(process.platform!=='linux')return {status:'unsupported',reason:'Local không có crontab Linux.',edges:[]};
    const {stdout}=await exec('/usr/bin/crontab',['-l'],{timeout:config.sourceTimeoutMs,maxBuffer:131072,windowsHide:true});const found=[],registry=[];
    for(const line of stdout.split(/\r?\n/)){const match=line.match(/^\s*((?:\S+\s+){4}\S+)\s+(.+)$/);if(!match||line.trim().startsWith('#')||!/^[-*,/0-9A-Za-z ]+$/.test(match[1]))continue;
      const id=hash(line);registry.push({id:'cron:'+id,task:'Cron quan sát',source:'cron',executor:'system scheduler',configuration:'observed',schedule:match[1],timezone:'Chưa xác minh CRON_TZ',execution:'unverified',at,reason:'Lệnh được ẩn; lịch không chứng minh đã chạy.'});
      for(const m of match[2].matchAll(/(?:^|\s)(\/[a-zA-Z0-9_./-]+\.(?:mjs|js|cjs|sh|php))(?=\s|$)/g))if(within(config.accountRoot,m[1]))found.push({from:'cron:'+id,to:m[1],relation:'configured_script',reason:'Đường dẫn script allowlist trong crontab; không chạy lệnh.'});
    }
    return {status:'available',reason:'Chỉ đọc lịch user; cron provider có thể ngoài quyền quan sát.',edges:found,tasks:registry};
  });
  await source('services','Vùng hệ thống và dịch vụ',async()=>({status:'partial',reason:'Nhận diện policy vùng dịch vụ; chưa có metadata provider/backup service.',edges:['mail','ssl','etc','.cpanel','.cagefs','.ssh','nodevenv','public_html','repositories','app-data'].map(name=>({from:'account-services',to:path.join(config.accountRoot,name),relation:'protected_zone',reason:'Policy bảo vệ; không kết luận còn dùng chỉ vì tên.'}))}));
  await source('processes','Tiến trình thuộc tài khoản',async()=>{
    if(adapters.processes)return adapters.processes(config);
    if(!config.processDiscovery)return {status:'unconfigured',reason:'Chưa bật process metadata discovery.',edges:[]};
    if(process.platform!=='linux'||!process.getuid)return {status:'unsupported',reason:'Collector chỉ hỗ trợ metadata /proc Linux.',edges:[]};
    const list=(await fs.readdir('/proc')).filter(n=>/^\d+$/.test(n)),found=[];let denied=0;
    for(const pid of list.slice(0,500))try{const s=await fs.stat('/proc/'+pid);if(s.uid!==process.getuid())continue;const cwd=await fs.readlink('/proc/'+pid+'/cwd');if(within(config.accountRoot,cwd))found.push({from:'process:'+pid,to:cwd,relation:'observed_cwd',reason:'CWD quan sát của process cùng UID; không đọc argv/environment.'});}catch(e){if(['EACCES','EPERM'].includes(e.code))denied++;}
    return {status:denied||list.length>500?'partial':'available',reason:'Không thấy process không chứng minh thư mục vô dụng.',edges:found};
  });
  await source('speaking','Worker Speaking',async()=>{
    const db=new Database(config.dbPath,{readonly:true,fileMustExist:true});try{
      const rows=db.prepare('SELECT status,COUNT(*) count FROM speaking_jobs GROUP BY status').all();
      return {status:'available',reason:'Chỉ aggregate bảng job; không gọi provider.',edges:[],tasks:[{id:'speaking-worker',task:'Chấm Speaking',source:'speaking_jobs',executor:'worker ứng dụng',configuration:'observed',schedule:'Theo hàng chờ',timezone:config.timezone,execution:'observed',at,counts:rows,reason:'Trạng thái lưu trong DB; chưa có heartbeat của worker trong inventory.'}]};
    }finally{db.close();}
  });
  tasks.unshift({id:'hosting-inventory',task:'Quét toàn tài khoản',source:'inventory',executor:config.executor?'process riêng':'CLI thủ công',configuration:config.executor?'configured':'manual',schedule:'Thủ công; chưa đăng ký cron',timezone:config.timezone,execution:'verified',at,reason:'Tiến độ/heartbeat từ executor inventory; không tự quét khi tải trang.'});
  return {sources,edges,tasks};
}
export function classify(config,absolute,stat,type) {
  const rel=path.relative(config.accountRoot,absolute),parts=rel.split(path.sep),top=parts[0]||'',name=path.basename(absolute);
  let status='unknown',role='Chưa xác định',protectedFlag=true,reason='Chưa có bằng chứng đủ về vai trò; V1 không cấp quyền xóa.';
  if(type==='link')return {status:'protected',role:'Liên kết phụ thuộc',protectedFlag:true,reason:'Chỉ ghi đích liên kết, không đi theo symlink.'};
  if(stat?.nlink>1&&type==='file')return {status:'protected',role:'Hardlink dùng chung',protectedFlag:true,reason:'Cùng inode có thể được dùng qua đường dẫn khác; không được xử lý.'};
  if(!rel||['nodevenv','public_html','mail','ssl','etc','repositories','app-data','.cpanel','.cagefs','.ssh','.pki','.cl.selector','.htpasswds','.caldav','.cphorde','.softaculous','.spamassassin','.subaccounts'].includes(top)) {
    status='protected';role='Vùng hệ thống/dữ liệu';reason='Policy bảo vệ tài khoản/dịch vụ/runtime; xử lý mục con cần xác minh riêng.';
  }
  if(within(config.dataRoot,absolute)){status=absolute===config.dataRoot?'active':'unknown';role='Dữ liệu ứng dụng';reason=absolute===config.dataRoot?'Data root được cấu hình và bảo vệ.':'Thuộc vùng dữ liệu; chưa chứng minh tham chiếu riêng từng file, không xóa DB/bài học/kết quả/media.';}
  if(within(config.deployRoot,absolute)){status=absolute===config.deployRoot?'active':'unknown';role='Code/triển khai';reason=absolute===config.deployRoot?'Deploy root được cấu hình; xem bằng chứng app/domain.':'Thuộc vùng triển khai; cần cạnh tham chiếu riêng để xác minh tác dụng từng file.';}
  for(const root of config.backupRoots)if(within(root,absolute)){status='candidate';role='Kho backup cấu hình';reason='Backup được nhận diện theo vị trí; cần xác minh bộ/thành phần trước khi xử lý.';if(root===absolute){status='protected';reason='Đích backup đang cấu hình; không xóa toàn thư mục.';}}
  if(/(?:backup|restore|migration-smoke|sqlite-check|preflight|\.previous$|\.zip$|\.tar(?:\.gz)?$)/i.test(name)&&status!=='protected'){status='candidate';role='Dấu hiệu backup/rollback';reason='Tên chỉ là đầu mối nhận diện; chưa biết bộ có đầy đủ hoặc đang dùng.';}
  if(['.npm','.cache','.trash','tmp','deploy-staging'].includes(top)&&status==='unknown'){status='candidate';role=top==='deploy-staging'?'Staging chưa xác minh':'Cache/tạm theo tên';reason='Cần đối chiếu writer/pipeline/policy; tuổi và tên không cấp quyền xóa.';}
  if(/^node_modules.*backup/i.test(top)){status='unknown';role='Dependency phục hồi chưa rõ';reason='Có thể phục vụ migration/recovery CloudLinux; thiếu bằng chứng trạng thái nên bảo vệ.';}
  if(['.env','.user.ini','php.ini','.htaccess','package.json','package-lock.json'].includes(name)||/^id_(rsa|ed25519)|\.(key|pem)$/.test(name)||[config.dbPath,config.dbPath+'-wal',config.dbPath+'-shm'].includes(absolute)){status='protected';role='Cấu hình/bí mật hoặc DB đang chạy';reason='Chỉ stat; không đọc .env/key, không cấp quyền xử lý.';}
  if(within(config.stateRoot,absolute)){status='protected';role='Metadata quản trị';reason='Metadata quản trị được kiểm kê; chỉ index/WAL đang ghi có số đo riêng và không sinh cảnh báo tự tham chiếu.';}
  return {status,role,protectedFlag,reason};
}