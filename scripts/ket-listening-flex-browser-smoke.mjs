import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';

// Real editor, detector, canvas crop and player. Uploads are isolated in memory;
// this fixture never calls the user's API or writes their database.
const evidence = path.resolve('.data/ket-listening-flex-qa');
fs.mkdirSync(evidence, { recursive: true });
const bundle = path.join(evidence, 'browser-fixture.js');
await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import KetListeningAuthoring from './src/features/exam-platform/admin/KetListeningAuthoring';
import KetListeningPartView from './src/features/exam-platform/student/KetListeningViews';
import {listeningApi} from './src/features/listening/api';
import {createDefaultExamContent,getExamPaperDefinition} from './src/features/exam-platform/definitions';
const initial=createDefaultExamContent(getExamPaperDefinition('ket','listening')).parts[0];
initial.imageAssetId='source';initial.imageUrl='/source.svg';
initial.examples=[{prompt:'What time is it?',answer:'B',options:[{label:'A',text:'A clock showing 6.00.',imageAssetId:'ex-a',imageUrl:'/picture.svg'},{label:'B',text:'A clock showing 8.30.',imageAssetId:'ex-b',imageUrl:'/picture.svg'},{label:'C',text:'A clock showing 9.00.',imageAssetId:'ex-c',imageUrl:'/picture.svg'}]}];
initial.questions=initial.questions.map((q,i)=>({...q,prompt:['Where is the hat?','Which train leaves first?','What does Sarah buy?','Which building is the school?','What time does the bus arrive?'][i],imageLayout:[{kind:'shared'},{kind:'options',optionLabels:['A','C']},{kind:'options',optionLabels:['A','B','C']},{kind:'shared'},{kind:'options',optionLabels:['B']}][i],imageAssetId:'common-'+i,imageUrl:'/picture.svg',correctOptionIds:[q.options[1].id],options:q.options.map(o=>({...o,text:'Detailed scene '+o.label,imageAssetId:'image-'+i+'-'+o.label,imageUrl:'/picture.svg'}))}));
window.qaUploads=[];window.qaDelay=0;window.qaFail=false;
listeningApi.uploadAsset=async(token,file,kind,metadata)=>{const item={name:file.name,size:file.size,type:file.type,metadata};window.qaUploads.push(item);await new Promise(r=>setTimeout(r,window.qaDelay));if(window.qaFail)throw Error('Upload fixture failure');return{id:'derived-'+window.qaUploads.length,kind:'image',status:'active',mimeType:'image/png',url:'/picture.svg',originalName:file.name};};
function Fixture(){const [part,setPart]=useState(structuredClone(initial)),[mode,setMode]=useState('student'),[answers,setAnswers]=useState({}),[assets,setAssets]=useState([]);
window.qaPart=part;window.qaAnswers=answers;window.qaMode=setMode;window.qaReset=()=>{setPart(structuredClone(initial));setAnswers({});};window.qaPatch=patch=>setPart(p=>({...p,...patch}));
const current=mode==='part3'?{...part,part:3,examples:[{prompt:"Sarah's boss wants a new",answer:'C',options:[{label:'A',text:'office manager'},{label:'B',text:'shop assistant'},{label:'C',text:'secretary'}]}]}:mode==='part4'||mode==='part5'?{...part,part:mode==='part4'?4:5,passage:'Notebook\\nExample — Name of school: International Language School',questions:[{...part.questions[0],displayNumber:16,type:'short-answer',prompt:'Next course begins — Day',answerPrefix:'',answerSuffix:''},{...part.questions[1],displayNumber:17,type:'short-answer',prompt:'Next course begins — Date',answerPrefix:'',answerSuffix:''}]}:part;
return <main style={{maxWidth:1100,margin:'0 auto',padding:16}}>{mode==='author'?<KetListeningAuthoring token='fixture' part={part} assets={assets} onAssets={asset=>setAssets(a=>a.some(x=>x.id===asset.id)?a:[...a,asset])} onChange={setPart}/>:<KetListeningPartView part={current} answers={answers} onAnswer={(id,value)=>setAnswers(a=>({...a,[id]:value}))}/>}</main>;}
createRoot(document.getElementById('fixture')).render(<Fixture/>);
` }, outfile: bundle, bundle: true, format: 'esm', jsx: 'automatic', logLevel: 'silent' });
const css = fs.readdirSync('dist/client/assets').find(name => /^index-.*\.css$/.test(name));
assert.ok(css, 'Run the canonical build before browser verification.');
const counts = [1, 2, 3, 1, 1];
const frames = counts.flatMap((count, row) => Array.from({ length: count }, (_, column) => `<rect x="${count === 1 ? 60 : 60 + column * 280}" y="${40 + row * 180}" width="${count === 1 ? 760 : 200}" height="120" fill="white" stroke="black" stroke-width="2"/>`)).join('');
const source = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1000"><rect width="900" height="1000" fill="white"/>${frames}</svg>`;
const picture = '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="200"><rect width="500" height="200" fill="#e0f2fe"/><circle cx="250" cy="90" r="65" fill="white" stroke="#075985" stroke-width="5"/><path d="M250 40V90L285 120" fill="none" stroke="#075985" stroke-width="5"/></svg>';
const server = http.createServer((req, res) => {
  if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(fs.readFileSync(bundle)); }
  else if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(fs.readFileSync(path.join('dist/client/assets', css))); }
  else if (req.url === '/source.svg' || req.url === '/picture.svg') { res.setHeader('Content-Type', 'image/svg+xml'); res.end(req.url === '/source.svg' ? source : picture); }
  else if (req.url.startsWith('/api/')) { res.writeHead(500).end('Unexpected API request in isolated UI fixture'); }
  else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="fixture"></div><script type="module" src="/fixture.js"></script></body></html>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const debugPort = 14000 + Math.floor(Math.random() * 20000);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ket-flex-browser-'));
const chrome = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, origin], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [], errors = [], shots = [], computed = {};
let socket;
try {
  let target;
  for (let count = 0; count < 150 && !target; count++) { try { target = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(tab => tab.type === 'page'); } catch {} if (!target) await delay(100); }
  assert.ok(target);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 1; const pending = new Map();
  socket.onmessage = event => {
    const result = JSON.parse(event.data);
    if (result.method === 'Runtime.exceptionThrown') errors.push(result.params.exceptionDetails);
    if (!result.id || !pending.has(result.id)) return;
    const call = pending.get(result.id); pending.delete(result.id); clearTimeout(call.timer);
    result.error ? call.reject(Error(result.error.message)) : call.resolve(result.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = nextId++, timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout ' + method)); }, 20000); pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
  const wait = async expression => { for (let i = 0; i < 150; i++) { if (await evaluate(`Boolean(${expression})`)) return; await delay(80); } throw Error('UI timeout ' + expression); };
  const click = async selector => { await wait(`document.querySelector(${JSON.stringify(selector)})&&!document.querySelector(${JSON.stringify(selector)}).disabled`); await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); await delay(80); };
  const mode = async name => { await evaluate(`window.qaMode(${JSON.stringify(name)})`); await wait(name === 'author' ? "document.querySelector('#ket-listening-authoring')" : "document.querySelector('#ket-listening-player')"); await delay(120); };
  const viewport = async width => { await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 }); await delay(150); };
  const shot = async name => { await evaluate('scrollTo(0,0)'); const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); const file = path.join(evidence, name + '.png'); fs.writeFileSync(file, Buffer.from(screenshot.data, 'base64')); shots.push(file); };
  const contrast = async selector => evaluate(`(()=>{const s=getComputedStyle(document.querySelector(${JSON.stringify(selector)}));const rgb=v=>v.match(/[\\d.]+/g).slice(0,3).map(Number),lum=v=>rgb(v).map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4}).reduce((n,c,i)=>n+c*[.2126,.7152,.0722][i],0);const a=lum(s.color),b=lum(s.backgroundColor);return {foreground:s.color,background:s.backgroundColor,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};})()`);
  await send('Page.enable'); await send('Runtime.enable'); await send('Page.navigate', { url: origin }); await wait("document.querySelectorAll('[data-ket-listening-question]').length===5");
  await viewport(1440);
  assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-ket-listening-question]')].map(e=>e.dataset.ketImageLayout)"), ['shared', 'options', 'options', 'shared', 'options']);
  assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-ket-listening-question]')].map(e=>e.querySelectorAll('img').length)"), [1, 2, 3, 1, 1]);
  assert.equal(await evaluate("document.querySelectorAll('[data-ket-example-option]').length"), 3);
  assert.equal(await evaluate("document.querySelector('[data-ket-example-option][data-correct=true]').dataset.ketExampleOption"), 'B');
  computed.exampleCorrect = await contrast('[data-ket-example-option][data-correct=true]');
  computed.choiceDefault = await contrast('[data-ket-listening-choice]');
  assert.ok(computed.exampleCorrect.ratio >= 4.5 && computed.choiceDefault.ratio >= 4.5);
  const hoverPoint = await evaluate("(()=>{const e=document.querySelector('[data-ket-listening-choice]');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()");
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...hoverPoint });
  computed.choiceHover = await contrast('[data-ket-listening-choice]');
  assert.ok(computed.choiceHover.ratio >= 4.5);
  await click('[data-ket-listening-question]:nth-of-type(3) [data-ket-listening-choice="C"] input');
  await wait("Object.keys(window.qaAnswers).length===1");
  computed.choiceSelected = await contrast('[data-ket-listening-choice][data-selected=true]');
  assert.ok(computed.choiceSelected.ratio >= 4.5);
  await evaluate("document.querySelector('[data-ket-listening-choice][data-selected=true] input').focus()");
  assert.equal(await evaluate("getComputedStyle(document.activeElement.closest('label')).outlineWidth"), '3px');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 });
  await wait("document.activeElement.closest('[data-ket-listening-choice]').dataset.ketListeningChoice==='B'");
  assert.ok(await evaluate("Object.values(window.qaAnswers).some(id=>window.qaPart.questions[2].options.find(o=>o.id===id)?.label==='B')"));
  await shot('student-desktop');
  for (const width of [390, 320]) { await viewport(width); assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1')); assert.equal(await evaluate("document.querySelectorAll('[data-ket-listening-choice]').length"), 15); await shot('student-' + width); }
  await mode('part3'); assert.equal(await evaluate("document.querySelectorAll('[data-ket-example-option]').length"), 3); assert.ok(await evaluate("document.querySelector('[data-ket-example-option][data-correct=true]').textContent.includes('secretary')")); await shot('part3-mobile');
  for (const name of ['part4', 'part5']) { await mode(name); assert.equal(await evaluate("document.querySelectorAll('[data-ket-listening-form-rows] input').length"), 2); assert.ok(await evaluate("!document.querySelector('[data-ket-listening-text-source]').textContent.includes('Next course begins')")); }
  checks.push('Desktop/mobile player preserves question order, 1/2/3 pictures, all ABC answers, detailed examples and highlighted correct choice; form context contains no scored rows.');
  await viewport(1440); await mode('author');
  await wait("document.querySelectorAll('[data-ket-listening-question-id]').length===5");
  assert.equal(await evaluate("document.querySelectorAll('[data-ket-listening-example-editor] [aria-label^=\"Nội dung example\"]').length"), 3);
  await evaluate("(()=>{const select=document.querySelectorAll('[data-ket-listening-question-id] select')[0];select.value='options';select.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await wait("window.qaPart.questions[0].imageLayout.kind==='options'");
  assert.ok(await evaluate("window.qaPart.questions[0].imageAssetId==='common-0'&&window.qaPart.questions[0].options.every(o=>o.imageAssetId)"));
  await evaluate('window.qaReset()'); await delay(150);
  await click('[data-ket-listening-action="detect-part1-layout"]'); await wait("document.querySelector('[data-ket-listening-crop-mapping]')");
  assert.equal(await evaluate("document.querySelectorAll('[data-ket-listening-crop-mapping] [style*=\"left\"]').length"), 8);
  await click('[data-ket-listening-action="apply-part1-layout"]'); await wait("window.qaUploads.length===8&&document.querySelector('[role=status]').textContent.includes('Đã gán đủ')");
  assert.ok(await evaluate("window.qaUploads.every(f=>f.type==='image/png'&&f.size>100&&f.metadata.derivedFromAssetId==='source')"));
  assert.ok(await evaluate("window.qaPart.questions[0].imageAssetId.startsWith('derived-')&&window.qaPart.questions[2].options.every(o=>o.imageAssetId.startsWith('derived-'))"));
  checks.push('Real pixel detection includes wide shared frames; reviewed mapping crops/uploads/attaches all 8 dynamic slots without a fixed question number or image total.');
  await evaluate('window.qaReset();window.qaDelay=250;window.qaUploads=[]'); await delay(120);
  await click('[data-ket-listening-action="detect-part1-layout"]'); await wait("document.querySelector('[data-ket-listening-crop-mapping]')");
  await click('[data-ket-listening-action="apply-part1-layout"]'); await wait('window.qaUploads.length>0');
  await evaluate("window.qaPatch({instruction:'Edited during upload'})");
  await wait("document.querySelector('[role=status]').textContent.includes('đã đổi')");
  assert.ok(await evaluate("window.qaPart.instruction==='Edited during upload'&&window.qaPart.questions[0].imageAssetId==='common-0'"));
  checks.push('Editing during async upload rejects stale crop attachment and preserves the latest draft.');
  await evaluate('window.qaDelay=0;window.qaFail=true;window.qaReset()'); await delay(120);
  await evaluate("[...document.querySelector('[data-ket-listening-question-id]').querySelectorAll('button')].find(b=>b.textContent.includes('Crop ảnh chung')).click()");
  await wait("document.querySelector('[data-ket-listening-manual-crop]')");
  await click('[data-ket-listening-manual-crop] > button'); await wait("document.querySelector('[role=status]').textContent.includes('Upload fixture failure')");
  assert.equal(await evaluate('window.qaPart.questions[0].imageAssetId'), 'common-0');
  await evaluate('window.qaFail=false'); await click('[data-ket-listening-manual-crop] > button'); await wait("window.qaPart.questions[0].imageAssetId.startsWith('derived-')");
  checks.push('Manual shared-image crop works at question 1; upload failure preserves existing media and retry succeeds.');
  await evaluate('window.qaReset()'); await delay(120); await viewport(390); assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1')); await shot('author-mobile');
  await evaluate('window.qaPatch({imageAssetId:undefined,imageUrl:undefined})'); await delay(100);
  assert.ok(await evaluate("document.querySelector('[data-ket-listening-action=detect-part1-layout]').disabled"));
  computed.cropDisabled = await contrast('[data-ket-listening-action=detect-part1-layout]');
  assert.ok(computed.cropDisabled.ratio >= 4.5);
  await evaluate('window.qaReset()'); await delay(100);
  await viewport(1440); await shot('author-desktop');
  assert.equal(errors.length, 0, JSON.stringify(errors));
  fs.writeFileSync(path.join(evidence, 'browser-report.json'), JSON.stringify({ passed: true, checks, shots, computed, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, checks, screenshots: shots.length }));
} finally { socket?.close(); chrome.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
