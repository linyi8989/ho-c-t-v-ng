import dotenv from 'dotenv';
import { createMaintenance, maintenanceConfig } from './maintenance-core.mjs';
dotenv.config({ path: process.env.MAINTENANCE_ENV_FILE || '.env', quiet: true });
const flags = new Set(process.argv.slice(2));
if ([...flags].some(flag => !['--scan', '--dry-run', '--execute'].includes(flag)) || flags.size > 1) {
  console.error('Usage: node scripts/maintenance-run.mjs [--scan | --dry-run | --execute]'); process.exitCode = 1;
} else {
  try {
    if (!process.env.SQLITE_DB_PATH || !process.env.STORAGE_MODE) throw new Error('Explicit storage config required for cron');
    const service = createMaintenance(maintenanceConfig());
    const result = flags.has('--scan') ? await service.scan('cron') : await service.automate(flags.has('--execute'));
    // No absolute paths or tokens in scheduler output.
    console.log(JSON.stringify(flags.has('--scan') ? { at: result.at, complete: result.complete, files: result.fileCount, bytes: result.totalBytes } : result));
  } catch { console.error('[Maintenance] Tác vụ lỗi. Kiểm tra dashboard/config/lease; không tự tiếp tục xóa.'); process.exitCode = 1; }
}
