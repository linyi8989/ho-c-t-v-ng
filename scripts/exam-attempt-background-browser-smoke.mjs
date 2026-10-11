import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { build } from 'esbuild';

// Mount the actual student players with local fixture APIs; no user database,
// published lesson, external provider or real submission is modified.
const evidence = path.resolve('.data/exam-background-all-qa');
fs.mkdirSync(evidence, { recursive: true });
const create = spawnSync(process.execPath, ['--import','tsx','scripts/exam-attempt-background-fixture.mjs'], {encoding:'utf8',windowsHide:true});
assert.equal(create.status,0,create.stderr);
const cases=JSON.parse(fs.readFileSync(path.join(evidence,'fixture.json'),'utf8'));
const work=fs.mkdtempSync(path.join(os.tmpdir(),'exam-background-qa-'));
await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:
"import React from 'react';import{createRoot}from'react-dom/client';"+
"import GenericExamLearningArea from './src/features/exam-platform/student/GenericExamLearningArea';"+
"import ListeningLearningArea from './src/features/listening/student/ListeningLearningArea';"+
"import MoverReadingWritingLearningArea from './src/features/mover-reading-writing/student/MoverReadingWritingLearningArea';"+
"const cases="+JSON.stringify(cases)+";const k=new URLSearchParams(location.search).get('case')||'mover-reading-writing';const item=cases[k];"+
"createRoot(document.getElementById('fixture')).render(item.kind==='listening'?<ListeningLearningArea setId={item.playable.id} onBack={()=>window.qaBack=true}/>:item.kind==='reading'?<MoverReadingWritingLearningArea setId={item.playable.id} onBack={()=>window.qaBack=true}/>:<GenericExamLearningArea moduleId={item.moduleId} paperId={item.paperId} setId={item.playable.id} onBack={()=>window.qaBack=true}/>);"
},outfile:path.join(work,'fixture.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',external:['/assets/*'],define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},plugins:[{name:'fixture-auth',setup(b){b.onResolve({filter:/context\/AuthContext/},()=>({path:'auth',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:"const value={user:{id:'qa-student',name:'QA Student',role:'student'},token:'qa-token',firebaseUser:null,authSessionKnown:true,loading:false};export function useAuth(){return value;}",loader:'js'}));}}],logLevel:'silent'});
const globalCss=fs.readFileSync('dist/client/index.html','utf8').match(/href="(\/assets\/[^" ]+\.css)"/)?.[1];assert(globalCss);
const requests=[],errors=[];
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://fixture'),p=url.pathname;
 const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 if(p.startsWith('/api/')){
  requests.push({method:req.method,path:p});
  const item=Object.values(cases).find(c=>p.includes('/sets/'+c.playable.id));
  if(!item)return json({error:'Unexpected fixture API'},404);
  if(req.method==='GET') {const value=structuredClone(item.playable);if(new URL(req.headers.referer||'http://fixture').searchParams.has('custom'))value.content.backgroundUrl='/assets/backgrounds/bg-exams-three-yards-v1.webp';return json(value);}
  if(p.endsWith('/prepare')||p.endsWith('/activate'))return json({ticket:Buffer.from(JSON.stringify({ownerKey:'user:qa-student'})).toString('base64url')+'.qa-signature',startedAt:new Date().toISOString(),versionId:item.playable.versionId});
  // Exercise error banner without writing attempts or calling external graders.
  return json({error:'QA submit offline: answers retained'},503);
 }
 if(p==='/'||p.startsWith('/exams/')){res.setHeader('Content-Type','text/html');return res.end('<html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="'+globalCss+'"><link rel="stylesheet" href="/fixture.css"></head><body style="margin:0"><div id="app-root"><div id="fixture"></div></div><script type="module" src="/fixture.js"></script></body></html>');}
 let file;if(p==='/fixture.js'||p==='/fixture.css')file=path.join(work,p);else if(p.startsWith('/assets/')&&!p.includes('..')){file=path.join('public',p);if(!fs.existsSync(file))file=path.join('dist/client',p);}else {res.writeHead(404);return res.end();}
 if(!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':'font/ttf');
 let data=fs.readFileSync(file);if(file===path.join('dist/client',globalCss))data=Buffer.from(data.toString().replace(/@import\s*url\([^)]*\)\s*;/g,''));res.end(data);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const debugPort=10000+Math.floor(Math.random()*20000);
const chrome=spawn(process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-sandbox','--no-first-run','--remote-debugging-port='+debugPort,'--user-data-dir='+path.join(work,'profile'),'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let chromeError='';chrome.stderr.on('data',b=>chromeError+=String(b));
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
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
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


let cdp;
const report={cases:[],screenshots:[],requests,errors};
try {
 const tab=(await waitForDebugger()).find(t=>t.type==='page');cdp=createCdpClient(tab.webSocketDebuggerUrl);await cdp.ready;await cdp.send('Page.enable');await cdp.send('Runtime.enable');
 const evaluate=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails){errors.push(r.exceptionDetails);throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);}return r.result.value;};
 const wait=async expression=>{for(let i=0;i<160;i++){if(await evaluate('Boolean('+expression+')'))return;await delay(70);}throw Error('Timeout '+expression+' '+await evaluate('document.body.innerText.slice(-800)'));};
 const viewport=async(w,h=960)=>{await cdp.send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<600});await evaluate('scrollTo(0,0)');await delay(100);};
 const shot=async name=>{const r=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const dir=path.join(evidence,'screenshots');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,name+'.png');fs.writeFileSync(file,Buffer.from(r.data,'base64'));report.screenshots.push(file);};
 const scenery=()=>evaluate("(()=>{const e=document.querySelector('.student-exam-shell')||document.querySelector('[data-student-journey]');const s=getComputedStyle(e,'::before');return {image:s.backgroundImage,position:s.position,pointer:s.pointerEvents,size:s.backgroundSize,width:parseFloat(s.width),height:parseFloat(s.height),viewportWidth:document.documentElement.clientWidth,viewportHeight:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1};})()");
 const controls=()=>evaluate("(()=>{const lum=s=>s.match(/[0-9.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);return [...document.querySelectorAll('.student-exam-part-tab,.student-exam-part-nav,.student-exam-submit-action')].map(e=>{const s=getComputedStyle(e),fg=lum(s.color),colors=s.backgroundImage.match(/rgb\\([^)]+\\)/g)||[s.backgroundColor];return {label:e.textContent.trim(),disabled:e.disabled,ratio:Math.min(...colors.map(c=>{const bg=lum(c);return (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);})),height:e.getBoundingClientRect().height};});})()");
 for(const [key,item]of Object.entries(cases)){
  await viewport(1440);await cdp.send('Page.navigate',{url:origin+'/?case='+key});await wait('document.querySelector("[data-student-journey]")&&[...document.querySelectorAll("button")].some(e=>/^Bắt đầu/.test(e.textContent.trim()))');
  const start=await scenery();assert(start.image.includes('bg-starter-exam-v1.webp'),key+' start scenery');
  await evaluate('[...document.querySelectorAll("button")].find(e=>/^Bắt đầu/.test(e.textContent.trim())).click()');await wait('document.querySelector(".student-exam-shell")');
  const enabled=key!=='standalone-writing';const observations=[];
  for(const width of [1440,1024,390,320]){
   await viewport(width,width<600?844:960);const state=await scenery();if(enabled){assert(state.image.includes('bg-starter-exam-v1.webp'),key+' has illustration');assert(state.position==='fixed'&&state.pointer==='none'&&state.size==='cover',key+' fixed layer');assert(state.width===state.viewportWidth&&state.height===state.viewportHeight,key+' full viewport '+JSON.stringify(state));}else assert(!state.image.includes('bg-starter-exam-v1.webp'),'Standalone scope unchanged');
   assert(!state.overflow,key+' no horizontal overflow at '+width);
   const buttons=await controls();assert(buttons.every(b=>b.ratio>=4.5),key+' contrast '+JSON.stringify(buttons));assert(buttons.every(b=>b.height>=40),key+' touch dimensions');observations.push({width,...state,minimumContrast:Math.min(...buttons.map(b=>b.ratio))});
   if(['mover-reading-writing','flyer-reading-writing','pet-reading','ielts-academic-reading'].includes(key)&&[1440,390].includes(width))await shot(key+'-'+width);
  }
  await viewport(1440);
  const tabs=await evaluate('document.querySelectorAll(".student-exam-part-tab").length');if(tabs>1){await evaluate('document.querySelector("[data-direction=next]").click()');await wait('document.querySelectorAll(".student-exam-part-tab")[1].getAttribute("aria-selected")==="true"');await evaluate('document.querySelector("[data-direction=previous]").click()');await wait('document.querySelectorAll(".student-exam-part-tab")[0].getAttribute("aria-selected")==="true"');}
  await evaluate('document.querySelector(".student-exam-part-tab").focus()');assert(await evaluate('document.activeElement.classList.contains("student-exam-part-tab")'),key+' keyboard focus');
  const before=await scenery();await evaluate('scrollTo(0,document.documentElement.scrollHeight)');await delay(70);const after=await scenery();assert(after.image===before.image&&after.position===before.position,key+' background stays on long page');
  report.cases.push({key,start:true,navigation:true,focus:true,longPage:true,observations});console.log(key+' PASS');
 }
 await viewport(1440);await cdp.send('Page.navigate',{url:origin+'/?case=mover-listening&custom=1'});await wait('document.querySelector(".student-exam-shell")');
 const custom=await scenery();assert(custom.image.includes('bg-exams-three-yards-v1.webp')&&custom.image.includes('linear-gradient'),'Teacher background and overlay retained');await shot('mover-custom-background');report.customBackground=true;
 await viewport(1440);await cdp.send('Page.navigate',{url:origin+'/?case=mover-reading-writing'});await wait('document.querySelector(".student-exam-shell")');
 await evaluate('window.confirm=()=>true;document.querySelector(".student-exam-submit-action").click()');await wait('document.body.innerText.includes("QA submit offline")');assert(await evaluate('!!document.querySelector(".student-exam-shell")'),'Submission error preserves player');await shot('mover-error-banner');
 // Verify the fixed decoration does not consume clicks on answer controls.
 await evaluate('(()=>{const e=document.querySelector(".student-exam-shell input:not([type=checkbox])");if(e){window.qaAnswer=true;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"bookcase");e.dispatchEvent(new Event("input",{bubbles:true}));e.focus();}else window.qaAnswer=false;})()');
 assert(await evaluate('window.qaAnswer&&document.activeElement instanceof HTMLInputElement'),'Answer input usable over illustration');
 await wait('document.querySelector(".student-exam-shell-progress").textContent.startsWith("1/")');report.inputAndSubmitError=true;
 assert.equal(errors.length,0);report.passed=true;fs.writeFileSync(path.join(evidence,'browser-report.json'),JSON.stringify(report,null,2));console.log('PASS '+report.cases.length+' actual players / '+report.cases.length*4+' viewport states.');
} catch(e){console.error(e);if(cdp){const r=await cdp.send('Page.captureScreenshot',{format:'png'}).catch(()=>null);if(r)fs.writeFileSync(path.join(evidence,'failure.png'),Buffer.from(r.data,'base64'));}throw e;}
finally {cdp?.close();chrome.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}
