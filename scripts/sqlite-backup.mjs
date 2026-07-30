import path from 'node:path';
import {
  createVerifiedBackup,
  printJson,
  readArg,
  redactPath,
  resolveDatabasePath,
} from './sqlite-cli-common.mjs';

const sourcePath = resolveDatabasePath();
const destinationDirectory = readArg('--output-dir')
  || process.env.SQLITE_BACKUP_DIR
  || path.join(path.dirname(sourcePath), 'backups');
const backupPath = await createVerifiedBackup(sourcePath, destinationDirectory);

printJson({
  ok: true,
  source: redactPath(sourcePath),
  backup: redactPath(backupPath),
  quickCheck: 'ok',
});
