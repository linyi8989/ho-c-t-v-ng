import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config({path:process.env.MAINTENANCE_ENV_FILE||path.resolve(process.cwd(),'.env'),quiet:true});
import { maintenanceConfig } from './maintenance-core.mjs';
import { inventoryConfig } from './hosting-inventory-store.mjs';
import { createHostingInventory,runInventory } from './hosting-inventory-core.mjs';
const config=inventoryConfig(maintenanceConfig());
const args=process.argv.slice(2);
try {
  let id;
  if(args.length===2&&args[0]==='--scan-id'&&/^[a-f0-9-]{36}$/.test(args[1]))id=args[1];
  else if(args.length===1&&args[0]==='--start')id=createHostingInventory(config).start('cli',true).id;
  else throw new Error('Usage: node scripts/hosting-inventory-run.mjs --start | --scan-id UUID');
  const result=await runInventory(config,id);
  console.log(JSON.stringify({id:result.id,status:result.status,filesystemComplete:result.filesystemComplete,files:result.fileCount,reason:result.reason}));
}catch{console.error('Inventory không hoàn tất. Kiểm tra cấu hình/quyền/ngân sách và báo cáo cached; không có file nguồn bị xóa.');process.exitCode=1;}