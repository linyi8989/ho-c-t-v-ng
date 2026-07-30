# cPanel better-sqlite3 Preflight

Run this with the exact Node executable/environment used by Passenger. The command must not point to `app.sqlite`.

## 1. Capture runtime facts

```bash
node -p "JSON.stringify({node:process.version,abi:process.versions.modules,execPath:process.execPath,platform:process.platform,arch:process.arch,glibc:process.report?.getReport?.().header?.glibcVersionRuntime||null},null,2)"
npm ls better-sqlite3
```

The production compatibility pin is `better-sqlite3@10.1.0` on Node 22.x. This
version is built from source on the current cPanel host because its prebuilt
Linux binary requires a newer glibc than the host provides. The host build uses
Python 3.11 and the available GCC 8.5 C++17 toolchain.

Keep this compatibility pin exact. Do not install a different package version
directly on the host or patch files under `node_modules`.

## 2. Install production dependencies

Stop the cPanel Web Application before installing. From the application root:

```bash
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"
export npm_config_python=/opt/alt/python311/bin/python3.11
export PYTHON=/opt/alt/python311/bin/python3.11
export npm_config_build_from_source=true
npm ci --omit=dev
```

## 3. Run an isolated preflight

```bash
cd /home/qzmivzbj/app.msdieu.com
npm run storage:preflight -- \
  --db /home/qzmivzbj/app-data/vhomework/better-sqlite3-test.sqlite
```

The script:

- refuses the configured main database and any file named `app.sqlite`;
- refuses to overwrite an existing test database;
- loads the native package;
- creates/inserts/selects in the isolated test file;
- enables and verifies WAL;
- closes/reopens and selects again;
- runs `quick_check`;
- reports Node, ABI, executable, platform, architecture, libc, package version, and result.

Review the JSON output and retain it with the deployment record. Remove the test file and its `-wal`/`-shm` sidecars manually only after review.

## 4. Failure rule

If native load, WAL, reopen, or `quick_check` fails:

- do not point the new code at `app.sqlite`;
- do not start Phase 2;
- record the exact runtime output and native error;
- choose/test a compatible pinned candidate or correct the Passenger Node runtime.
