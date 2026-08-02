import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsxCli = path.join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const localDataDir = path.join(projectRoot, '.data');

const child = spawn(process.execPath, [tsxCli, 'server.ts'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
    VITE_MODE: 'production',
    VITE_LOCAL_AUTH_BYPASS_ENABLED: 'true',
    LOCAL_AUTH_BYPASS_ENABLED: 'true',
    STORAGE_MODE: 'sqlite',
    SQLITE_DRIVER: process.env.LOCAL_TEST_SQLITE_DRIVER || 'sqljs',
    SQLITE_DB_PATH: process.env.LOCAL_TEST_SQLITE_DB_PATH || path.join(localDataDir, 'local-test.sqlite'),
    SQLITE_ALLOW_CREATE: 'true',
    SQLITE_ALLOW_JSON_IMPORT: 'false',
    LISTENING_MEDIA_DIR: path.join(localDataDir, 'listening-media'),
    TTS_AUDIO_DIR: path.join(localDataDir, 'audio'),
  },
});

console.log('[Local Test] Authentication bypass is ON for loopback requests only.');
console.log('[Local Test] Open http://localhost:3000 — production deployments are unaffected.');

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => child.kill(signal));
}

child.once('error', error => {
  console.error('[Local Test] Failed to start server:', error);
  process.exitCode = 1;
});

child.once('exit', code => {
  process.exitCode = code ?? 1;
});
