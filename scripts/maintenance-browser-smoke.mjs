import { spawn } from 'node:child_process';
import fs, { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = Number(process.env.CSS_QA_DEBUG_PORT || (10_000 + Math.floor(Math.random() * 20_000)));
const origin = process.env.CSS_QA_ORIGIN || 'http://127.0.0.1:3177';
const qaRoot = mkdtempSync(path.join(os.tmpdir(), 'vhomework-css-qa-'));
const profileDir = path.join(qaRoot, 'profile');
const screenshotDir = path.resolve('.data/maintenance-qa/screenshots');
mkdirSync(profileDir, { recursive: true });
mkdirSync(screenshotDir, { recursive: true });

let baselineAt=null;
try { const f=JSON.parse(fs.readFileSync(path.resolve('.data/maintenance-qa/fixture.json'),'utf8')); baselineAt=JSON.parse(fs.readFileSync(path.join(f.root,'maintenance/state.json'),'utf8')).latest?.at || null; } catch {}
const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--disable-gpu-compositing',
  '--disable-gpu-shader-disk-cache',
  '--disable-features=Vulkan,SkiaGraphite,Dawn,UseDMSAA',
  '--use-angle=swiftshader',
  '--use-gl=angle',
  '--enable-unsafe-swiftshader',
  '--no-sandbox',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  '--window-size=1440,1000',
  origin,
], {
  stdio: ['ignore', 'ignore', 'pipe'],
  windowsHide: true,
});

let chromeError = '';
chrome.stderr.setEncoding('utf8');
chrome.stderr.on('data', chunk => {
  chromeError += chunk;
});

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForDebugger() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      if (response.ok) return response.json();
    } catch {
      // Chrome is still starting.
    }
    await delay(100);
  }
  throw new Error(`Chrome DevTools endpoint did not start. ${chromeError.slice(-800)}`);
}

function createCdpClient(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();
  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timeoutId);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  socket.addEventListener('close', event => {
    const detail = `Chrome DevTools WebSocket closed (${event.code}): ${event.reason}`;
    for (const [id, request] of pending) {
      clearTimeout(request.timeoutId);
      request.reject(new Error(detail));
      pending.delete(id);
    }
  });
  socket.addEventListener('error', error => {
    for (const [id, request] of pending) {
      clearTimeout(request.timeoutId);
      request.reject(error);
      pending.delete(id);
    }
  });

  return {
    ready,
    close: () => socket.close(),
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = nextId++;
        const timeoutId = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Chrome DevTools command timed out: ${method}`));
        }, 10_000);
        pending.set(id, { resolve, reject, timeoutId });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const targets = await waitForDebugger();
  const target = targets.find(item => item.type === 'page' && item.url.startsWith(origin));
  if (!target?.webSocketDebuggerUrl) throw new Error('Localhost page target was not created.');

  const cdp = createCdpClient(target.webSocketDebuggerUrl);
  await Promise.race([
    cdp.ready,
    delay(5_000).then(() => {
      throw new Error('Timed out opening the Chrome DevTools WebSocket.');
    }),
  ]);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  const evaluate = async (expression, userGesture = false) => {
    const result = await cdp.send('Runtime.evaluate', {
      expression,
      userGesture,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  };

  const waitFor = async expression => {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      if (await evaluate(`Promise.resolve(${expression}).then(value => Boolean(value))`)) return;
      await delay(100);
    }
    console.log(await evaluate("document.querySelector('#maintenance-media-preview')?.outerHTML || document.body.innerText.slice(-3000)"));
    console.log(await evaluate("Promise.all(['/summary','/inventory/summary'].map(url=>fetch('/api/admin/maintenance'+url,{headers:{Authorization:'Bearer local-test-auth-bypass'}}).then(async r=>{const d=await r.json();return {url,status:r.status,at:d.latest?.at,complete:d.latest?.complete,scanRunning:d.scanRunning,busy:d.busy,scanError:d.scanError,latestStatus:d.latest?.status};})))"));
    await screenshot('maintenance-failure');
    throw new Error(`Timed out waiting for ${expression}`);
  };

  const viewport = async (width, height, mobile = false) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    });
    await delay(100);
  };

  const screenshot = async name => {
    const result = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    const filePath = path.join(screenshotDir, `${name}.png`);
    writeFileSync(filePath, Buffer.from(result.data, 'base64'));
    return filePath;
  };

  const verifyFrames=async label=>{
    const frames=await evaluate('('+function(){return [...document.querySelectorAll('#maintenance-center .maintenance-scroll-region')].filter(el=>el.offsetWidth).map(el=>{const s=getComputedStyle(el);return {label:el.getAttribute('aria-label'),height:el.clientHeight,maxHeight:parseFloat(s.maxHeight),overflow:s.overflowY,tabIndex:el.tabIndex,scrollHeight:el.scrollHeight};});}.toString()+')()');
    assert(frames.length>0,'Each tab has framed content: '+label);
    assert(frames.every(frame=>frame.label&&frame.tabIndex===0&&frame.overflow==='auto'&&Number.isFinite(frame.maxHeight)&&frame.height<=frame.maxHeight+2),'Content frames are bounded and keyboard accessible: '+label);
    return frames;
  };


  const fixture=JSON.parse(fs.readFileSync(path.resolve('.data/maintenance-qa/fixture.json'),'utf8'));
  assert(path.basename(fixture.root).startsWith('vhomework-maintenance-browser-'),'Only isolated QA files can be changed');
  const report={origin,checks:[],screenshots:[]},png=fs.readFileSync('public/logo.png'),past=new Date(Date.now()-8*86400000);
  for(let i=0;i<40;i++){const file=path.join(fixture.root,'listening-media','f'.repeat(60)+i.toString(16).padStart(4,'0')+'.png');fs.writeFileSync(file,png);fs.utimesSync(file,past,past);}
  const usedName='a'.repeat(64)+'.png';fs.writeFileSync(path.join(fixture.root,'listening-media',usedName),png);
  fs.mkdirSync(path.join(fixture.root,'deployment/dist/client/assets'),{recursive:true});fs.writeFileSync(path.join(fixture.root,'deployment/dist/client/assets/protected-layout.js'),Buffer.alloc(64000,32));
  const Database=(await import('better-sqlite3')).default,db=new Database(path.join(fixture.root,'app.sqlite'));
  const audio=fs.readFileSync(path.join(fixture.root,'listening-media','e'.repeat(64)+'.wav')),speaking=path.join(fixture.root,'speaking-recordings');fs.mkdirSync(speaking,{recursive:true});
  const expired='22222222-2222-4222-8222-222222222222',busy='33333333-3333-4333-8333-333333333333',fresh='44444444-4444-4444-8444-444444444444';
  for(const [id,status] of [[expired,'completed'],[busy,'assessing'],[fresh,'completed']]){
    const value={audioExpiresAt:new Date(Date.now()+(id===fresh?1:-2)*86400000).toISOString(),score:88};
    db.prepare('INSERT OR REPLACE INTO speaking_attempts(id,owner_key,lesson_id,version_id,client_run_id,status,student_name,created_at,data_json) VALUES(?,?,?,?,?,?,?,?,?)').run(id,'qa-owner','qa-lesson','qa-version',id,status,'QA',past.toISOString(),JSON.stringify(value));
    const file=path.join(speaking,id+'.wav');fs.writeFileSync(file,audio);if(id!==fresh)fs.utimesSync(file,past,past);
  }
  const preservedAttempt=db.prepare('SELECT data_json FROM speaking_attempts WHERE id=?').get(expired).data_json;db.close();
  const selectTab=async label=>{await evaluate("[...document.querySelectorAll('#maintenance-center nav button')].find(b=>b.textContent==="+JSON.stringify(label)+").click()");await delay(100);};
  const appSummary=()=>evaluate("fetch('/api/admin/maintenance/summary',{headers:{Authorization:'Bearer local-test-auth-bypass'}}).then(r=>r.json())");
  const hostSummary=()=>evaluate("fetch('/api/admin/maintenance/inventory/summary',{headers:{Authorization:'Bearer local-test-auth-bypass'}}).then(r=>r.json())");
  const waitComplete=async()=>{await waitFor("fetch('/api/admin/maintenance/summary',{headers:{Authorization:'Bearer local-test-auth-bypass'}}).then(r=>r.json()).then(d=>d.latest?.complete&&!d.scanRunning&&!d.busy)");await waitFor("fetch('/api/admin/maintenance/inventory/summary',{headers:{Authorization:'Bearer local-test-auth-bypass'}}).then(r=>r.json()).then(d=>d.latest?.status==='completed'&&d.latest.filesystemComplete)");await waitFor("document.querySelector('#maintenance-scan')?.disabled===false");};
  await waitFor("document.querySelector('#tab-maintenance')");const appBefore=(await appSummary()).latest?.at||null,hostBefore=(await hostSummary()).latest?.id||null;
  await evaluate("document.querySelector('#tab-maintenance').click()");await waitFor("document.querySelector('.maintenance-dashboard')");
  assert(await evaluate("[...document.querySelectorAll('nav[aria-label=\"Chức năng maintenance\"] button')].map(b=>b.textContent).join('|')==='Tổng quan|File & Dọn dẹp|Cài đặt tự động'"),'Only the three requested tabs exist');
  assert(await evaluate("[...document.querySelectorAll('#maintenance-center button')].every(b=>b.closest('nav[aria-label=\"Chức năng maintenance\"]'))&&!document.querySelector('.hosting-inventory')"),'Overview is information only without hosting inspectors');
  assert(((await appSummary()).latest?.at||null)===appBefore&&((await hostSummary()).latest?.id||null)===hostBefore,'Opening overview never scans');report.checks.push('three-tabs-overview-no-actions-no-automatic-scan');
  await selectTab('File & Dọn dẹp');await waitFor("document.querySelector('#maintenance-scan')?.disabled===false");
  assert(await evaluate("document.querySelector('#maintenance-scan').textContent==='Quét tất cả'&&!document.querySelector('.maintenance-scope-tabs')&&!document.querySelector('#hosting-inventory-scan')"),'A single scan control replaces separate scopes');
  await evaluate("document.querySelector('#maintenance-scan').click()");await waitComplete();
  assert((await hostSummary()).latest.id!==hostBefore&&(await appSummary()).latest.at!==appBefore,'One button started both real scanners');report.checks.push('one-button-starts-both-real-scans');
  const statePath=path.join(fixture.root,'maintenance/state.json'),state=JSON.parse(fs.readFileSync(statePath,'utf8'));
  state.snapshots.unshift({at:new Date(Date.now()-86400000).toISOString(),complete:true,bytes:1000,groups:Object.fromEntries(state.latest.groups.map(g=>[g.id,Math.max(0,g.bytes-512)]))});fs.writeFileSync(statePath,JSON.stringify(state));
  fs.appendFileSync(path.join(fixture.root,'.npm/_cacache/blob'),'x'.repeat(2048));
  const scanId=(await hostSummary()).latest.id;await evaluate("document.querySelector('#maintenance-scan').click()");await waitFor("fetch('/api/admin/maintenance/inventory/summary',{headers:{Authorization:'Bearer local-test-auth-bypass'}}).then(r=>r.json()).then(d=>d.latest?.id!=="+JSON.stringify(scanId)+"&&d.latest?.status==='completed')");await waitComplete();
  await selectTab('Tổng quan');await waitFor("document.querySelector('[aria-label=\"Tăng trưởng thư mục hosting\"] .maintenance-folder-row')");
  assert(await evaluate("document.querySelector('[aria-label=\"Tăng trưởng thư mục ứng dụng\"]').textContent.includes('Asset frontend (Node)')&&document.querySelector('[aria-label=\"Tăng trưởng thư mục ứng dụng\"]').textContent.includes('dist')"),'Application rows show configured label and path');
  assert(await evaluate("[...document.querySelectorAll('[aria-label=\"Tăng trưởng thư mục hosting\"] .maintenance-folder-row')].find(r=>r.textContent.includes('.npm'))?.textContent.includes('Tăng')"),'Hosting chart shows a real directory increase');
  assert(await evaluate("document.querySelectorAll('.maintenance-mini-bars li').length>10&&!document.querySelector('.maintenance-history')"),'Small per-folder bar charts replace the large history panel');
  await evaluate("document.querySelector('.maintenance-mini-bars li').focus()");assert(await evaluate("getComputedStyle(document.activeElement,'::after').content!=='none'"),'Mini chart values are available by keyboard');
  report.checks.push('folder-label-path-purpose-mini-charts-real-growth-keyboard');
  await evaluate("document.activeElement.blur();document.querySelector('#maintenance-center').scrollIntoView({block:'start'})");report.screenshots.push(await screenshot('maintenance-focused-overview-desktop'));
  await viewport(390,844,true);assert(!await evaluate("document.documentElement.scrollWidth>innerWidth+1"),'Overview fits mobile');await evaluate("document.querySelector('.maintenance-growth-grid').scrollIntoView({block:'start'})");report.screenshots.push(await screenshot('maintenance-focused-overview-mobile'));await verifyFrames('Overview mobile');report.checks.push('overview-bounded-mobile-layout');
  await viewport(1440,1000);await selectTab('File & Dọn dẹp');await waitFor("document.querySelector('tr[data-file-id]')");
  const catalog=await appSummary(),shown=await evaluate("[...document.querySelectorAll('tr[data-file-id]')].map(r=>r.dataset.fileId)");
  assert(shown.every(id=>{const e=catalog.latest.entries.find(e=>e.id===id);return e.kind==='speaking'||e.kind==='media'&&['suspected','held'].includes(e.status);}), 'Only recordings and suspected media are listed');
  assert(!await evaluate("[...document.querySelectorAll('tr[data-file-id]')].some(r=>r.textContent.includes('protected-layout.js')||r.textContent.includes('11111111-1111-4111-8111-111111111111')||r.textContent.includes("+JSON.stringify(usedName)+")||r.textContent.includes("+JSON.stringify(fresh)+"))"),'Assets/temp/used files stay outside cleanup table');
  assert(await evaluate("[...document.querySelectorAll('tr[data-file-id]')].find(r=>r.textContent.includes("+JSON.stringify(busy)+"))?.textContent.includes('Quá hạn, đang bị giữ')"),'Busy expired recording stays blocked');report.checks.push('cleanup-list-only-recordings-and-orphan-media-with-busy-guard');
  await verifyFrames('File cleanup desktop');await evaluate("(()=>{const frame=document.querySelector('[aria-label=\"Bản thu và file nghi ngờ mồ côi\"]');frame.scrollTop=160;})()");
  assert(await evaluate("(()=>{const frame=document.querySelector('[aria-label=\"Bản thu và file nghi ngờ mồ côi\"]');return frame.scrollTop>0&&Math.abs(frame.querySelector('th').getBoundingClientRect().top-frame.getBoundingClientRect().top)<3;})()"),'File rows scroll under sticky headings');report.checks.push('bounded-file-table-sticky-heading');
  await evaluate("document.querySelector('[aria-label=\"Bản thu và file nghi ngờ mồ côi\"]').scrollTop=0;[...document.querySelectorAll('tbody button')].find(b=>b.textContent==='Xem ảnh').focus();[...document.querySelectorAll('tbody button')].find(b=>b.textContent==='Xem ảnh').click()");
  await waitFor("document.querySelector('#maintenance-media-preview img')?.naturalWidth>0");await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await waitFor("!document.querySelector('#maintenance-media-preview')");assert(await evaluate("document.activeElement.textContent==='Xem ảnh'"),'Image close restores focus');report.checks.push('orphan-image-preview-and-focus');
  await evaluate("(()=>{const r=[...document.querySelectorAll('tr[data-file-id]')].find(r=>r.textContent.includes("+JSON.stringify(expired)+"));[...r.querySelectorAll('button')].find(b=>b.textContent==='Nghe trước').click();})()");
  await waitFor("document.querySelector('#maintenance-media-preview audio')?.readyState>=1");assert(await evaluate("document.querySelector('#maintenance-media-preview audio').paused"),'Recording does not autoplay');await evaluate("window.__qaAudio=document.querySelector('#maintenance-media-preview audio');window.__qaAudio.play()",true);await waitFor("window.__qaAudio.currentTime>0.1");await evaluate("document.querySelector('#maintenance-media-preview button').click()");await waitFor("!document.querySelector('#maintenance-media-preview')");assert(await evaluate("window.__qaAudio.paused&&!window.__qaAudio.hasAttribute('src')"),'Closing preview releases audio');report.checks.push('expired-speaking-preview-play-and-release');
  const orphan='d'.repeat(64)+'.png';await evaluate("(()=>{const r=[...document.querySelectorAll('tr[data-file-id]')].find(r=>r.textContent.includes("+JSON.stringify(orphan)+"));[...r.querySelectorAll('button')].find(b=>b.textContent==='Giữ 30 ngày').click();})()");await waitFor("[...document.querySelectorAll('tr[data-file-id]')].some(r=>r.textContent.includes("+JSON.stringify(orphan)+")&&r.textContent.includes('Bỏ giữ'))");await evaluate("[...document.querySelectorAll('tbody button')].find(b=>b.textContent==='Bỏ giữ').click()");await waitFor("![...document.querySelectorAll('tbody button')].some(b=>b.textContent==='Bỏ giữ')");assert(fs.existsSync(path.join(fixture.root,'listening-media',orphan)),'Hold/release preserves media');report.checks.push('orphan-hold-release-stays-in-focused-list');
  await evaluate("(()=>{const r=[...document.querySelectorAll('tr[data-file-id]')].find(r=>r.textContent.includes("+JSON.stringify(expired)+"));[...r.querySelectorAll('button')].find(b=>b.textContent==='Xem trước xóa hết hạn').click();})()");await waitFor("document.querySelector('#maintenance-center dialog').open");assert(await evaluate("document.querySelector('#maintenance-confirm-execute').disabled"),'Expired recording delete requires exact confirmation');await evaluate("document.querySelector('#maintenance-confirm-name').focus()");await cdp.send('Input.insertText',{text:expired+'.wav'});await waitFor("!document.querySelector('#maintenance-confirm-execute').disabled");await evaluate("document.querySelector('#maintenance-confirm-execute').click()");await waitFor("!document.querySelector('#maintenance-center dialog').open");assert(!fs.existsSync(path.join(speaking,expired+'.wav')),'Confirmed cleanup removes only expired recording');const checkDb=new Database(path.join(fixture.root,'app.sqlite'),{readonly:true});assert(checkDb.prepare('SELECT data_json FROM speaking_attempts WHERE id=?').get(expired).data_json===preservedAttempt,'Score and attempt remain unchanged');checkDb.close();assert(fs.existsSync(path.join(speaking,busy+'.wav')),'Busy recording remains intact');report.checks.push('exact-confirmed-expired-delete-preserves-attempt-and-busy-recording');
  await selectTab('Cài đặt tự động');assert(await evaluate("document.querySelectorAll('.maintenance-policy').length===2&&document.querySelector('#maintenance-center').textContent.includes('File tạm nhập đề quá 48 giờ')&&document.querySelector('#maintenance-center').textContent.includes('Bản thu Speaking hết hạn, tối đa 24 giờ')"),'Automatic settings retain both policy controls');await evaluate("[...document.querySelectorAll('.maintenance-policy button')][0].click()");await waitFor("document.querySelector('#maintenance-center dialog').open");assert(await evaluate("document.querySelector('#maintenance-confirm-execute').disabled"),'Automatic settings retain activation confirmation');await evaluate("document.querySelector('#maintenance-center dialog button').click()");report.checks.push('automatic-settings-unchanged-activation-guard');
  await viewport(390,844,true);for(const label of ['Tổng quan','File & Dọn dẹp','Cài đặt tự động']){await selectTab(label);assert(!await evaluate("document.documentElement.scrollWidth>innerWidth+1"),'Tab fits mobile '+label);await verifyFrames(label);}
  await selectTab('File & Dọn dẹp');await evaluate("document.querySelector('.maintenance-filters input').focus()");await cdp.send('Input.insertText',{text:'nonexistent-focused-file'});await waitFor("document.querySelector('[aria-label=\"Bản thu và file nghi ngờ mồ côi\"]').textContent.includes('Không có file phù hợp')");assert(await evaluate("document.querySelector('[aria-label=\"Bản thu và file nghi ngờ mồ côi\"]').clientHeight<150"),'Empty table shrinks');report.checks.push('three-tabs-mobile-and-empty-list');
  await evaluate("window.__qaRequests=[];window.__qaFetch=window.fetch;window.__qaMocked=false;window.fetch=function(input,init){window.__qaRequests.push({url:String(input),method:init?.method||'GET'});if(!window.__qaMocked&&String(input).endsWith('/inventory/summary')){window.__qaMocked=true;return window.__qaFetch.apply(this,arguments).then(r=>r.json()).then(d=>new Promise(resolve=>setTimeout(()=>resolve(new Response(JSON.stringify({...d,executor:'unconfigured'}),{status:200,headers:{'Content-Type':'application/json'}})),600)));}return window.__qaFetch.apply(this,arguments);};document.querySelector('#maintenance-scan').click()");await waitFor("document.querySelector('#maintenance-scan').disabled");await waitFor("document.querySelector('#maintenance-center [role=alert]')?.textContent.includes('chưa bật bộ quét process')");assert(await evaluate("!window.__qaRequests.some(r=>r.method==='POST'&&r.url.includes('/inventory/'))"),'Unconfigured host does not receive scan write');await evaluate("window.fetch=window.__qaFetch");await waitFor("document.querySelector('#maintenance-scan')?.disabled===false");assert(!await evaluate("document.documentElement.scrollWidth>innerWidth+1"),'Host error fits mobile');report.screenshots.push(await screenshot('maintenance-focused-files-mobile-error'));report.checks.push('pending-and-host-unconfigured-error-keeps-app-scan');
  fs.writeFileSync(path.resolve('.data/maintenance-qa/browser-report.json'),JSON.stringify(report,null,2));cdp.close();chrome.kill();console.log(JSON.stringify(report));
}
main().catch(error=>{console.error(error);chrome.kill();process.exitCode=1;});
