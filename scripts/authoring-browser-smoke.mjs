import { spawn } from 'node:child_process';
import fs, { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = Number(process.env.CSS_QA_DEBUG_PORT || (10_000 + Math.floor(Math.random() * 20_000)));
const origin = process.env.AUTHORING_QA_ORIGIN || 'http://127.0.0.1:3178';
const qaRoot = mkdtempSync(path.join(os.tmpdir(), 'vhomework-css-qa-'));
const profileDir = path.join(qaRoot, 'profile');
const screenshotDir = path.resolve('.data/authoring-session-qa/screenshots');
mkdirSync(profileDir, { recursive: true });
mkdirSync(screenshotDir, { recursive: true });


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
    if (message.method === 'Page.javascriptDialogOpening') { socket.send(JSON.stringify({ id: nextId++, method: 'Page.handleJavaScriptDialog', params: { accept: true } })); return; }
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
 const target=(await waitForDebugger()).find(t=>t.type==='page'&&t.url.startsWith(origin));
 const cdp=createCdpClient(target.webSocketDebuggerUrl);await cdp.ready;await cdp.send('Page.enable');await cdp.send('Runtime.enable');
 const evaluate=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const wait=async expression=>{const until=Date.now()+15000;while(Date.now()<until){if(await evaluate('Promise.resolve('+expression+').then(Boolean)'))return;await delay(100);}throw Error('Timeout '+expression+'; '+await evaluate('document.body.innerText.slice(-1400)'));};
 const clickSelector=async selector=>{await wait('document.querySelector('+JSON.stringify(selector)+')&&!document.querySelector('+JSON.stringify(selector)+').disabled');await evaluate('document.querySelector('+JSON.stringify(selector)+').click()');await delay(100);};
 const click=async(text,root='body')=>{await wait('(()=>{const b=[...document.querySelectorAll('+JSON.stringify(root+' button')+')].find(b=>b.textContent.trim()==='+JSON.stringify(text)+'&&!b.disabled);if(!b)return false;b.click();return true;})()');await delay(100);};
 const input=async(selector,value)=>{await wait('document.querySelector('+JSON.stringify(selector)+')');await evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,"value").set.call(e,'+JSON.stringify(value)+');e.dispatchEvent(new Event("input",{bubbles:true}));})()');};
 const field=async(label,value,root='body')=>{await wait('[...document.querySelectorAll('+JSON.stringify(root+' label')+')].some(l=>l.textContent.includes('+JSON.stringify(label)+')&&l.querySelector("input,textarea"))');await evaluate('(()=>{const l=[...document.querySelectorAll('+JSON.stringify(root+' label')+')].find(l=>l.textContent.includes('+JSON.stringify(label)+'));const e=l?.querySelector("input,textarea");if(!e)throw Error("Missing field '+label+'");Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,"value").set.call(e,'+JSON.stringify(value)+');e.dispatchEvent(new Event("input",{bubbles:true}));})()');};
 const keys=async scope=>evaluate('Object.values(localStorage).map(v=>{try{return JSON.parse(v)}catch{return null}}).filter(r=>r?.version===1&&r.owner==="local-test-super-admin"&&r.scope==='+JSON.stringify(scope)+')');
 const recovery=async root=>click('Khôi phục',root+' .authoring-draft-recovery');
 const reload=async()=>{await evaluate('window.dispatchEvent(new Event("pagehide"));window.onbeforeunload=null');await cdp.send('Page.navigate',{url:origin});await wait('document.querySelector("#tab-editor")');};
 const shot=async name=>{const r=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true});const p=path.join(screenshotDir,name+'.png');fs.writeFileSync(p,Buffer.from(r.data,'base64'));return p;};
 const report={checks:[],screenshots:[]}; const note=check=>{report.checks.push(check);console.log(check);};
 try {
 await wait('document.querySelector("#tab-editor")');await evaluate('localStorage.clear()');
 await clickSelector('#tab-editor');await input('#editor-details-form input','QA nháp từ vựng');await delay(500);
 assert((await keys('vocabulary')).some(r=>r.value.editorTitle==='QA nháp từ vựng'),'Vocabulary keystrokes persist');
 await clickSelector('#tab-dashboard');await reload();await clickSelector('#tab-sets');await recovery('#admin-main-panel');await wait('document.querySelector("#editor-details-form input")?.value==="QA nháp từ vựng"');note('vocabulary-switch-reload-restore');
 await input('#editor-details-form input','QA nháp từ vựng đã khôi phục');await delay(500);const restoredVocab=await keys('vocabulary');assert(restoredVocab.length===1&&restoredVocab[0].value.editorTitle==='QA nháp từ vựng đã khôi phục','Editing recovered draft updates its original slot');note('restored-draft-updates-original-slot');
 await clickSelector('#tab-editor');await input('#editor-details-form input','QA bài mới thứ hai');await delay(500);assert((await keys('vocabulary')).some(r=>r.value.editorTitle==='QA nháp từ vựng đã khôi phục')&&(await keys('vocabulary')).some(r=>r.value.editorTitle==='QA bài mới thứ hai'),'New article keeps preceding unsaved draft');note('new-article-does-not-overwrite-previous-draft');
 await clickSelector('#tab-grammar-editor');await input('#grammar-editor-tab-content input','QA nháp ngữ pháp');await delay(500);await reload();await clickSelector('#tab-grammar-sets');await recovery('#admin-main-panel');await wait('document.querySelector("#grammar-editor-tab-content input")?.value==="QA nháp ngữ pháp"');note('grammar-reload-restore');
 const openExam=async(module,paper,create=true)=>{await clickSelector('#tab-dashboard');await clickSelector('#tab-listening-library');await clickSelector('[data-exam-module-quick-link="'+module+'"]');await clickSelector('[data-exam-paper-filter="'+paper+'"]');if(create)await click(paper==='reading-writing'?'Soạn R&W':paper==='listening'?'Soạn Listening':'Soạn Writing','#exam-module-admin-hub');};
 await openExam('mover','listening');await field('Tên bộ đề','QA nháp Listening','#listening-wizard');await delay(500);assert((await keys('movers-listening')).some(r=>r.value.content.title==='QA nháp Listening'),'Unsaved new listening draft persists');
 await reload();await openExam('mover','listening',false);await recovery('#listening-admin-module');await wait('document.querySelector("#listening-wizard")');assert(await evaluate('[...document.querySelectorAll("#listening-wizard input")].some(e=>e.value==="QA nháp Listening")'),'Listening restored');note('movers-listening-new-reload-restore');
 await click('Lưu nháp','#listening-wizard');await wait('document.querySelector("#listening-wizard").textContent.includes("Đã lưu")');
 await evaluate('window.qaFetch=window.fetch;window.qaHold=true;window.fetch=async(input,init)=>{if(window.qaHold&&String(input).includes("/autosave")){window.qaHold=false;await new Promise(r=>setTimeout(r,1000));}return window.qaFetch(input,init);}');
 await field('Tên bộ đề','QA Listening lưu chậm','#listening-wizard');await delay(1350);await field('Tên bộ đề','QA Listening chỉnh sửa mới','#listening-wizard');await delay(3500);
 assert(await evaluate('[...document.querySelectorAll("#listening-wizard input")].some(e=>e.value==="QA Listening chỉnh sửa mới")'),'Late server response keeps newer edits');await evaluate('window.fetch=window.qaFetch');
 await wait('(async()=>{const rows=await (await fetch("/api/listening/admin/sets",{headers:{Authorization:"Bearer local-test-auth-bypass"}})).json();const row=rows.find(r=>r.title==="QA Listening chỉnh sửa mới");if(!row)return false;window.qaListeningId=row.id;const full=await (await fetch("/api/listening/admin/sets/"+row.id,{headers:{Authorization:"Bearer local-test-auth-bypass"}})).json();return full.draftContent.title==="QA Listening chỉnh sửa mới";})()');note('listening-inflight-edit-preserved-on-server');
 await field('Tên bộ đề','QA Listening checkpoint','#listening-wizard');await evaluate('document.dispatchEvent(new Event("visibilitychange"));window.dispatchEvent(new Event("pagehide"))');assert((await keys('movers-listening')).some(r=>r.value.content.title==='QA Listening checkpoint'),'Leaving saves synchronously');note('pagehide-checkpoint');
 await evaluate('Object.defineProperty(document,"visibilityState",{configurable:true,value:"hidden"});document.dispatchEvent(new Event("visibilitychange"));delete document.visibilityState;');
 const serverTitle=title=>'(async()=>{const row=await (await fetch("/api/listening/admin/sets/"+window.qaListeningId,{headers:{Authorization:"Bearer local-test-auth-bypass"}})).json();return row.draftContent.title==='+JSON.stringify(title)+';})()';
 await wait(serverTitle('QA Listening checkpoint'));note('hidden-flush-to-server');
 await field('Tên bộ đề','QA Listening logout','#listening-wizard');await click('Đăng xuất');await wait(serverTitle('QA Listening logout'));note('logout-flush-before-signout');
 await openExam('mover','reading-writing');await field('Tên bộ đề','QA nháp Reading','#mover-reading-writing-admin');await delay(500);await reload();await openExam('mover','reading-writing',false);await recovery('#mover-reading-writing-admin');await wait('[...document.querySelectorAll("#mover-reading-writing-admin input")].some(e=>e.value==="QA nháp Reading")');note('movers-reading-v3-reload-restore');
 await openExam('flyer','listening');await field('Tên bộ đề','QA nháp Flyer','#generic-exam-editor');await delay(500);await reload();await openExam('flyer','listening',false);await recovery('#generic-exam-admin');await wait('document.querySelector("#generic-exam-editor")');note('generic-exam-new-reload-restore');
 await click('Lưu','#generic-exam-editor');await wait('document.querySelector("#generic-exam-editor").textContent.includes("Bản nháp đã lưu")');
 await evaluate('window.qaFetch=window.fetch;window.qaHold=true;window.fetch=async(input,init)=>{if(window.qaHold&&String(input).includes("/autosave")){window.qaHold=false;await new Promise(r=>setTimeout(r,1000));}return window.qaFetch(input,init);}');
 await field('Tên bộ đề','QA Flyer chậm','#generic-exam-editor');await delay(1350);await field('Tên bộ đề','QA Flyer chỉnh sửa mới','#generic-exam-editor');await delay(3500);await evaluate('window.fetch=window.qaFetch');
 await wait('(async()=>{const rows=await (await fetch("/api/exam-platform/admin/modules/flyer/papers/listening/sets",{headers:{Authorization:"Bearer local-test-auth-bypass"}})).json();const row=rows.find(r=>r.title==="QA Flyer chỉnh sửa mới");if(!row)return false;window.qaFlyerId=row.id;const full=await (await fetch("/api/exam-platform/admin/modules/flyer/papers/listening/sets/"+row.id,{headers:{Authorization:"Bearer local-test-auth-bypass"}})).json();return full.draftContent.title==="QA Flyer chỉnh sửa mới";})()');note('generic-inflight-edit-preserved-on-server');
 const flyerId=await evaluate('window.qaFlyerId');
 await input('#universal-whole-json-import textarea','{ "unfinished-universal":');await delay(500);await reload();await openExam('flyer','listening',false);
 await evaluate('(()=>{const row=[...document.querySelectorAll("#generic-exam-admin tr")].find(r=>r.textContent.includes("QA Flyer chỉnh sửa mới"));if(!row)throw Error("Saved Flyer row missing");[...row.querySelectorAll("button")].find(b=>b.textContent.trim()==="Sửa").click();})()');
 await wait('document.querySelector("#generic-exam-editor")');await recovery('#universal-whole-json-import');await wait('document.querySelector("#universal-whole-json-import textarea")?.value==='+JSON.stringify('{ "unfinished-universal":'));note('universal-unfinished-json-reload-restore');
 await evaluate('window.qaFetch=window.fetch;window.fetch=(input,init)=>String(input).includes("/autosave")?Promise.resolve(new Response(JSON.stringify({error:"QA conflict"}),{status:409,headers:{"Content-Type":"application/json"}})):window.qaFetch(input,init);');
 await field('Tên bộ đề','QA nháp xung đột','#generic-exam-editor');await wait('document.querySelector("#generic-exam-editor").textContent.includes("Xung đột bản nháp")');assert((await keys('exam-flyer-listening')).some(r=>r.value.content.title==='QA nháp xung đột'),'Conflict preserves local draft');await evaluate('window.fetch=window.qaFetch');note('conflict-keeps-local-draft');



 await clickSelector('#tab-speaking');await click('Soạn bài','#speaking-admin');await field('Tiêu đề','QA nháp Speaking','#speaking-admin');await delay(500);await reload();await clickSelector('#tab-speaking');await recovery('#speaking-admin');await wait('[...document.querySelectorAll("#speaking-admin input")].some(e=>e.value==="QA nháp Speaking")');note('speaking-reload-restore');
 await clickSelector('#tab-ioe-violympic');await click('Soạn JSON','#ioe-violympic-admin');await field('JSON từ ChatGPT','{ "unfinished":','#ioe-violympic-admin');await delay(500);await reload();await clickSelector('#tab-ioe-violympic');await recovery('#ioe-violympic-admin');await wait('document.querySelector("#ioe-violympic-admin textarea")?.value===\'{ "unfinished":\'');note('ioe-unfinished-json-reload-restore');
 // Exercise real bank commits, lost responses, reload and idempotent retry on the isolated QA database.
 const resetIOE=async()=>{await field('JSON từ ChatGPT','','#ioe-violympic-admin');await delay(500);await evaluate('Object.keys(localStorage).filter(k=>k.startsWith("vhomework:authoring:v1:")&&k.includes(":ioe-violympic:")).forEach(k=>localStorage.removeItem(k))');await reload();await clickSelector('#tab-ioe-violympic');await click('Soạn JSON','#ioe-violympic-admin');};
 const bankCount=prefix=>evaluate('(async()=>{const r=await fetch("/api/ioe-violympic/admin/questions?search="+encodeURIComponent('+JSON.stringify(prefix)+')+"&page=1",{headers:{Authorization:"Bearer local-test-auth-bypass"}});if(!r.ok)throw Error("QA bank query failed");return (await r.json()).total;})()');
 for(const mode of ['partial','response-lost']) {
  await resetIOE();const prefix='QA-authoring-'+mode+'-'+Date.now();
  const questions=Array.from({length:55},(_,i)=>({prompt:prefix+' '+i,options:['yes','no'],answer:'A',domain:'vocabulary',difficulty:1}));
  await field('JSON từ ChatGPT',JSON.stringify({questions}),'#ioe-violympic-admin');await click('Ghép vào bảng','#ioe-violympic-admin');await wait('document.querySelectorAll("[data-competition-draft-row]").length===55');
  await evaluate('window.qaFetch=window.fetch;window.qaPosts=0;window.fetch=async(input,init)=>{if(String(input).includes("/api/ioe-violympic/admin/questions")&&init?.method==="POST"){window.qaPosts++;if('+JSON.stringify(mode)+'==="partial"&&window.qaPosts===2)return new Response(JSON.stringify({error:"QA second chunk offline"}),{status:503});const r=await window.qaFetch(input,init);if('+JSON.stringify(mode)+'==="response-lost"&&window.qaPosts===1)return new Response(JSON.stringify({error:"QA response lost after commit"}),{status:503});return r;}return window.qaFetch(input,init);}');
  await click('Lưu 55 câu vào bank','#ioe-violympic-admin');await wait('document.querySelector("#ioe-violympic-admin [role=alert]")');await delay(500);
  const expected=mode==='partial'?5:55;const cached=(await keys('ioe-violympic')).find(r=>r.value.drafts.length===expected&&r.value.saveKey);
  assert(cached,'Only uncommitted rows and the idempotency key survive failure');assert(await bankCount(prefix)===50,'First chunk committed exactly 50 questions');await evaluate('window.fetch=window.qaFetch');
  await reload();await clickSelector('#tab-ioe-violympic');await recovery('#ioe-violympic-admin');await wait('document.querySelectorAll("[data-competition-draft-row]").length==='+expected);
  await click('Lưu '+expected+' câu vào bank','#ioe-violympic-admin');await wait('document.querySelectorAll("[data-competition-draft-row]").length===0');await delay(500);
  assert(await bankCount(prefix)===55,'Reload retry never duplicates committed questions');assert((await keys('ioe-violympic')).length===0,'Successful batch leaves no already-committed draft');note('ioe-'+mode+'-reload-idempotent-retry');
 }
 // Non-English bank subjects share the same draft recovery mechanism.
 await resetIOE();await evaluate('(()=>{const e=document.querySelector("#ioe-violympic-admin select");Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set.call(e,"math-english");e.dispatchEvent(new Event("change",{bubbles:true}));})()');
 await field('JSON từ ChatGPT','{ "math-english-unfinished":','#ioe-violympic-admin');await delay(500);await reload();await clickSelector('#tab-ioe-violympic');await recovery('#ioe-violympic-admin');await wait('document.querySelector("#ioe-violympic-admin select")?.value==="math-english"');note('ioe-math-english-draft-recovery');

 // Quota writes surface an error without discarding older draft.
 await evaluate('window.qaSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith("vhomework:authoring:"))throw new DOMException("quota","QuotaExceededError");return window.qaSet.call(this,k,v);}');await field('JSON từ ChatGPT','{ "newer":','#ioe-violympic-admin');await wait('document.querySelector("#ioe-violympic-admin .authoring-draft-recovery [role=alert]")');assert((await keys('ioe-violympic')).length>0,'Quota keeps recoverable older draft');await evaluate('Storage.prototype.setItem=window.qaSet');note('quota-visible-retains-old-draft');
 await clickSelector('#tab-sets');report.screenshots.push(await shot('draft-recovery-desktop'));
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(200);assert(await evaluate('[...document.querySelectorAll(".authoring-draft-recovery")].every(e=>e.scrollWidth<=e.clientWidth+1)'),'Recovery frame fits mobile');await evaluate('document.querySelector(".authoring-draft-recovery button")?.focus()');assert(await evaluate('document.activeElement?.closest(".authoring-draft-recovery")!=null'),'Recovery supports keyboard focus');report.screenshots.push(await shot('draft-recovery-mobile'));note('mobile-frame-and-keyboard');
 fs.writeFileSync('.data/authoring-session-qa/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 } catch(e) {await shot('failure').catch(()=>{});console.error(await evaluate('document.body.innerText.slice(0,1700)').catch(()=>''));throw e;}
 finally {cdp.close();chrome.kill();}
}
main().catch(error=>{console.error(error);chrome.kill();process.exitCode=1;});
