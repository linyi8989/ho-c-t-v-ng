import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import http from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { verifyStarterPlayer } from './starter-player-browser-checks.mjs';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = Number(process.env.CSS_QA_DEBUG_PORT || (10_000 + Math.floor(Math.random() * 20_000)));

const qaRoot = mkdtempSync(path.join(os.tmpdir(), 'vhomework-css-qa-'));
const profileDir = path.join(qaRoot, 'profile');
const screenshotDir = path.join(qaRoot, 'screenshots');
mkdirSync(profileDir, { recursive: true });
mkdirSync(screenshotDir, { recursive: true });

const fixtureRoot = path.join(qaRoot, 'fixture'), fixtureDb = path.join(fixtureRoot, 'app.sqlite');
const fixture = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/starter-scene-qa-fixture.ts'], { encoding: 'utf8', windowsHide: true, env: { ...process.env, NODE_ENV: 'test', STARTER_SCENE_QA: 'true', STORAGE_MODE: 'sqlite', SQLITE_DRIVER: 'better-sqlite3', SQLITE_DB_PATH: fixtureDb, SQLITE_ALLOW_CREATE: 'true', SQLITE_ALLOW_JSON_IMPORT: 'false' } });
if (fixture.status !== 0) throw Error(fixture.stderr);
const fixtureData = JSON.parse(readFileSync(path.join(fixtureRoot, 'fixture.json'), 'utf8'));
const listener = net.createServer(); await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve)); const appPort = listener.address().port; await new Promise(resolve => listener.close(resolve));
const backendOrigin = `http://127.0.0.1:${appPort}`;
if (!existsSync('dist/server.cjs')) throw Error('Run the canonical build before browser verification.');
const appServer = spawn(process.execPath, ['dist/server.cjs'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env,
  DISABLE_HMR: 'true', NODE_ENV: 'development', VITE_MODE: 'production', VITE_LOCAL_AUTH_BYPASS_ENABLED: 'true', LOCAL_AUTH_BYPASS_ENABLED: 'true', VITE_FIREBASE_API_KEY: 'local-test-api-key', VITE_FIREBASE_AUTH_DOMAIN: 'local-test.invalid', VITE_FIREBASE_PROJECT_ID: 'local-test', VITE_FIREBASE_STORAGE_BUCKET: 'local-test.invalid', VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000', VITE_FIREBASE_APP_ID: '1:000000000000:web:localtest',
  STORAGE_MODE: 'sqlite', SQLITE_DRIVER: 'better-sqlite3', SQLITE_DB_PATH: fixtureDb, SQLITE_ALLOW_CREATE: 'true', SQLITE_ALLOW_JSON_IMPORT: 'false', SEED_DATA_ENABLED: 'false', LEARNING_HISTORY_ENABLED: 'true', LISTENING_TICKET_SECRET: 'qa-only-ticket', GUEST_PUBLIC_ID_SECRET: 'qa-only-id', DIAGNOSTIC_SECRET: 'qa-only-diagnostic',
  AI33_API_KEY: '', TTS_API_KEY: '', YUPVOX_API_KEY: '', SPEAKING_SAMPLE_TTS_PROVIDER: 'b', SPEAKING_FEEDBACK_PROVIDER: 'none', DEVQUOTA_API_KEY: '', DEVQUOTA_API_KEYk: '', STALI_API_KEY: '', SPEAKING_ENABLED: 'true', SPEAKING_AZURE_PROSODY: 'false', AZURE_SPEECH_KEY: '', AZURE_SPEECH_REGION: '', SPEECHSUPER_APP_KEY: '', SPEECHSUPER_SECRET_KEY: '', GEMINI_API_KEY: '', SPEAKING_FEEDBACK_MODEL: '',
  TTS_AUDIO_DIR: path.join(fixtureRoot, 'audio'), LISTENING_MEDIA_DIR: path.join(fixtureRoot, 'listening-media'), VOCAB_IMAGE_DIR: path.join(fixtureRoot, 'vocab-images'), PORT: String(appPort),
} });
let serverLogs = ''; appServer.stdout.on('data', b => { serverLogs += b; }); appServer.stderr.on('data', b => { serverLogs += b; });
// Build the same client code into an isolated QA directory with B's loopback auth switch.
// The shipped dist is untouched, and the browser tests do not depend on dev HMR sockets.
const clientRoot = path.join(fixtureRoot, 'client');
const qaBuild = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', clientRoot, '--emptyOutDir'], { encoding: 'utf8', windowsHide: true, env: { ...process.env, VITE_LOCAL_AUTH_BYPASS_ENABLED: 'true', VITE_FIREBASE_API_KEY: 'local-test-api-key', VITE_FIREBASE_AUTH_DOMAIN: 'local-test.invalid', VITE_FIREBASE_PROJECT_ID: 'local-test', VITE_FIREBASE_STORAGE_BUCKET: 'local-test.invalid', VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000', VITE_FIREBASE_APP_ID: '1:000000000000:web:localtest' } });
if(qaBuild.status!==0){appServer.kill();throw Error(qaBuild.stderr);}
const frontend = http.createServer(async(req,res)=>{
  try {
    if(req.url.startsWith('/api/')||req.url.startsWith('/audio/')||req.url.startsWith('/listening-media/')){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
      const headers={...req.headers};delete headers.host;delete headers['content-length'];
      const upstream=await fetch(backendOrigin+req.url,{method:req.method,headers,...(req.method==='GET'||req.method==='HEAD'?{}:{body})});
      const replyHeaders=Object.fromEntries(upstream.headers);delete replyHeaders['content-encoding'];delete replyHeaders['content-length'];res.writeHead(upstream.status,replyHeaders);res.end(Buffer.from(await upstream.arrayBuffer()));return;
    }
    const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname), target=path.resolve(clientRoot,'.'+route);
    if(target.startsWith(clientRoot+path.sep)&&existsSync(target)&&!route.endsWith('/')){
      const type=route.endsWith('.js')?'text/javascript':route.endsWith('.css')?'text/css':route.endsWith('.svg')?'image/svg+xml':route.endsWith('.png')?'image/png':route.endsWith('.webp')?'image/webp':route.endsWith('.ttf')?'font/ttf':'application/octet-stream';res.writeHead(200,{'Content-Type':type});res.end(readFileSync(target));return;
    }
    res.writeHead(200,{'Content-Type':'text/html'});res.end(readFileSync(path.join(clientRoot,'index.html')));
  }catch{res.writeHead(502);res.end('QA proxy unavailable');}
});
await new Promise(resolve=>frontend.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${frontend.address().port}`;
const chrome = spawn(chromePath, [
  '--headless=new',
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  '--autoplay-policy=no-user-gesture-required',
  '--use-file-for-fake-audio-capture=' + path.join(fixtureRoot, 'audio', 'speaking-fixture.wav'),
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
 const targets=await waitForDebugger(),target=targets.find(t=>t.type==='page'&&t.url.startsWith(origin));assert(target?.webSocketDebuggerUrl,'Chrome page target missing');
 const cdp=createCdpClient(target.webSocketDebuggerUrl);await cdp.ready;await cdp.send('Page.enable');await cdp.send('Runtime.enable');
 const evaluate=async expression=>{const result=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
 const wait=async expression=>{const end=Date.now()+20000;while(Date.now()<end){if(await evaluate(`Boolean(${expression})`))return;await delay(100);}throw Error('Timed out: '+expression);};
 const click=async(text,root)=>{await wait(`[...document.querySelectorAll(${JSON.stringify(root+' button')})].some(b=>b.textContent.trim()===${JSON.stringify(text)}&&!b.disabled)`);const point=await evaluate(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(root+' button')})].find(b=>b.textContent.trim()===${JSON.stringify(text)}&&!b.disabled);b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await delay(100);};
 const viewport=async width=>{await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<600});await delay(150);};
 const shot=async name=>{const result=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true});const file=path.join(screenshotDir,name+'.png');writeFileSync(file,Buffer.from(result.data,'base64'));return file;};
 const api=async(endpoint,method='GET',body)=>{const response=await fetch(origin+'/api/exam-platform'+endpoint,{method,headers:{Authorization:'Bearer local-test-auth-bypass','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json();assert(response.ok,'Fixture API '+endpoint+': '+JSON.stringify(data));return data;};
 const publicApi=async()=>{const response=await fetch(origin+'/api/exam-platform/starter-scene');assert(response.ok,'Public scene API');return response.json();};
 const goto=async route=>{await cdp.send('Page.navigate',{url:origin+route});};
 const reports={},screenshots={};
 if(process.env.STARTER_PLAYER_QA==='true'){
  await goto('/exams/starter/listening/qa-listening-1');await wait("document.querySelector('#generic-exam-player button.exam-platform-primary-action')");
  await verifyStarterPlayer({cdp,evaluate,wait,click,goto,shot,viewport,reports,screenshots});assert(browserErrors.length===0,'Player browser exceptions');
  mkdirSync('.data/starter-scene-verification',{recursive:true});writeFileSync('.data/starter-scene-verification/player-report.json',JSON.stringify({passed:true,fixtureDb,origin,reports,screenshots,browserErrors},null,2));console.log(JSON.stringify({passed:true,screenshots,browserErrors:0}));cdp.close();return;
 }
 const controlContrast=async root=>evaluate(`(()=>{const lum=s=>s.match(/[0-9.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);return [...document.querySelectorAll(${JSON.stringify(root+' button,'+root+' a')})].filter(e=>e.getBoundingClientRect().width>0).map(e=>{const s=getComputedStyle(e),a=lum(s.color),b=lum(s.backgroundColor);return {text:e.textContent,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});})()`);
 const loadingScript=await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const f=window.fetch.bind(window);window.fetch=(u,o)=>String(u).endsWith('/starter-scene')?new Promise(resolve=>setTimeout(()=>resolve(f(u,o)),1200)):f(u,o);})()`});
 await goto('/exams/starter');await wait("document.querySelector('[data-starter-list=listening][aria-busy=true]')");reports.loadingVisible=true;
 await cdp.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:loadingScript.identifier});
 await goto('/exams/starter');await wait("document.querySelectorAll('[data-starter-link=listening]').length===31");
 assert((await publicApi()).papers['reading-writing'].links.length===31,'31 actual links in each yard, no fixed 27 cap');
 assert((await publicApi()).papers.listening.links[0].title.includes('\uFFFD')&&await evaluate("[...document.querySelectorAll('[data-starter-link]')].every(e=>!e.textContent.includes('\uFFFD')&&!e.title.includes('\uFFFD')&&!e.getAttribute('aria-label').includes('\uFFFD'))"),'Legacy separator is readable in text/tooltip/accessible label without rewriting the source title');reports.legacySeparator=true;
 await wait("document.querySelector('.starter-background')?.naturalWidth===1672");
 await evaluate(`Promise.all([document.fonts.load('800 24px "Baloo 2"'),document.fonts.load('700 24px "Baloo 2"'),document.fonts.load('700 16px "Nunito"')])`);
 assert(await evaluate(`document.fonts.check('800 24px "Baloo 2"')&&document.fonts.check('700 24px "Baloo 2"')&&document.fonts.check('700 16px "Nunito"')`),'Self-hosted board, lesson and body fonts load');reports.fonts=true;
 await evaluate(`new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{window.starterQaCardArt=img;resolve(true);};img.onerror=()=>reject(Error('Card art unavailable'));img.src='/assets/lesson-cards/starter-wood-cards-v2.webp';})`);
 const typography=await evaluate(`(()=>{const headings=[...document.querySelectorAll('#starter-scene-page h1,#starter-scene-page h2')].map(e=>{const s=getComputedStyle(e);return {text:e.textContent,tag:e.tagName,color:s.color,font:s.fontFamily,size:parseFloat(s.fontSize),stroke:s.webkitTextStrokeWidth,shadow:s.textShadow};});const links=[...document.querySelectorAll('[data-starter-link]')].map(e=>{const s=getComputedStyle(e),t=getComputedStyle(e.querySelector('.starter-link-text')),art=e.querySelector('.starter-lesson-art'),number=e.querySelector('.starter-lesson-number');return {background:s.backgroundColor,backgroundImage:s.backgroundImage,border:s.borderTopWidth,shadow:s.boxShadow,font:t.fontFamily,weight:t.fontWeight,color:t.color,size:parseFloat(t.fontSize),stroke:parseFloat(t.webkitTextStrokeWidth),textShadow:t.textShadow,decoration:s.textDecorationLine,transform:s.transform,illustrated:e.children.length===3&&art.getAttribute('aria-hidden')==='true'&&number.getAttribute('aria-hidden')==='true'&&getComputedStyle(art).backgroundImage.includes('starter-wood-cards-v2.webp')};});const dynamic=[...document.querySelectorAll('[data-starter-list]')].every(list=>[...list.querySelectorAll('[data-starter-link]')].every((e,i)=>e.querySelector('.starter-lesson-number').textContent===String(i+1)&&Number(e.dataset.starterLessonVariant)===i%5));return {headings,links,dynamic,hints:document.querySelectorAll('.starter-lawn-hint').length};})()`);
 assert(typography.headings.length===3&&typography.headings.every(h=>h.font.includes('Baloo 2')&&h.shadow!=='none')&&typography.headings.filter(h=>h.tag==='H1').every(h=>h.color==='rgb(255, 223, 115)'&&parseFloat(h.stroke)>0&&h.size<=86)&&typography.headings.filter(h=>h.tag==='H2').every(h=>h.color==='rgb(99, 48, 18)'),'Smaller gold title and carved house labels survive B styles');
 assert(typography.links.every(link=>link.background==='rgba(0, 0, 0, 0)'&&link.backgroundImage==='none'&&link.border==='0px'&&link.shadow==='none'&&link.font.includes('Baloo 2')&&link.weight==='700'&&link.color==='rgb(99, 48, 18)'&&link.size>=11&&link.illustrated&&link.stroke===0&&link.textShadow==='none'&&link.decoration==='none'&&link.transform==='none')&&typography.hints===0&&typography.dynamic,'Reference-style illustrated boards, live numbering and brown lesson names without underline or extra CSS shadow');reports.typography={smallerTitle:true,houseLabels:true,illustratedLinks:true,dynamicNumbers:true,hintsRemoved:true};
 const balance=await evaluate(`(()=>{const title=document.querySelector('#starter-scene-page h1'),letters=[...title.querySelectorAll('.starter-title-letter')].map(e=>getComputedStyle(e).transform),pre=getComputedStyle(document.querySelector('.starter-title-board p'));return {arc:letters.length===8&&new Set(letters).size>=5&&title.getAttribute('aria-label')==='Starters',preRaised:new DOMMatrixReadOnly(pre.transform).m42<=-7.9};})()`);
 assert(Object.values(balance).every(Boolean),'Curved accessible title and raised Pre A1 preserved');reports.balance=balance;
 const titleFit=async()=>evaluate(`(()=>{const board=document.querySelector('.starter-title-board').getBoundingClientRect(),title=document.querySelector('#starter-scene-page h1'),pre=document.querySelector('.starter-title-board p'),tag=pre.getBoundingClientRect(),oldSize=innerWidth<768?Math.max(48,Math.min(innerWidth*.14,58)):Math.max(64,Math.min(innerWidth*.052,86)),oldPre=innerWidth<768?22:Math.max(22,Math.min(innerWidth*.018,29)),letters=[...title.querySelectorAll('.starter-title-letter')];return {font:parseFloat(getComputedStyle(title).fontSize),ratio:parseFloat(getComputedStyle(title).fontSize)/oldSize,preRatio:parseFloat(getComputedStyle(pre).fontSize)/oldPre,preLeft:(tag.left-board.left)/board.width,preRight:(tag.right-board.left)/board.width,preTop:(tag.top-board.top)/board.height,preBottom:(tag.bottom-board.top)/board.height,preCenter:(tag.left+tag.width/2-board.left)/board.width,titleFits:letters.every(e=>{const r=e.getBoundingClientRect();return r.left>=board.left&&r.right<=board.right&&r.top>=board.top&&r.bottom<=board.bottom;}),accessible:title.getAttribute('aria-label')==='Starters'};})()`);
 await evaluate(`new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{window.starterQaSignArt=img;resolve(true);};img.onerror=()=>reject(Error('Signpost art unavailable'));img.src='/assets/signs/signpost-double.webp';})`);
 const navState=async()=>evaluate(`(()=>{const expected={home:'/',next:'/exams/mover',history:'/history'},img=window.starterQaSignArt,c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const lum=rgb=>rgb.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);return {toolbarRemoved:!document.querySelector('.starter-toolbar'),links:[...document.querySelectorAll('[data-starter-nav]')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),label=e.querySelector('.starter-sign-label').getBoundingClientRect(),fg=lum(s.color.match(/[0-9.]+/g).map(Number)),y=e.dataset.starterNav==='next'? .55:.27,bg=lum([...ctx.getImageData(Math.round(c.width*.6),Math.round(c.height*y),1,1).data]);return {id:e.dataset.starterNav,href:e.getAttribute('href'),correctHref:e.getAttribute('href')===expected[e.dataset.starterNav],accessible:e.getAttribute('aria-label').length>e.textContent.trim().length&&!e.closest('[aria-hidden=true]'),withinViewport:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,touch:r.height>=44&&r.width>=44,labelFits:label.width<=r.width&&label.height<=r.height,font:s.fontFamily,underline:s.textDecorationLine,contrast:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)};})};})()`);
 const navClick=async id=>{const point=await evaluate(`(()=>{const e=document.querySelector('[data-starter-nav=${id}]');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});};
 for(const paper of ['listening','reading-writing']){
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  const point=await evaluate(`(()=>{const r=document.querySelector('[data-starter-link=${paper}]').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await wait(`getComputedStyle(document.querySelector('[data-starter-link=${paper}]')).scale==='1'&&getComputedStyle(document.querySelector('[data-starter-link=${paper}]')).color==='rgb(76, 39, 15)'`);
  const hover=await evaluate(`(()=>{const e=document.querySelector('[data-starter-link=${paper}]'),s=getComputedStyle(e),t=getComputedStyle(e.querySelector('.starter-link-text'));return {hovered:e.matches(':hover'),color:t.color,decoration:s.textDecorationLine,shadow:t.textShadow,stroke:t.webkitTextStrokeWidth,box:s.boxShadow,transform:s.transform,scale:s.scale,filter:s.filter,duration:s.transitionDuration};})()`);
  assert(hover.hovered&&hover.color==='rgb(76, 39, 15)'&&hover.decoration==='none'&&hover.shadow==='none'&&hover.stroke==='0px'&&hover.box==='none'&&hover.transform==='none'&&hover.scale==='1'&&hover.filter==='brightness(1.035)'&&hover.duration.includes('0.18s'),'Subtle animated hover retains clear brown text without underline or extra CSS shadow on '+paper+': '+JSON.stringify(hover));reports['hover-'+paper]=hover;
 }
 await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});await delay(250);
 assert(await evaluate("[...document.querySelectorAll('[data-starter-link]')].every(e=>getComputedStyle(e).scale==='0.985')"),'Resting cards retain a small hover gutter');
 await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 const reducedPoint=await evaluate("(()=>{const r=document.querySelector('[data-starter-link=listening]').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()");await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',...reducedPoint});await delay(200);
 assert(await evaluate("(()=>{const s=getComputedStyle(document.querySelector('[data-starter-link=listening]'));return s.scale==='0.985'&&s.transitionDuration==='0s';})()"),'Reduced motion suppresses hover enlargement and animation');reports.reducedMotion=true;
 await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await delay(250);
 reports.linkBackgroundContrast=await evaluate(`(()=>{const lum=rgb=>rgb.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0),img=window.starterQaCardArt,canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return [...document.querySelectorAll('[data-starter-link]')].filter(e=>{const b=e.getBoundingClientRect(),l=e.closest('[data-starter-list]').getBoundingClientRect();return b.top>=l.top-1&&b.bottom<=l.bottom+1;}).map(e=>{const t=e.querySelector('.starter-link-text'),b=t.getBoundingClientRect(),r=e.getBoundingClientRect(),fg=lum(getComputedStyle(t).color.match(/[0-9.]+/g).map(Number)),samples=[.2,.5,.8].map(f=>{const x=Math.round((b.left+b.width*f-r.left)/r.width*canvas.width),y=Math.round((Number(e.dataset.starterLessonVariant)+(b.top+b.height*.5-r.top)/r.height)/5*canvas.height),pixel=[...ctx.getImageData(x,y,1,1).data],bg=lum(pixel);return {ratio:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05),alpha:pixel[3]/255};});return {paper:e.dataset.starterLink,minimum:Math.min(...samples.map(s=>s.ratio)),minimumAlpha:Math.min(...samples.map(s=>s.alpha))};});})()`);
 assert(reports.linkBackgroundContrast.length===10&&reports.linkBackgroundContrast.every(link=>link.minimum>=4.5&&link.minimumAlpha>=.95),'Lesson titles contrast with the opaque wood under them: '+JSON.stringify(reports.linkBackgroundContrast));
 reports.artAlpha=await evaluate(`(()=>{const img=window.starterQaCardArt,c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return {width:c.width,height:c.height,corner:ctx.getImageData(0,0,1,1).data[3]};})()`);
 assert(reports.artAlpha.corner===0,'Card sprite has a genuinely transparent outer corner');
 const houseLayout=async()=>evaluate(`(()=>{const scene=document.querySelector('.starter-scene-canvas');return [...document.querySelectorAll('[data-starter-house-sign]')].map(e=>{const s=getComputedStyle(e),label=e.querySelector('h2'),plaque=e.querySelector('.starter-house-plaque');return {paper:e.dataset.starterHouseSign,left:parseFloat(s.left)/scene.clientWidth,top:parseFloat(s.top)/scene.clientHeight,width:parseFloat(s.width)/scene.clientWidth,onCanvas:e.parentElement===scene,emblem:!!e.querySelector('.starter-house-emblem'),labelFits:label.scrollWidth<=plaque.clientWidth+1};});})()`);
 const houseArch=async()=>evaluate(`(()=>{const sign=document.querySelector('[data-starter-house-sign=reading-writing]'),plaque=sign.querySelector('.starter-house-plaque'),label=sign.querySelector('h2'),letters=[...label.querySelectorAll('.starter-house-title-letter')],box=plaque.getBoundingClientRect(),face=plaque.querySelectorAll('svg > path')[1],start=face.getPointAtLength(0),middle=face.getPointAtLength(129),offsets=letters.map(e=>new DOMMatrixReadOnly(getComputedStyle(e).transform).m42);return {marked:plaque.dataset.starterArchedPlaque==='true',woodRise:start.y-middle.y,accessible:label.getAttribute('aria-label')==='Reading & Writing'&&label.querySelector('[aria-hidden=true]')?.textContent==='Reading & Writing',count:letters.length,lettersCurved:offsets[0]>0&&offsets.at(-1)>0&&offsets[Math.floor(offsets.length/2)]<0,lettersFit:letters.every(e=>{const r=e.getBoundingClientRect();return r.left>=box.left-1&&r.right<=box.right+1&&r.top>=box.top-1&&r.bottom<=box.bottom+1;}),listeningUnchanged:!document.querySelector('[data-starter-house-sign=listening] [data-starter-arched-plaque]')&&!document.querySelector('[data-starter-house-sign=listening] .starter-house-title-arc')};})()`);
 const layout=async()=>evaluate(`(()=>{const frame=document.querySelector('.starter-scene-viewport');return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,lawns:[...document.querySelectorAll('[data-starter-list]')].map(list=>{const box=list.getBoundingClientRect();const visible=[...list.querySelectorAll('li')].filter(li=>{const r=li.getBoundingClientRect();return r.top>=box.top-1&&r.bottom<=box.bottom+1;}).length;return {paper:list.dataset.starterList,height:box.height,visible,total:list.querySelectorAll('li').length,scrollable:list.scrollHeight>list.clientHeight,withinScene:list.offsetParent.className};})};})()`);
 for(const width of [1440,1280,1024,390,320]){
  await viewport(width);if(width<1280)await click('Listening','#starter-scene-page');
  const title=await titleFit();assert(Math.abs(title.ratio-.9)<.001&&Math.abs(title.preRatio-.9)<.001&&title.preLeft>=.12&&title.preRight<=.88&&title.preTop>=.32&&title.preBottom<=.76&&title.preCenter>.5&&title.preCenter<.56&&title.titleFits&&title.accessible,'Title stays at 90% and the smaller right-shifted Pre A1 fits inside the wooden face at '+width+': '+JSON.stringify(title));reports['titleFit'+width]=title;
  const nav=await navState();assert(nav.toolbarRemoved&&nav.links.length===3&&nav.links.every(l=>l.correctHref&&l.accessible&&l.withinViewport&&l.touch&&l.labelFits&&l.font.includes('Baloo 2')&&l.underline==='none'&&l.contrast>=4.5),'Three wood-sign controls stay usable and legible at '+width+': '+JSON.stringify(nav));reports['navigation'+width]=nav;
  const numbers=await evaluate(`(()=>{const link=document.querySelector('[data-starter-link=listening]'),number=link.querySelector('.starter-lesson-number'),old=number.textContent,oldDigits=number.dataset.digits;try{return ['12','123','1000'].map(text=>{number.textContent=text;number.dataset.digits=String(text.length);return {text,fits:number.getBoundingClientRect().width<=link.clientWidth*.11};});}finally{number.textContent=old;number.dataset.digits=oldDigits;}})()`);assert(numbers.every(number=>number.fits),'Two/three/four-digit numbering fits its badge at '+width+': '+JSON.stringify(numbers));reports['numbers'+width]=numbers;
  const lawnBounds=await evaluate(`(()=>{const scene=document.querySelector('.starter-scene-canvas').getBoundingClientRect();return [...document.querySelectorAll('[data-starter-list]')].map(e=>{const r=e.getBoundingClientRect();return {paper:e.dataset.starterList,top:(r.top-scene.top)/scene.height,bottom:(r.bottom-scene.top)/scene.height,width:r.width,row:e.querySelector('li').clientHeight};});})()`);
  assert(lawnBounds.every(l=>l.top>=.469&&l.bottom<=.865&&(width<768?Math.abs(l.width-(width-48))<1&&l.row===44:l.row>=50&&l.row<=70)),'Five-card groups remain in the upper lawn before the foreground at '+width+': '+JSON.stringify(lawnBounds));reports['lawnBounds'+width]=lawnBounds;
  const result=await layout();assert(!result.overflow,'Document overflow at '+width);assert(result.lawns.every(lawn=>lawn.visible===5&&lawn.total===31&&lawn.scrollable),'Exactly five visible actual links at '+width+': '+JSON.stringify(result));const houses=await houseLayout();assert(houses.length===2&&houses.every(h=>h.onCanvas&&h.emblem&&h.labelFits&&Math.abs(h.width-(h.paper==='listening'?.079:.112))<.002&&Math.abs(h.left-(h.paper==='listening'?.337:.778))<.002&&Math.abs(h.top-(h.paper==='listening'?.286:.30))<.002),'Smaller signs follow the two house facades without clipping at '+width+': '+JSON.stringify(houses));reports['houses'+width]=houses;reports['layout'+width]=result;screenshots['listening'+width]=await shot('starter-listening-'+width);
  const arch=await houseArch();assert(arch.marked&&arch.woodRise>=12&&arch.woodRise<=14&&arch.accessible&&arch.count===17&&arch.lettersCurved&&arch.lettersFit&&arch.listeningUnchanged,'Reading & Writing wood and accessible lettering form a gentle fitted arch at '+width+': '+JSON.stringify(arch));reports['houseArch'+width]=arch;
  if(width<=390){await click('Reading & Writing','#starter-scene-page');await wait("document.querySelector('.starter-scene-viewport').scrollLeft>600");assert(await evaluate("(()=>{const l=document.querySelector('[data-starter-list=reading-writing]').getBoundingClientRect();return l.left>=0&&l.right<=innerWidth;})()"),'Right yard fits mobile');screenshots['reading'+width]=await shot('starter-reading-'+width);}
 }
 await viewport(1440);
 reports.compact=await evaluate("(()=>{const scene=document.querySelector('.starter-scene-canvas');return [...document.querySelectorAll('.starter-lawn')].map(e=>({paper:e.dataset.starterLawn,width:e.clientWidth/scene.clientWidth,top:parseFloat(getComputedStyle(e).top)/scene.clientHeight,row:e.querySelector('li').clientHeight}));})()");
 assert(reports.compact.every(l=>Math.abs(l.width-.305)<.002&&l.row>=50&&l.row<=70&&Math.abs(l.top-(l.paper==='listening'?.47:.48))<.002),'Both desktop lists use smaller dimensions and the higher lawn anchors');
 for(const paper of ['listening','reading-writing']){
  const point=await evaluate(`(()=>{const r=document.querySelector('[data-starter-list=${paper}]').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseWheel',deltaX:0,deltaY:180,...point});await delay(400);
  assert(await evaluate(`document.querySelector('[data-starter-list=${paper}]').scrollTop>0`),'Mouse wheel scrolls '+paper);
  await evaluate(`document.querySelector('[data-starter-list=${paper}]').scrollTop=document.querySelector('[data-starter-list=${paper}]').scrollHeight`);await delay(200);
  assert(await evaluate(`(()=>{const l=document.querySelector('[data-starter-list=${paper}]'),r=l.querySelector('li:last-child').getBoundingClientRect(),b=l.getBoundingClientRect();return r.bottom<=b.bottom+1&&r.top>=b.top;})()`),'Scroll reaches final actual entry on '+paper);
  await evaluate(`document.querySelector('[data-starter-list=${paper}]').scrollTop=0`);reports['scroll-'+paper]={wheel:true,last:true};
 }
 await goto('/exams/starter?preview=links');await wait("document.querySelectorAll('[data-starter-link=listening]').length===31");assert(await evaluate("!document.querySelector('[data-starter-preview]')&&[...document.querySelectorAll('[data-starter-link]')].every(e=>!e.getAttribute('href').startsWith('#'))"),'Production build ignores development preview and retains actual published links');reports.productionPreviewDisabled=true;
 await evaluate("document.querySelector('[data-starter-nav=home]').focus()");await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 assert(await evaluate("document.activeElement.getAttribute('href')==='/exams/mover'&&getComputedStyle(document.activeElement).outlineWidth==='3px'"),'Keyboard navigation and focus ring');reports.keyboardFocus=true;
 for(const width of [1440,390]){
  await viewport(width);
  for(const action of [{id:'next',path:'/exams/mover',target:"document.querySelector('#starter-scene-page[data-listening-module=mover][data-scene-yards=\"2\"]')"},{id:'history',path:'/history',target:"document.querySelector('#student-history-page')"},{id:'home',path:'/',target:"document.querySelector('#admin-mode-banner')"}]){
   await goto('/exams/starter');await wait("document.querySelector('[data-starter-nav=home]')");
   if(action.id==='history'){await evaluate("document.querySelector('[data-starter-nav=history]').focus()");await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});}else await navClick(action.id);
   await wait(`location.pathname===${JSON.stringify(action.path)}&&Boolean(${action.target})`);
   // B's fixed local QA identity is staff: its home is the dashboard, with the existing student-view action.
   if(action.id==='home'){await evaluate("document.querySelector('#view-student-page-btn').click()");await wait("document.querySelector('#app-root')");}
  }
 }
 reports.navigationDestinations={home:true,mover:true,history:true,desktop:true,mobile:true};
 await goto('/exams/starter');await wait("document.querySelector('[data-starter-link=listening]')");
 await evaluate("document.querySelector('[data-starter-link=listening]').focus()");await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await wait("document.querySelector('#generic-exam-player')");assert(await evaluate("location.pathname.includes('/exams/starter/listening/qa-listening-1')"),'Keyboard hotspot opens unchanged listening player');reports.playerListening=true;
 await verifyStarterPlayer({cdp,evaluate,wait,click,goto,shot,viewport,reports,screenshots});
 await goto('/exams/starter');await wait("document.querySelector('[data-starter-link=reading-writing]')");await evaluate("document.querySelector('[data-starter-link=reading-writing]').click()");await wait("document.querySelector('#generic-exam-player')");reports.playerReading=true;
 await goto('/admin');await wait("document.querySelector('#tab-listening-library')");await evaluate("document.querySelector('#tab-listening-library').click()");await wait("document.querySelector('[data-exam-module-quick-link=starter]')");await evaluate("document.querySelector('[data-exam-module-quick-link=starter]').click()");await click('Danh sách link học sinh','#exam-module-admin-hub');await wait("document.querySelectorAll('[data-starter-admin-row]').length===31");
 const removeLast=async()=>evaluate("document.querySelector('[data-starter-admin-row]:last-child button[aria-label^=\"Xóa link\"]').click()");
 for(let i=0;i<6;i++)await removeLast();await wait("document.querySelectorAll('[data-starter-admin-row]').length===25");
 const beforeEscape=await evaluate("(()=>{const d=document.querySelector('#starter-scene-admin');window.starterQaCancel=[];d.addEventListener('cancel',e=>queueMicrotask(()=>window.starterQaCancel.push({prevented:e.defaultPrevented,cancelable:e.cancelable,type:e.type})));return {open:d.open,disabled:[...d.querySelectorAll('button')].find(b=>b.textContent==='Đóng').disabled};})()");
 await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await delay(100);const afterEscape=await evaluate("({open:document.querySelector('#starter-scene-admin')?.open||false,events:window.starterQaCancel})");assert(beforeEscape.disabled&&afterEscape.open,'Unsaved list survives Escape: '+JSON.stringify({beforeEscape,afterEscape}));reports.unsavedProtection=true;
 await evaluate("document.querySelector('[aria-label=\"Đưa link 2 lên\"]').click()");await click('Lưu danh sách','#starter-scene-admin');await wait("document.querySelector('#starter-scene-admin [role=status]')");
 let result=await publicApi();assert(result.papers.listening.links.length===25&&result.papers.listening.links[0].href.endsWith('qa-listening-2'),'25 links + reordered first saved through actual UI');
 await click('+ Thêm link','#starter-scene-admin');await evaluate("const s=document.querySelector('[data-starter-admin-row]:last-child select');s.value='qa-listening-26';s.dispatchEvent(new Event('change',{bubbles:true}))");await click('Lưu danh sách','#starter-scene-admin');await wait("document.querySelector('#starter-scene-admin [role=status]')");assert((await publicApi()).papers.listening.links.length===26,'UI add persists');
 await removeLast();await click('Lưu danh sách','#starter-scene-admin');await wait("document.querySelector('#starter-scene-admin [role=status]')");
 for(const width of [1440,390,320]){await viewport(width);assert(await evaluate("(()=>{const d=document.querySelector('#starter-scene-admin'),c=d.querySelector('.starter-admin-content'),f=d.querySelector('footer');c.scrollTop=0;return d.getBoundingClientRect().right<=innerWidth&&c.clientHeight>=300&&c.scrollWidth<=c.clientWidth+1&&c.getBoundingClientRect().bottom<=f.getBoundingClientRect().top+1;})()"),'Admin has usable scrolling area, no horizontal overflow and fixed footer at '+width);screenshots['admin'+width]=await shot('starter-admin-'+width);}
 reports.adminContrast=await controlContrast('#starter-scene-admin');assert(reports.adminContrast.every(item=>item.ratio>=4.5),'Admin contrast includes selected and disabled controls');
 await click('Đóng','#starter-scene-admin');await cdp.send('Page.reload');await wait("document.querySelector('#tab-listening-library')");await evaluate("document.querySelector('#tab-listening-library').click()");await wait("document.querySelector('[data-exam-module-quick-link=starter]')");await evaluate("document.querySelector('[data-exam-module-quick-link=starter]').click()");await click('Danh sách link học sinh','#exam-module-admin-hub');await wait("document.querySelectorAll('[data-starter-admin-row]').length===25");reports.admin={add:true,remove:true,reorder:true,persistedAfterReload:true};
 await click('Đóng','#starter-scene-admin');await goto('/exams/starter');await wait("document.querySelectorAll('[data-starter-link=listening]').length===25");await viewport(1440);screenshots.finalDesktop=await shot('starter-final-desktop');
 const scene=await api('/admin/starter-scene/listening');const original=scene.entries.map(({id,setId})=>({id,setId}));
 for(const count of [3,0]){const current=await api('/admin/starter-scene/listening');await api('/admin/starter-scene/listening','PUT',{baseRevision:current.revision,entries:original.slice(0,count)});await cdp.send('Page.reload');await wait(`document.querySelector('[data-starter-list=listening][aria-busy=false]')&&document.querySelectorAll('[data-starter-link=listening]').length===${count}`);if(count===0)assert(await evaluate("(()=>{const list=document.querySelector('[data-starter-list=listening]');return list.childElementCount===0&&list.textContent==='';})()"),'Empty list leaves the lawn blank after loading');assert((await publicApi()).papers.listening.links.length===count,'Actual '+count+' entries');screenshots['count'+count]=await shot('starter-count-'+count);}
 const current=await api('/admin/starter-scene/listening');await api('/admin/starter-scene/listening','PUT',{baseRevision:current.revision,entries:original});
 await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const f=window.fetch.bind(window);window.fetch=(u,o)=>String(u).endsWith('/starter-scene')?Promise.resolve(new Response(JSON.stringify({error:'QA unavailable'}),{status:503,headers:{'Content-Type':'application/json'}})):f(u,o);})()`});
 await cdp.send('Page.reload');await wait("document.querySelector('#starter-scene-page [role=alert]')?.textContent.includes('QA unavailable')");reports.errorVisible=true;
 const contrast=await evaluate(`(()=>{const lum=s=>s.match(/[0-9.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);return [...document.querySelectorAll('#starter-scene-page button')].filter(e=>e.getBoundingClientRect().width>0).map(e=>{const s=getComputedStyle(e),a=lum(s.color),b=lum(s.backgroundColor);return {text:e.textContent,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});})()`);
 assert(contrast.every(item=>item.ratio>=4.5),'Computed scene control contrast');reports.contrast=contrast;
 assert(browserErrors.length===0,'Browser exceptions '+JSON.stringify(browserErrors));
 mkdirSync('.data/starter-scene-verification',{recursive:true});writeFileSync('.data/starter-scene-verification/browser-report.json',JSON.stringify({passed:true,fixtureDb,origin,reports,screenshots,browserErrors},null,2));console.log(JSON.stringify({passed:true,screenshots,browserErrors:0}));cdp.close();
}
try{await main();}finally{chrome.kill();appServer.kill();frontend.closeAllConnections();frontend.close();}
