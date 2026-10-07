import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http'; import {spawn} from 'node:child_process'; import {build} from 'esbuild';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'journey-ui-qa-'));
await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React,{useState} from 'react'; import {createRoot} from 'react-dom/client';
import ListeningLibraryHome from './src/features/listening-library/student/ListeningLibraryHome';
import StarterListeningResult from './src/features/exam-platform/student/StarterListeningResult';
import StarterReadingWritingResult from './src/features/exam-platform/student/StarterReadingWritingResult';
import FlyerReadingWritingResult from './src/features/exam-platform/student/FlyerReadingWritingResult';
import KetReadingWritingResult from './src/features/exam-platform/student/KetReadingWritingResult';
import PetReadingResult from './src/features/exam-platform/student/PetReadingResult';
import FceReadingResult from './src/features/exam-platform/student/FceReadingResult';
import {PetWritingResult} from './src/features/exam-platform/student/PetWritingViews';
import {StandaloneWritingResult} from './src/features/writing-library/student/StandaloneWritingViews';
import {createDefaultExamContent,getExamPaperDefinition} from './src/features/exam-platform/definitions';
import {gradeExamAttempt} from './src/server/exam-platform/examGrader';
const types={'ket-reviewed':[KetReadingWritingResult,'ket','reading-writing'],'starter-listening':[StarterListeningResult,'starter','listening'],'starter-reading':[StarterReadingWritingResult,'starter','reading-writing'],'flyer-reading':[FlyerReadingWritingResult,'flyer','reading-writing'],'ket-reading':[KetReadingWritingResult,'ket','reading-writing'],'pet-reading':[PetReadingResult,'pet','reading'],'fce-reading':[FceReadingResult,'fce','reading'],'pet-writing':[PetWritingResult,'pet','writing'],'writing':[StandaloneWritingResult,'writing','writing']};
function Fixture(){const [kind,setKind]=useState('map'); window.qaKind=setKind;window.qaNavigation=[];
 if(kind==='map')return <ListeningLibraryHome onNavigate={href=>window.qaNavigation.push(href)}/>;
 const [Component,moduleId,paperId]=types[kind],content=createDefaultExamContent(getExamPaperDefinition(moduleId,paperId));content.showReviewAfterSubmit=true;
 const grade=gradeExamAttempt(content,{}),result={...grade,id:'qa-result',setId:'qa-set',versionId:'qa-version',durationSeconds:60,completedAt:'2026-10-07T00:00:00Z'},playable={id:'qa-set',title:content.title,description:content.description,content,timeLimitMinutes:20},review={attempt:result,questions:grade.questions};
 // Presentation-only fixture for a teacher-completed Writing review.
 if(kind==='ket-reviewed'){result.status='completed';result.score=grade.objectiveScore??grade.score;}
 return <div data-qa-kind={kind}><Component key={kind} playable={playable} result={result} review={review} answers={{}} reviewLoading={false} gradeRetrying={false} error="" onReview={()=>{}} onRetryGrade={()=>{}} onRetry={()=>window.qaNavigation.push('retry')} onBack={()=>window.qaNavigation.push('back')}/></div>;
} createRoot(document.getElementById('fixture')).render(<Fixture/>);
`},bundle:true,format:'esm',platform:'browser',outfile:path.join(root,'fixture.js'),jsx:'automatic',external:['/assets/*'],define:{'process.env.NODE_ENV':'\"production"','import.meta.env.DEV':'false'}});
const css=fs.readFileSync('dist/client/index.html','utf8').match(/href="(\/assets\/[^" ]+\.css)"/)?.[1];assert(css);
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://fixture'),pathname=url.pathname,json=(body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
 if(pathname.startsWith('/api/'))return json({error:'No API is used by this fixture'},404);
 if(pathname==='/fixture.js'||pathname==='/fixture.css'){res.setHeader('Content-Type',pathname.endsWith('css')?'text/css':'text/javascript');return res.end(fs.readFileSync(path.join(root,pathname)));}
 if(pathname===css){res.setHeader('Content-Type','text/css');return res.end(fs.readFileSync(path.join('dist/client',css),'utf8').replace(/@import\s*(?:url\([^)]*\)|"[^"]*"|'[^']*')\s*;/g,''));}
 if(pathname.startsWith('/assets/')&&!pathname.includes('..')){const file=path.join('public',pathname);if(fs.existsSync(file)){res.setHeader('Content-Type',file.endsWith('.webp')?'image/webp':'font/ttf');return res.end(fs.readFileSync(file));}}
 if(pathname!=='/exams'&&!pathname.startsWith('/exams/')){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type','text/html');res.end(`<html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${css}"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app-root"><div id="fixture"></div></div><script type="module" src="/fixture.js"></script></body></html>`);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,port=10000+Math.floor(Math.random()*20000);
const chrome=spawn(process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-sandbox','--no-first-run',`--remote-debugging-port=${port}`,`--user-data-dir=${path.join(root,'profile')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let socket;const errors=[],shots={},reports={};
try{
 let tab;for(let n=0;n<200;n++){try{tab=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');if(tab)break;}catch{}await delay(100);}assert(tab);
 socket=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});let id=0;const pending=new Map();
 socket.onmessage=event=>{const data=JSON.parse(event.data);if(!data.id){if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails);return;}const call=pending.get(data.id);if(!call)return;pending.delete(data.id);clearTimeout(call.timer);data.error?call.reject(Error(data.error.message)):call.resolve(data.result);};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const callId=++id,timer=setTimeout(()=>{pending.delete(callId);reject(Error('CDP timeout '+method));},15000);pending.set(callId,{resolve,reject,timer});socket.send(JSON.stringify({id:callId,method,params}));});
 const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
 const wait=async expression=>{for(let n=0;n<150;n++){if(await evaluate(`Boolean(${expression})`))return;await delay(80);}throw Error('UI timeout '+expression+' '+JSON.stringify(errors));};
 const click=async selector=>{await wait(`document.querySelector(${JSON.stringify(selector)})`);assert(await evaluate(`!document.querySelector(${JSON.stringify(selector)}).disabled`),'Disabled '+selector);await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);};
 const viewport=async width=>{await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<600});await evaluate('scrollTo(0,0)');await delay(150);};
 const shot=async name=>{const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});const file=path.join(root,name+'.png');fs.writeFileSync(file,Buffer.from(result.data,'base64'));shots[name]=file;};

 const contrast=async()=>evaluate(`(()=>{const lum=s=>s.match(/[0-9.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);return [...document.querySelectorAll('[data-student-journey] button')].filter(e=>!e.disabled&&e.getBoundingClientRect().width>0).map(e=>{const s=getComputedStyle(e),fg=lum(s.color),colors=s.backgroundImage.match(/rgb\([^)]+\)/g)||[s.backgroundColor];return {text:e.textContent,round:parseFloat(s.borderRadius),height:e.getBoundingClientRect().height,ratio:Math.min(...colors.map(c=>{const bg=lum(c);return (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);})),shadow:s.boxShadow};});})()`);
 await send('Page.navigate',{url:origin+'/exams'});await wait("document.querySelectorAll('[data-exam-island]').length===7");await wait("document.querySelector('.island-scene>img')?.naturalWidth===1672");
 for(const width of [1672,1440,768,390,320]){await viewport(width);assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Map document overflow '+width);assert(await evaluate("[...document.querySelectorAll('[data-exam-island]')].every(e=>e.getBoundingClientRect().height>=44&&e.getAttribute('href').startsWith('/exams/'))"));await shot('islands-'+width);}
 await viewport(1440);await click('[data-exam-island=pet]');assert.deepEqual(await evaluate('window.qaNavigation'),['/exams/pet']);reports.islands={levels:7,widths:5,link:true};
 for(const kind of ['starter-listening','starter-reading','flyer-reading','ket-reading','ket-reviewed','pet-reading','fce-reading','pet-writing','writing']){
   await evaluate(`window.qaKind(${JSON.stringify(kind)})`);await wait(`document.querySelector('[data-qa-kind="${kind}"] [data-student-journey]')`);
   for(const width of [1440,390,320]){await viewport(width);assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),kind+' summary overflow '+width);const c=await contrast();assert(c.every(b=>b.ratio>=4.5&&b.height>=44&&b.round>=18),kind+' summary controls '+JSON.stringify(c));await shot(kind+'-summary-'+width);}
   const reviewButton=await evaluate("[...document.querySelectorAll('[data-student-journey] button')].find(b=>b.textContent.includes('Xem kết quả'))?.className");
   if(reviewButton){await click('[data-student-journey] button.'+reviewButton.split(' ')[0]);await wait("document.querySelector('[id*=review-screen]')");for(const width of [1440,390,320]){await viewport(width);assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),kind+' review overflow '+width);const c=await contrast();assert(c.every(b=>b.ratio>=4.5&&b.height>=44&&b.round>=18),kind+' review controls '+JSON.stringify(c));await shot(kind+'-review-'+width);}}
   reports[kind]={summary:true,review:Boolean(reviewButton),widths:3};
 }
 assert.equal(errors.length,0,JSON.stringify(errors));fs.mkdirSync('.data/student-expansion-verification',{recursive:true});fs.writeFileSync('.data/student-expansion-verification/journey-browser.json',JSON.stringify({passed:true,reports,shots,errors},null,2));console.log(JSON.stringify({passed:true,reports,root}));
}finally{socket?.close();chrome.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}



