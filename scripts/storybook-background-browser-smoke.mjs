import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { build } from 'esbuild';

// Real History with an isolated read-only API; other roots exercise their actual CSS.
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'storybook-background-qa-'));
const output = path.resolve('.data/storybook-background-verification');
fs.mkdirSync(output, { recursive: true });
const styles = [
  'src/components/history/HistoryTheme.css', 'src/components/games/VocabularyTheme.css',
  'src/components/grammar/GrammarLearningTheme.css', 'src/components/student/student-module-theme.css',
  'src/features/exam-platform/student/starter-player.css', 'src/features/exam-platform/student/journey-state.css',
];
const selectors = {
  history: '#student-history-page', vocabulary: '#student-area-root', grammar: '#grammar-learning-root',
  speaking: '#speaking-student', competition: '#ioe-violympic-student',
  starter: '#generic-exam-player', result: '#qa-result-screen',
};
await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React from 'react';import {createRoot} from 'react-dom/client';
import StudentHistoryPage from './src/components/history/StudentHistoryPage';
const kind=new URLSearchParams(location.search).get('kind')||'history';
const roots={vocabulary:{id:'student-area-root','data-vocab-theme':'storybook'},grammar:{id:'grammar-learning-root'},
speaking:{id:'speaking-student','data-student-module-theme':'storybook'},competition:{id:'ioe-violympic-student','data-student-module-theme':'storybook'},
starter:{id:'generic-exam-player','data-exam-theme':'starter'},result:{id:'qa-result-screen','data-student-journey':'storybook'}};
createRoot(document.getElementById('fixture')).render(kind==='history'?<StudentHistoryPage authToken="fixture-auth" onBack={()=>{}}/>:
<main {...roots[kind]} style={{minHeight:'100dvh'}}><div style={{margin:'24px',padding:'24px',background:'#fffdf3',borderRadius:'24px'}}>
<h1>{kind} · Scenery verification</h1><button id="qa-control" onClick={()=>window.qaClicked=true}>Kiểm tra thao tác</button></div>
<div id="qa-long-content" style={{height:'3200px'}} aria-hidden="true"/></main>);
` }, outfile: path.join(work, 'fixture.js'), bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' },
  plugins: [{ name: 'fixture', setup(builder) {
    builder.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'css' }));
    builder.onResolve({ filter: /context\/AuthContext/ }, () => ({ path: 'auth', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: "export function useAuth(){return {token:'fixture-auth',user:{id:'fixture-student'},loading:false};}", loader: 'js' }));
  } }], logLevel: 'silent' });
const globals = fs.readFileSync('dist/client/index.html', 'utf8').match(/href="(\/assets\/[^" ]+\.css)"/)?.[1];
assert(globals);
const items = Array.from({ length: 20 }, (_, index) => ({
  attemptId: `background-fixture-${index}`, sourceType: 'grammar', lessonTitle: `Bài luyện tập ${index + 1}`,
  gameId: 'grammar', gameTitle: 'Luyện ngữ pháp', score: 80, correctCount: 8, incorrectCount: 2,
  unansweredCount: 0, totalQuestions: 10, durationSeconds: 120, startedAt: '2026-10-07T09:00:00Z',
  completedAt: '2026-10-07T09:02:00Z', activityAt: '2026-10-07T09:02:00Z',
  attemptStatus: 'completed', attemptNumber: 1, detailStatus: 'available',
}));
const errors = [], requests = [], reports = {}, screenshots = {}, backgroundShots = {};
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://fixture');
  if (url.pathname.startsWith('/api/')) {
    assert.equal(req.method, 'GET'); requests.push(url.pathname);
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/api/my-learning-history') return res.end(JSON.stringify({ items,
      summary: { totalAttempts: 20, completedAttempts: 20, averageScore: 80, bestScore: 80, totalCorrect: 160,
        totalIncorrect: 40, totalUnanswered: 0, totalDurationSeconds: 2400, studyDays: 1 },
      pagination: { page: 1, pageSize: 20, totalItems: 20, totalPages: 1 }, filterOptions: {} }));
    return res.end(JSON.stringify({ attempt: items[0], detailStatus: 'available', detail: { answerDetails: [], warnings: [] } }));
  }
  if (url.pathname === '/') {
    res.setHeader('Content-Type', 'text/html');
    return res.end(`<html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${globals}"><link rel="stylesheet" href="/theme.css${url.search}"></head><body style="margin:0"><div id="app-root"><div id="fixture"></div></div><script type="module" src="/fixture.js"></script></body></html>`);
  }
  if (url.pathname === '/theme.css') {
    res.setHeader('Content-Type', 'text/css');
    const baseline = url.searchParams.has('baseline');
    let css = fs.readFileSync('src/features/starter-scene/fonts.css', 'utf8');
    for (const file of styles) css += '\n' + fs.readFileSync(baseline ? path.join('.data/storybook-background-before', file) : file, 'utf8').replace(/@import[^;]+;/g, '');
    if (!baseline) css += '\n' + fs.readFileSync('src/styles/storybook-background.css', 'utf8');
    return res.end(css);
  }
  const file = url.pathname === '/fixture.js' ? path.join(work, 'fixture.js') : path.resolve('dist/client', '.' + url.pathname);
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.webp') ? 'image/webp' : 'application/octet-stream');
  let content = fs.readFileSync(file);
  if (file.endsWith('.css')) content = Buffer.from(content.toString().replace(/@import\s*url\([^)]*\)\s*;/g, ''));
  res.end(content);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`, port = 12000 + Math.floor(Math.random() * 15000);
const chrome = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(work, 'profile')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let tab; for (let i = 0; i < 150; i++) { try { tab = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); if (tab) break; } catch {} await delay(100); }
  assert(tab); socket = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0; const pending = new Map();
  socket.onmessage = event => { const message = JSON.parse(event.data); if (!message.id) { if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails); return; }
    const call = pending.get(message.id); if (!call) return; pending.delete(message.id); clearTimeout(call.timer); message.error ? call.reject(Error(message.error.message)) : call.resolve(message.result); };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(Error(method)); }, 15000); pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const wait = async expression => { for (let i = 0; i < 150; i++) { if (await evaluate(`Boolean(${expression})`)) return; await delay(70); } throw Error(expression); };
  const shot = async key => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); const file = path.join(output, key + '.png'); fs.writeFileSync(file, Buffer.from(r.data, 'base64')); screenshots[key] = file; };
  const metrics = selector => evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}),s=getComputedStyle(r),b=getComputedStyle(r,'::before');return {height:r.getBoundingClientRect().height,viewport:innerHeight,width:document.documentElement.clientWidth,screenWidth:innerWidth,scroll:scrollY,overflow:document.documentElement.scrollWidth>innerWidth+1,isolation:s.isolation,rootImage:s.backgroundImage,layer:{content:b.content,position:b.position,top:b.top,left:b.left,width:parseFloat(b.width),height:parseFloat(b.height),size:b.backgroundSize,image:b.backgroundImage,repeat:b.backgroundRepeat,pointer:b.pointerEvents,z:b.zIndex}}})()`);
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: origin + '/?kind=history&baseline=1' }); await wait("document.querySelectorAll('.history-table-row').length===20");
  const before = await metrics(selectors.history);
  assert(before.height > 1440 * 1024 / 1536 && before.layer.content === 'none' && before.rootImage.includes('bg-starter-exam-v1.webp'), 'Baseline reproduces finite-height scenery under a long History list');
  await evaluate('scrollTo(0,document.documentElement.scrollHeight)'); await delay(100); await shot('history-baseline-bottom'); reports.baseline = before;
  for (const [kind, selector] of Object.entries(selectors)) {
    await send('Page.navigate', { url: origin + '/?kind=' + kind }); await wait(`document.querySelector(${JSON.stringify(selector)})`);
    await evaluate("(()=>{const style=document.createElement('style');style.textContent='.qa-background-only > * {visibility:hidden!important}';document.head.append(style)})()");
    if (kind === 'history') await wait("document.querySelectorAll('.history-table-row').length===20");
    await evaluate('document.fonts.ready.then(()=>true)');
    for (const [width, height] of [[1440, 1000], [1024, 768], [390, 844], [320, 568], [844, 390]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 900 });
      await evaluate('scrollTo(0,0)'); await delay(80);
      for (const position of ['top', 'middle', 'bottom']) {
        await evaluate(position === 'top' ? 'scrollTo(0,0)' : position === 'middle' ? 'scrollTo(0,(document.documentElement.scrollHeight-innerHeight)/2)' : 'scrollTo(0,document.documentElement.scrollHeight)'); await delay(60);
        const value = await metrics(selector), b = value.layer, key = `${kind}-${width}-${height}-${position}`;
        assert(value.height > height && !value.overflow && value.isolation === 'isolate' && value.rootImage === 'none', key + ' root ' + JSON.stringify(value));
        assert(b.content === '""' && b.position === 'fixed' && b.top === '0px' && b.left === '0px' && Math.abs(b.width - value.width) < 1 && Math.abs(b.height - height) < 1 && b.size === 'cover' && b.repeat === 'no-repeat' && b.image.includes('bg-starter-exam-v1.webp') && b.pointer === 'none' && b.z === '-1', key + ' layer ' + JSON.stringify(value));
        reports[key] = value;
        if ((kind === 'history' || kind === 'vocabulary' || kind === 'starter') && [1440, 320].includes(width) && position !== 'middle') {
          await shot(key);
          // Hide only children, retaining the real page height and the root's scenery.
          // Otherwise varying card shadows also tint the edge pixels being compared.
          await evaluate(`document.querySelector(${JSON.stringify(selector)}).classList.add('qa-background-only')`);
          const sceneryKey = `${kind}-${width}-${height}-background-${position}`;
          await shot(sceneryKey); backgroundShots[sceneryKey] = screenshots[sceneryKey];
          await evaluate(`document.querySelector(${JSON.stringify(selector)}).classList.remove('qa-background-only')`);
        }
      }
      await evaluate('scrollTo(0,0)');
      if (kind !== 'history') { await evaluate("window.qaClicked=false;document.querySelector('#qa-control').click()"); assert(await evaluate('window.qaClicked')); }
    }
  }
  await send('Page.navigate', { url: origin + '/?kind=history' }); await wait("document.querySelectorAll('.history-table-row').length===20");
  await evaluate("document.querySelector('.history-detail-button').click()"); await wait("document.querySelector('.history-modal')&&!document.querySelector('.history-modal [role=status]')");
  assert(await evaluate("(()=>{const b=document.querySelector('#student-history-modal-close-btn'),r=b.getBoundingClientRect();return b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()"), 'The scenery stays behind the modal');
  await evaluate("document.querySelector('#student-history-modal-close-btn').click()"); await wait("!document.querySelector('.history-modal')");
  assert.equal(errors.length, 0, JSON.stringify(errors));
  const pixelCheck = spawnSync(process.env.PYTHON_PATH || 'D:\\python3\\python.exe', ['-c',
    "import json,sys;from PIL import Image;d=json.load(sys.stdin);checks=[]\nfor key,file in d.items():\n if key.endswith('-top'):\n  bottom=key[:-4]+'-bottom';a=Image.open(file).convert('RGB');b=Image.open(d[bottom]).convert('RGB');box=(0,0,3,a.height);same=a.crop(box).tobytes()==b.crop(box).tobytes();checks.append({'top':key,'bottom':bottom,'sameEdgePixels':same});assert same,key\nprint(json.dumps(checks))"], { encoding: 'utf8', input: JSON.stringify(backgroundShots) });
  assert.equal(pixelCheck.status, 0, pixelCheck.stderr); reports.edgePixels = JSON.parse(pixelCheck.stdout);
  const result = { passed: true, work, reports, screenshots, errors, apiWrites: 0, historyRequests: requests.length };
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ passed: true, states: Object.keys(reports).length, screenshots, edgePixels: reports.edgePixels }));
} finally { socket?.close(); chrome.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
