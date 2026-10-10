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
      if (await evaluate(`Boolean(${expression})`)) return;
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
    const result = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    const filePath = path.join(screenshotDir, `${name}.png`);
    writeFileSync(filePath, Buffer.from(result.data, 'base64'));
    return filePath;
  };

  const fixture = JSON.parse(await fs.promises.readFile(path.resolve('.data/maintenance-qa/fixture.json'),'utf8'));
  await waitFor("document.querySelector('#tab-maintenance')");
  const report={origin,checks:[],screenshots:[]};
  const untouched=await evaluate("fetch('/api/admin/maintenance/summary',{headers:{Authorization:'Bearer local-test-auth-bypass'}}).then(r=>r.json()).then(d=>d.latest?.at || null)");
  assert(untouched===baselineAt,'Overview must not scan automatically');report.checks.push('overview-does-not-scan');
  await evaluate("document.querySelector('#tab-maintenance').click()");
  await waitFor("document.querySelector('#maintenance-center')");
  await evaluate("document.querySelector('#maintenance-scan').click()");
  await waitFor("fetch('/api/admin/maintenance/summary',{headers:{Authorization:'Bearer local-test-auth-bypass'}}).then(r=>r.json()).then(d=>d.latest?.at!=="+JSON.stringify(baselineAt)+"&&d.latest?.complete&&!d.scanRunning&&!d.busy)");
  await waitFor("document.querySelector('#maintenance-scan')?.disabled===false");

  await waitFor("document.querySelector('#maintenance-center tbody button')?.textContent==='Xem ảnh'");
  await evaluate("(()=>{const b=[...document.querySelectorAll('#maintenance-center tbody button')].find(b=>b.textContent==='Xem ảnh');b.focus();b.click();})()");
  await waitFor("document.querySelector('#maintenance-media-preview img')?.naturalWidth>0");
  assert(await evaluate("document.querySelector('#maintenance-media-preview').open"),'Image preview opens as modal');
  report.screenshots.push(await screenshot('maintenance-preview-image-desktop'));
  await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await waitFor("!document.querySelector('#maintenance-media-preview')");
  assert(await evaluate("document.activeElement?.textContent==='Xem ảnh'"),'Closing modal restores focus to image preview button');
  report.checks.push('scoped-image-preview-decodes-and-escape-closes');

  await evaluate("[...document.querySelectorAll('#maintenance-center tbody button')].find(b=>b.textContent==='Nghe trước').click()");
  await waitFor("document.querySelector('#maintenance-media-preview audio')?.readyState>=1");
  assert(await evaluate("document.querySelector('#maintenance-media-preview audio').paused"),'Audio must not autoplay');
  await evaluate("window.__maintenancePreviewAudio=document.querySelector('#maintenance-media-preview audio');window.__maintenancePreviewAudio.play()",true);
  await waitFor("window.__maintenancePreviewAudio.currentTime>0.1");
  await viewport(390,844,true);
  assert(!await evaluate("document.documentElement.scrollWidth>innerWidth+1"),'Preview must fit mobile');
  assert(await evaluate("document.querySelector('#maintenance-media-preview').getBoundingClientRect().width<=innerWidth"),'Preview dialog fits mobile viewport');
  assert(await evaluate("(()=>{const d=document.querySelector('#maintenance-media-preview');return d.scrollWidth<=d.clientWidth+1;})()"),'Preview content does not overflow mobile dialog');
  report.screenshots.push(await screenshot('maintenance-preview-audio-mobile'));
  await evaluate("document.querySelector('#maintenance-media-preview button').click()");
  await waitFor("!document.querySelector('#maintenance-media-preview')");
  assert(await evaluate("window.__maintenancePreviewAudio.paused&&!window.__maintenancePreviewAudio.hasAttribute('src')"),'Closing audio modal stops player and releases source');
  report.checks.push('audio-no-autoplay-playback-and-close-stops');

  await viewport(1440,1000);
  await evaluate("(()=>{const row=[...document.querySelectorAll('#maintenance-center tbody tr')].find(r=>r.textContent.includes('"+'d'.repeat(64)+".png'));[...row.querySelectorAll('button')].find(b=>b.textContent==='Giữ 30 ngày').click();})()");
  await waitFor("[...document.querySelectorAll('#maintenance-center tbody tr')].some(r=>r.textContent.includes('"+'d'.repeat(64)+".png')&&r.textContent.includes('Giữ đến'))");
  await evaluate("(()=>{const row=[...document.querySelectorAll('#maintenance-center tbody tr')].find(r=>r.textContent.includes('"+'d'.repeat(64)+".png'));[...row.querySelectorAll('button')].find(b=>b.textContent==='Bỏ giữ').click();})()");
  await waitFor("[...document.querySelectorAll('#maintenance-center tbody tr')].some(r=>r.textContent.includes('"+'d'.repeat(64)+".png')&&!r.textContent.includes('Giữ đến'))");
  report.checks.push('hold-release-updates-immediately-without-scan');

  await evaluate("[...document.querySelectorAll('#maintenance-center nav button')].find(b=>b.textContent==='Backup').click()");
  await waitFor("document.querySelector('#maintenance-center input[type=file]')");
  const downloads=path.resolve('.data/maintenance-qa/downloads-'+Date.now());fs.mkdirSync(downloads,{recursive:true});
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  const oldDownloads=new Set(fs.readdirSync(downloads));
  await evaluate("[...document.querySelectorAll('#maintenance-center tbody button')].find(b=>b.textContent.trim()==='Tải').click()");
  let downloaded;
  for(let i=0;i<120;i++){downloaded=fs.readdirSync(downloads).find(n=>n.endsWith('.sqlite')&&!oldDownloads.has(n));if(downloaded)break;await delay(250);}
  assert(downloaded,'Browser must save a streamed backup');
  const document=await cdp.send('DOM.getDocument');
  const input=await cdp.send('DOM.querySelector',{nodeId:document.root.nodeId,selector:'#maintenance-center input[type=file]'});
  await cdp.send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path.join(downloads,downloaded)]});
  await waitFor("document.querySelector('#maintenance-center').textContent.includes('Local đã đối chiếu')");
  report.checks.push('browser-stream-download-and-local-worker-verification');
  const buttonMetrics=await evaluate("(" + function(){
    const rgb=(s)=>s.match(/[\d.]+/g).slice(0,3).map(Number);
    const lum=(c)=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
    return [...document.querySelectorAll('#maintenance-center button')].filter(b=>b.offsetWidth).map(b=>{
      const s=getComputedStyle(b),l1=lum(rgb(s.color)),l2=lum(rgb(s.backgroundColor));
      return {label:b.textContent.trim(),disabled:b.disabled,foreground:s.color,background:s.backgroundColor,ratio:(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)};
    });
  }.toString()+")()");
  assert(buttonMetrics.every(b=>b.ratio>=4.5),'Button computed contrast must reach 4.5');report.contrast=buttonMetrics;
  report.screenshots.push(await screenshot('maintenance-desktop'));
  await waitFor("[...document.querySelectorAll('#maintenance-center button')].find(b=>b.textContent==='Xem trước xóa khỏi host')?.disabled===false");
  await evaluate("[...document.querySelectorAll('#maintenance-center button')].find(b=>b.textContent==='Xem trước xóa khỏi host').click()");
  await waitFor("document.querySelector('#maintenance-center dialog[open]')");
  assert(await evaluate("document.querySelector('#maintenance-confirm-execute').disabled"),'Delete must require exact typed confirmation');
  await evaluate("document.querySelector('#maintenance-center dialog button').click()");
  report.checks.push('delete-preview-requires-explicit-confirmation');
  await viewport(390,844,true);
  assert(!await evaluate("document.documentElement.scrollWidth>innerWidth+1"),'Mobile page must not overflow');
  await evaluate("document.querySelector('#maintenance-center').scrollIntoView({block:'start'})");
  await delay(150);
  report.screenshots.push(await screenshot('maintenance-mobile'));
  await evaluate("document.querySelector('#maintenance-center .maintenance-tabs').scrollIntoView({block:'start'})");
  await delay(150);
  report.screenshots.push(await screenshot('maintenance-mobile-backups'));
  for(const label of ['Tác vụ nền','Nhật ký','Cảnh báo','Chính sách','File & Dọn dẹp']){
    await evaluate("[...document.querySelectorAll('#maintenance-center nav button')].find(b=>b.textContent==="+JSON.stringify(label)+").click()");
    await delay(100);
    assert(!await evaluate("document.documentElement.scrollWidth>innerWidth+1"),'Tab must fit mobile: '+label);
  }
  report.checks.push('all-tabs-mobile-no-overflow');
  fs.writeFileSync(path.resolve('.data/maintenance-qa/browser-report.json'),JSON.stringify(report,null,2));
  cdp.close();chrome.kill();
  console.log(JSON.stringify({checks:report.checks,screenshots:report.screenshots}));
}
main().catch(error=>{console.error(error);chrome.kill();process.exitCode=1;});
