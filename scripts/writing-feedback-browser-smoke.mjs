import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
import { createDefaultExamContent, getExamPaperDefinition } from '../src/features/exam-platform/definitions.ts';

// Actual result UIs with isolated GET-only APIs and a separate Chrome profile.
const evidence=path.resolve('.data/writing-feedback-qa');fs.mkdirSync(evidence,{recursive:true});
const work=fs.mkdtempSync(path.join(os.tmpdir(),'writing-feedback-browser-'));
const original='My best friend is Ngan. She 11 years old. She is friendly and kindness. We play footdball together.';
const revision='My best friend is Ngan. She is 11 years old. She is friendly and kind. We play football together. I like Ngan because she is a good friend.';
const grammar={original:'She 11 years old.',corrected:'She is 11 years old.',explanation:'Thêm động từ “is” khi nói về tuổi.'};
const vocabulary=[{original:'kindness',corrected:'kind',explanation:'Dùng tính từ để miêu tả tính cách.'},{original:'footdball',corrected:'football',explanation:'Sửa lỗi chính tả của từ “football”.'}];
const base={questionId:'qa-writing',part:1,number:1,type:'long-writing',prompt:'Write about your best friend.',userAnswer:original,correct:null,unanswered:false,pointsAwarded:6,maxPoints:10,pendingManualReview:false,aiGradingStatus:'completed',writingScore:6,sentenceCount:4,aiFeedback:'Bài viết có ý rõ ràng. Em cần chú ý động từ và lựa chọn từ vựng.',grammarCorrections:[grammar],vocabularyCorrections:vocabulary,grammarErrors:[grammar.explanation],vocabularyErrors:vocabulary.map(v=>v.explanation),revisedEssay:revision};
const legacy={...base};delete legacy.grammarCorrections;delete legacy.vocabularyCorrections;delete legacy.revisedEssay;
legacy.grammarErrors=['Câu “She 11 years old.” cần thêm động từ: “She is 11 years old.”'];
const unsafe='<img src=x onerror="window.qaInjected=true">';
const cases={structured:base,legacy,clean:{...base,userAnswer:'My best friend is Ngan. She is kind.',grammarCorrections:[],vocabularyCorrections:[],grammarErrors:[],vocabularyErrors:[],revisedEssay:'My best friend is Ngan. She is kind.'},blank:{...base,userAnswer:'',unanswered:true,pointsAwarded:0,writingScore:0,sentenceCount:0,grammarCorrections:[],vocabularyCorrections:[],grammarErrors:[],vocabularyErrors:[],revisedEssay:''},long:{...base,grammarCorrections:Array.from({length:20},()=>grammar),vocabularyCorrections:Array.from({length:20},()=>vocabulary[0]),revisedEssay:Array.from({length:30},()=>revision).join('\n\n')},unsafe:{...base,userAnswer:unsafe,grammarCorrections:[{original:unsafe,corrected:'A plain text example.',explanation:'Nội dung được hiển thị dưới dạng văn bản.'}],vocabularyCorrections:[],revisedEssay:'<script>window.qaInjected=true</script>\nA plain text example.'},pending:{...base,pendingManualReview:true,aiGradingStatus:'processing'}};
const content=createDefaultExamContent(getExamPaperDefinition('writing','writing'));content.parts[0].questions[0].id='qa-writing';content.level='Lớp 6';content.title='My best friend';content.showReviewAfterSubmit=true;
const set={id:'qa-writing-set',title:content.title,description:'A2–B1 Writing',moduleId:'writing',paperId:'writing',level:'Lớp 6',topic:'Friends',status:'published',visibility:'public',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),versionId:'qa-version',versionNumber:1,content};
const fixture="import React from 'react';import{createRoot}from'react-dom/client';"+
"import GenericExamAdmin from './src/features/exam-platform/admin/GenericExamAdmin';"+
"import{StandaloneWritingResult}from './src/features/writing-library/student/StandaloneWritingViews';"+
"const cases="+JSON.stringify(cases)+";const playable="+JSON.stringify(set)+";"+
"const params=new URLSearchParams(location.search),key=params.get('case')||'structured',role=params.get('role')||'student',q=cases[key];"+
"const pending=key==='pending';const attempt={id:'qa-attempt',setId:playable.id,versionId:playable.versionId,status:pending?'pending_review':'completed',score:q.writingScore*10,objectiveScore:0,correctCount:0,incorrectCount:0,unansweredCount:0,totalCount:1,pendingManualCount:pending?1:0,aiGradingStatus:pending?'processing':'completed',writingScore:q.writingScore,writingWordCount:21,durationSeconds:120,completedAt:new Date().toISOString()};"+
"createRoot(document.getElementById('fixture')).render(role==='teacher'?<GenericExamAdmin moduleId=\"writing\" paperId=\"writing\" token=\"qa-token\"/>:<StandaloneWritingResult result={attempt} review={pending?null:{attempt,questions:[q]}} playable={playable} answers={{'qa-writing':q.userAnswer}} reviewLoading={false} gradeRetrying={false} error=\"\" onReview={()=>window.qaReview=true} onRetryGrade={()=>window.qaGrade=true} onRetry={()=>window.qaRetry=true} onBack={()=>window.qaBack=true}/>);";
await build({stdin:{resolveDir:process.cwd(),contents:fixture,loader:'tsx'},outfile:path.join(work,'fixture.js'),bundle:true,external:['/assets/*'],format:'esm',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},plugins:[{name:'qa-auth',setup(b){b.onResolve({filter:/context\/AuthContext/},()=>({path:'auth',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:"export function useAuth(){return {user:{id:'qa-teacher',name:'QA Teacher',role:'teacher'},token:'qa-token',firebaseUser:null,authSessionKnown:true,loading:false};}",loader:'js'}));}}],logLevel:'silent'});
const css=fs.readFileSync('dist/client/index.html','utf8').match(/href="(\/assets\/[^" ]+\.css)"/)?.[1];assert(css);
const requests=[],errors=[];
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://fixture'),p=url.pathname;
 const json=(v,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(v));};
 if(p.startsWith('/api/')){requests.push({method:req.method,path:p});if(req.method!=='GET')return json({error:'Read-only fixture'},405);
  const key=new URL(req.headers.referer||'http://fixture').searchParams.get('case')||'structured',q=cases[key];
  if(p.endsWith('/results'))return json({set,attempts:[{id:'qa-attempt',studentName:'QA Student',status:key==='pending'?'pending_review':'completed',aiGradingStatus:key==='pending'?'processing':'completed',score:q.writingScore*10,writingScore:q.writingScore,writingWordCount:21,durationSeconds:120,completedAt:new Date().toISOString(),questions:[q]}]});
  if(p.endsWith('/sets'))return json([set]);if(p.endsWith('/assets'))return json([]);if(p.endsWith('/providers'))return json({providers:[]});return json({error:'Unknown fixture route'},404);
 }
 if(p==='/'){res.setHeader('Content-Type','text/html');return res.end('<html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="'+css+'"><link rel="stylesheet" href="/fixture.css"></head><body style="margin:0"><div id="app-root"><main id="admin-area-root"><div id="fixture"></div></main></div><script type="module" src="/fixture.js"></script></body></html>');}
 let file;if(p==='/fixture.js'||p==='/fixture.css')file=path.join(work,p);else if(p.startsWith('/assets/')&&!p.includes('..')){file=path.join('public',p);if(!fs.existsSync(file))file=path.join('dist/client',p);}else{res.writeHead(404);return res.end();}
 if(!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':'font/ttf');let data=fs.readFileSync(file);if(file.endsWith('.css'))data=Buffer.from(data.toString().replace(/@import\s*url\([^)]*\)\s*;/g,''));res.end(data);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const debugPort=12000+Math.floor(Math.random()*15000);
const chrome=spawn(process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-sandbox','--no-first-run','--remote-debugging-port='+debugPort,'--user-data-dir='+path.join(work,'profile'),'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});let chromeError='';chrome.stderr.on('data',b=>chromeError+=String(b));
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


let cdp;const report={states:[],screenshots:[],errors,requests};
try{
 const tab=(await waitForDebugger()).find(t=>t.type==='page');cdp=createCdpClient(tab.webSocketDebuggerUrl);await cdp.ready;await cdp.send('Page.enable');await cdp.send('Runtime.enable');
 const evaluate=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const wait=async expression=>{for(let i=0;i<150;i++){if(await evaluate('Boolean('+expression+')'))return;await delay(70);}throw Error('Timeout '+expression+' '+await evaluate('document.body.innerText.slice(-800)'));};
 const shot=async key=>{await evaluate('document.querySelector("[data-writing-feedback]")?.scrollIntoView({block:"start"})');const r=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const file=path.join(evidence,'screenshots',key+'.png');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(r.data,'base64'));report.screenshots.push(file);};
 for(const role of ['teacher','student'])for(const key of Object.keys(cases)){
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await cdp.send('Page.navigate',{url:origin+'/?role='+role+'&case='+key});
  if(role==='teacher'){
   await wait('[...document.querySelectorAll("button")].some(e=>e.textContent.trim()==="Kết quả")');await evaluate('[...document.querySelectorAll("button")].find(e=>e.textContent.trim()==="Kết quả").click()');
   await wait('[...document.querySelectorAll("button")].some(e=>e.textContent.includes("QA Student"))');await evaluate('[...document.querySelectorAll("button")].find(e=>e.textContent.includes("QA Student")).click()');
  }else await wait('document.querySelector("#standalone-writing-result")');
  if(key==='pending'){assert(await evaluate('!document.querySelector("[data-writing-feedback]")'),'Pending is not labelled as an old result');report.states.push({role,key,pending:true});continue;}
  await wait('document.querySelector("[data-writing-feedback]")');
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".writing-feedback-category h3")].map(e=>e.textContent)'),['Ngữ pháp','Từ vựng']);
  assert.equal(await evaluate('document.querySelectorAll(".writing-feedback-frame").length'),2);
  if(role==='student')assert.equal(await evaluate('document.querySelector("details p").textContent'),cases[key].userAnswer||'Bỏ trống');
  if(key==='legacy'){assert(await evaluate('document.querySelector("[data-writing-feedback]").textContent.includes("Kết quả cũ")'));assert.equal(await evaluate('document.querySelectorAll("[data-writing-correction-row]").length'),0);assert(await evaluate('document.querySelector(".writing-revised-essay").textContent.includes("chưa lưu")'));}
  else if(key==='blank')assert(await evaluate('document.querySelector(".writing-revised-essay").textContent.includes("Bài để trống")'));
  else assert.equal(await evaluate('document.querySelector("[data-writing-revised-essay]").textContent'),cases[key].revisedEssay);
  if(key==='unsafe')assert(await evaluate('!window.qaInjected&&!document.querySelector(".writing-feedback img,.writing-feedback script")'));
  for(const width of [1440,390,320]){
   await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:width<600?844:1000,deviceScaleFactor:1,mobile:width<600});await evaluate('scrollTo(0,0)');await delay(100);
   const state=await evaluate('(()=>{const root=document.querySelector(".writing-feedback"),tables=[...root.querySelectorAll("table")],a=root.querySelectorAll(".writing-feedback-category");return {overflow:document.documentElement.scrollWidth>innerWidth+1,equalColumns:tables.every(t=>{const h=t.querySelectorAll("th");return Math.abs(h[0].getBoundingClientRect().width-h[1].getBoundingClientRect().width)<1}),grammarBeforeVocabulary:a[0].getBoundingClientRect().top<a[1].getBoundingClientRect().top,headers:tables.map(t=>[...t.querySelectorAll("th")].map(h=>h.textContent))};})()');
   assert(!state.overflow,role+'/'+key+'/'+width+' overflow');assert(state.equalColumns&&state.grammarBeforeVocabulary);
   assert(state.headers.every(h=>h[0]==='Em đã viết'&&h[1]==='Sửa thành'));
   const contrast=await evaluate('(()=>{const lum=s=>s.match(/[0-9.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);return [...document.querySelectorAll(".writing-feedback h2,.writing-feedback h3,.writing-feedback th,.writing-feedback td,.writing-feedback p")].map(e=>{const fg=lum(getComputedStyle(e).color);let node=e,bg;while(node){bg=getComputedStyle(node).backgroundColor;if(!bg.includes("rgba")&&!bg.includes("transparent"))break;node=node.parentElement;}const b=lum(bg);return (Math.max(fg,b)+.05)/(Math.min(fg,b)+.05);});})()');assert(contrast.every(c=>c>=4.5),'Text contrast '+role+'/'+key);state.minimumContrast=Math.min(...contrast);
   if(key==='structured'&&width!==320)await shot(role+'-'+width);
   report.states.push({role,key,width,...state});
  }
  console.log(role+'/'+key+' PASS');
 }
 assert.equal(errors.length,0,JSON.stringify(errors));assert(requests.every(r=>r.method==='GET'));report.passed=true;fs.writeFileSync(path.join(evidence,'browser-report.json'),JSON.stringify(report,null,2));console.log('PASS '+report.states.length+' UI states; actual teacher/student result components; zero API writes.');
}catch(error){console.error(error);if(cdp){const r=await cdp.send('Page.captureScreenshot',{format:'png'}).catch(()=>null);if(r)fs.writeFileSync(path.join(evidence,'failure.png'),Buffer.from(r.data,'base64'));}throw error;}
finally{cdp?.close();chrome.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}