import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { Database } from './sqlite-cli-common.mjs';

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vhomework-startup-'));

function commonEnvironment(databasePath, allowCreate, port) {
  return {
    ...process.env,
    NODE_ENV: 'production',
    STORAGE_MODE: 'sqlite',
    SQLITE_DRIVER: 'better-sqlite3',
    SQLITE_DB_PATH: databasePath,
    SQLITE_ALLOW_CREATE: String(allowCreate),
    SQLITE_ALLOW_JSON_IMPORT: 'false',
    SQLITE_BUSY_TIMEOUT_MS: '2000',
    SQLITE_WAL_AUTOCHECKPOINT_PAGES: '50',
    SQLITE_SYNCHRONOUS: 'NORMAL',
    SEED_DATA_ENABLED: 'false',
    DIAGNOSTIC_SECRET: 'startup-smoke-secret',
    PORT: String(port),
  };
}

async function findFreePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitForDiagnostics(port) {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(
        `http://127.0.0.1:${port}/api/diagnostics/storage?secret=startup-smoke-secret`
      );
      if (response.ok) return response.json();
      lastError = new Error(`Diagnostics returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw lastError || new Error('Timed out waiting for startup diagnostics.');
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Graceful shutdown timed out.')), 10_000)),
  ]);
}

try {
  const missingPath = path.join(temporaryDirectory, 'missing.sqlite');
  const missingPort = await findFreePort();
  const missing = spawnSync(process.execPath, ['dist/server.cjs'], {
    cwd: process.cwd(),
    env: commonEnvironment(missingPath, false, missingPort),
    encoding: 'utf8',
    timeout: 15_000,
  });
  assert.equal(missing.status, 1);
  assert.match(`${missing.stdout}\n${missing.stderr}`, /database file does not exist/i);
  assert.equal(fs.existsSync(missingPath), false);

  const databasePath = path.join(temporaryDirectory, 'app.sqlite');
  new Database(databasePath).close();
  const port = await findFreePort();
  const child = spawn(process.execPath, ['dist/server.cjs'], {
    cwd: process.cwd(),
    env: commonEnvironment(databasePath, false, port),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });

  try {
    const diagnostics = await waitForDiagnostics(port);
    assert.equal(diagnostics.sqliteDriver, 'better-sqlite3');
    assert.equal(diagnostics.sqliteDbBasename, 'app.sqlite');
    assert.equal(diagnostics.quickCheck, 'ok');
    assert.equal(diagnostics.pragmas.journalMode, 'wal');
    assert.equal(diagnostics.pragmas.foreignKeys, 1);
    assert.equal(String(diagnostics.sqliteDbPath).includes(temporaryDirectory), false);
  } finally {
    await stopChild(child);
  }

  assert.match(output, /SQLite ready: driver=better-sqlite3/);
  assert.match(output, /Server running at/);
  assert.equal(
    output.indexOf('SQLite ready: driver=better-sqlite3') < output.indexOf('Server running at'),
    true
  );

  const reopened = new Database(databasePath, { fileMustExist: true, readonly: true });
  try {
    assert.equal(reopened.pragma('quick_check', { simple: true }), 'ok');
    assert.equal(reopened.pragma('journal_mode', { simple: true }), 'wal');
    assert.equal(
      reopened.prepare('SELECT COUNT(*) AS count FROM migrations').get().count >= 4,
      true
    );
  } finally {
    reopened.close();
  }

  process.stdout.write('Startup smoke passed: strict missing-file gate, pre-listen integrity, WAL diagnostics, graceful close, and reopen.\n');
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
