import { controlMetricsExpression, exerciseStudentModuleTheme } from './student-module-theme-browser-checks.mjs';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exerciseBankFilters } from './ioe-bank-filters-browser-checks.mjs';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = Number(process.env.CSS_QA_DEBUG_PORT || (10_000 + Math.floor(Math.random() * 20_000)));
const origin = process.env.COMPETITION_QA_ORIGIN || 'http://127.0.0.1:3016';
const qaRoot = mkdtempSync(path.join(os.tmpdir(), 'vhomework-css-qa-'));
const profileDir = path.join(qaRoot, 'profile');
const screenshotDir = path.join(qaRoot, 'screenshots');
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
    if (!message.id) { if(message.method==='Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails); return; }
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


let browserErrors = [];
async function main() {
 const overviewOnly=process.argv.includes('--overview-only'),previewOnly=process.argv.includes('--preview-only'),bankFiltersOnly=process.argv.includes('--bank-filters-only');
 if(!overviewOnly&&!previewOnly&&!bankFiltersOnly&&process.env.COMPETITION_QA_ALLOW_FIXTURE_WRITES !== 'true')throw Error('Set COMPETITION_QA_ALLOW_FIXTURE_WRITES=true only for an isolated dev:local fixture database.');
 if(!/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin))throw Error('Browser QA only supports an isolated dev:local loopback server.');
 const me=await fetch(origin+'/api/me',{headers:{Authorization:'Bearer local-test-auth-bypass'}});if(!me.ok||(await me.json()).id!=='local-test-super-admin')throw Error('Start an isolated fixture database through npm run dev:local.');
 const target=(await waitForDebugger()).find(t=>t.type==='page'&&t.url.startsWith(origin));
 const cdp=createCdpClient(target.webSocketDebuggerUrl); await cdp.ready;
 await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
 const evaluate=async expression=>{let r;try{r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});}catch(e){throw Error(e.message+' evaluating '+expression.slice(0,250));}if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const wait=async expression=>{const until=Date.now()+30000;while(Date.now()<until){if(await evaluate(`Boolean(${expression})`))return;await delay(120);}throw Error(`UI timeout: ${expression}; ${await evaluate("document.body.innerText.slice(-1600)")}`);};
 const click=async(text,root='#ioe-violympic-admin')=>{await wait(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(root+' button')})].find(b=>b.textContent.trim()===${JSON.stringify(text)}&&!b.disabled);if(!b)return false;b.click();return true;})()`);await delay(120);};
 const field=async(label,value,root='#ioe-violympic-admin')=>{await evaluate(`(()=>{const l=[...document.querySelectorAll(${JSON.stringify(root+' label')})].find(l=>l.textContent.trim().startsWith(${JSON.stringify(label)}));if(!l)throw Error('Missing label '+${JSON.stringify(label)});const el=l.querySelector('input,select,textarea');Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await delay(120);};
 const enter=async(extra={})=>{await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r',...extra});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await delay(100);await wait("!document.querySelector('.competition-question-nav button:disabled')");};
 const currentNumber=()=>evaluate("[...document.querySelectorAll('.competition-question-nav button')].findIndex(b=>b.getAttribute('aria-pressed')==='true')+1");
 const goToQuestion=async(number)=>{await evaluate(`document.querySelectorAll('.competition-question-nav button')[${number-1}].click()`);await wait(`document.querySelector('.competition-question')?.getAttribute('aria-label')==='Câu ${number}'`);};
 const waitForAutosave=async()=>{
   // Even re-selecting the same answer dirties the local generation. Let the
   // real 3-second autosave acknowledge it before testing a reload.
   await delay(3200);
   const until=Date.now()+15000;
   while(Date.now()<until){
     const saved=await evaluate(`(async()=>{const paper=decodeURIComponent(location.pathname.split('/').pop());const entry=Object.entries(sessionStorage).find(([key])=>key.startsWith('ioe-violympic:'+paper+':')&&!key.endsWith(':answers-backup'));if(!entry)return false;const local=JSON.parse(entry[1]);const response=await fetch('/api/ioe-violympic/attempts/'+local.id,{headers:{Authorization:'Bearer local-test-auth-bypass','X-Attempt-Ticket':local.ticket}});if(!response.ok)return false;const server=await response.json();return local.revision===server.revision&&Object.keys(server.answers).length===Object.keys(local.answers).length&&Object.entries(local.answers).every(([key,value])=>JSON.stringify(server.answers[key])===JSON.stringify(value));})()`);
     if(saved)return;await delay(200);
   }
   throw Error('Automatic saving did not persist the current answers to the fixture server');
 };
 const viewport=async(width,height=900)=>{await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await delay(150);};
 const shot=async(name,root)=>{const clip=root?await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(root)}).getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()`):undefined;const r=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,...(clip?{clip,captureBeyondViewport:true}:{})});const file=path.join(screenshotDir,name+'.png');writeFileSync(file,Buffer.from(r.data,'base64'));return file;};
 const metrics=async(root)=>evaluate(controlMetricsExpression(root));
 const reports={},screenshots={};
 const staffFetch=async(endpoint,method='GET',body)=>{const r=await fetch(origin+endpoint,{method,headers:{Authorization:'Bearer local-test-auth-bypass','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();assert(r.ok,'Fixture API '+endpoint+': '+JSON.stringify(data));return data;};
 const exercisePreview=async(name,triggerRoot)=>{
   await evaluate("window.qaPreviewFetch=window.fetch;window.qaPreviewWrites=[];window.fetch=(input,init)=>{if(init?.method&&!['GET','HEAD'].includes(init.method.toUpperCase()))window.qaPreviewWrites.push(String(input));return window.qaPreviewFetch(input,init)}");
   const open=async()=>{await evaluate(`[...document.querySelectorAll(${JSON.stringify(triggerRoot+' button')})].find(b=>b.textContent==='Xem trước').focus()`);await click('Xem trước',triggerRoot);await wait("document.querySelector('#ioe-question-preview')?.open");};
   const resetState="(()=>{const d=document.querySelector('#ioe-question-preview');return !d.querySelector('.competition-question input')?.value&&!d.querySelector('.competition-question button[aria-pressed=true]')&&!d.querySelector('.competition-question ol li')&&[...d.querySelectorAll('.competition-matches select')].every(s=>!s.value)})()";
   await open();assert(await evaluate(resetState),'Preview starts with no answer');
   const kind=await evaluate("(()=>{const d=document.querySelector('#ioe-question-preview');return d.querySelector('.competition-matches')?'matching':d.querySelector('.competition-answer')?'text-entry':d.querySelector('.competition-question ol')?'ordering':'choice';})()");
   const answerPreview=async()=>{
     if(kind==='text-entry')await field('Câu trả lời của em','42','#ioe-question-preview');
     else if(kind==='matching')await evaluate("(()=>{const selects=[...document.querySelectorAll('#ioe-question-preview .competition-matches select')];for(const el of selects){Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,el.options[1].value);el.dispatchEvent(new Event('change',{bubbles:true}));}})()");
     else {await evaluate("document.querySelector('#ioe-question-preview .competition-options button').click()");await delay(80);if(kind==='ordering')await evaluate("document.querySelectorAll('#ioe-question-preview .competition-options button')[1].click()");}
     await wait("!([...document.querySelectorAll('#ioe-question-preview button')].find(b=>b.textContent==='Làm lại câu xem thử').disabled)");
   };
   await answerPreview();
   if(['choice','text-entry'].includes(kind)){await evaluate("document.querySelector('#ioe-question-preview .competition-answer input, #ioe-question-preview .competition-option[aria-pressed=true]').focus()");await enter();assert(await evaluate("document.querySelector('#ioe-question-preview')?.open"),'Enter in trial answer keeps the preview open');assert(!await evaluate(resetState),'Enter does not clear the preview answer');}
   if(kind==='ordering')assert(await evaluate("document.querySelectorAll('#ioe-question-preview .competition-question ol li').length===2"),'Ordering preview records selected token order');
   if(kind==='matching')assert(await evaluate("[...document.querySelectorAll('#ioe-question-preview .competition-matches select')].filter(s=>s.value).length===1"),'Matching preview retains one-to-one pairing');
   for(const width of [1440,390,320]){await viewport(width);const layout=await evaluate("(()=>{const d=document.querySelector('#ioe-question-preview'),r=d.getBoundingClientRect();return {inViewport:r.top>=0&&r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,overflow:d.scrollWidth>d.clientWidth+1,focused:d.contains(document.activeElement),interactive:[...d.querySelectorAll('.competition-question :is(button,input,select)')].every(e=>!e.disabled)};})()");assert(layout.inViewport&&!layout.overflow&&layout.focused&&layout.interactive,'Student preview fits '+name+' at '+width);reports[name+width]={...await metrics('#ioe-question-preview'),layout,kind};screenshots[name+width]=await shot(name+'-'+width);}
   await evaluate("document.querySelector('#ioe-question-preview button').focus()");
   for(let i=0;i<10;i++){await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});assert(await evaluate("document.querySelector('#ioe-question-preview').contains(document.activeElement)"),'Tab focus remains inside the modal');}
   const focus=await evaluate("(()=>{const s=getComputedStyle(document.activeElement);return{style:s.outlineStyle,width:parseFloat(s.outlineWidth)}})()");assert(focus.style==='solid'&&focus.width>=3,'Preview keyboard focus is visible');
   await click('Làm lại câu xem thử','#ioe-question-preview');assert(await evaluate(resetState),'Reset clears only the preview answer');await answerPreview();
   await click('Đóng xem trước','#ioe-question-preview');await wait("!document.querySelector('#ioe-question-preview')");assert(await evaluate("document.activeElement.textContent==='Xem trước'"),'Close restores trigger focus');
   await open();assert(await evaluate(resetState),'Reopening starts a clean preview');
   await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await wait("!document.querySelector('#ioe-question-preview')");
   await open();await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:3,y:3,button:'left',clickCount:1});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:3,y:3,button:'left',clickCount:1});await wait("!document.querySelector('#ioe-question-preview')");
   assert(await evaluate("window.qaPreviewWrites.length===0"),'Trying a question never calls a write/attempt/grade endpoint');await evaluate("window.fetch=window.qaPreviewFetch");reports[name+'behavior']={kind,reset:true,reopen:true,escape:true,backdrop:true,focusTrap:true,noWrites:true};
 };
 await cdp.send('Page.navigate',{url:origin+'/admin'});await wait("document.querySelector('#tab-ioe-violympic')");await evaluate("document.querySelector('#tab-ioe-violympic').click()");await wait("document.querySelector('#ioe-violympic-admin .competition-tabs')");
 await wait("document.querySelectorAll('[data-inventory-subject]').length===4");assert(await evaluate("[...document.querySelectorAll('.competition-tabs button')].map(b=>b.textContent.trim()).join('|')==='Tổng quan|Soạn JSON|Ngân hàng|Kết quả'"),'Four revised admin tabs');
 if(bankFiltersOnly){
   const bankChecks=await exerciseBankFilters({assert,click,field,wait,evaluate,viewport,metrics,shot,staffFetch});Object.assign(reports,bankChecks.reports);Object.assign(screenshots,bankChecks.screenshots);
   assert(browserErrors.length===0,'Bank filters browser exceptions: '+JSON.stringify(browserErrors));
   const report={passed:true,readOnly:true,origin,reports,screenshots,browserErrors};writeFileSync('.data/ioe-bank-filters-local-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,readOnly:true,screenshots}));cdp.close();return;
 }
 if(overviewOnly){
   await wait("!document.querySelector('[data-competition-overview] button:disabled')");
   const overview=await staffFetch('/api/ioe-violympic/admin/overview');
   const cells=await evaluate("[...document.querySelectorAll('[data-inventory-cell]')].map(c=>({key:c.dataset.inventoryCell,text:c.textContent.trim()}))");
   assert(cells.length===144,'All four subjects, nine grades and four levels are visible');
   for(const cell of cells){const row=overview.inventory.find(r=>`${r.subject}:${r.grade}:${r.level}`===cell.key);assert(cell.text===(row?.count?row.count.toLocaleString('vi-VN'):'—'),'Displayed inventory agrees with the API: '+cell.key);}
   for(const width of [1280,390,320]){
     await viewport(width); const controls=await metrics('#ioe-violympic-admin');
     const layout=await evaluate("(()=>{const tables=[...document.querySelectorAll('.competition-inventory-table')];return {interactive:document.querySelectorAll('.competition-inventory-table :is(button,a,input,select,[tabindex])').length,heights:tables.map(t=>t.getBoundingClientRect().height),overflow:tables.some(t=>t.scrollWidth>t.parentElement.clientWidth+1),clipped:[...document.querySelectorAll('.competition-inventory-table th,.competition-inventory-table td')].some(c=>c.scrollWidth>c.clientWidth+1)};})()");
     assert(!controls.overflow&&!layout.overflow&&!layout.clipped&&layout.interactive===0&&layout.heights.every(h=>h<300),'Compact read-only table fits '+width+'px: '+JSON.stringify(layout));
     assert(controls.controls.every(c=>c.contrast>=4.5),'Overview control contrast at '+width+'px');reports[width]={...controls,layout};
     screenshots[width]=await shot('overview-compact-'+width,'#ioe-violympic-admin');
   }
   assert(browserErrors.length===0,'Overview browser exceptions: '+JSON.stringify(browserErrors));
   const report={passed:true,readOnly:true,origin,reports,screenshots,browserErrors};writeFileSync('.data/ioe-compact-overview-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,readOnly:true,screenshots}));cdp.close();return;
 }
 if(previewOnly){
   await click('Ngân hàng');await field('Môn','math');await field('Lớp','3');await field('Cấp','school');await wait("document.querySelector('#ioe-violympic-admin tbody tr button')&&!document.querySelector('#ioe-violympic-admin [role=status]')");
   await evaluate("[...document.querySelectorAll('#ioe-violympic-admin tbody button')].find(b=>b.textContent==='Xem trước').focus()");await click('Xem trước','#ioe-violympic-admin tbody');
   const before=await evaluate("(()=>{const dialog=document.querySelector('#ioe-question-preview'),old=[...document.querySelectorAll('#ioe-violympic-admin button')].find(b=>b.textContent==='Đóng xem trước'),r=old?.getBoundingClientRect();return {dialog:Boolean(dialog?.open),oldPreviewTop:r?.top,viewport:innerHeight,disabledAnswerControls:document.querySelectorAll('#ioe-violympic-admin .competition-question :is(button,input,select):disabled').length};})()");
   if(!before.dialog&&typeof before.oldPreviewTop==='number')writeFileSync('.data/ioe-preview-baseline-ui.json',JSON.stringify(before,null,2));
   assert(before.dialog,'Preview must open immediately in a student-view dialog: '+JSON.stringify(before));
   for(const width of [1440,390,320]){await viewport(width);const layout=await evaluate("(()=>{const d=document.querySelector('#ioe-question-preview'),r=d.getBoundingClientRect();return {open:d.open,inViewport:r.top>=0&&r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,overflow:d.scrollWidth>d.clientWidth+1,activeInside:d.contains(document.activeElement),disabledAnswerControls:d.querySelectorAll('.competition-question :is(button,input,select):disabled').length};})()");assert(layout.open&&layout.inViewport&&!layout.overflow&&layout.activeInside&&layout.disabledAnswerControls===0,'Visible, focused, interactive preview fits '+width);reports[width]={...await metrics('#ioe-question-preview'),layout};screenshots[width]=await shot('question-preview-'+width);}
   await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await wait("!document.querySelector('#ioe-question-preview')");
   const restoredFocus=await evaluate("({tag:document.activeElement.tagName,text:document.activeElement.textContent.slice(0,80)})");assert(restoredFocus.text==='Xem trước','Closing returns focus to the preview trigger: '+JSON.stringify(restoredFocus));
   await exercisePreview('localPreview','#ioe-violympic-admin tbody');
   assert(browserErrors.length===0,'Preview browser exceptions: '+JSON.stringify(browserErrors));assert(Object.values(reports).filter(r=>r.controls).every(r=>!r.overflow&&r.controls.every(c=>c.contrast>=4.5)),'Preview computed control contrast');
   const report={passed:true,readOnly:true,origin,reports,screenshots,browserErrors};writeFileSync('.data/ioe-preview-local-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,readOnly:true,screenshots}));cdp.close();return;
 }
 await click('Soạn JSON');
 for(const subject of ['english','vietnamese','math-english','math']){
   await field('Môn',subject);await click('Thêm câu thủ công');
   const visible=await evaluate("[...document.querySelectorAll('[data-competition-draft-row] label')].filter(l=>/^(Nhóm kiến thức|Độ khó)/.test(l.textContent)).length");
   assert(visible===(subject==='english'?2:0),'Authoring metadata follows the actual selection blueprint for '+subject);await click('Bỏ dòng');
 }
 await field('Môn','math');await field('Lớp','3');await field('Cấp','school');
 await field('JSON từ ChatGPT',JSON.stringify({questions:[null]}));await click('Ghép vào bảng');assert(await evaluate("document.querySelector('#ioe-violympic-admin [role=alert]').textContent.includes('đối tượng JSON')"),'Malformed row must report an error without crashing React');await field('JSON từ ChatGPT',JSON.stringify({questions:[{prompt:'Câu thiếu đáp án',options:['Một','Hai'],answer:''}]}));await click('Ghép vào bảng');
 assert(await evaluate("document.querySelector('[data-competition-draft-row] .competition-error')!==null"),'Invalid row must show validation');
 await click('Lưu 1 câu vào bank');assert(await evaluate("document.querySelector('#ioe-violympic-admin [role=alert]').textContent.includes('Dòng 1')"),'Save must reject invalid row');await click('Bỏ dòng');
 await field('JSON từ ChatGPT',JSON.stringify({questions:[{title:'Chọn đáp án đúng',prompt:'QA Chọn hình tam giác',options:[{text:''},{text:''}],answer:'',explanation:'Quan sát số cạnh của từng hình.'}]}));await click('Ghép vào bảng');
 assert(await evaluate("document.querySelectorAll('.competition-editor-option').length===2&&[...document.querySelectorAll('.competition-editor-option textarea')].every(t=>t.value==='')"),'Image options preserve empty upload slots, never invented descriptions');
 assert(await evaluate("[...document.querySelectorAll('[data-competition-draft-row] label')].find(l=>l.textContent.startsWith('Đáp án đúng')).querySelector('select').value===''"),'Empty image options never infer answer A from blank text');
 assert(await evaluate("[...document.querySelectorAll('[data-competition-draft-row] label')].find(l=>l.textContent.startsWith('Đoạn văn')).querySelector('textarea').value===''"),'Image question has no generated passage');
 assert(await evaluate("![...document.querySelectorAll('[data-competition-draft-row] label')].some(l=>/^(Nhóm kiến thức|Độ khó)/.test(l.textContent))"),'Math studio hides unused rotation metadata');
 await click('Lưu 1 câu vào bank');assert(await evaluate("!!document.querySelector('[data-competition-draft-row] .competition-error')"),'An image option without uploaded media cannot be saved');
 await field('Đáp án đúng','option-2','[data-competition-draft-row]');
 for(let option=0;option<2;option++){
   await evaluate(`(()=>{const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1sAAAAASUVORK5CYII='),c=>c.charCodeAt(0))],'qa-image-option.png',{type:'image/png'}));const el=document.querySelectorAll('.competition-editor-option')[${option}].querySelector('input[type=file][accept^="image/"]');el.files=dt.files;el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
   await wait(`document.querySelectorAll('.competition-editor-option')[${option}].querySelector('img')`);
 }
 await wait("!document.querySelector('[data-competition-draft-row] .competition-error')");await exercisePreview('uploadedImageChoices','[data-competition-draft-row]');
 assert(await evaluate("[...document.querySelectorAll('.competition-editor-option textarea')].every(t=>t.value==='')&&document.querySelectorAll('.competition-editor-option img').length===2"),'Teacher-uploaded option images work without generated text');await click('Bỏ dòng');
 const runName='QA '+Date.now();
 const questions=Array.from({length:30},(_,i)=>({title:`Câu ${700+i}. Dữ kiện`,sourceNumber:String(700+i),prompt:`${runName} tính ${i}+1`,passage:i===0?'Đọc dữ kiện trước khi làm bài.':'',options:i===29?[]:['Sai 1','Sai 2','Sai 3','Sai 4',String(i+1)],answer:i===29?'30':'E',explanation:`Lời giải: ${i}+1=${i+1}.`}));
 await click('Ngân hàng');assert(await evaluate("[...document.querySelectorAll('.competition-bank-prompt p')].every(p=>p.textContent.startsWith('QA '))"),'Existing bank contains non-QA data; refusing fixture cleanup');await wait("!document.querySelector('#ioe-violympic-admin button:disabled')||document.querySelector('#ioe-violympic-admin tbody')");await evaluate("(()=>{const el=document.querySelector('input[aria-label=\"Chọn cả trang\"]');if(el&&!el.checked)el.click();})()");if(await evaluate("document.querySelector('input[aria-label=\"Chọn cả trang\"]')?.checked")){const text=await evaluate("[...document.querySelectorAll('#ioe-violympic-admin button')].find(b=>b.textContent.startsWith('Xóa ')&&b.textContent.includes('câu đã chọn')).textContent.trim()");await click(text);await wait("document.querySelectorAll('#ioe-violympic-admin tbody tr').length===0");}await click('Soạn JSON');await field('JSON từ ChatGPT',JSON.stringify({questions}));await click('Ghép vào bảng');await wait("document.querySelectorAll('[data-competition-draft-row]').length===30");
 assert(await evaluate("(()=>{const row=document.querySelector('[data-competition-draft-row]'),media=row.querySelector('.competition-draft-fields > .competition-media-editor');return ['Tải ảnh','Dán ảnh','Tải audio','Nghe thử'].every(label=>[...media.querySelectorAll('button')].some(b=>b.textContent.trim()===label))&&!row.textContent.includes('Số nguồn PDF')&&!row.textContent.includes('Sửa JSON cả câu')&&!media.textContent.includes('Tạo ảnh bằng')&&!media.textContent.includes('Tạo audio bằng');})()"),'Editor always shows four media controls and hides removed fields');
 await evaluate("(()=>{window.qaFetch=window.fetch;window.fetch=async(...args)=>{const r=await window.qaFetch(...args);if(String(args[0]).includes('/api/listening/assets'))await new Promise(resolve=>setTimeout(resolve,500));return r;};})()");
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1sAAAAASUVORK5CYII=';
 await evaluate(`(()=>{const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob(${JSON.stringify(png)}),c=>c.charCodeAt(0))],'fixture.png',{type:'image/png'}));document.querySelector('[data-competition-draft-row] .competition-draft-fields > .competition-media-editor [aria-label="Tải, kéo thả hoặc dán ảnh từ clipboard"]').dispatchEvent(new ClipboardEvent('paste',{bubbles:true,clipboardData:dt}));})()`);
 assert(await evaluate("[...document.querySelectorAll('#ioe-violympic-admin button')].find(b=>b.textContent.trim()==='Lưu 30 câu vào bank').disabled"),'Saving must wait for media upload');await wait("document.querySelector('[data-competition-draft-row] .competition-draft-fields > .competition-media-editor img')");await evaluate("window.fetch=window.qaFetch");
 await click('Gỡ ảnh','[data-competition-draft-row] .competition-draft-fields > .competition-media-editor');
 await wait("!document.querySelector('[data-competition-draft-row] .competition-draft-fields > .competition-media-editor img')");
 await evaluate(`(()=>{const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob(${JSON.stringify(png)}),c=>c.charCodeAt(0))],'fixture-second.png',{type:'image/png'}));const el=document.querySelector('[data-competition-draft-row] .competition-draft-fields > .competition-media-editor input[type=file][accept^="image/"]');el.files=dt.files;el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await wait("document.querySelector('[data-competition-draft-row] .competition-draft-fields > .competition-media-editor img')");
 const wav=Buffer.alloc(32044);wav.write('RIFF');wav.writeUInt32LE(32036,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(32000,40);
 await evaluate(`(()=>{const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob(${JSON.stringify(wav.toString('base64'))}),c=>c.charCodeAt(0))],'fixture.wav',{type:'audio/wav'}));const el=document.querySelector('[data-competition-draft-row] .competition-draft-fields > .competition-media-editor input[type=file][accept^="audio/"]');el.files=dt.files;el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await wait("document.querySelector('[data-competition-draft-row] .competition-draft-fields > .competition-media-editor > .competition-media audio[src]')");
 assert(await evaluate("!document.querySelector('[data-competition-draft-row] .competition-draft-fields > .competition-media-editor [data-audio-preview-button]').disabled"),'Uploaded audio enables the always-visible preview');
 // Playback requires a trusted user gesture; element.click() alone in a fresh
 // headless document is rejected by Chrome's normal autoplay policy.
 const audioPoint=await evaluate("(()=>{const b=document.querySelector('[data-competition-draft-row] .competition-draft-fields > .competition-media-editor [data-audio-preview-button]');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()");
 await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...audioPoint});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...audioPoint});
 await wait("!document.querySelector('[data-competition-draft-row] .competition-draft-fields > .competition-media-editor audio.hidden').paused");await click('Dừng','[data-competition-draft-row] .competition-draft-fields > .competition-media-editor');
 await exercisePreview('draftPreview','[data-competition-draft-row]');assert(await evaluate("document.querySelectorAll('[data-competition-draft-row]').length===30"),'Draft preview keeps the authoring rows');
 await click('Lưu 30 câu vào bank');await wait("document.querySelectorAll('[data-competition-draft-row]').length===0");await click('Ngân hàng');await wait("document.querySelectorAll('#ioe-violympic-admin tbody tr').length===30");
 const bankChecks=await exerciseBankFilters({assert,click,field,wait,evaluate,viewport,metrics,shot,staffFetch},true);Object.assign(reports,bankChecks.reports);Object.assign(screenshots,bankChecks.screenshots);
 await field('Môn','math');await field('Lớp','3');await field('Cấp','school');await wait("document.querySelectorAll('#ioe-violympic-admin tbody tr').length===30&&!document.querySelector('#ioe-violympic-admin [role=status]')");
 const bankPreviewRows=await staffFetch('/api/ioe-violympic/admin/questions?subject=math&grade=3&level=school');
 for(const interaction of ['choice','text-entry']){const index=bankPreviewRows.items.findIndex(q=>q.interaction===interaction);assert(index>=0,'Fixture contains '+interaction);await exercisePreview('bankPreview-'+interaction,`#ioe-violympic-admin tbody tr:nth-child(${index+1})`);}
 assert(await evaluate("document.querySelectorAll('#ioe-violympic-admin tbody tr').length===30"),'Bank preview retains all questions');
 await viewport(1440);reports.bankDesktop=await metrics('#ioe-violympic-admin');screenshots.bankDesktop=await shot('bank-desktop');await viewport(390);reports.bankMobile=await metrics('#ioe-violympic-admin');screenshots.bankMobile=await shot('bank-mobile');
 // Regression: the student can discover saved questions before any paper is published.
 assert(bankPreviewRows.items.every(q=>q.sourceNumber),'Hiding the source-number field preserves imported source metadata');
 await cdp.send('Page.navigate',{url:origin+'/ioe-violympic'});await wait("document.querySelector('[data-student-portal] .competition-portal-hero')");
 for(const width of [1440,390,320]){await viewport(width);reports['portal'+width]=await metrics('#ioe-violympic-student');screenshots['portal'+width]=await shot('student-portal-'+width);}
 reports.studentTheme=await exerciseStudentModuleTheme({evaluate,cdp,root:'#ioe-violympic-student',assert});
 await click('Thi thử','#ioe-violympic-student');await wait("document.querySelectorAll('[data-bank-directory] select').length===3");
 assert(await evaluate("document.querySelector('[data-bank-directory] select').options.length===5"),'Mock hub offers all four subjects');
 assert(await evaluate("[...document.querySelectorAll('[data-bank-directory] select')].every(s=>s.value==='')"),'No default subject, grade or level');
 assert(await evaluate("![...document.querySelectorAll('[data-bank-directory] button')].some(b=>/Cập nhật|Mở bài/.test(b.textContent))"),'Automatic checks replace refresh and open cards');
 await click('Thi thử ngay','[data-bank-directory]');await wait("document.querySelector('[data-bank-directory] [role=alert]')?.textContent.includes('chọn đủ')");
 for(const width of [1440,390,320]){await viewport(width);reports['directory'+width]=await metrics('#ioe-violympic-student');screenshots['directory'+width]=await shot('bank-directory-'+width);}
 await field('Môn','vietnamese','[data-bank-directory]');await field('Lớp','9','[data-bank-directory]');await field('Cấp','national','[data-bank-directory]');
 await click('Thi thử ngay','[data-bank-directory]');await wait("document.querySelector('[data-bank-directory] [role=alert]')?.textContent==='Bộ đề đang được soạn, hãy chọn cấp khác.'");reports.bankMissing=await metrics('#ioe-violympic-student');
 await evaluate("window.qaDirectoryFetch=window.fetch;window.fetch=async(...args)=>{if(String(args[0]).includes('/papers/bank-vietnamese-9-national')){await new Promise(resolve=>setTimeout(resolve,700));return new Response(JSON.stringify({error:'Lỗi tải kho kiểm thử'}),{status:503,headers:{'Content-Type':'application/json'}});}return window.qaDirectoryFetch(...args)}");
 await click('Thi thử ngay','[data-bank-directory]');assert(await evaluate("document.querySelector('[data-bank-directory] button').disabled"),'Bank check has a loading state');
 await wait("document.querySelector('[data-bank-directory] [role=alert]')?.textContent.includes('Lỗi tải kho kiểm thử')");reports.bankError=await metrics('#ioe-violympic-student');
 await evaluate("window.fetch=window.qaDirectoryFetch");await click('Thi thử ngay','[data-bank-directory]');await wait("document.querySelector('[data-bank-directory] [role=alert]')?.textContent==='Bộ đề đang được soạn, hãy chọn cấp khác.'");
 assert(await evaluate("[...document.querySelectorAll('[data-bank-directory] select')].map(s=>s.value).join(',')==='vietnamese,9,national'"),'Failed checks preserve selected scope');
 const createdPaper=await staffFetch('/api/ioe-violympic/admin/papers','POST',{subject:'math',grade:3,level:'school',title:runName,visibility:'public'});
 const paperHref='/ioe-violympic/paper/'+createdPaper.id;
 const createdClass=await staffFetch('/api/classes','POST',{name:runName+' Lớp B'});
 const assignment=await staffFetch('/api/assignments','POST',{resourceType:'competition',resourceId:createdPaper.id,classId:createdClass.id,title:runName});
 const assignmentLink=origin+paperHref+'?access='+encodeURIComponent(assignment.shareToken);assert(assignment.shareToken,'Existing B assignment API retains shared link');
 await cdp.send('Page.navigate',{url:assignmentLink});await wait("document.querySelector('#ioe-violympic-student .competition-primary')");await click('Chuẩn bị bài','#ioe-violympic-student');await click('Bắt đầu','#ioe-violympic-student');await wait("document.querySelector('.competition-player-header')");
 const response=await evaluate(`(async()=>{const saved=JSON.parse(Object.entries(sessionStorage).find(([k,v])=>k.startsWith('ioe-violympic:')&&!k.endsWith(':answers-backup'))[1]);const r=await fetch('/api/ioe-violympic/attempts/'+saved.id,{headers:{Authorization:'Bearer local-test-auth-bypass','X-Attempt-Ticket':saved.ticket}});return r.json()})()`);
 assert(!/answerSpec|correctOptionId|explanation|ownerId|sourceNumber/.test(JSON.stringify(response)),'No answer key before submit');
 const answerCurrent=async()=>{await evaluate(`(()=>{const q=document.querySelector('.competition-question');const correct=Number(q.querySelector('.competition-prompt').textContent.match(/(\\d+)\\+1/)[1])+1;const option=[...q.querySelectorAll('button.competition-option')].find(b=>b.querySelector('span').textContent.trim().replace(/^[A-Z]\\.\\s*/,'')===String(correct));if(option){option.focus();option.click();}else {const el=q.querySelector('input');el.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(correct));el.dispatchEvent(new Event('input',{bubbles:true}));}})()`);await delay(50);};
 const choiceNumber=response.questions.findIndex((q,i)=>q.interaction==='choice'&&i<29)+1;
 await goToQuestion(choiceNumber);await evaluate("document.querySelector('.competition-option').focus()");await enter();assert(await currentNumber()===choiceNumber,'Enter on an unselected option selects it before advancing');
 assert(await evaluate("document.querySelector('.competition-option').getAttribute('aria-pressed')==='true'"),'Native Enter activation selects the focused option');
 await evaluate("document.querySelectorAll('.competition-option')[1].focus()");await enter();assert(await currentNumber()===choiceNumber,'Enter on a different option does not advance using the old selection');
 assert(await evaluate("document.querySelectorAll('.competition-option')[1].getAttribute('aria-pressed')==='true'"),'Native Enter can change a selection');
 await answerCurrent();
 for(const init of [{isComposing:true},{keyCode:229}]){await evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true,...${JSON.stringify(init)}}))`);assert(await currentNumber()===choiceNumber,'Composition Enter keeps the current question');}
 for(const modifiers of [1,2,4,8]){await enter({modifiers});assert(await currentNumber()===choiceNumber,'Modified Enter preserves question '+modifiers);}
 await enter({autoRepeat:true});assert(await currentNumber()===choiceNumber,'Held Enter does not advance');
 await enter();await wait(`document.querySelector('.competition-question').getAttribute('aria-label')==='Câu ${choiceNumber+1}'`);
 assert(await evaluate("document.activeElement.matches('.competition-answer input, .competition-option')"),'The next answer control receives focus');
 await enter({autoRepeat:true});assert(await currentNumber()===choiceNumber+1,'Repeat cannot skip the next question');
 assert(await evaluate("!document.querySelector('.competition-option[aria-pressed=true]')&&!document.querySelector('.competition-answer input')?.value"),'Repeat cannot select an answer on the next question');
 const mediaNumber=response.questions.findIndex(q=>q.media.some(m=>m.kind==='audio'))+1;
 await goToQuestion(mediaNumber);await evaluate("document.querySelector('.competition-question audio').focus()");await enter();assert(await currentNumber()===mediaNumber,'Audio Enter does not navigate questions');await evaluate("document.querySelector('.competition-question audio').pause()");
 const nextButtonFrom=mediaNumber<30?mediaNumber:1;await goToQuestion(nextButtonFrom);
 await evaluate("[...document.querySelectorAll('#ioe-violympic-student button')].find(b=>b.textContent==='Câu tiếp').focus()");await enter();assert(await currentNumber()===nextButtonFrom+1,'Enter still activates the existing Next button once');
 await goToQuestion(30);await answerCurrent();await enter();assert(await currentNumber()===30&&await evaluate("!!document.querySelector('.competition-player-header')&&!document.querySelector('.competition-score')"),'Enter at the last question never submits');
 reports.enterChoice={nativeSelection:true,changeSelection:true,next:true,focus:true,repeatGuard:true,imeGuard:true,modifierGuard:true,mediaUnaffected:true,nextButton:true,lastDoesNotSubmit:true};
 await goToQuestion(1);
 for(const width of [1440,1024,768,640,390,320]){
   await viewport(width);await evaluate('document.activeElement?.blur()');
   const layout=await evaluate(`(()=>{const nav=document.querySelector('.competition-answer-navigation'),top=document.querySelector('.competition-player-topline'),rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,cx:(r.left+r.right)/2,cy:(r.top+r.bottom)/2,height:r.height};},buttons=[...nav.querySelectorAll('button')].map(rect),timer=rect(top.querySelector('.competition-timer')),submit=rect(top.querySelector('.competition-submit')),title=rect(top.querySelector('h2')),answered=document.querySelector('.competition-question-nav [data-answered=true]'),blank=document.querySelector('.competition-question-nav button:not([data-answered])'),styles=e=>{const s=getComputedStyle(e);return {color:s.color,background:s.backgroundColor,image:s.backgroundImage,shadow:s.boxShadow}};return {nav:rect(nav),top:rect(top),buttons,timer,submit,title,answered:styles(answered),blank:styles(blank),removed:!document.body.innerText.includes('Đã lưu trên server')&&!document.body.innerText.includes('câu đã trả lời')&&![...document.querySelectorAll('#ioe-violympic-student button')].some(b=>b.textContent==='Lưu ngay'),overflow:document.documentElement.scrollWidth>innerWidth+1};})()`);
   assert(layout.removed&&!layout.overflow,'Clean player without manual save/progress text at '+width);
   assert(layout.buttons.length===3&&Math.abs(layout.buttons[1].cx-layout.nav.cx)<2&&Math.abs(layout.buttons[0].left-layout.nav.left)<2&&Math.abs(layout.buttons[2].right-layout.nav.right)<2,'Previous, Answer and Next align left/center/right at '+width);
   assert(Math.max(...layout.buttons.map(b=>b.cy))-Math.min(...layout.buttons.map(b=>b.cy))<2&&layout.buttons.every(b=>b.height>=44),'All three actions share one row with touch targets at '+width);
   assert(Math.abs(layout.submit.right-layout.top.right)<2,'Submit aligns to upper-right edge at '+width);
   if(width>700)assert(Math.abs(layout.timer.cx-layout.top.cx)<2&&Math.max(layout.title.cy,layout.timer.cy,layout.submit.cy)-Math.min(layout.title.cy,layout.timer.cy,layout.submit.cy)<2,'Title, centered clock and submit share the header row at '+width);
   else assert(layout.title.bottom<=layout.timer.top&&Math.abs(layout.timer.cy-layout.submit.cy)<2,'Compact header keeps title above aligned clock/submit at '+width);
   assert(layout.answered.color!==layout.blank.color&&layout.answered.image.includes('255, 225, 184'),'Answered numbered buttons use light orange at '+width);
   reports['playerLayout'+width]={...await metrics('#ioe-violympic-student'),layout};screenshots['playerLayout'+width]=await shot('player-layout-'+width);
 }
 await viewport(390);
 await answerCurrent();await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});reports.keyboardFocus=await evaluate("(()=>{const el=document.activeElement,s=getComputedStyle(el);return {visible:el.matches(':focus-visible'),outline:s.outlineStyle,width:s.outlineWidth};})()");assert(reports.keyboardFocus.visible&&reports.keyboardFocus.outline==='solid','Keyboard focus must be visible');await viewport(1440);reports.playerDesktop=await metrics('#ioe-violympic-student');screenshots.playerDesktop=await shot('player-desktop');await viewport(390);reports.playerMobile=await metrics('#ioe-violympic-student');screenshots.playerMobile=await shot('player-mobile');
 await waitForAutosave();await cdp.send('Page.reload');await wait("document.querySelector('.competition-option[aria-pressed=true]')||document.querySelector('.competition-question input')?.value");
 for(let i=1;i<30;i++){await click('Câu tiếp','#ioe-violympic-student');await answerCurrent();}
 await waitForAutosave();
 await click('Nộp bài','#ioe-violympic-student');await wait("document.querySelectorAll('.competition-review-row').length===30");assert(await evaluate("document.querySelector('.competition-score').textContent.includes('300/300')"),'All correct answers must score 300/300');assert(await evaluate("document.querySelectorAll('.competition-review-row.is-incorrect').length===0"),'Review grading');assert(await evaluate("Boolean(document.querySelector('.competition-review img')&&document.querySelector('.competition-review audio'))"),'Review retains B media');
 await viewport(1440);reports.reviewDesktop=await metrics('.competition-review');screenshots.reviewDesktop=await shot('review-desktop');await viewport(390);reports.reviewMobile=await metrics('.competition-review');screenshots.reviewMobile=await shot('review-mobile');
 await click('Lịch sử học tập','#ioe-violympic-student');await wait("document.querySelector('.history-detail-button')");await evaluate("document.querySelector('.history-detail-button').click()");await wait("document.querySelectorAll('.competition-review-row').length===30");screenshots.history=await shot('history-mobile');
 // New subject uses the same real JSON -> bank -> signed attempt -> History flow.
 await cdp.send('Page.navigate',{url:origin+'/admin'});await wait("document.querySelector('#tab-ioe-violympic')");await evaluate("document.querySelector('#tab-ioe-violympic').click()");await wait("document.querySelectorAll('[data-inventory-subject]').length===4");
 await click('Soạn JSON');await field('Môn','math-english');await field('Lớp','2');await field('Cấp','district');await click('Xem hướng dẫn');
 assert(await evaluate("document.querySelector('textarea[aria-label=\"Hướng dẫn cho ChatGPT\"]').value.includes('không dịch sang tiếng Việt')"),'English Math prompt retains English');
 const mathEnglishScope={subject:'math-english',grade:2,level:'district'};
 for(let page=0;page<20;page++){const bank=await staffFetch('/api/ioe-violympic/admin/questions?subject=math-english&grade=2&level=district');if(!bank.items.length)break;assert(bank.items.every(q=>q.prompt.startsWith('QA ')),'English Math bank contains non-QA data');await staffFetch('/api/ioe-violympic/admin/questions/archive','POST',{ids:bank.items.map(q=>q.id)});}
 const mathEnglishQuestions=Array.from({length:30},(_,i)=>({title:'Question '+(i+1)+'. Add one',prompt:runName+' Calculate '+i+'+1',options:[],answer:String(i+1),explanation:'Add one to '+i+'.',domain:'arithmetic'}));
 await field('JSON từ ChatGPT',JSON.stringify({questions:mathEnglishQuestions}));await click('Ghép vào bảng');await wait("document.querySelectorAll('[data-competition-draft-row]').length===30");await click('Lưu 30 câu vào bank');await wait("document.querySelectorAll('[data-competition-draft-row]').length===0");
 const mathEnglishPaper=await staffFetch('/api/ioe-violympic/papers/bank-math-english-2-district');assert(mathEnglishPaper.total===30&&mathEnglishPaper.ready,'English Math is ready directly from bank');
 await cdp.send('Page.navigate',{url:origin+'/ioe-violympic/paper/'+mathEnglishPaper.id});await click('Chuẩn bị bài','#ioe-violympic-student');await click('Bắt đầu','#ioe-violympic-student');await wait("document.querySelector('.competition-player-header')");
 assert(await evaluate("document.activeElement.matches('.competition-answer input')"),'Text answer starts focused');await enter();assert(await currentNumber()===1,'Empty text Enter does not advance');
 await field('Câu trả lời của em','   ','#ioe-violympic-student');await enter();assert(await currentNumber()===1,'Whitespace text Enter does not advance');await answerCurrent();
 for(const init of [{isComposing:true},{keyCode:229}]){await evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true,...${JSON.stringify(init)}}))`);assert(await currentNumber()===1,'Text composition Enter does not advance');}
 for(const modifiers of [1,2,4,8]){await enter({modifiers});assert(await currentNumber()===1,'Modified text Enter keeps current question');}
 await enter({autoRepeat:true});assert(await currentNumber()===1,'Held text Enter does not advance');await enter();assert(await currentNumber()===2,'Filled text Enter advances exactly once');
 assert(await evaluate("document.activeElement.matches('.competition-answer input')"),'Next text input is focused');await enter({autoRepeat:true});assert(await currentNumber()===2,'Held Enter cannot skip a new blank input');
 await answerCurrent();await enter();assert(await currentNumber()===3,'Consecutive text answers advance');
 await waitForAutosave();await cdp.send('Page.reload');await wait("document.querySelector('.competition-answer input')?.value");
 assert(await evaluate("document.querySelector('.competition-answer input').value===document.querySelector('.competition-prompt').textContent.match(/(\\d+)\\+1/)[1]*1+1+''"),'Text entered before Enter survives save/reload');
 for(let i=0;i<30;i++){await answerCurrent();await enter();assert(await currentNumber()===Math.min(i+2,30),'Text Enter navigation remains bounded through the final question');}
 assert(await evaluate("!!document.querySelector('.competition-player-header')&&!document.querySelector('.competition-score')"),'Last text Enter keeps the active attempt');
 for(const width of [1440,390,320]){await viewport(width);reports['enterText'+width]=await metrics('#ioe-violympic-student');screenshots['enterText'+width]=await shot('enter-text-'+width);}
 reports.enterText={emptyGuard:true,whitespaceGuard:true,next:true,focus:true,repeatGuard:true,imeGuard:true,modifierGuard:true,saveReload:true,lastDoesNotSubmit:true};
 await evaluate("window.qaSubmitFetch=window.fetch;window.qaSubmitCalls=0;window.fetch=async(input,init)=>{if(String(input).endsWith('/submit')){window.qaSubmitCalls++;await new Promise(resolve=>setTimeout(resolve,500));}return window.qaSubmitFetch(input,init)}");
 await click('Nộp bài','#ioe-violympic-student');await evaluate("document.querySelector('.competition-answer input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))");assert(await currentNumber()===30,'Enter while submitting keeps the question');
 await wait("document.querySelectorAll('.competition-review-row').length===30");assert(await evaluate("window.qaSubmitCalls===1"),'Keyboard does not double-submit');await evaluate("window.fetch=window.qaSubmitFetch");
 assert(await evaluate("document.querySelector('.competition-score').textContent.includes('300/300')"),'English Math full flow scores 300/300');reports.mathEnglish={questions:30,score:300};
 await cdp.send('Page.navigate',{url:origin+'/admin'});await wait("document.querySelector('#tab-ioe-violympic')");await evaluate("document.querySelector('#tab-ioe-violympic').click()");await wait("document.querySelector('[data-overview-stat=\"completed\"]')?.textContent!=='—'&&document.querySelector('[data-competition-overview]')&&!document.querySelector('[data-competition-overview] button:disabled')");
 const overview=await staffFetch('/api/ioe-violympic/admin/overview');
 assert(await evaluate(`Number(document.querySelector('[data-overview-stat="completed"]').textContent.replaceAll('.',''))===${overview.totals.completed}`),'Overview displays real completed count');
 assert(await evaluate("document.querySelector('[data-inventory-cell=\"math-english:2:district\"]').textContent.trim()==='30'"),'Overview school/district/province/national counts are real');
 await viewport(1440);reports.overviewDesktop=await metrics('#ioe-violympic-admin');screenshots.overviewDesktop=await shot('overview-desktop','#ioe-violympic-admin');await viewport(390);reports.overviewMobile=await metrics('#ioe-violympic-admin');screenshots.overviewMobile=await shot('overview-mobile','#ioe-violympic-admin');
 await evaluate("document.querySelector('[data-inventory-subject=\"english\"]').scrollIntoView({block:'start'})");await delay(200);screenshots.overviewFirstTableMobile=await shot('overview-first-table-mobile');
 await evaluate("document.querySelector('[data-inventory-subject=\"math-english\"]').scrollIntoView({block:'start'})");await delay(200);screenshots.overviewMathEnglishMobile=await shot('overview-math-english-mobile');
 assert(await evaluate("document.querySelectorAll('.competition-inventory-table :is(button,a,input,select,[tabindex])').length===0"),'Overview tables are read-only');
 assert(await evaluate("[...document.querySelectorAll('[data-inventory-cell]')].every(cell=>cell.textContent.trim()==='—'||/^[0-9.]+$/.test(cell.textContent.trim()))"),'Inventory cells show a dash or only a count');
 await click('Kết quả');await wait("document.querySelector('[data-results-total]')");
 assert(await evaluate("[...document.querySelectorAll('[data-competition-results] select')].every(s=>s.value==='')"),'Result filters start empty independently of authoring scope');
 const allResults=await staffFetch('/api/ioe-violympic/admin/results-page');assert(await evaluate(`document.querySelector('[data-results-total]').textContent.startsWith('${allResults.total} bài')`),'All completed results shown with pagination');
 await field('Môn','math-english','[data-competition-results]');await field('Lớp','2','[data-competition-results]');await field('Cấp','district','[data-competition-results]');assert(await evaluate(`document.querySelector('[data-results-total]').textContent.startsWith('${allResults.total} bài')`),'Changing a filter alone does not apply it');
 await click('Lọc kết quả');await wait("!document.querySelector('[data-competition-results] button:disabled.competition-primary')");
 const filteredResults=await staffFetch('/api/ioe-violympic/admin/results-page?subject=math-english&grade=2&level=district');assert(await evaluate(`document.querySelector('[data-results-total]').textContent.startsWith('${filteredResults.total} bài')`),'Explicit result filters reach the server');
 assert(await evaluate("[...document.querySelectorAll('[data-result-id]')].every(r=>r.textContent.includes('Toán Tiếng Anh')&&r.textContent.includes('Lớp 2')&&r.textContent.includes('Xã/Phường'))"),'Filtered rows retain subject/grade/level');
 await viewport(1440);reports.resultsDesktop=await metrics('#ioe-violympic-admin');screenshots.resultsDesktop=await shot('results-desktop','#ioe-violympic-admin');await viewport(390);reports.resultsMobile=await metrics('#ioe-violympic-admin');screenshots.resultsMobile=await shot('results-mobile','#ioe-violympic-admin');
 const resultLayout=await evaluate("(()=>{const table=document.querySelector('.competition-results-table');return {width:table.getBoundingClientRect().width,titleWidth:table.querySelector('tbody td:nth-child(2)').getBoundingClientRect().width,maxRowHeight:Math.max(...[...table.querySelectorAll('tbody tr')].map(row=>row.getBoundingClientRect().height))};})()");assert(resultLayout.width>=960&&resultLayout.titleWidth>=210&&resultLayout.maxRowHeight<180,'Result columns must remain readable on mobile');reports.resultLayout=resultLayout;
 await field('Lớp','9','[data-competition-results]');await click('Lọc kết quả');await wait("document.querySelector('[data-competition-results]').textContent.includes('Không có bài hoàn thành phù hợp bộ lọc')");reports.resultsEmpty=await metrics('#ioe-violympic-admin');
 await click('Xóa bộ lọc');await wait(`document.querySelector('[data-results-total]')?.textContent.startsWith('${allResults.total} bài')`);assert(await evaluate("[...document.querySelectorAll('[data-competition-results] select')].every(s=>s.value==='')"),'Reset restores all results');
 // A 200-question IOE run exercises bounded navigation and the ported ordering/matching games.
 const englishScope={subject:'english',grade:3,level:'practice'};
 const englishBank=await staffFetch('/api/ioe-violympic/admin/questions?subject=english&grade=3&level=practice');assert(englishBank.items.every(q=>q.prompt.startsWith('QA ')),'IOE bank contains non-QA data');
 for(let page=0;page<20;page++){const bank=await staffFetch('/api/ioe-violympic/admin/questions?subject=english&grade=3&level=practice');if(!bank.items.length)break;await staffFetch('/api/ioe-violympic/admin/questions/archive','POST',{ids:bank.items.map(q=>q.id)});}
 const gameRows=Array.from({length:200},(_,i)=>({prompt:'QA IOE '+runName+' '+i,options:['yes','no'],answer:'A',domain:'vocabulary',difficulty:1}));
 gameRows[0]={prompt:'QA Ordering '+runName,options:['red','green','blue'],answerSpec:{kind:'ordering',orderedTokenIds:['A','B','C']},domain:'vocabulary',difficulty:1};
 gameRows[1]={prompt:'QA Matching '+runName,pairs:{left:['one','two'],right:['1','2']},answerSpec:{kind:'matching',correctPairMatches:{A:'A',B:'B'}},domain:'vocabulary',difficulty:1};
 for(let i=0;i<200;i+=50)await staffFetch('/api/ioe-violympic/admin/questions','POST',{...englishScope,requestId:runName.replaceAll(' ','-')+'-'+i,questions:gameRows.slice(i,i+50)});
 await click('Ngân hàng');await field('Môn','english');await field('Lớp','3');await field('Cấp','practice');
 for(const [interaction,search] of [['ordering','QA Ordering '+runName],['matching','QA Matching '+runName]]){await field('Tìm nội dung / tiêu đề',search);await wait(`document.querySelectorAll('#ioe-violympic-admin tbody tr').length===1&&document.querySelector('.competition-bank-prompt p')?.textContent===${JSON.stringify(search)}`);await exercisePreview('bankPreview-'+interaction,'#ioe-violympic-admin tbody');}
 const ioePaper=await staffFetch('/api/ioe-violympic/papers/bank-english-3-practice');assert(ioePaper.total===200&&ioePaper.ready,'Flexible IOE bank preserves 200 questions without fixed publication');
 await cdp.send('Page.navigate',{url:origin+'/ioe-violympic/paper/'+ioePaper.id});await click('Chuẩn bị bài','#ioe-violympic-student');await click('Bắt đầu','#ioe-violympic-student');await wait("document.querySelectorAll('.competition-question-nav button').length===200");
 const large=await evaluate("(()=>{const nav=document.querySelector('.competition-question-nav'),h=document.querySelector('.competition-player-header');return {navHeight:nav.getBoundingClientRect().height,headerHeight:h.getBoundingClientRect().height,windowHeight:innerHeight};})()");assert(large.navHeight<=160&&large.headerHeight<large.windowHeight/2,'Large IOE navigation must leave the question visible');reports.ioe200=large;
 const ioeRun=await evaluate("JSON.parse(Object.entries(sessionStorage).find(([k,v])=>k.includes('"+ioePaper.id+"')&&!k.endsWith(':answers-backup'))[1])");
 const ioeSession=await evaluate(`(async()=>{const r=await fetch('/api/ioe-violympic/attempts/${ioeRun.id}',{headers:{Authorization:'Bearer local-test-auth-bypass','X-Attempt-Ticket':${JSON.stringify(ioeRun.ticket)}}});return r.json();})()`);
 for(const interaction of ['ordering','matching']){const number=ioeSession.questions.findIndex(q=>q.interaction===interaction)+1;await evaluate(`document.querySelectorAll('.competition-question-nav button')[${number-1}].click()`);await delay(150);
 if(interaction==='ordering'){for(const text of ['red','green','blue'])await click(text,'.competition-question');}
 else {await evaluate("(()=>{for(const label of document.querySelectorAll('.competition-matches label')){const text=label.querySelector('span').textContent.trim(),select=label.querySelector('select');const expected=text==='one'?'1':'2',option=[...select.options].find(o=>o.textContent.endsWith('. '+expected));Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,option.value);select.dispatchEvent(new Event('change',{bubbles:true}));}})()");await delay(150);}}
 await waitForAutosave();screenshots.ioe200Mobile=await shot('ioe-200-mobile');
 await click('Nộp bài','#ioe-violympic-student');await wait("document.querySelectorAll('.competition-review-row').length===200");assert(await evaluate("[...document.querySelectorAll('.competition-review-row.is-correct')].filter(r=>r.textContent.includes('QA Ordering')||r.textContent.includes('QA Matching')).length===2"),'Both games are graded correctly');
 // Complete the actual student portal -> bank -> wrong queue -> practice ->
 // mastery -> History path. Nothing is written to the user's live database.
 await cdp.send('Page.navigate',{url:origin+'/ioe-violympic'});await click('Thi thử','#ioe-violympic-student');await wait("document.querySelector('[data-bank-directory]')");
 await field('Môn','math','[data-bank-directory]');await field('Lớp','3','[data-bank-directory]');await field('Cấp','school','[data-bank-directory]');
 await click('Thi thử ngay','[data-bank-directory]');await wait("document.querySelectorAll('.competition-question-nav button').length===30");
 assert(await evaluate("!document.body.innerText.includes('Chuẩn bị bài')&&!document.body.innerText.includes('Đã chuẩn bị')&&location.search.includes('start=now')"),'One click activates a random bank exam');
 const directRun=await evaluate("new URLSearchParams(location.search).get('run')");
 await goToQuestion(1);await answerCurrent();const mouseNumber=await currentNumber();
 await evaluate("window.qaAnswerFetch=window.fetch;window.fetch=async(...args)=>String(args[0]).endsWith('/answers')&&args[1]?.method==='PUT'?new Response(JSON.stringify({error:'Lỗi lưu kiểm thử'}),{status:503,headers:{'Content-Type':'application/json'}}):window.qaAnswerFetch(...args)");
 await click('Trả Lời','#ioe-violympic-student');await wait("document.querySelector('#ioe-violympic-student [role=alert]')?.textContent.includes('Lỗi lưu kiểm thử')");
 assert(await currentNumber()===mouseNumber,'A failed save keeps the answer on its question');await evaluate("window.fetch=window.qaAnswerFetch");
 await evaluate("(()=>{const b=[...document.querySelectorAll('#ioe-violympic-student button')].find(b=>b.textContent==='Trả Lời');b.click();b.click();})()");await wait(`document.querySelector('.competition-question')?.getAttribute('aria-label')==='Câu ${mouseNumber+1}'`);
 assert(await currentNumber()===mouseNumber+1,'Double mouse answer advances exactly once');
 const activeRun=await evaluate("JSON.parse(Object.entries(sessionStorage).find(([k])=>k.startsWith('ioe-violympic:bank-math-3-school:')&&!k.endsWith(':answers-backup'))[1]).id");
 await cdp.send('Page.reload');await wait("document.querySelector('.competition-question-nav')");assert(await evaluate("JSON.parse(Object.entries(sessionStorage).find(([k])=>k.startsWith('ioe-violympic:bank-math-3-school:')&&!k.endsWith(':answers-backup'))[1]).id")===activeRun,'Reload resumes the same direct-start attempt');
 await cdp.send('Page.navigate',{url:origin+'/ioe-violympic'});await click('Thi thử','#ioe-violympic-student');await wait("document.querySelector('[data-bank-directory]')");
 await field('Môn','math','[data-bank-directory]');await field('Lớp','3','[data-bank-directory]');await field('Cấp','school','[data-bank-directory]');await click('Thi thử ngay','[data-bank-directory]');await wait("document.querySelectorAll('.competition-question-nav button').length===30");
 assert(await evaluate("new URLSearchParams(location.search).get('run')")!==directRun,'Each click requests a fresh random exam');assert(await evaluate("JSON.parse(Object.entries(sessionStorage).find(([k])=>k.startsWith('ioe-violympic:bank-math-3-school:')&&!k.endsWith(':answers-backup'))[1]).id")!==activeRun,'A new launch does not resume the previous attempt');
 reports.directMock={immediate:true,newLaunch:true,reloadResumes:true,mouse:true,doubleClickGuard:true,failedSaveRetains:true};
 const wrongSnapshot=await evaluate(`(async()=>{const saved=JSON.parse(Object.entries(sessionStorage).find(([k])=>k.startsWith('ioe-violympic:bank-math-3-school:')&&!k.endsWith(':answers-backup'))[1]);return (await fetch('/api/ioe-violympic/attempts/'+saved.id,{headers:{Authorization:'Bearer local-test-auth-bypass','X-Attempt-Ticket':saved.ticket}})).json()})()`);
 const wrongChoice=wrongSnapshot.questions.findIndex(q=>q.media.some(m=>m.kind==='image'))+1,wrongText=wrongSnapshot.questions.findIndex(q=>q.interaction==='text-entry')+1;
 assert(wrongChoice>0&&wrongText>0,'Wrong fixture includes media and text');await goToQuestion(wrongChoice);
 await evaluate(`(()=>{const q=document.querySelector('.competition-question'),correct=Number(q.querySelector('.competition-prompt').textContent.match(/(\\d+)\\+1/)[1])+1;[...q.querySelectorAll('.competition-option')].find(b=>b.querySelector('span').textContent.trim().replace(/^[A-Z]\\.\\s*/,'')!==String(correct)).click();})()`);
 await goToQuestion(wrongText);await field('Câu trả lời của em','99999','#ioe-violympic-student');await click('Nộp bài','#ioe-violympic-student');await wait("document.querySelectorAll('.competition-review-row').length===30");
 assert(await evaluate("document.querySelectorAll('.competition-review-row.is-incorrect').length===2&&document.querySelectorAll('.competition-review-row.is-unanswered').length===28"),'Server separates wrong answers from unanswered questions');
 await click('Về khu IOE/Violympic','#ioe-violympic-student');await click('Luyện tập','#ioe-violympic-student');await wait("document.querySelector('[data-mistake-topic=\"mistakes-math-3-school\"]')");
 assert(await evaluate("document.querySelector('[data-pending-count]').textContent.trim()==='2 câu cần luyện lại'&&[...document.querySelectorAll('[data-mistake-directory] select')].every(s=>s.value==='')"),'Private practice defaults to all filters and only two wrong questions');
 for(const width of [1440,390,320]){await viewport(width);reports['practice'+width]=await metrics('#ioe-violympic-student');screenshots['practice'+width]=await shot('wrong-practice-'+width);}
 await click('Luyện 2 câu','[data-mistake-topic="mistakes-math-3-school"]');await click('Chuẩn bị bài','#ioe-violympic-student');await click('Bắt đầu','#ioe-violympic-student');await wait("document.querySelectorAll('.competition-question-nav button').length===2");
 await answerCurrent();await click('Câu tiếp','#ioe-violympic-student');await answerCurrent();await click('Nộp bài','#ioe-violympic-student');await wait("document.querySelectorAll('.competition-review-row').length===2");
 assert(await evaluate("document.querySelectorAll('.competition-review-row.is-incorrect').length===0&&!!document.querySelector('.competition-review img')&&document.querySelector('.competition-score').textContent.includes('20/20')"),'Wrong practice grades original snapshots and retains media');
 await click('Lịch sử học tập','#ioe-violympic-student');await wait("document.body.innerText.includes('Luyện câu sai')");screenshots.practiceHistory=await shot('wrong-practice-history');
 await cdp.send('Page.navigate',{url:origin+'/ioe-violympic'});await click('Luyện tập','#ioe-violympic-student');await wait("document.querySelector('[data-pending-count]')?.textContent.trim()==='0 câu cần luyện lại'");
 assert(await evaluate("!document.querySelector('[data-mistake-topic]')&&document.querySelector('[data-mistake-directory]').textContent.includes('Em chưa có câu sai')"),'Mastered questions leave the pending queue, with no random substitute');reports.practiceFlow={private:true,wrong:2,unanswered:28,practiced:2,remaining:0,media:true,history:true};screenshots.practiceEmpty=await shot('wrong-practice-empty');
 // Verify equivalent computed CSS for all controls covered by reset consolidation.
 const fs=await import('node:fs');
 const globals=['tokens-base','shared-components','home','admin','student'].map(f=>fs.readFileSync(`src/styles/${f}.css`,'utf8')).join('\n');
 const oldCss=fs.readFileSync('.data/ioe-verification/exam-listening-before.css','utf8'),newCss=fs.readFileSync('src/styles/exam-listening.css','utf8');
 const buttons=['pet-writing-task-option','exam-platform-result-review','exam-platform-result-home','exam-platform-result-retry','exam-platform-grade-retry','ket-part-three-tab','ket-part-three-page-nav','ket-reading-result-home','ket-reading-result-review','ket-reading-result-retry'].flatMap(cls=>[false,true].flatMap(disabled=>['false','true'].flatMap(selected=>['previous','next'].map(direction=>`<button class="${cls}" data-selected="${selected}" data-active="${selected}" data-direction="${direction}" ${disabled?'disabled':''}>Text <span>child</span></button>`)))).join('');
 const dom=['generic-exam-player','pet-writing-result','ket-reading-writing-player','ket-reading-writing-review-screen','ket-reading-writing-result-screen','ket-reading-writing-authoring'].map(id=>`<section id="${id}">${buttons}<input type="text" value="Text"><textarea>Text</textarea><select><option>Text</option></select></section>`).join('');
 const comparison=await evaluate(`(()=>{const compare=(css)=>{const frame=document.createElement('iframe');frame.style.cssText='width:600px;height:900px;position:absolute;left:-10000px';document.body.append(frame);frame.contentDocument.write('<style>'+${JSON.stringify(globals)}+'\\n'+css+'</style>'+${JSON.stringify(dom)});frame.contentDocument.close();const rows=[...frame.contentDocument.querySelectorAll('button,input,select,textarea,button span')].map(el=>{const s=frame.contentWindow.getComputedStyle(el);return [...s].map(k=>[k,s.getPropertyValue(k)]);});frame.remove();return rows;};const old=compare(${JSON.stringify(oldCss)}),current=compare(${JSON.stringify(newCss)});return {controls:old.length,equal:JSON.stringify(old)===JSON.stringify(current),differences:old.flatMap((row,i)=>row.filter(([k,v],j)=>v!==current[i][j][1]).map(([k,v],j)=>({i,k,before:v,after:current[i].find(x=>x[0]===k)[1]}))).slice(0,20)};})()`);
 assert(comparison.equal,`CSS consolidation changed computed styles: ${JSON.stringify(comparison.differences)}`);reports.cssEquivalence=comparison;
 for(const [name,r] of Object.entries(reports)){if(!r.controls||!Array.isArray(r.controls))continue;assert(!r.overflow,`${name} page overflow`);for(const c of r.controls)assert(c.contrast>=4.5,`${name}: low contrast ${JSON.stringify(c)}`);}
 assert(browserErrors.length===0,`Browser exceptions: ${JSON.stringify(browserErrors)}`);
 const report={passed:true,origin,reports,screenshots,browserErrors};writeFileSync(path.join(qaRoot,'report.json'),JSON.stringify(report,null,2));writeFileSync('.data/ioe-verification/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,report:path.join(qaRoot,'report.json'),screenshots,states:Object.keys(reports),cssEquivalence:comparison},null,2));cdp.close();
}
try { await main(); } catch(error) { console.error(error);process.exitCode=1; } finally { chrome.kill('SIGTERM'); }
