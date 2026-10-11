import { spawn } from 'node:child_process';
import fs, { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = Number(process.env.CSS_QA_DEBUG_PORT || (10_000 + Math.floor(Math.random() * 20_000)));
const origin = process.env.CSS_QA_ORIGIN || 'http://127.0.0.1:3177';
const qaRoot = mkdtempSync(path.join(os.tmpdir(), 'vhomework-hosting-qa-'));
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
  const downloads=path.join(qaRoot,'downloads');mkdirSync(downloads,{recursive:true});await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});

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
    await delay(250);
    const result = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    const filePath = path.join(screenshotDir, `${name}.png`);
    writeFileSync(filePath, Buffer.from(result.data, 'base64'));
    return filePath;
  };


  const fixture=JSON.parse(fs.readFileSync(path.resolve('.data/maintenance-qa/fixture.json'),'utf8'));
  assert(path.basename(fixture.root).startsWith('vhomework-maintenance-browser-'),'Only isolated QA is used');
  const report={origin,checks:[],screenshots:[]};
  const summary=()=>evaluate("fetch('/api/admin/maintenance/inventory/summary',{headers:{Authorization:'Bearer local-test-auth-bypass'}}).then(r=>r.json())");
  await waitFor("document.querySelector('#tab-maintenance')");
  const baseline=(await summary()).latest;assert(baseline?.filesystemComplete,'Run application browser smoke first to create two complete scans');
  await waitFor("document.querySelector('#tab-maintenance')");await evaluate("document.querySelector('#tab-maintenance').click()");await waitFor("document.querySelector('[aria-label=\"Tăng trưởng thư mục hosting\"] .maintenance-folder-row')");
  const trends=await evaluate("fetch('/api/admin/maintenance/inventory/trends',{headers:{Authorization:'Bearer local-test-auth-bypass'}}).then(r=>r.json())");
  assert(trends.complete&&trends.scopeCompatible,'Hosting charts use a complete current scope');
  const cache=trends.folders.find(folder=>folder.label==='.npm');assert(cache?.samples.length===2&&cache.bytes>0&&cache.samples.every(s=>s.complete),'Hosting chart has the two retained real directory measurements');
  const tree=await evaluate("fetch('/api/admin/maintenance/inventory/scans/"+baseline.id+"/tree',{headers:{Authorization:'Bearer local-test-auth-bypass'}}).then(r=>r.json())");assert(tree.items.find(row=>row.name==='.npm').bytes===cache.bytes,'Chart total matches existing nested tree aggregate');
  assert(!JSON.stringify(trends).includes('KEEP_PRIVATE_SENTINEL'),'Trend metadata does not expose secret file contents');report.checks.push('read-only-trends-complete-scope-two-measurements-and-no-secrets');
  assert(await evaluate("[...document.querySelectorAll('#maintenance-center button')].every(b=>b.closest('nav[aria-label=\"Chức năng maintenance\"]'))&&!document.querySelector('.hosting-inspector')&&!document.querySelector('.hosting-breadcrumbs')&&!document.querySelector('.maintenance-scope-tabs')"),'No hosting controls, inspectors or scope tabs');
  assert(((await summary()).latest?.id)===baseline.id,'Opening folder growth does not start a scan');report.checks.push('hosting-is-display-only-no-scan-or-file-controls');
  const layout=await evaluate('('+function(){const a=document.querySelector('.maintenance-growth-grid').children[0].getBoundingClientRect(),b=document.querySelector('.maintenance-growth-grid').children[1].getBoundingClientRect(),rows=[...document.querySelectorAll('.maintenance-folder-row')].map(row=>{const r=row.getBoundingClientRect(),chart=row.querySelector('.maintenance-folder-chart').getBoundingClientRect(),desc=row.querySelector('.maintenance-folder-description').getBoundingClientRect();return {inside:chart.right<=r.right+1,separate:desc.right<chart.left,width:chart.width};});return {equal:Math.abs(a.width-b.width)<2,sameTop:Math.abs(a.top-b.top)<2,rows};}.toString()+')()');assert(layout.equal&&layout.sameTop&&layout.rows.every(row=>row.inside&&row.separate),'Desktop panels balance; every mini chart is right of its path');report.layout=layout;report.checks.push('balanced-desktop-folder-rows-with-chart-on-right');
  await evaluate("(()=>{const el=document.querySelector('[aria-label=\"Tăng trưởng thư mục hosting\"]');el.scrollIntoView({block:'center'});el.scrollTop=0;el.focus({preventScroll:true});})()");await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});await delay(180);assert(await evaluate("document.querySelector('[aria-label=\"Tăng trưởng thư mục hosting\"]').scrollTop>0"),'Hosting directory list scrolls by keyboard');report.checks.push('hosting-list-bounded-and-keyboard-scrollable');
  await evaluate("document.activeElement.blur();document.querySelector('.maintenance-growth-grid').scrollIntoView({block:'start'})");report.screenshots.push(await screenshot('hosting-focused-growth-desktop'));
  await viewport(390,844,true);await evaluate("document.querySelector('[aria-label=\"Tăng trưởng thư mục hosting\"]').closest('section').scrollIntoView({block:'start'})");assert(!await evaluate("document.documentElement.scrollWidth>innerWidth+1"),'Hosting growth fits mobile');assert(await evaluate("[...document.querySelectorAll('.maintenance-folder-row')].every(row=>row.querySelector('.maintenance-folder-chart').getBoundingClientRect().right<=row.getBoundingClientRect().right+1)"),'Mini charts remain inside mobile rows');report.screenshots.push(await screenshot('hosting-focused-growth-mobile'));report.checks.push('mobile-hosting-paths-and-mini-charts-fit');
  const downloaded=await evaluate("fetch('/api/admin/maintenance/inventory/scans/"+baseline.id+"/report',{headers:{Authorization:'Bearer local-test-auth-bypass'}}).then(r=>r.json())");assert(downloaded.exportComplete&&downloaded.entries.filter(entry=>entry.relative.startsWith('paginated/')).length===123,'Existing full report still covers all123 source files');assert((await summary()).latest.id===baseline.id,'Report reads do not start a scan');report.checks.push('existing-full-report-api-preserves-123-file-coverage');
  fs.writeFileSync(path.resolve('.data/maintenance-qa/hosting-browser-report.json'),JSON.stringify(report,null,2));cdp.close();chrome.kill();console.log(JSON.stringify(report));
}
main().catch(error=>{console.error(error);chrome.kill();process.exitCode=1;});
