import {setImmediate as yieldBatch} from 'node:timers/promises';
import {MaintenanceError} from './maintenance-core.mjs';
import {openStore,getScan,scanDTO,VERSION} from './hosting-inventory-store.mjs';

// Export saved metadata only. A bounded read transaction keeps every section on one snapshot.
export async function exportHostingReport(config,id,write,describe,enrich=entry=>entry,applicationReport=null,options={}) {
  let db;try{db=openStore(config,false);}catch(error){if(error.code==='ENOENT')throw new MaintenanceError(404,'Chưa có báo cáo hosting để tải.');throw error;}
  if(!db)throw new MaintenanceError(404,'Chưa có báo cáo hosting để tải.');
  const started=Date.now(),maxMs=options.maxMs??60000,maxBytes=options.maxBytes??256*1048576;
  let exportedBytes=0;
  const check=()=>{options.signal?.throwIfAborted();if(Date.now()-started>maxMs)throw new MaintenanceError(503,'Xuất báo cáo vượt thời gian cho phép; thử lại khi tác vụ quét đã dừng.');};
  const emit=async chunk=>{check();exportedBytes+=Buffer.byteLength(chunk);if(exportedBytes>maxBytes)throw new MaintenanceError(413,'Báo cáo vượt giới hạn xuất 256 MiB.');await write(chunk);check();};
  const cleanupSummary=Object.fromEntries(['ready','review','protected','unverified'].map(category=>[category,{files:0,logicalBytes:0,uniqueBytes:0}]));
  const included={entries:0,evidence:0,backupSets:0,deltas:0};
  try {
    db.exec('BEGIN');const row=getScan(db,id);
    if(!row.retained)throw new MaintenanceError(410,'Chi tiết mốc đã thu gọn; chỉ còn tổng hợp, cần chọn mốc mới.');
    const scan=scanDTO(row),scopeChanged=row.scope!==config.scope;
    const largestTopLevel=db.prepare("SELECT * FROM entries WHERE scan=? AND parent='' ORDER BY bytes DESC,size DESC LIMIT 20").all(id).map(entry=>enrich(describe(db,row,entry)));
    const header={reportVersion:1,exportedAt:new Date().toISOString(),root:row.root,scan,currentVersion:VERSION,scopeChanged,
      readOnly:true,metadataOnly:true,applicationReport,largestTopLevel,
      notes:['Đây là toàn bộ metadata đã lưu, không chỉ trang/bộ lọc đang mở. Không đọc lại file nguồn.',
        'filesystemComplete=false nghĩa là phạm vi quét còn thiếu; số liệu và danh sách chưa bao phủ toàn tài khoản.',
        'Dung lượng category chỉ cộng file; không cộng lại thư mục cha/con. Logical bytes có thể đếm hardlink nhiều lần.',
        'ready chỉ mở luồng dọn ứng dụng đã hỗ trợ; backend vẫn kiểm tra lại và yêu cầu xác nhận.',
        'Cache tài khoản, staging và BackupSet ngoài catalog chưa có thao tác dọn trong V1. Không có ready không có nghĩa host không có rác.']};
    await emit(JSON.stringify(header).slice(0,-1));
    const array=async(key,sql,convert)=>{
      await emit(',"'+key+'":[');let first=true,batch='',batchCount=0;
      for(const item of db.prepare(sql).iterate(id)) {
        check();const value=convert(item);batch+=(first?'':',')+JSON.stringify(value);first=false;included[key]++;batchCount++;
        if(batchCount>=100||Buffer.byteLength(batch)>262144){await emit(batch);batch='';batchCount=0;await yieldBatch();}
      }
      if(batch)await emit(batch);await emit(']');
    };
    await array('entries','SELECT * FROM entries WHERE scan=? ORDER BY rel',entry=>{
      const value=enrich(describe(db,row,entry));
      if(value.type==='file'){const category=cleanupSummary[value.cleanup.category];category.files++;category.logicalBytes+=value.bytes;category.uniqueBytes+=value.uniqueBytes;}
      return value;
    });
    await array('evidence','SELECT * FROM evidence WHERE scan=? ORDER BY source,id',entry=>({...entry,status:scan.sources.find(source=>source.id===entry.source)?.status||entry.status}));
    await array('backupSets','SELECT * FROM backup_sets WHERE scan=? ORDER BY id',entry=>({...entry,formatCheck:'unverified',restoreCheck:'unverified',offHost:'unverified',deleteAllowed:false}));
    await array('deltas','SELECT * FROM deltas WHERE scan=? ORDER BY rel',entry=>entry);
    await emit(',"cleanupSummary":'+JSON.stringify(cleanupSummary)+',"included":'+JSON.stringify(included)+',"exportComplete":true}\n');
    return {included,exportedBytes};
  } finally {try{if(db.inTransaction)db.exec('ROLLBACK');}finally{db.close();}}
}
