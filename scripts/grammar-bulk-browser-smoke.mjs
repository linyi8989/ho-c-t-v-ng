import { spawn } from 'node:child_process';
import fs, { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = Number(process.env.CSS_QA_DEBUG_PORT || (10_000 + Math.floor(Math.random() * 20_000)));
const origin = process.env.GRAMMAR_QA_ORIGIN || 'http://127.0.0.1:3180';
const qaUrl = new URL(origin);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(qaUrl.hostname) || qaUrl.port === '3000') {
  throw new Error('Use a dedicated loopback QA fixture on port 3180; never run this write smoke against the user workspace server.');
}

const qaRoot = mkdtempSync(path.join(os.tmpdir(), 'vhomework-css-qa-'));
const profileDir = path.join(qaRoot, 'profile');
const screenshotDir = path.resolve('.data/grammar-bulk-qa/screenshots');
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
 const cdp=createCdpClient(target.webSocketDebuggerUrl); await cdp.ready; await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
 const evaluate=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const wait=async expression=>{const end=Date.now()+15000;while(Date.now()<end){if(await evaluate('Promise.resolve('+expression+').then(Boolean)'))return;await delay(100);}throw Error('Timeout: '+expression+'; '+await evaluate('document.body.innerText.slice(-1200)'));};
 const clickSelector=async selector=>{await wait('document.querySelector('+JSON.stringify(selector)+')');await evaluate('document.querySelector('+JSON.stringify(selector)+').click()');await delay(100);};
 const click=async text=>{await wait('(()=>{const b=[...document.querySelectorAll("#grammar-editor-tab-content button")].find(b=>b.textContent.trim()==='+JSON.stringify(text)+'&&!b.disabled);if(!b)return false;b.click();return true;})()');await delay(100);};
 const input=async(selector,value)=>{await wait('document.querySelector('+JSON.stringify(selector)+')');await evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,"value").set.call(e,'+JSON.stringify(value)+');e.dispatchEvent(new Event("input",{bubbles:true}));})()');};
 const enter=async text=>{await input('#grammar-bulk-input','');await evaluate('document.querySelector("#grammar-bulk-input").focus()');await cdp.send('Input.insertText',{text});await delay(100);};
 const newEditor=async(type='multiple_choice')=>{await clickSelector(type==='rewrite'?'#tab-grammar-rewrite-editor':'#tab-grammar-editor');await wait('document.querySelector("#grammar-bulk-input")');await wait('document.querySelector("#grammar-bulk-input").value===""');};
 const count=n=>wait('[...document.querySelectorAll("#grammar-editor-tab-content h3")].some(e=>e.textContent==="Bảng câu hỏi ('+n+')")');
 const rows=()=>evaluate('(()=>{const section=[...document.querySelectorAll("#grammar-editor-tab-content h3")].find(e=>e.textContent.startsWith("Bảng câu hỏi")).parentElement.parentElement;return [...section.querySelectorAll(":scope > .space-y-4 > div")].map(row=>({text:row.querySelector("textarea").value,explanation:[...row.querySelectorAll("textarea")].at(-1).value,options:[...row.querySelectorAll("input[placeholder^=\\"Đáp án\\"]")].map(e=>e.value)}));})()');
 const shot=async name=>{const r=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true});const p=path.join(screenshotDir,name+'.png');fs.writeFileSync(p,Buffer.from(r.data,'base64'));return p;};
 const report={checks:[],screenshots:[]}; const note=check=>{report.checks.push(check);console.log(check);};
 const first='QUESTION: She _____ to school every day.\nA: go\nB: goes\nC: going\nANSWER: B\nEXPLANATION: Chủ ngữ She dùng goes.';
 const second='QUESTION: They _____ watching TV now.\nA: is\nB: are\nANSWER: B\nEXPLANATION: Chủ ngữ They dùng are.';
 const auth={Authorization:'Bearer local-test-auth-bypass'};
 const savedIds=[];
 try {
  await wait('document.querySelector("#tab-grammar-editor")');await evaluate('localStorage.clear()');
  await newEditor();const raw=first+'\n'+second;await enter(raw);
  assert(await evaluate('document.querySelector("#grammar-bulk-input").value')===raw,'Real browser input retains line breaks');
  await click('Ghép dữ liệu vào bảng câu hỏi');await count(2);let actual=await rows();
  assert(actual.length===2&&actual[0].text==='She _____ to school every day.'&&actual[1].text==='They _____ watching TV now.','Every question survives without blank separators');
  assert(actual[0].options.join('|')==='go|goes|going'&&actual[1].options.join('|')==='is|are','All options survive');
  assert(actual[0].explanation==='Chủ ngữ She dùng goes.','Explanation preserved');
  assert(await evaluate('document.querySelector("#grammar-bulk-input").value')===raw,'Import never rewrites raw draft text');
  note('no-blank-lines-browser-input-and-all-fields');
  assert(await evaluate('document.getElementById(document.querySelector("#grammar-bulk-input").getAttribute("aria-describedby"))?.textContent.includes("Không bắt buộc dòng trống")'),'Help linked accessibly');note('input-help-and-accessible-name');
  await delay(400);await evaluate('window.dispatchEvent(new Event("pagehide"));window.onbeforeunload=null');await cdp.send('Page.navigate',{url:origin});await wait('document.querySelector("#tab-grammar-sets")');await clickSelector('#tab-grammar-sets');
  await wait('document.querySelector("#admin-main-panel .authoring-draft-recovery")');await evaluate('[...document.querySelectorAll("#admin-main-panel .authoring-draft-recovery button")].find(b=>b.textContent.trim()==="Khôi phục").click()');await count(2);
  assert(await evaluate('document.querySelector("#grammar-bulk-input").value')===raw,'Draft recovery preserves every label/newline');note('imported-rows-and-raw-source-survive-reload');
  await input('#grammar-editor-tab-content input','QA grammar bulk no-blank '+Date.now());
  await evaluate('(()=>{const l=[...document.querySelectorAll("#grammar-editor-tab-content label")].find(e=>e.textContent.includes("Trạng thái"));const e=l.querySelector("select");Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set.call(e,"draft");e.dispatchEvent(new Event("change",{bubbles:true}));window.qaFetch=window.fetch;window.qaSaves=[];window.fetch=async(url,init)=>{const r=await window.qaFetch(url,init);if(String(url)==="/api/admin/grammar-sets"&&init?.method==="POST"){window.qaSaves.push({payload:JSON.parse(init.body),status:r.status,body:await r.clone().json()});}return r;};})()');
  await click('Lưu bài ngữ pháp');await wait('window.qaSaves?.length===1');const save=await evaluate('window.qaSaves[0]');assert(save.status===201,'Real server accepts imported grammar set');savedIds.push(save.body.id);
  const read=await (await fetch(origin+'/api/admin/grammar-sets/'+save.body.id,{headers:auth})).json();
  assert(read.questions.length===2&&read.questions[0].options.find(o=>o.id===read.questions[0].correctOptionId).text==='goes'&&read.questions[1].options.find(o=>o.id===read.questions[1].correctOptionId).text==='are','Database/API roundtrip retains complete answer IDs');
  note('manual-save-database-api-roundtrip');
  const denied=await fetch(origin+'/api/admin/grammar-sets/'+save.body.id);assert(denied.status===401,'Admin detail still needs authentication');
  const invalid=structuredClone(save.payload);invalid.title='QA invalid bulk';invalid.questions[0].correctOptionId='invalid';const rejected=await fetch(origin+'/api/admin/grammar-sets',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify(invalid)});assert(rejected.status===400,'Real backend validation still rejects invalid answer key');note('auth-and-server-validation-unchanged');
  await newEditor();await enter((first+'\n'+second).replace(/\n/g,' '));await click('Ghép dữ liệu vào bảng câu hỏi');await count(2);actual=await rows();assert(actual[1].text==='They _____ watching TV now.','Collapsed input has both records');await wait('document.body.innerText.includes("dồn trên cùng một dòng")');note('collapsed-line-recovery-with-review-warning');
  await evaluate('document.querySelector("#grammar-bulk-input").scrollIntoView({block:"center"})');report.screenshots.push(await shot('collapsed-desktop'));
  await newEditor();const bad='QUESTION: Broken.\nA: one\nB: two\nEXPLANATION: Missing answer.';await enter(first+'\n'+bad+'\n'+second);await click('Ghép dữ liệu vào bảng câu hỏi');await count(2);await wait('document.body.innerText.includes("2/3 câu")&&document.body.innerText.includes("Câu số 2")');note('malformed-middle-count-and-explicit-error');
  await newEditor();await enter(first+'\nA: overwrite');await click('Ghép dữ liệu vào bảng câu hỏi');await count(0);await wait('document.body.innerText.includes("nhãn A lặp lại")');note('duplicate-field-blocked-without-overwriting');
  await newEditor();await enter('[{"question":"not labelled text"}]');await click('Ghép dữ liệu vào bảng câu hỏi');await count(0);await wait('document.body.innerText.includes("không phải JSON")');note('actual-json-format-feedback');
  await newEditor('rewrite');const rewritten="QUESTION: Expand It's Monday.\nANSWER: It is Monday.\nACCEPTED: It's Monday.\nACCEPTED: It is Monday\nEXPLANATION: It's means It is.\nQUESTION: She _____ a teacher.\nANSWER: is\nEXPLANATION: She đi với is.";await enter(rewritten.replace(/\n/g,' '));await click('Ghép dữ liệu vào bảng câu hỏi');await count(2);actual=await rows();assert(actual.length===2&&actual[0].text==="Expand It's Monday.",'Rewrite collapsed input has both questions');
  await input('#grammar-editor-tab-content input','QA rewrite bulk '+Date.now());await click('Lưu bài tự luận');await wait('window.qaSaves?.length===2');const rewriteSave=await evaluate('window.qaSaves[1]');assert(rewriteSave.status===201,'Rewrite save succeeds');savedIds.push(rewriteSave.body.id);
  const rewriteRead=await (await fetch(origin+'/api/admin/grammar-sets/'+rewriteSave.body.id,{headers:auth})).json();assert(rewriteRead.questions.length===2&&rewriteRead.questions[0].correctAnswer==='It is Monday.'&&rewriteRead.questions[0].acceptedAnswers.includes("It's Monday."),'Rewrite alternatives/answer persist');note('rewrite-collapsed-save-and-accepted-answers-roundtrip');
  await newEditor();await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await enter(raw);await click('Ghép dữ liệu vào bảng câu hỏi');await count(2);await evaluate('document.querySelector("#grammar-bulk-input").scrollIntoView({block:"center"});document.querySelector("#grammar-bulk-input").focus()');
  assert(await evaluate('document.activeElement.id==="grammar-bulk-input"&&document.querySelector("#grammar-bulk-input").getBoundingClientRect().width<=390'),'Textarea fits mobile and supports focus');report.screenshots.push(await shot('import-mobile'));note('mobile-input-and-keyboard-focus');
  report.savedIds=savedIds;fs.writeFileSync('.data/grammar-bulk-qa/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 } catch(e) {await shot('failure').catch(()=>{});console.error(await evaluate('document.body.innerText.slice(-1500)').catch(()=>''));throw e;}
 finally {cdp.close();chrome.kill();}
}
main().catch(error=>{console.error(error);chrome.kill();process.exitCode=1;});
