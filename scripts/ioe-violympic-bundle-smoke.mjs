import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import Database from 'better-sqlite3';

// Runs the canonical production bundle against a backup of the isolated browser
// fixture. It never starts an authentication bypass or writes to the source DB.
const fixture = path.resolve('.data/ioe-verification/browser-2.sqlite');
assert.ok(fs.existsSync(fixture), 'Run the isolated competition browser fixture first.');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'competition-bundle-'));
const dbPath = path.join(root, 'app.sqlite');
const source = new Database(fixture, { readonly: true, fileMustExist: true });
await source.backup(dbPath); source.close();
const db = new Database(dbPath, { readonly: true });
const paper = JSON.parse(db.prepare("SELECT data_json FROM competition_papers WHERE subject='math' AND status='published' AND visibility='public' ORDER BY created_at DESC LIMIT 1").get().data_json);
for (const row of db.prepare('SELECT DISTINCT url FROM competition_asset_usages').all()) {
  if (!/^\/listening-media\/[a-f0-9]{64}\.(?:png|wav)$/.test(row.url)) continue;
  const name = path.basename(row.url), mediaDir = path.join(root, 'listening-media');
  fs.mkdirSync(mediaDir, { recursive: true });
  fs.copyFileSync(path.join('.data/listening-media', name), path.join(mediaDir, name));
}
db.close();
const listener = net.createServer(); await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
const port = listener.address().port; await new Promise(resolve => listener.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['dist/server.cjs'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: {
  ...process.env, NODE_ENV: 'production', LOCAL_AUTH_BYPASS_ENABLED: 'false', STORAGE_MODE: 'sqlite', SQLITE_DRIVER: 'better-sqlite3',
  SQLITE_DB_PATH: dbPath, SQLITE_ALLOW_CREATE: 'false', SQLITE_ALLOW_JSON_IMPORT: 'false', SEED_DATA_ENABLED: 'false',
  LEARNING_HISTORY_ENABLED: 'true', LISTENING_TICKET_SECRET: 'fixture-only-bundle-ticket-secret', GUEST_PUBLIC_ID_SECRET: 'fixture-only-bundle-public-id-secret', DIAGNOSTIC_SECRET: 'fixture-only-bundle-diagnostics',
  LISTENING_MEDIA_DIR: path.join(root, 'listening-media'), TTS_AUDIO_DIR: path.join(root, 'audio'), VOCAB_IMAGE_DIR: path.join(root, 'vocab-images'), PORT: String(port),
} });
let logs = ''; child.stdout.on('data', chunk => { logs += chunk; }); child.stderr.on('data', chunk => { logs += chunk; });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  let ready = false;
  for (let i = 0; i < 60; i++) { try { const r = await fetch(origin + '/api/ioe-violympic/capabilities'); if (r.ok && (await r.json()).enabled) { ready = true; break; } } catch { /* Startup in progress. */ } await delay(200); }
  assert.ok(ready, 'Production bundle did not start: ' + logs.slice(-1000));
  const badAuth = await fetch(origin + '/api/ioe-violympic/admin/inventory', { headers: { Authorization: 'Bearer local-test-auth-bypass' } });
  assert.equal(badAuth.status, 401, 'Production must reject local-test auth');
  const html = await (await fetch(origin + `/ioe-violympic/paper/${paper.id}`)).text(); assert.match(html, /assets\/index-[^"']+\.js/);
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"']+)"/g)].map(match => match[1]);
  for (const asset of assets) assert.equal((await fetch(origin + asset)).status, 200, 'Built asset missing: ' + asset);
  const guestId = 'guest-' + crypto.randomUUID(), name = 'QA Guest';
  const profileResponse = await fetch(origin + '/api/guest-profiles/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestId, displayName: name }) });
  assert.equal(profileResponse.status, 200); const profile = await profileResponse.json(); assert.ok(profile.guestAccessToken);
  const headers = { 'Content-Type': 'application/json', 'X-Guest-Id': profile.guestId, 'X-Guest-Access-Token': profile.guestAccessToken };
  const call = async (url, method = 'GET', body, ticket) => { const r = await fetch(origin + url, { method, headers: { ...headers, ...(ticket ? { 'X-Attempt-Ticket': ticket } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }); const data = await r.json(); assert.ok(r.ok, url + ': ' + JSON.stringify(data)); return data; };
  const prepared = await call('/api/ioe-violympic/attempts/prepare', 'POST', { paperId: paper.id, clientRunId: crypto.randomUUID(), studentName: 'Forged name' });
  assert.equal(prepared.status, 'prepared'); assert.doesNotMatch(JSON.stringify(prepared), /answerSpec|correctOptionId|explanation|ownerId|sourceNumber/);
  const active = await call(`/api/ioe-violympic/attempts/${prepared.id}/activate`, 'POST', {}, prepared.ticket);
  const answers = Object.fromEntries(active.questions.map(q => { const number = Number(q.prompt.match(/(\d+)\+1/)[1]) + 1; return [q.id, q.interaction === 'choice' ? { selectedOptionId: q.options.find(o => o.text === String(number)).id } : { textAnswer: String(number) }]; }));
  const saved = await call(`/api/ioe-violympic/attempts/${prepared.id}/answers`, 'PUT', { revision: active.revision, answers }, prepared.ticket);
  assert.ok(!('questions' in saved), 'Autosave must stay compact');
  const submitted = await call(`/api/ioe-violympic/attempts/${prepared.id}/submit`, 'POST', { revision: saved.revision, answers }, prepared.ticket);
  assert.equal(submitted.result.score, 100); assert.equal(submitted.result.rawScore, 300);
  const review = await call(`/api/ioe-violympic/attempts/${prepared.id}/review`, 'GET', undefined, prepared.ticket); assert.equal(review.rows.length, 30);
  for (const media of review.rows.flatMap(row => [...row.question.media, ...row.question.options.flatMap(o => o.media)])) assert.equal((await fetch(origin + media.url)).status, 200);
  const history = await call('/api/my-learning-history?sourceType=competition'); assert.ok(history.items.some(row => row.attemptId === prepared.id && row.studentName === name));
  const detail = await call(`/api/my-learning-history/${prepared.id}`); assert.equal(detail.detail.extraDetails.competitionReview.rows.length, 30);
  const topics = await call('/api/ioe-violympic/bank-topics');
  const bank = topics.find(row => row.id === 'bank-math-3-school'); assert.ok(bank.ready);
  const bankRun = await call('/api/ioe-violympic/attempts/prepare', 'POST', { paperId: bank.id, clientRunId: crypto.randomUUID() });
  assert.equal(bankRun.questions.length, 30); assert.doesNotMatch(JSON.stringify(bankRun), /answerSpec|correctOptionId|explanation|ownerId|sourceNumber/);
  const bankActive = await call(`/api/ioe-violympic/attempts/${bankRun.id}/activate`, 'POST', {}, bankRun.ticket);
  const bankAnswers = Object.fromEntries(bankActive.questions.map(q => { const number = Number(q.prompt.match(/(\d+)\+1/)[1]) + 1; return [q.id, q.interaction === 'choice' ? { selectedOptionId: q.options.find(o => o.text === String(number)).id } : { textAnswer: String(number) }]; }));
  const bankDone = await call(`/api/ioe-violympic/attempts/${bankRun.id}/submit`, 'POST', { revision: bankActive.revision, answers: bankAnswers }, bankRun.ticket);
  assert.equal(bankDone.result.rawScore, 300); assert.equal((await call(`/api/my-learning-history/${bankRun.id}`)).detail.extraDetails.competitionReview.rows.length, 30);
  const report = { passed: true, node: process.version, productionBypassRejected: true, assets: assets.length, questions: review.rows.length, score: submitted.result.score, rawScore: submitted.result.rawScore, bankQuestions: bankRun.questions.length, bankScore: bankDone.result.rawScore, history: true, media: true };
  fs.writeFileSync('.data/ioe-verification/bundle-report.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally {
  child.kill('SIGTERM');
  if (child.exitCode === null) await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(10000)]);
  // Keep the isolated backup for inspection; never remove a production path.
}
