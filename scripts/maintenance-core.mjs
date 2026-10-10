import fs from 'node:fs/promises';
import { createReadStream, constants } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createVerifiedBackup } from './sqlite-cli-common.mjs';

const execFileAsync = promisify(execFile);
const DAY = 86400000;
const MAX_STATE_BYTES = 12 * 1024 * 1024;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const inside = (root, target) => target === root || (!path.relative(root, target).startsWith('..' + path.sep) && path.relative(root, target) !== '..' && !path.isAbsolute(path.relative(root, target)));
const same = (a, b) => a && b && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ino === b.ino && a.dev === b.dev;
export const maintenanceInodeKey = s => String(s.dev) + ':' + String(s.ino);
const fingerprint = s => ({ size: s.size, mtimeMs: s.mtimeMs, ino: s.ino, dev: s.dev });
export class MaintenanceError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new MaintenanceError(status, message); };

export function maintenanceConfig(env = process.env, cwd = process.cwd()) {
  const dbPath = path.resolve(env.SQLITE_DB_PATH || path.join(cwd, '.data/app.sqlite'));
  const dataRoot = path.dirname(dbPath);
  const deployRoot = path.resolve(env.MAINTENANCE_DEPLOY_ROOT || cwd);
  const accountRoot = path.resolve(env.MAINTENANCE_ACCOUNT_ROOT || (env.NODE_ENV === 'production' && os.homedir().startsWith('/home/') ? os.homedir() : dataRoot));
  const backupRoots = [env.SQLITE_BACKUP_DIR || path.join(dataRoot, 'backups'), path.join(dataRoot, 'restore-backup'), path.join(dataRoot, 'release-b-backups'), path.join(dataRoot, 'retention-backups')].map(p => path.resolve(p));
  return {
    dbPath, dataRoot, deployRoot, accountRoot, backupRoots,
    stateRoot: path.resolve(env.MAINTENANCE_STATE_DIR || path.join(dataRoot, 'maintenance')),
    audioRoot: path.resolve(env.TTS_AUDIO_DIR || path.join(dataRoot, 'audio')),
    listeningRoot: path.resolve(env.LISTENING_MEDIA_DIR || path.join(dataRoot, 'listening-media')),
    vocabRoot: path.resolve(env.VOCAB_IMAGE_DIR || path.join(dataRoot, 'vocab-images')),
    speakingRoot: path.join(dataRoot, 'speaking-recordings'),
    maxFiles: Math.min(500000, Math.max(100, Number(env.MAINTENANCE_MAX_FILES) || 100000)),
    maxScanMs: Math.min(300000, Math.max(1000, Number(env.MAINTENANCE_SCAN_SECONDS) * 1000 || 60000)),
    reserveBytes: Math.max(64 * 1024 * 1024, (Number.isFinite(Number(env.MAINTENANCE_RESERVE_MB)) && Number(env.MAINTENANCE_RESERVE_MB) > 0 ? Number(env.MAINTENANCE_RESERVE_MB) : 256) * 1024 * 1024),
    nativeSqlite: env.STORAGE_MODE === 'sqlite' && env.SQLITE_DRIVER === 'better-sqlite3',
    quotaHost: env.MAINTENANCE_CPANEL_HOST || '',
    quotaUser: env.MAINTENANCE_CPANEL_USER || '',
    quotaToken: env.MAINTENANCE_CPANEL_TOKEN || '',
    cronDiscovery: env.MAINTENANCE_CRON_DISCOVERY === 'true',
  };
}

async function privateDir(directory) {
  let current = path.parse(path.resolve(directory)).root;
  for (const part of path.relative(current, path.resolve(directory)).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try { const item = await fs.lstat(current); if (item.isSymbolicLink() || !item.isDirectory()) fail(409, 'Parent directory không an toàn.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; await fs.mkdir(current, { mode: 0o700 }); }
  }
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail(409, 'Thư mục maintenance không an toàn.');
  if (process.platform !== 'win32') await fs.chmod(directory, 0o700);
}
async function atomicJson(file, value) {
  const text = JSON.stringify(value);
  if (Buffer.byteLength(text) > MAX_STATE_BYTES) fail(507, 'Metadata vượt giới hạn; dừng để bảo vệ dung lượng.');
  const temporary = file + '.' + crypto.randomUUID() + '.tmp';
  const handle = await fs.open(temporary, 'wx', 0o600);
  try { await handle.writeFile(text); await handle.sync(); } finally { await handle.close(); }
  await fs.rename(temporary, file);
}
function emptyState() {
  return { version: 1, latest: null, snapshots: [], audit: [], jobs: [], holds: {}, pins: {}, verifications: {}, previews: {}, quarantine: {}, policy: { temporary: false, speaking: false } };
}
async function safeFile(root, relative, expected) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\0')) fail(400, 'Đường dẫn không hợp lệ.');
  const resolvedRoot = path.resolve(root), target = path.resolve(resolvedRoot, relative);
  if (!inside(resolvedRoot, target) || target === resolvedRoot) fail(403, 'File ngoài phạm vi cho phép.');
  // Reject symlinks in every component, including the root.
  let current = path.parse(resolvedRoot).root;
  for (const part of path.relative(current, target).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink()) fail(409, 'Không xử lý symlink.');
  }
  const stat = await fs.lstat(target);
  if (!stat.isFile() || stat.nlink !== 1) fail(409, 'Chỉ xử lý file thường, không hardlink.');
  if (expected && !same(fingerprint(stat), expected)) fail(409, 'File đã thay đổi. Hãy quét và xác minh lại.');
  return { target, stat };
}

const MEDIA_ROOTS = new Set(['temporary-pdf','temporary-reading','speaking','tts','listening','vocab','assets','assets-client']);
function previewFormat(entry) {
  if (!MEDIA_ROOTS.has(entry.rootId)) return null;
  const formats = {
    '.png': ['image','image/png'], '.jpg': ['image','image/jpeg'], '.jpeg': ['image','image/jpeg'],
    '.webp': ['image','image/webp'], '.gif': ['image','image/gif'],
    '.wav': ['audio','audio/wav'], '.mp3': ['audio','audio/mpeg'], '.ogg': ['audio','audio/ogg'], '.m4a': ['audio','audio/mp4'],
  };
  const match = formats[path.extname(entry.name).toLowerCase()];
  return match ? { type: match[0], mime: match[1], maxBytes: (match[0] === 'image' ? 16 : 32) * 1024 * 1024 } : null;
}
function matchesMediaSignature(bytes, mime) {
  const text = (start, end) => bytes.toString('ascii',start,end);
  if (mime === 'image/png') return bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (mime === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === 'image/gif') return ['GIF87a','GIF89a'].includes(text(0,6));
  if (mime === 'image/webp') return text(0,4) === 'RIFF' && text(8,12) === 'WEBP';
  if (mime === 'audio/wav') return text(0,4) === 'RIFF' && text(8,12) === 'WAVE';
  if (mime === 'audio/mpeg') return text(0,3) === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224 && (bytes[1] & 6) !== 0);
  if (mime === 'audio/ogg') return text(0,4) === 'OggS';
  if (mime === 'audio/mp4') return text(4,8) === 'ftyp' && bytes.length >= 12;
  return false;
}
function presentedEntry(state, entry) {
  const overlay = ['held','pinned'].includes(entry.status);
  const baseStatus = entry.baseStatus || (overlay ? 'unknown' : entry.status);
  const baseReason = entry.baseReason || (overlay ? 'Quét lại để xác định trạng thái sau khi bỏ giữ/ghim.' : entry.reason);
  const held = state.holds[entry.id]?.until > Date.now() ? state.holds[entry.id] : null;
  const pinned = Boolean(state.pins[entry.id]);
  return { ...entry, status: pinned ? 'pinned' : held ? 'held' : baseStatus,
    reason: pinned ? 'Backup được ghim; bỏ ghim trước khi xử lý.' : held ? held.reason : baseReason,
    pinned, heldUntil: held ? new Date(held.until).toISOString() : null };
}

export function createMaintenance(config) {
  const stateFile = path.join(config.stateRoot, 'state.json');
  const lockFile = path.join(config.stateRoot, 'task.lock');
  let busy = false;
  async function readState() {
    try {
      const info = await fs.lstat(stateFile);
      if (info.isSymbolicLink() || info.size > MAX_STATE_BYTES) fail(503, 'Metadata maintenance không an toàn.');
      const state = JSON.parse(await fs.readFile(stateFile, 'utf8'));
      if (state.version !== 1 || !Array.isArray(state.audit) || !Array.isArray(state.jobs) || !state.policy) fail(503, 'Metadata maintenance không hợp lệ.');
      return state;
    } catch (error) { if (error.code === 'ENOENT') return emptyState(); throw error; }
  }
  async function save(state) {
    state.audit = state.audit.slice(-600); state.jobs = state.jobs.slice(-80); state.snapshots = state.snapshots.slice(-120);
    const now = Date.now();
    for (const [key, value] of Object.entries(state.holds)) if (value.until <= now) delete state.holds[key];
    for (const [key, value] of Object.entries(state.verifications)) if (value.expiresAt < now) delete state.verifications[key];
    for (const [key, value] of Object.entries(state.previews)) if (value.expiresAt < now) delete state.previews[key];
    await atomicJson(stateFile, state);
  }
  async function locked(actor, task, action) {
    if (busy) fail(409, 'Một tác vụ maintenance đang chạy. Hãy thử lại sau.');
    await privateDir(config.stateRoot);
    await safeParents(config.stateRoot);
    let lease;
    try { lease = await fs.open(lockFile, 'wx', 0o600); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      // A live process always retains its lock. A dead process may be recovered.
      const info = await fs.lstat(lockFile);
      if (info.isSymbolicLink()) fail(409, 'Khóa tác vụ không hợp lệ.');
      const prior = JSON.parse(await fs.readFile(lockFile, 'utf8'));
      let alive = true;
      try { process.kill(prior.pid, 0); } catch (e) { if (e.code === 'ESRCH') alive = false; }
      if (alive || !Number.isFinite(prior.startedAt) || Date.now() - prior.startedAt < 60000) fail(409, 'Tác vụ khác đang giữ khóa.');
      await fs.unlink(lockFile);
      lease = await fs.open(lockFile, 'wx', 0o600);
    }
    busy = true;
    try {
      await lease.writeFile(JSON.stringify({ pid: process.pid, startedAt: Date.now(), task })); await lease.sync();
      const state = await readState();
      for (const job of state.jobs) if (job.status === 'running') { job.status = 'interrupted'; job.finishedAt = new Date().toISOString(); }
      const job = { id: crypto.randomUUID(), task, source: actor === 'cron' ? 'cron' : 'dashboard', actor, status: 'running', startedAt: new Date().toISOString() };
      state.jobs.push(job); await save(state);
      try {
        const result = await action(state, job);
        job.status = 'success'; job.finishedAt = new Date().toISOString(); job.durationMs = Date.now() - Date.parse(job.startedAt);
        await save(state); return result;
      } catch (error) {
        job.status = 'failed'; job.finishedAt = new Date().toISOString(); job.error = error instanceof MaintenanceError ? error.message : 'Tác vụ lỗi; chưa xác nhận hoàn tất.';
        await save(state); throw error;
      }
    } finally { busy = false; await lease.close(); await fs.unlink(lockFile); }
  }
  async function audit(state, actor, action, details) {
    state.audit.push({ id: crypto.randomUUID(), at: new Date().toISOString(), actor, action, ...details }); await save(state);
  }
  async function safeParents(target) {
    let current = path.parse(target).root;
    for (const part of path.relative(current, target).split(path.sep).filter(Boolean)) {
      current = path.join(current, part);
      const info = await fs.lstat(current);
      if (info.isSymbolicLink()) fail(409, 'Không sử dụng thư mục symlink.');
    }
  }
  function resolveEntry(state, id) {
    const entry = state.latest?.entries.find(e => e.id === id);
    if (!entry) fail(404, 'File không còn trong báo cáo. Hãy quét lại.');
    const root = roots().find(r => r.id === entry.rootId);
    if (!root) fail(403, 'Phạm vi file không còn được phép.');
    return { entry, root };
  }
  function roots() {
    const definitions = [
      ['backups', config.backupRoots[0], 'Backup'], ...config.backupRoots.slice(1).map((p, i) => ['backup-' + i, p, 'Backup phục hồi']),
      ['temporary-pdf', path.join(config.listeningRoot, '.tmp-pdf-import'), 'File tạm nhập PDF'],
      ['temporary-reading', path.join(config.listeningRoot, '.tmp-mover-reading-import'), 'File tạm nhập Reading'],
      ['speaking', config.speakingRoot, 'Bản thu Speaking'], ['tts', config.audioRoot, 'Audio TTS'],
      ['listening', config.listeningRoot, 'Media Listening'], ['vocab', config.vocabRoot, 'Ảnh từ vựng'],
      ['quarantine', path.join(config.stateRoot, 'quarantine'), 'File cách ly'],
      ['assets', path.join(config.deployRoot, 'assets'), 'Asset frontend'],
      ['assets-client', path.join(config.deployRoot, 'dist/client/assets'), 'Asset frontend (Node)'],
      ['data', config.dataRoot, 'Dữ liệu ứng dụng'], ['deployment', config.deployRoot, 'Code triển khai'], ['account', config.accountRoot, 'Tài khoản hosting'],
    ];
    return definitions.map(([id, root, label]) => ({ id, root: path.resolve(root), label }));
  }
  async function quota() {
    if (!config.quotaHost || !config.quotaUser || !config.quotaToken) return { status: 'unconfigured', measuredAt: null, usedBytes: null, limitBytes: null };
    try {
      const url = new URL('https://' + config.quotaHost);
      if (url.pathname !== '/' || url.username || url.password || (url.port && url.port !== '2083')) throw new Error('Invalid host');
      url.port = '2083'; url.pathname = '/execute/Quota/get_quota_info';
      const response = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'error', headers: { Authorization: 'cpanel ' + config.quotaUser + ':' + config.quotaToken } });
      if (!response.ok) throw new Error('API unavailable');
      const result = await response.json(), d = result.data;
      const usedBytes = Number(d?.bytes_used), limitBytes = Number(d?.byte_limit);
      if (result.status !== 1 || d?.bytes_used == null || d?.byte_limit == null || !Number.isFinite(usedBytes) || usedBytes < 0 || !Number.isFinite(limitBytes) || limitBytes <= 0) throw new Error('Unsupported quota');
      return { status: 'available', measuredAt: new Date().toISOString(), usedBytes, limitBytes };
    } catch { return { status: 'unavailable', measuredAt: new Date().toISOString(), usedBytes: null, limitBytes: null }; }
  }
  async function cronList() {
    if (!config.cronDiscovery) return { status: 'unconfigured', schedules: [] };
    try {
      const { stdout } = await execFileAsync('crontab', ['-l'], { timeout: 4000, maxBuffer: 65536, windowsHide: true });
      const schedules = stdout.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#') && !/^\s*[A-Za-z_]\w*\s*=/.test(l)).slice(0, 100).map((line, i) => {
        const parts = line.trim().split(/\s+/);
        const known = ['maintenance-run.mjs','sqlite-backup.mjs','activity-prune.mjs','media-orphan-maintenance.mjs'].find(name => line.includes(name));
        return { id: i, task: known || 'Tác vụ chưa nhận diện', schedule: parts[0].startsWith('@') ? parts[0] : parts.slice(0, 5).join(' '), command: '[Lệnh được ẩn để bảo vệ thông tin]', status: 'unknown' };
      });
      return { status: 'available', schedules };
    } catch { return { status: 'unavailable', schedules: [] }; }
  }

  async function assetReferences() {
    const protectedFiles = new Set(), historical = new Set(), digests = new Map();
    const directory = path.join(config.dataRoot, 'frontend-releases');
    try {
      await safeParents(directory);
      const records = [];
      for (const name of (await fs.readdir(directory)).filter(n => /^release-[a-zA-Z0-9._-]+\.json$/.test(n)).slice(-500)) {
        const file = await safeFile(directory, name);
        if (file.stat.size > 1024 * 1024) throw new Error('Manifest too large');
        const data = JSON.parse(await fs.readFile(file.target, 'utf8'));
        if (data.version !== 1 || !Array.isArray(data.files) || data.files.length > 10000 || data.files.some(f => typeof f.path !== 'string' || f.path.includes('..') || path.isAbsolute(f.path) || !/^[a-f0-9]{64}$/.test(f.sha256))) throw new Error('Invalid manifest');
        records.push({ data, activated: file.stat.mtimeMs });
      }
      records.sort((a,b)=>b.activated-a.activated);
      if (!records.length) throw new Error('No manifest');
      const indexPaths = [path.join(config.deployRoot,'index.html'),path.join(config.deployRoot,'dist/client/index.html')];
      for (const indexPath of indexPaths) {
        const file = await safeFile(path.dirname(indexPath),path.basename(indexPath));
        if (file.stat.size > 1024 * 1024) throw new Error('Index too large');
        const html = await fs.readFile(file.target,'utf8');
        const matches = [...html.matchAll(/(?:\/|["'])assets\/([^"'<>?\s]+)/g)].map(m=>'assets/'+m[1]);
        if (!matches.length || !records.some(r=>matches.every(m=>r.data.files.some(f=>f.path===m)))) throw new Error('Live index not covered by manifest');
        for (const record of records.filter(r=>matches.every(m=>r.data.files.some(f=>f.path===m)))) for(const f of record.data.files) protectedFiles.add(f.path);
      }
      records.forEach((record,index)=>{
        for(const f of record.data.files) {
          historical.add(f.path);
          if (!digests.has(f.path)) digests.set(f.path, new Set());
          digests.get(f.path).add(f.sha256);
          if(index<2 || Date.now()-record.activated<365*DAY) protectedFiles.add(f.path);
        }
      });
      return { status:'available', protectedFiles, historical, digests };
    } catch { return { status:'unknown', protectedFiles, historical, digests }; }
  }

  async function references() {
    const assets = await assetReferences();
    if (!config.nativeSqlite) return { status: 'unknown', error: 'Kiểm tra tham chiếu cần SQLite native.', speaking: new Map(), assets };
    try {
      const file = await safeFile(path.dirname(config.dbPath), path.basename(config.dbPath));
      const db = new Database(file.target, { readonly: true, fileMustExist: true, timeout: 3000 });
      try {
        const { loadMediaReferences } = await import('./media-reference-index.mjs');
        const media = loadMediaReferences(db);
        const speaking = new Map();
        if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='speaking_attempts'").get()
          || !db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='speaking_jobs'").get()) throw new Error('Speaking schema missing');
        for (const row of db.prepare('SELECT id,status,data_json FROM speaking_attempts').iterate()) {
          const value = JSON.parse(row.data_json);
          const expiry = Date.parse(value.audioExpiresAt);
          speaking.set(row.id, { status: row.status, expiry, busy: false });
        }
        for (const row of db.prepare("SELECT attempt_id FROM speaking_jobs WHERE status IN ('waiting','queued','running')").iterate()) {
          const item = speaking.get(row.attempt_id);
          if (item) item.busy = true;
        }
        return { status: 'available', ...media, speaking, assets };
      } finally { db.close(); }
    } catch { return { status: 'unknown', error: 'Không đọc đủ tham chiếu/schema. Không cấp quyền dọn media.', speaking: new Map(), assets }; }
  }
  function classify(root, name, stat, ref) {
    const age = Date.now() - stat.mtimeMs;
    if (root.id.startsWith('backup') && /^(?:app|db|backup|sqlite)[a-zA-Z0-9._-]*\.(?:sqlite|db)$/i.test(name)
      && path.resolve(root.root, name) !== config.dbPath) return { kind: 'backup', status: 'review', reason: 'Bản sao cần quick_check và đối chiếu file local trước khi xóa.' };
    if (root.id.startsWith('temporary') && /^[a-f0-9-]{36}(?:[._-][a-zA-Z0-9-]+)*\.(?:png|jpg|jpeg|webp|gif)$/i.test(name)) return { kind: 'temporary', status: age > 2 * DAY ? 'eligible' : 'used', reason: age > 2 * DAY ? 'File tạm nhập đề quá 48 giờ.' : 'Chưa hết thời gian bảo vệ file tạm.' };
    if (root.id === 'speaking' && /^[a-f0-9-]{36}\.wav$/i.test(name)) {
      const attempt = ref.speaking.get(name.slice(0, -4));
      if (ref.status !== 'available' || !attempt || !Number.isFinite(attempt.expiry)) return { kind: 'speaking', status: 'unknown', reason: 'Không xác minh được bản thu và thời điểm hết hạn.' };
      const expired = Date.now() >= Math.min(attempt.expiry, stat.mtimeMs + DAY);
      if (attempt.busy || ['prepared', 'queued', 'assessing'].includes(attempt.status)) return { kind: 'speaking', status: expired ? 'blocked' : 'used', reason: expired ? 'Quá hạn nhưng tác vụ còn sử dụng. Cần xử lý hàng chờ.' : 'Tác vụ chấm/nhận xét còn sử dụng.' };
      return { kind: 'speaking', status: expired ? 'eligible' : 'used', reason: expired ? 'Bản thu hết hạn; kết quả chấm được giữ nguyên.' : 'Bản thu chưa hết hạn 24 giờ.' };
    }
    if (root.id === 'tts' || root.id === 'listening') {
      const pattern = root.id === 'tts' ? /^[a-f0-9]{64}\.mp3$/i : /^[a-f0-9]{64}\.(?:gif|jpe?g|m4a|mp3|ogg|png|wav|webp)$/i;
      if (pattern.test(name) && ref.status === 'available') {
        const used = (root.id === 'tts' ? ref.tts : ref.listening).has(name);
        return { kind: 'media', status: used ? 'used' : age > 7 * DAY ? 'suspected' : 'used', reason: used ? 'Có tham chiếu, gồm cả nội dung đã archive và lịch sử.' : age > 7 * DAY ? 'Không tìm thấy tham chiếu; cần maintenance media riêng trước khi xử lý.' : 'File mới còn trong thời gian bảo vệ.' };
      }
      return { kind: 'media', status: 'unknown', reason: 'Chưa có đủ bằng chứng tham chiếu; được bảo vệ.' };
    }
    if (root.id === 'vocab') return { kind: 'media', status: ref.status === 'available' && ref.vocab.has(name) ? 'used' : 'unknown', reason: ref.status === 'available' && ref.vocab.has(name) ? 'Ảnh có trong thư viện tái sử dụng; được bảo vệ.' : 'Chưa xác minh đầy đủ ảnh legacy/tham chiếu; không cấp quyền xóa.' };
    if (root.id.startsWith('assets')) {
      const key='assets/'+name.split(path.sep).join('/');
      const eligible=ref.assets?.status==='available' && ref.assets.historical.has(key) && !ref.assets.protectedFiles.has(key);
      return { kind:'asset',status:eligible?'eligible':'protected',reason:eligible?'Asset có manifest lịch sử, không thuộc bản live/rollback và đã qua 365 ngày bảo vệ.':'Bảo vệ asset live/rollback/cache 365 ngày; legacy hoặc thiếu manifest không được xóa.' };
    }
    return { kind: root.id === 'quarantine' ? 'quarantine' : 'other', status: 'protected', reason: 'Chỉ giám sát; không thuộc danh sách được phép xóa.' };
  }
  async function scan(actor = 'cron') {
    return locked(actor, 'scan', async (state, job) => {
      const started = Date.now(), definitions = roots(), groups = {}, seen = new Set(), walked = new Set(), entries = [], largest = [];
      const ref = await references(), issues = [];
      let fileCount = 0, groupCount = 0, partial = false;
      for (const root of definitions) {
        if (Date.now() - started >= config.maxScanMs || fileCount >= config.maxFiles) { partial = true; break; }
        let rootStat;
        try { await safeParents(root.root); rootStat = await fs.lstat(root.root); }
        catch (error) { issues.push({ root: root.id, status: error.code === 'ENOENT' ? 'missing' : 'unreadable' }); continue; }
        if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) { issues.push({ root: root.id, status: 'excluded' }); continue; }
        const stack = [root.root];
        while (stack.length) {
          if (Date.now() - started >= config.maxScanMs || fileCount >= config.maxFiles) { partial = true; break; }
          const directory = stack.pop();
          if (walked.has(directory)) continue;
          walked.add(directory);
          let children;
          try { children = await fs.readdir(directory, { withFileTypes: true }); }
          catch { issues.push({ root: root.id, status: 'unreadable', relative: path.relative(root.root, directory) }); continue; }
          for (const child of children) {
            const target = path.join(directory, child.name);
            if (child.isSymbolicLink()) { issues.push({ root: root.id, status: 'symlink-excluded', relative: path.relative(root.root, target) }); continue; }
            if (child.isDirectory()) { stack.push(target); continue; }
            if (!child.isFile()) continue;
            let stat;
            try { stat = await fs.lstat(target); } catch { partial = true; continue; }
            if (!stat.isFile() || stat.isSymbolicLink()) continue;
            // NTFS IDs may exceed Number's exact range; rounding can merge unrelated files.
            const identity = Number.isSafeInteger(stat.ino) ? stat : await fs.lstat(target, { bigint: true });
            if (!identity.isFile() || Number(identity.size) !== stat.size) { partial = true; continue; }
            const inode = maintenanceInodeKey(identity);
            if (seen.has(inode)) continue;
            seen.add(inode); fileCount++;
            const owner = definitions.find(r => inside(r.root, target)) || root;
            const relative = path.relative(owner.root, target);
            const segments = relative.split(path.sep);
            const bucket = segments.length > 1 ? segments[0] : '[file tại root]';
            let groupId = owner.id === 'account' ? 'account:' + bucket : owner.id;
            if (!groups[groupId] && groupCount >= 1000) groupId = owner.id + ':other';
            if (!groups[groupId]) groupCount++;
            const groupedAccount = owner.id === 'account' && !groupId.endsWith(':other');
            const group = groups[groupId] ||= { id: groupId, label: groupedAccount ? bucket : groupId.endsWith(':other') ? owner.label + ' · nhóm còn lại' : owner.label, root: groupedAccount && segments.length > 1 ? path.join(owner.root, bucket) : owner.root, bytes: 0, allocatedBytes: 0, files: 0 };
            group.bytes += stat.size; group.allocatedBytes += Number.isFinite(stat.blocks) ? stat.blocks * 512 : stat.size; group.files++;
            const result = classify(owner, path.relative(owner.root, target), stat, ref);
            const entry = { id: hash(owner.id + ':' + relative), rootId: owner.id, relative, name: child.name, bytes: stat.size, modifiedAt: new Date(stat.mtimeMs).toISOString(), fingerprint: fingerprint(stat), ...result };
            if (stat.nlink !== 1) { entry.status = 'protected'; entry.reason = 'Hardlink: chỉ giám sát.'; }
            entry.baseStatus = entry.status; entry.baseReason = entry.reason;
            if (state.holds[entry.id] && state.holds[entry.id].until > Date.now()) { entry.status = 'held'; entry.reason = state.holds[entry.id].reason; }
            if (state.pins[entry.id]) { entry.status = 'pinned'; entry.reason = 'Backup được ghim; bỏ ghim trước khi xử lý.'; }
            if (entry.kind === 'backup' || ['eligible', 'blocked', 'suspected', 'held'].includes(entry.status)) {
              if (entries.length < 3000) entries.push(entry); else partial = true;
            }
            largest.push(entry); largest.sort((a, b) => b.bytes - a.bytes); if (largest.length > 50) largest.pop();
            if (fileCount % 100 === 0) await new Promise(resolve => setImmediate(resolve));
            if (fileCount >= config.maxFiles || Date.now() - started >= config.maxScanMs) { partial = true; break; }
          }
        }
      }
      const knownIds = new Set(entries.map(e => e.id));
      for (const item of largest) if (!knownIds.has(item.id)) entries.push(item);
      const quotaInfo = await quota(), cron = await cronList(), measuredAt = new Date().toISOString();
      const totalBytes = Object.values(groups).reduce((n, g) => n + g.bytes, 0);
      const alerts = [];
      if (partial || issues.some(i => i.status === 'unreadable')) alerts.push({ severity: 'warning', message: 'Phạm vi quét chưa đầy đủ; số liệu là phần đã đọc.', action: 'Xem phạm vi và tăng giới hạn quét nếu phù hợp.' });
      if (ref.status !== 'available') alerts.push({ severity: 'warning', message: ref.error, action: 'Kiểm tra cấu hình native SQLite và dữ liệu; không dọn media khi chưa xác minh.' });
      if (quotaInfo.status === 'available') {
        const percent = quotaInfo.usedBytes / quotaInfo.limitBytes * 100;
        if (percent >= 80) alerts.push({ severity: percent >= 95 ? 'critical' : percent >= 90 ? 'warning' : 'info', message: 'Quota hosting đã dùng ' + percent.toFixed(1) + '%.', action: 'Ưu tiên tải/xác minh backup có sẵn; không tạo thêm bản lớn khi thiếu chỗ.' });
      }
      const blocked = entries.filter(e => e.status === 'blocked');
      if (blocked.length) alerts.push({ severity: 'warning', message: blocked.length + ' bản thu quá hạn đang bị tác vụ giữ.', action: 'Kiểm tra hàng chờ Speaking; không xóa bản đang được sử dụng.' });
      const previous = state.snapshots.findLast(s => Date.parse(s.at) <= Date.now() - DAY) || state.snapshots.at(-1);
      const growth = !partial && previous?.complete ? Object.values(groups).map(g => ({ id: g.id, label: g.label, bytes: g.bytes - (previous.groups[g.id] || 0) })).sort((a, b) => b.bytes - a.bytes) : [];
      if (growth[0]?.bytes > 100 * 1024 * 1024) alerts.push({ severity: 'warning', message: growth[0].label + ' tăng ' + Math.round(growth[0].bytes / 1024 / 1024) + ' MiB từ ' + previous.at + '.', action: 'Xem file lớn và log tác vụ. Chưa quy nguồn nếu không có bằng chứng.' });
      state.latest = { at: measuredAt, complete: !partial && !issues.some(i => i.status === 'unreadable'), totalBytes, fileCount, groups: Object.values(groups), entries, issues: issues.slice(0, 200), quota: quotaInfo, cron, alerts, growth, referenceStatus: ref.status, durationMs: Date.now() - started };
      // One growth point per day; live latest still refreshes each scan.
      const point = { at: measuredAt, complete: state.latest.complete, bytes: totalBytes, groups: Object.fromEntries(Object.values(groups).map(g => [g.id, g.bytes])) };
      if (state.snapshots.at(-1)?.at.slice(0, 10) === measuredAt.slice(0, 10)) state.snapshots[state.snapshots.length - 1] = point;
      else state.snapshots.push(point);
      job.scanned = fileCount; job.bytes = totalBytes; job.partial = !state.latest.complete;
      await audit(state, actor, 'scan.completed', { files: fileCount, bytes: totalBytes, complete: state.latest.complete });
      return state.latest;
    });
  }
  async function summary(actor) {
    const state = await readState();
    const latest = state.latest ? { ...state.latest, alerts: [...state.latest.alerts], entries: state.latest.entries.map(({ fingerprint: _f, baseStatus: _s, baseReason: _r, ...e }) => ({ ...presentedEntry(state, { ...e, baseStatus: _s, baseReason: _r }), baseStatus: undefined, baseReason: undefined, previewType: previewFormat(e)?.type || null, verified: Object.values(state.verifications).some(v => v.actor === actor && v.id === e.id && v.expiresAt > Date.now() && same(v.fingerprint, _f)) })) } : null;
    if (latest) {
      const recentTasks = new Map();
      for (const job of [...state.jobs].reverse()) if (!recentTasks.has(job.task)) recentTasks.set(job.task, job);
      for (const job of recentTasks.values()) if (['failed','interrupted'].includes(job.status) && Date.now() - Date.parse(job.startedAt) < DAY) {
        latest.alerts.push({ severity: 'warning', message: 'Tác vụ ' + job.task + ' chưa hoàn tất lúc ' + job.startedAt + '.', action: 'Xem Tác vụ nền/Nhật ký; kiểm tra lỗi và trạng thái file trước khi chạy lại.' });
      }
    }
    return { latest, snapshots: state.snapshots, jobs: state.jobs.slice(-30).reverse(), audit: state.audit.slice(-100).reverse(), quarantine: Object.values(state.quarantine), policy: state.policy, roots: roots(), busy, cloud: { status: 'unconfigured' } };
  }

  async function previewMedia(actor, id, consume) {
    return locked(actor, 'file.preview', async state => {
      const { entry, root } = resolveEntry(state,id), format = previewFormat(entry);
      if (!format) fail(415, 'Chỉ xem trước ảnh PNG/JPEG/WebP/GIF và audio WAV/MP3/OGG/M4A trong phạm vi media cho phép.');
      const file = await safeFile(root.root,entry.relative,entry.fingerprint);
      if (file.stat.size <= 0 || file.stat.size > format.maxBytes) fail(413, 'Giới hạn xem trước: ảnh 16 MiB, audio 32 MiB.');
      const handle = await fs.open(file.target,constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
      try {
        if (!same(fingerprint(await handle.stat()),entry.fingerprint)) fail(409, 'File đã thay đổi trước khi xem. Hãy quét lại.');
        const header = Buffer.alloc(32), result = await handle.read(header,0,32,0);
        if (!matchesMediaSignature(header.subarray(0,result.bytesRead),format.mime)) fail(415, 'Nội dung file không khớp định dạng ảnh/audio được hỗ trợ.');
        await audit(state,actor,'file.preview-opened',{ file:entry.relative,root:root.id,bytes:file.stat.size });
        await consume(handle,{ ...entry,type:format.type,mime:format.mime });
      } finally { await handle.close(); }
    });
  }

  async function backupEntry(state, id) {
    const { entry, root } = resolveEntry(state, id);
    if (entry.kind !== 'backup' || !root.id.startsWith('backup')) fail(403, 'Chỉ xử lý backup trong thư mục được phép.');
    const file = await safeFile(root.root, entry.relative, entry.fingerprint);
    const main = await fs.stat(config.dbPath);
    if ((file.stat.ino === main.ino && file.stat.dev === main.dev) || file.target === config.dbPath || file.target.startsWith(config.dbPath + '-')) fail(403, 'Database đang chạy được bảo vệ.');
    return { entry, root, ...file };
  }
  async function checksum(target, expected) {
    const handle = await fs.open(target, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      if (!same(fingerprint(await handle.stat()), expected)) fail(409, 'File thay đổi trước khi đọc.');
      const digest = crypto.createHash('sha256');
      const stream = handle.createReadStream({ autoClose: false });
      for await (const chunk of stream) digest.update(chunk);
      if (!same(fingerprint(await handle.stat()), expected)) fail(409, 'File thay đổi khi đọc.');
      return digest.digest('hex');
    } finally { await handle.close(); }
  }
  async function checkBackup(target) {
    const wal = await fs.stat(target + '-wal').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (wal && wal.size > 0) fail(409, 'Backup còn WAL có dữ liệu; không thể xác minh chỉ một file. Cần snapshot độc lập.');
    if (!config.nativeSqlite) fail(503, 'Kiểm tra backup cần better-sqlite3.');
    const db = new Database(target, { readonly: true, fileMustExist: true, timeout: 3000 });
    try {
      if (db.pragma('quick_check').some(row => Object.values(row)[0] !== 'ok')) fail(409, 'Backup không đạt quick_check; không được xóa.');
      if (db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table'").get().n < 1) fail(409, 'Backup không có bảng dữ liệu.');
    } finally { db.close(); }
    const afterWal = await fs.stat(target + '-wal').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (afterWal && afterWal.size > 0) fail(409, 'Backup thay đổi WAL trong lúc kiểm tra.');
  }
  async function verifyBackup(actor, id, localHash, bytes) {
    if (!/^[a-f0-9]{64}$/.test(localHash) || !Number.isSafeInteger(bytes) || bytes <= 0) fail(400, 'Checksum hoặc dung lượng file local không hợp lệ.');
    return locked(actor, 'backup.verify', async state => {
      const file = await backupEntry(state, id);
      if (bytes !== file.stat.size) fail(409, 'Dung lượng file local không khớp backup.');
      await checkBackup(file.target);
      const sha256 = await checksum(file.target, file.entry.fingerprint);
      if (sha256 !== localHash) fail(409, 'Checksum không khớp. Không cho phép xóa.');
      const verification = { id, actor, sha256, bytes, fingerprint: file.entry.fingerprint, verifiedAt: new Date().toISOString(), expiresAt: Date.now() + DAY, quickCheck: 'ok', restoreTested: false, source: 'local-file-checksum' };
      state.verifications[actor + ':' + id] = verification;
      await audit(state, actor, 'backup.local-verified', { file: file.entry.relative, bytes, sha256, restoreTested: false });
      return verification;
    });
  }
  function evidence(state, actor, file) {
    if (state.pins[file.entry.id]) fail(409, 'Backup đang được ghim.');
    const proof = state.verifications[actor + ':' + file.entry.id];
    if (!proof || proof.expiresAt <= Date.now() || !same(proof.fingerprint, file.entry.fingerprint)) fail(409, 'Cần xác minh file local bằng tài khoản hiện tại trước khi xóa.');
    return proof;
  }
  async function previewDelete(actor, id) {
    return locked(actor, 'backup.delete-preview', async state => {
      const file = await backupEntry(state, id), proof = evidence(state, actor, file);
      const approval = crypto.randomUUID();
      state.previews[approval] = { actor, id, fingerprint: file.entry.fingerprint, sha256: proof.sha256, expiresAt: Date.now() + 10 * 60000 };
      await audit(state, actor, 'backup.delete-preview', { file: file.entry.relative, bytes: file.stat.size });
      return { approval, name: file.entry.name, bytes: file.stat.size, localVerifiedAt: proof.verifiedAt, expiresAt: state.previews[approval].expiresAt, retainedOnHostRequired: false };
    });
  }
  async function deleteBackup(actor, id, approval, confirmation) {
    return locked(actor, 'backup.delete', async (state, job) => {
      const file = await backupEntry(state, id), proof = evidence(state, actor, file), preview = state.previews[approval];
      if (!preview || preview.actor !== actor || preview.id !== id || preview.expiresAt <= Date.now() || preview.sha256 !== proof.sha256 || !same(preview.fingerprint, file.entry.fingerprint)) fail(409, 'Preview hết hạn hoặc không khớp. Hãy xem trước lại.');
      if (confirmation !== file.entry.name) fail(400, 'Tên file xác nhận không khớp.');
      await checkBackup(file.target);
      if (await checksum(file.target, file.entry.fingerprint) !== proof.sha256) fail(409, 'Nội dung backup thay đổi; dừng xóa.');
      await backupEntry(state, id);
      await audit(state, actor, 'backup.delete-intent', { operation: job.id, file: file.entry.relative, bytes: file.stat.size, sha256: proof.sha256, localVerifiedAt: proof.verifiedAt });
      await fs.unlink(file.target);
      delete state.previews[approval];
      for (const [key, value] of Object.entries(state.verifications)) if (value.id === id) delete state.verifications[key];
      state.latest.entries = state.latest.entries.filter(e => e.id !== id);
      job.removedBytes = file.stat.size; job.removedFiles = 1;
      await audit(state, actor, 'backup.deleted', { operation: job.id, file: file.entry.relative, removedBytes: file.stat.size, quotaDeltaBytes: null, recovery: 'Bản local đã đối chiếu SHA-256; chưa thử restore.' });
      return { removedBytes: file.stat.size, quotaDeltaBytes: null };
    });
  }
  async function downloadTicket(actor, id) {
    return locked(actor, 'backup.download-ticket', async state => {
      const file = await backupEntry(state, id), ticket = crypto.randomBytes(32).toString('hex');
      state.downloads ||= {};
      for (const [key, value] of Object.entries(state.downloads)) if (value.expiresAt < Date.now()) delete state.downloads[key];
      state.downloads[hash(ticket)] = { id, actor, expiresAt: Date.now() + 120000, fingerprint: file.entry.fingerprint };
      await audit(state, actor, 'backup.download-requested', { file: file.entry.relative, bytes: file.stat.size });
      return { ticket, expiresInSeconds: 120 };
    });
  }
  async function download(ticket, consume) {
    if (!/^[a-f0-9]{64}$/.test(ticket)) fail(404, 'Lượt tải không hợp lệ.');
    const preliminary = await readState();
    if (!preliminary.downloads?.[hash(ticket)] || preliminary.downloads[hash(ticket)].expiresAt < Date.now()) fail(404, 'Lượt tải hết hạn.');
    return locked('download', 'backup.download', async (state, job) => {
      const key = hash(ticket), lease = state.downloads?.[key];
      if (!lease || lease.expiresAt < Date.now()) fail(404, 'Lượt tải hết hạn. Hãy bấm Tải lại.');
      const file = await backupEntry(state, lease.id);
      if (!same(file.entry.fingerprint, lease.fingerprint)) fail(409, 'Backup đã thay đổi.');
      delete state.downloads[key]; await save(state);
      const handle = await fs.open(file.target, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
      try {
        if (!same(fingerprint(await handle.stat()), lease.fingerprint)) fail(409, 'Backup đã thay đổi trước khi tải.');
        await consume(handle, file.entry);
      } finally { await handle.close(); }
      await audit(state, lease.actor, 'backup.download-served', { file: file.entry.relative, bytes: file.stat.size, localSavedVerified: false });
      job.bytes = file.stat.size;
    });
  }
  async function preflightBackup() {
    const source = await safeFile(path.dirname(config.dbPath), path.basename(config.dbPath));
    let destination = config.backupRoots[0];
    while (true) {
      try { await fs.lstat(destination); break; }
      catch (error) { if (error.code !== 'ENOENT' || path.dirname(destination) === destination) throw error; destination = path.dirname(destination); }
    }
    await safeParents(destination);
    const disk = await fs.statfs(destination), quotaInfo = await quota();
    const diskFree = Number(disk.bavail) * Number(disk.bsize);
    const quotaFree = quotaInfo.status === 'available' ? Math.max(0, quotaInfo.limitBytes - quotaInfo.usedBytes) : null;
    // A shared filesystem's free space does not establish an account's remaining quota.
    if (process.platform !== 'win32' && quotaFree === null) fail(503, 'Chưa xác minh quota tài khoản. Không tự tạo backup lớn trên shared hosting.');
    const free = quotaFree === null ? diskFree : Math.min(diskFree, quotaFree);
    const db = new Database(source.target, { readonly: true, fileMustExist: true });
    let estimate;
    try { estimate = Math.max(source.stat.size, db.pragma('page_count', { simple: true }) * db.pragma('page_size', { simple: true })); } finally { db.close(); }
    const required = Math.ceil(estimate * 1.15) + config.reserveBytes;
    if (free < required) fail(507, 'Không đủ khoảng trống và dự phòng. Hãy chuyển backup có sẵn ra ngoài trước.');
    return { requiredBytes: required, freeBytes: free, quotaVerified: quotaFree !== null };
  }
  async function createBackup(actor) {
    if (!config.nativeSqlite) fail(503, 'Tạo backup cần SQLite native.');
    return locked(actor, 'backup.create', async (state, job) => {
      const space = await preflightBackup();
      await privateDir(config.backupRoots[0]); await safeParents(config.backupRoots[0]);
      await audit(state, actor, 'backup.create-intent', { requiredBytes: space.requiredBytes });
      const target = await createVerifiedBackup(config.dbPath, config.backupRoots[0]);
      job.bytes = (await fs.stat(target)).size;
      await audit(state, actor, 'backup.created', { file: path.basename(target), bytes: job.bytes, quickCheck: 'ok' });
      return { name: path.basename(target), bytes: job.bytes, quickCheck: 'ok' };
    });
  }
  async function pin(actor, id, enabled) {
    if (typeof enabled !== 'boolean') fail(400, 'Trạng thái ghim không hợp lệ.');
    return locked(actor, 'backup.pin', async state => {
      const file = await backupEntry(state, id);
      if (enabled) state.pins[id] = { actor, at: new Date().toISOString() }; else delete state.pins[id];
      await audit(state, actor, enabled ? 'backup.pinned' : 'backup.unpinned', { file: file.entry.relative }); return { pinned: enabled };
    });
  }
  async function hold(actor, id, days, reason) {
    if (!Number.isInteger(days) || days < 0 || days > 365 || typeof reason !== 'string' || reason.length > 200) fail(400, 'Thời hạn/lý do giữ không hợp lệ.');
    return locked(actor, 'file.hold', async state => {
      const { entry } = resolveEntry(state, id);
      if (entry.kind === 'speaking' && days > 0) fail(409, 'Không kéo dài bản thu vượt chính sách 24 giờ.');
      if (days) state.holds[id] = { until: Date.now() + days * DAY, reason: reason || 'Giữ theo quyết định super admin', actor };
      else delete state.holds[id];
      await audit(state, actor, days ? 'file.held' : 'file.released', { file: entry.relative, days, reason }); return { held: Boolean(days) };
    });
  }
  async function policy(actor, updates, confirmation) {
    if (!updates || Object.keys(updates).some(k => !['temporary', 'speaking'].includes(k)) || Object.values(updates).some(v => typeof v !== 'boolean')) fail(400, 'Chính sách không hợp lệ.');
    if (confirmation !== 'BẬT DỌN TỰ ĐỘNG' && Object.values(updates).some(Boolean)) fail(400, 'Cần xác nhận kích hoạt chính sách tự động.');
    return locked(actor, 'policy.update', async state => {
      state.policy = { ...state.policy, ...updates };
      await audit(state, actor, 'policy.updated', { policy: state.policy }); return state.policy;
    });
  }
  async function cleanup(actor, id, action, confirmation) {
    if (!['quarantine', 'delete-expired'].includes(action)) fail(400, 'Hành động không hợp lệ.');
    return locked(actor, 'file.' + action, async (state, job) => {
      const { entry, root } = resolveEntry(state, id);
      if (!['temporary', 'speaking', 'asset'].includes(entry.kind)) fail(403, 'Loại file chưa được cấp quyền dọn.');
      if (state.holds[id]?.until > Date.now()) fail(409, 'File đang được giữ.');
      if (confirmation !== entry.name) fail(400, 'Tên file xác nhận không khớp.');
      const file = await safeFile(root.root, entry.relative, entry.fingerprint);
      const refs = await references(), fresh = classify(root, entry.relative, file.stat, refs);
      if (fresh.status !== 'eligible') fail(409, 'File không còn đủ điều kiện: ' + fresh.reason);
      if (entry.kind === 'asset') {
        const key = 'assets/' + entry.relative.split(path.sep).join('/');
        if (!refs.assets.digests.get(key)?.has(await checksum(file.target, entry.fingerprint))) fail(409, 'Nội dung asset không khớp manifest lịch sử; dừng xử lý.');
        await safeFile(root.root, entry.relative, entry.fingerprint);
      }
      await audit(state, actor, 'file.' + action + '-intent', { operation: job.id, file: entry.relative, root: root.id, bytes: file.stat.size, reason: fresh.reason });
      if (action === 'quarantine') {
        const quarantineId = crypto.randomUUID(), directory = path.join(config.stateRoot, 'quarantine');
        await privateDir(directory); await safeParents(directory);
        const target = path.join(directory, quarantineId + path.extname(entry.name));
        const manifest = { id: quarantineId, rootId: root.id, relative: entry.relative, name: entry.name, target: path.basename(target), bytes: file.stat.size, fingerprint: entry.fingerprint, at: new Date().toISOString(), status: 'moving' };
        state.quarantine[quarantineId] = manifest; await save(state);
        await fs.rename(file.target, target);
        manifest.status = 'quarantined'; job.quarantinedBytes = file.stat.size;
      } else { await fs.unlink(file.target); job.removedBytes = file.stat.size; }
      state.latest.entries = state.latest.entries.filter(e => e.id !== id);
      await audit(state, actor, 'file.' + action + '-completed', { operation: job.id, file: entry.relative, removedBytes: action === 'delete-expired' ? file.stat.size : 0, quarantinedBytes: action === 'quarantine' ? file.stat.size : 0, quotaDeltaBytes: null });
      return { removedBytes: job.removedBytes || 0, quarantinedBytes: job.quarantinedBytes || 0 };
    });
  }
  async function quarantineAction(actor, id, action, confirmation) {
    if (!['restore', 'delete'].includes(action)) fail(400, 'Hành động không hợp lệ.');
    return locked(actor, 'quarantine.' + action, async state => {
      const item = state.quarantine[id], root = item && roots().find(r => r.id === item.rootId);
      if (!item || !root || !['speaking', 'temporary-pdf', 'temporary-reading', 'assets', 'assets-client'].includes(root.id) || item.status !== 'quarantined') fail(404, 'Manifest cách ly không hợp lệ.');
      if (confirmation !== item.name) fail(400, 'Tên xác nhận không khớp.');
      const source = await safeFile(path.join(config.stateRoot, 'quarantine'), item.target, item.fingerprint);
      await audit(state, actor, 'quarantine.' + action + '-intent', { file: item.name, bytes: item.bytes });
      if (action === 'restore') {
        const target = path.resolve(root.root, item.relative);
        if (!inside(root.root, target)) fail(403, 'Đường dẫn phục hồi ngoài phạm vi.');
        await safeParents(path.dirname(target));
        // link is exclusive: an existing original is never overwritten.
        await fs.link(source.target, target); await fs.unlink(source.target);
      } else await fs.unlink(source.target);
      delete state.quarantine[id];
      await audit(state, actor, 'quarantine.' + action + '-completed', { file: item.name, removedBytes: action === 'delete' ? item.bytes : 0 });
      return { restored: action === 'restore', removedBytes: action === 'delete' ? item.bytes : 0 };
    });
  }
  async function automate(execute = false) {
    await scan('cron');
    const state = await readState();
    const eligible = state.latest.entries.filter(e => e.status === 'eligible' && ['temporary','speaking'].includes(e.kind));
    if (!execute) return { dryRun: true, candidates: eligible.map(e => ({ id: e.id, name: e.name, bytes: e.bytes, reason: e.reason, policyEnabled: Boolean(state.policy[e.kind]) })) };
    const candidates = eligible.filter(e => Boolean(state.policy[e.kind]));
    const results = [];
    for (const entry of candidates.slice(0, 100)) {
      // Re-read policy before each file, so an admin pause takes effect.
      const current = await readState();
      if (!current.policy[entry.kind]) break;
      try { results.push({ id: entry.id, result: await cleanup('cron', entry.id, 'delete-expired', entry.name) }); }
      catch (error) { results.push({ id: entry.id, error: error instanceof MaintenanceError ? error.message : 'Tác vụ lỗi' }); break; }
    }
    return { dryRun: false, results };
  }
  return { summary, scan, previewMedia, verifyBackup, previewDelete, deleteBackup, downloadTicket, download, createBackup, pin, hold, policy, cleanup, quarantineAction, automate, config };
}
