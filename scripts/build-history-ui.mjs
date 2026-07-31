import { spawnSync } from 'node:child_process';

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('npm_execpath is unavailable; run this script through npm.');

const result = spawnSync(process.execPath, [npmCli, 'run', 'build'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_LEARNING_HISTORY_ENABLED: 'true',
  },
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
