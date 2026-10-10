import path from 'node:path';
import { within } from './hosting-inventory-store.mjs';

const fresh = value => Number.isFinite(Date.parse(value)) && Date.now()-Date.parse(value)<86400000 && Date.parse(value)<=Date.now()+60000;
const usable = edge => ['available','partial'].includes(edge.status) && fresh(edge.at);
const actualPath = value => typeof value==='string' && path.isAbsolute(value) ? path.resolve(value) : null;
const topName = (config,absolute) => path.relative(config.accountRoot,absolute).split(path.sep)[0];
const systemZones = new Set(['mail','ssl','etc','.cpanel','.cagefs','.ssh','.pki','.cl.selector','.htpasswds','.caldav','.cphorde','.softaculous','.spamassassin','.subaccounts']);

export function assessmentContext(config,scan,edges,truncated=false) {
  const projects=[];
  const add=(root,label,kind,source)=>{if(!root||!within(config.accountRoot,root))return;let project=projects.find(p=>p.root===root);if(!project){project={root,label,kind,source,domains:[]};projects.push(project);}return project;};
  add(config.deployRoot,'Ứng dụng Tiếng Anh','this_app','app-config');
  if(config.dataRoot!==config.accountRoot)add(config.dataRoot,'Dữ liệu ứng dụng Tiếng Anh','this_app','app-config');
  for(const root of [config.dbPath,config.audioRoot,config.listeningRoot,config.vocabRoot,config.speakingRoot,config.stateRoot,...config.backupRoots])add(root,'Dữ liệu ứng dụng Tiếng Anh','this_app','app-config');
  const valid=edges.filter(usable),runtime=[];
  for(const edge of valid){const target=actualPath(edge.to_node);if(!target)continue;
    if(['document_root','application_root','registered_app','PassengerAppRoot'].includes(edge.relation)){
      const own=within(config.deployRoot,target),domain=edge.from_node.startsWith('domain:')?edge.from_node.slice(7):null;
      const project=add(target,own?'Ứng dụng Tiếng Anh':domain?'Domain '+domain:'Ứng dụng khác: '+path.basename(target),own?'this_app':'other_project',edge.source);
      if(project&&domain&&!project.domains.includes(domain))project.domains.push(domain);
    }
  }
  for(const edge of valid){const target=actualPath(edge.to_node),from=actualPath(edge.from_node);if(!target||!from||!within(config.accountRoot,target))continue;
    if(['runtime_layout','PassengerNodejs','symlink_target'].includes(edge.relation)){
      const owner=projects.filter(p=>within(p.root,from)).sort((a,b)=>b.root.length-a.root.length)[0];
      if(owner&&(edge.relation!=='symlink_target'||topName(config,target)==='nodevenv'||path.basename(from)==='node_modules'))runtime.push({root:target,label:owner.label,domains:owner.domains,source:edge.source});
    }
  }
  return {config,scan,projects,runtime,edges:valid,truncated,scopeChanged:scan.scope!==config.scope,stale:!fresh(scan.heartbeat||scan.started_at)};
}

function association(context,entry,absolute) {
  const {config,projects,runtime}=context,top=topName(config,absolute);
  if(absolute===config.accountRoot)return {kind:'mixed',label:'Toàn tài khoản / nhiều vai trò',basis:'configured',owners:[],reason:'Chứa ứng dụng, dịch vụ và các vùng chưa nhận diện; chỉ xét từng mục con.'};
  const parts=path.relative(config.accountRoot,absolute).split(path.sep);
  if(parts.includes('node_modules'))return {kind:'runtime',label:'Dependency cài đặt / phục hồi',basis:'policy',owners:[],reason:'Thành phần package/runtime; chưa có bằng chứng để dọn qua dashboard.'};
  if(parts.includes('.git')||top==='repositories')return {kind:'hosting_service',label:'Repository / metadata Git',basis:'policy',owners:[],reason:'Mã nguồn, lịch sử và metadata triển khai cần giữ; không xóa để dọn file ứng dụng.'};
  const runtimeOwners=runtime.filter(p=>within(p.root,absolute)||entry.type==='directory'&&within(absolute,p.root));
  if(runtimeOwners.length)return {kind:'runtime',label:'Môi trường chạy / dependency',basis:'observed',owners:[...new Set(runtimeOwners.flatMap(p=>p.domains.length?p.domains:[p.label]))],reason:'Có quan hệ runtime hoặc symlink được quan sát; không đi theo liên kết khi quét.'};
  if(top==='nodevenv'||/^node_modules.*backup/i.test(top))return {kind:'runtime',label:top==='nodevenv'?'Môi trường Node.js':'Dependency phục hồi',basis:'policy',owners:[],reason:'Vùng runtime/recovery cần giữ; chưa đủ nguồn để gán cho một ứng dụng cụ thể.'};
  if(systemZones.has(top))return {kind:'hosting_service',label:'Dịch vụ / hệ thống hosting',basis:'policy',owners:[],reason:'Vùng cPanel, email, SSL hoặc cấu hình dịch vụ; không phải rác của ứng dụng.'};
  const matches=projects.filter(p=>within(p.root,absolute)).sort((a,b)=>b.root.length-a.root.length),chosen=matches[0];
  const descendants=entry.type==='directory'?projects.filter(p=>within(absolute,p.root)&&p.root!==absolute):[];
  const kinds=new Set([...matches.slice(0,1),...descendants].map(p=>p.kind));
  if(kinds.size>1)return {kind:'mixed',label:'Thư mục dùng chung / nhiều dự án',basis:'observed',owners:[...new Set([...matches.slice(0,1),...descendants].flatMap(p=>p.domains.length?p.domains:[p.label]))],reason:'Chứa các vùng có chủ sở hữu/vai trò khác nhau; phải xét từng mục con.'};
  if(chosen)return {kind:chosen.kind,label:chosen.label,basis:chosen.source==='app-config'?'configured':'observed',owners:chosen.domains,reason:'Gán phạm vi từ cấu hình/document root; vị trí không chứng minh từng file còn được sử dụng.'};
  if(descendants.length)return {kind:'mixed',label:'Thư mục chứa dữ liệu dự án',basis:'configured',owners:[...new Set(descendants.flatMap(p=>p.domains.length?p.domains:[p.label]))],reason:'Chứa vùng dự án đã nhận diện và các mục chưa rõ; không dọn cả cây.'};
  if(['.npm','.cache','.trash','tmp'].includes(top))return {kind:'hosting_service',label:'Cache / file tạm của tài khoản',basis:'hint',owners:[],reason:'Nhận diện theo vùng; chưa xác minh writer, dịch vụ hoặc chính sách dọn.'};
  return {kind:'unknown',label:'Chưa xác định dự án / dịch vụ',basis:'unknown',owners:[],reason:/\.[a-z]{2,}$/i.test(top)?'Tên giống domain nhưng chưa có document root/API chứng minh.':'Thiếu cấu hình hoặc quan hệ để xác định ai đang dùng.'};
}

export function assessEntry(context,entry) {
  const absolute=path.resolve(context.config.accountRoot,entry.relative),owner=association(context,entry,absolute);
  const decision=(category,reason,nextSteps)=>({...entry,association:owner,cleanup:{category,reason,nextSteps,action:'inspect',deleteAllowed:false,current:!context.scopeChanged&&!context.stale&&!entry.issue}});
  if(!within(context.config.accountRoot,absolute)||context.scopeChanged||context.stale||entry.issue)return decision('unverified','Báo cáo/đối tượng chưa đủ mới hoặc đọc chưa đầy đủ.',['Quét lại đúng phạm vi và xử lý lỗi quyền/file thay đổi trước khi xét dọn.']);
  const referenced=context.edges.some(e=>e.to_node===absolute&&e.relation!=='protected_zone'&&e.relation!=='backup_destination');
  const system=entry.status==='protected'||['runtime','other_project','mixed'].includes(owner.kind)||owner.kind==='hosting_service'&&owner.basis==='policy';
  if(system||entry.type==='link'||entry.type==='metadata')return decision('protected',owner.kind==='other_project'?'Thuộc domain/ứng dụng khác; việc dọn ứng dụng này không cấp quyền xóa dữ liệu của dự án đó.':(['runtime','mixed'].includes(owner.kind)||owner.kind==='hosting_service'&&owner.basis==='policy'?owner.reason:entry.reason),['Giữ nguyên. Với thư mục chứa nhiều vai trò, mở từng mục con để đánh giá riêng.']);
  if(entry.status==='active'||referenced)return decision('protected','Có tham chiếu cấu hình/cron/startup/process được quan sát.',['Xem quan hệ và chủ sở hữu; xác nhận đã ngừng dùng trước khi đề xuất chính sách dọn.']);
  if(entry.status==='candidate'){
    const backup=/backup|rollback|restore/i.test(entry.role);
    return decision('review',backup?'Có dấu hiệu backup/rollback, chưa đủ xác minh để xóa.':entry.reason,backup?['Chốt từng bộ/thành phần; loại trừ database đang chạy và thư mục đích đang được ghi.','Tải bản đã có ra ngoài host, đối chiếu đủ file/checksum/định dạng rồi mới xem trước xóa.']:['Đối chiếu writer, cron, deploy và dịch vụ đang dùng.','Chọn đúng policy cho từng file; tên, tuổi hoặc không tìm thấy tham chiếu chưa đủ cấp xóa.']);
  }
  if(owner.kind==='this_app')return decision('review','Thuộc ứng dụng này nhưng chưa có kết luận dọn riêng cho file.',['Đối chiếu báo cáo file ứng dụng và bộ kiểm tra đúng loại.','Media cần kiểm tra draft, phiên bản đã xuất bản, bài học/kết quả và job trước khi cách ly hoặc xóa.']);
  return decision('unverified',owner.reason,[context.truncated?'Danh sách quan hệ vượt giới hạn đọc; cần kiểm tra nguồn chi tiết.':'Đọc nguồn domain/Node.js/cron/process còn thiếu để xác định dự án hoặc dịch vụ.','Sau khi nhận diện vai trò, cần policy và kiểm tra đúng loại trước khi cấp quyền dọn.']);
}

// Only navigation to the original authenticated catalog; cleanup rechecks live state.
export function linkApplicationCatalog(entry,root,summary) {
  if(entry.type!=='file'||entry.cleanup.category==='protected'||!entry.cleanup.current||!summary?.latest||!fresh(summary.latest.at)||!['this_app','unknown'].includes(entry.association.kind)||entry.issue)return entry;
  const absolute=path.resolve(root,entry.relative),roots=new Map(summary.roots.map(r=>[r.id,path.resolve(r.root)]));
  const match=summary.latest.entries.find(e=>roots.has(e.rootId)&&path.resolve(roots.get(e.rootId),e.relative)===absolute&&e.bytes===entry.bytes&&e.modifiedAt===entry.modifiedAt);
  if(!match)return entry;
  const canReview=entry.cleanup.category!=='protected';
  const ready=match.status==='eligible'&&['speaking','temporary','asset'].includes(match.kind)||match.kind==='backup'&&match.verified&&!match.pinned;
  const category=!canReview||['held','pinned','blocked','used','protected'].includes(match.status)?'protected':ready?'ready':['suspected','review','eligible'].includes(match.status)?'review':'unverified';
  return {...entry,cleanup:{category,reason:match.reason,nextSteps:category==='ready'?['Mở thao tác dọn hiện có; xem trước và nhập tên xác nhận. Server kiểm tra lại file, tham chiếu, job và chính sách.']:match.kind==='backup'?['Tải và chọn lại bản local để đối chiếu SHA-256/bytes/quick_check; bỏ ghim trước khi xem trước xóa.']:['Xem chi tiết/preview và điều kiện dọn của file ứng dụng. Giữ 30 ngày chỉ là khóa tạm thời.'],action:match.kind==='backup'?'manage-backup':'manage-application',applicationId:match.id,applicationKind:match.kind,applicationStatus:match.status,catalogAt:summary.latest.at,deleteAllowed:false,current:true}};
}
