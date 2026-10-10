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

  const fixture=JSON.parse(fs.readFileSync(path.resolve('.data/maintenance-qa/fixture.json'),'utf8'));
  assert(path.basename(fixture.root).startsWith('vhomework-maintenance-browser-'),'Only isolated QA fixture is authorized');
  const sentinelFile=path.join(fixture.root,'node_modules-app-backup-20261007-223115/lib.js');const sentinel=fs.readFileSync(sentinelFile);
  const report={origin,checks:[],screenshots:[]};
  const summary=()=>evaluate("fetch('/api/admin/maintenance/inventory/summary',{headers:{Authorization:'Bearer local-test-auth-bypass'}}).then(r=>r.json())");
  await waitFor("document.querySelector('#tab-maintenance')");
  const baseline=(await summary()).latest?.id||null;
  await evaluate("document.querySelector('#tab-maintenance').click()");await waitFor("document.querySelector('#maintenance-center')");
  await evaluate("[...document.querySelectorAll('#maintenance-center button')].find(b=>b.textContent==='Thư mục hosting').click()");await waitFor("document.querySelector('#hosting-inventory-scan')?.disabled===false");
  assert(((await summary()).latest?.id||null)===baseline,'Opening hosting tree never scans');report.checks.push('hosting-page-cached-no-automatic-scan');
  await evaluate("document.querySelector('#maintenance-scan').click()");
  await waitFor("fetch('/api/admin/maintenance/summary',{headers:{Authorization:'Bearer local-test-auth-bypass'}}).then(r=>r.json()).then(d=>d.latest&&!d.scanRunning&&!d.busy)");
  await evaluate("document.querySelector('#hosting-inventory-scan').click()");
  await waitFor("[...document.querySelectorAll('.hosting-inventory button')].find(b=>b.textContent==='Tạm dừng')?.disabled===false");
  await evaluate("[...document.querySelectorAll('.hosting-inventory button')].find(b=>b.textContent==='Tạm dừng').click()");
  await waitFor("fetch('/api/admin/maintenance/inventory/summary',{headers:{Authorization:'Bearer local-test-auth-bypass'}}).then(r=>r.json()).then(d=>d.latest?.status==='paused')");
  await waitFor("[...document.querySelectorAll('.hosting-inventory button')].find(b=>b.textContent==='Tiếp tục')?.disabled===false");
  await evaluate("[...document.querySelectorAll('.hosting-inventory button')].find(b=>b.textContent==='Tiếp tục').click()");
  await waitFor("fetch('/api/admin/maintenance/inventory/summary',{headers:{Authorization:'Bearer local-test-auth-bypass'}}).then(r=>r.json()).then(d=>d.latest?.status==='completed'&&d.latest.filesystemComplete)");
  await waitFor("[...document.querySelectorAll('.hosting-inventory tbody tr')].some(r=>r.textContent.includes('nodevenv'))");
  report.checks.push('process-executor-pause-resume-completes');
  const current=await summary();assert(current.latest.dependencyComplete===false,'Missing hosting adapters remain visible');
  assert(await evaluate("[...document.querySelectorAll('.hosting-inventory tbody tr')].find(r=>r.textContent.includes('node_modules-app-backup'))?.textContent.includes('Chưa xác minh')"),'Dependency recovery remains unknown');
  assert(!await evaluate("[...document.querySelectorAll('.hosting-inventory tbody button')].some(b=>/Xóa|Cách ly/.test(b.textContent))"),'Hosting V1 grants no new delete/quarantine actions');
  report.checks.push('protected-runtime-unknown-recovery-and-no-delete');
  assert(await evaluate("[...document.querySelectorAll('.hosting-inventory tbody tr')].find(r=>r.textContent.includes('.npm'))?.textContent.includes('Cần xem xét')"),'Cache has review decision');
  assert(await evaluate("[...document.querySelectorAll('.hosting-inventory tbody tr')].find(r=>r.textContent.includes('nodevenv'))?.textContent.includes('Môi trường Node.js')"),'Runtime association is visible');
  await evaluate("document.querySelector('.hosting-inventory .maintenance-table').scrollIntoView({block:'center'})");
  report.screenshots.push(await screenshot('hosting-ownership-desktop'));
  await evaluate("(()=>{const r=[...document.querySelectorAll('.hosting-inventory tbody tr')].find(r=>r.textContent.includes('nodevenv'));const b=r.querySelector('[data-action=inspect-hosting]');b.focus();b.click();})()");
  await waitFor("document.querySelector('.hosting-inspector h4')===document.activeElement");
  assert(await evaluate("document.querySelector('.hosting-inspector').textContent.includes('Nguồn còn thiếu')"),'Inspector explains missing sources');
  await evaluate("[...document.querySelectorAll('.hosting-inspector button')].find(b=>b.textContent==='Xác minh lại nguồn').click()");
  await waitFor("document.querySelector('.hosting-inventory').textContent.includes('Đã đọc lại nguồn')");
  await evaluate("[...document.querySelectorAll('.hosting-inspector button')].find(b=>b.textContent==='Đóng bằng chứng').click()");
  assert(await evaluate("document.activeElement?.dataset.action==='inspect-hosting'"),'Inspector close restores keyboard focus');report.checks.push('evidence-focus-reverify-and-close');
  await evaluate("[...document.querySelectorAll('.hosting-inventory tbody button')].find(b=>b.textContent==='listening-media/').click()");
  await waitFor("[...document.querySelectorAll('.hosting-inventory tbody button')].some(b=>b.textContent==='.tmp-pdf-import/')");
  await evaluate("[...document.querySelectorAll('.hosting-inventory tbody button')].find(b=>b.textContent==='.tmp-pdf-import/').click()");
  await waitFor("[...document.querySelectorAll('.hosting-inventory tbody button')].some(b=>b.textContent==='Dọn file này')");
  assert(await evaluate("document.querySelector('.hosting-inventory tbody').textContent.includes('Có thể dọn có xác nhận')"),'Eligible temporary file is actionable through existing policy');
  report.screenshots.push(await screenshot('hosting-cleanup-decisions-desktop'));
  await evaluate("[...document.querySelectorAll('.hosting-inventory tbody button')].find(b=>b.textContent==='Dọn file này').click()");
  await waitFor("[...document.querySelectorAll('#maintenance-center tbody tr[data-file-id]')].some(r=>r.textContent.includes('11111111-1111-4111-8111-111111111111.png'))");
  await evaluate("[...document.querySelectorAll('#maintenance-center tbody button')].find(b=>b.textContent==='Xem trước xóa hết hạn').click()");
  await waitFor("document.querySelector('#maintenance-center dialog').open");
  assert(await evaluate("document.querySelector('#maintenance-confirm-execute').disabled"),'Cleanup requires typed confirmation');
  await evaluate("[...document.querySelectorAll('#maintenance-center dialog button')].find(b=>b.textContent==='Hủy').click()");
  assert(fs.existsSync(path.join(fixture.root,'listening-media/.tmp-pdf-import/11111111-1111-4111-8111-111111111111.png')),'Cancelled preview keeps source');
  report.checks.push('hosting-eligible-file-opens-existing-cleanup-with-typed-confirmation');
  await evaluate("[...document.querySelectorAll('#maintenance-center button')].find(b=>b.textContent==='Thư mục hosting').click()");
  await waitFor("[...document.querySelectorAll('.hosting-inventory tbody button')].some(b=>b.textContent==='paginated/')");
  await evaluate("[...document.querySelectorAll('.hosting-inventory tbody button')].find(b=>b.textContent==='paginated/').click()");
  await waitFor("document.querySelector('.hosting-inventory .maintenance-pagination')?.textContent.includes('123 mục')");
  assert(await evaluate("document.querySelectorAll('.hosting-inventory tbody tr').length===50"),'Tree first page is bounded to 50');
  await evaluate("[...document.querySelectorAll('.hosting-inventory .maintenance-pagination button')].find(b=>b.textContent==='Trang sau').click()");
  await waitFor("document.querySelector('.hosting-inventory .maintenance-pagination')?.textContent.includes('2/3')");report.checks.push('recursive-tree-paginates-all-123-entries');
  await viewport(390,844,true);assert(!await evaluate("document.documentElement.scrollWidth>innerWidth+1"),'Hosting tree fits mobile page');
  await evaluate("document.querySelector('.hosting-inventory').scrollIntoView({block:'start'})");report.screenshots.push(await screenshot('hosting-tree-mobile'));
  const contrast=await evaluate("("+function(){const lum=c=>c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);return [...document.querySelectorAll('#maintenance-center button')].filter(b=>b.offsetWidth).map(b=>{const s=getComputedStyle(b),a=lum(s.color),z=lum(s.backgroundColor);return {label:b.textContent,ratio:(Math.max(a,z)+.05)/(Math.min(a,z)+.05)};});}.toString()+")()");assert(contrast.every(b=>b.ratio>=4.5),'Hosting buttons contrast >=4.5');report.contrast=contrast;
  await viewport(1440,1000);await evaluate("[...document.querySelectorAll('#maintenance-center nav button')].find(b=>b.textContent==='Backup').click()");
  await waitFor("[...document.querySelectorAll('.hosting-inventory tbody tr')].some(r=>r.textContent.includes('external-backups'))");
  await evaluate("(()=>{const r=[...document.querySelectorAll('.hosting-inventory tbody tr')].find(r=>r.textContent.includes('external-backups'));r.querySelector('button').click();})()");
  await waitFor("document.querySelector('.hosting-inspector')?.textContent.includes('Thành phần được quan sát')");
  assert(await evaluate("document.querySelector('.hosting-inspector').textContent.includes('release-a')"),'Backup folder exposes its members');report.checks.push('external-backup-folder-members-and-unverified-scope');report.screenshots.push(await screenshot('hosting-backup-desktop'));
  for(const label of ['Tác vụ nền','Nhật ký','Cảnh báo']){
    await evaluate("[...document.querySelectorAll('#maintenance-center nav button')].find(b=>b.textContent==="+JSON.stringify(label)+").click()");await waitFor("document.querySelector('.hosting-inventory')");await delay(300);
    if(label==='Tác vụ nền'){await waitFor("document.querySelector('.hosting-inventory').textContent.includes('Thủ công; chưa đăng ký cron')");assert(await evaluate("document.querySelector('.hosting-inventory').textContent.includes('Chấm Speaking')"),'Registry observes speaking jobs independently');}
    await viewport(390,844,true);assert(!await evaluate("document.documentElement.scrollWidth>innerWidth+1"),'Hosting tab fits mobile: '+label);
  }
  report.checks.push('task-registry-manual-schedule-and-all-tabs-mobile');
  assert(fs.readFileSync(sentinelFile).equals(sentinel),'Runtime recovery sentinel preserved');
  report.checks.push('no-host-source-file-deleted');
  fs.writeFileSync(path.resolve('.data/maintenance-qa/hosting-browser-report.json'),JSON.stringify(report,null,2));cdp.close();chrome.kill();console.log(JSON.stringify(report));
}
main().catch(error=>{console.error(error.message);chrome.kill();process.exitCode=1;});