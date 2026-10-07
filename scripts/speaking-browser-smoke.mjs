import { controlMetricsExpression, exerciseStudentModuleTheme } from './student-module-theme-browser-checks.mjs';
import { exerciseSpeakingQueue } from './speaking-queue-browser-checks.mjs';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import http from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { exerciseProsodyReview } from './speaking-prosody-browser-checks.mjs';
import { exerciseRecordingPlayback } from './speaking-replay-browser-checks.mjs';
import { exerciseHomeLeaderboard } from './home-leaderboard-browser-checks.mjs';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = Number(process.env.CSS_QA_DEBUG_PORT || (10_000 + Math.floor(Math.random() * 20_000)));

const qaRoot = mkdtempSync(path.join(os.tmpdir(), 'vhomework-css-qa-'));
const profileDir = path.join(qaRoot, 'profile');
const screenshotDir = path.join(qaRoot, 'screenshots');
mkdirSync(profileDir, { recursive: true });
mkdirSync(screenshotDir, { recursive: true });

const fixtureRoot = path.join(qaRoot, 'fixture'), fixtureDb = path.join(fixtureRoot, 'app.sqlite');
const fixture = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/speaking-qa-fixture.ts'], { encoding: 'utf8', windowsHide: true, env: { ...process.env, NODE_ENV: 'test', SPEAKING_QA_FIXTURE: 'true', STORAGE_MODE: 'sqlite', SQLITE_DRIVER: 'better-sqlite3', SQLITE_DB_PATH: fixtureDb, SQLITE_ALLOW_CREATE: 'true', SQLITE_ALLOW_JSON_IMPORT: 'false' } });
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
    if(req.url.startsWith('/api/')||req.url.startsWith('/audio/')){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
      const headers={...req.headers};delete headers.host;delete headers['content-length'];
      const upstream=await fetch(backendOrigin+req.url,{method:req.method,headers,...(req.method==='GET'||req.method==='HEAD'?{}:{body})});
      const replyHeaders=Object.fromEntries(upstream.headers);delete replyHeaders['content-encoding'];delete replyHeaders['content-length'];res.writeHead(upstream.status,replyHeaders);res.end(Buffer.from(await upstream.arrayBuffer()));return;
    }
    const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname), target=path.resolve(clientRoot,'.'+route);
    if(target.startsWith(clientRoot+path.sep)&&existsSync(target)&&!route.endsWith('/')){
      const type=route.endsWith('.js')?'text/javascript':route.endsWith('.css')?'text/css':route.endsWith('.svg')?'image/svg+xml':route.endsWith('.png')?'image/png':'application/octet-stream';res.writeHead(200,{'Content-Type':type});res.end(readFileSync(target));return;
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
 for (let i=0;i<150;i++) { try { if ((await fetch(origin+'/api/speaking/capabilities')).ok) break; } catch {} if(i===149)throw Error(serverLogs.slice(-1500)); await delay(100); }
 const reports = {}, screenshots = {};
 const target=(await waitForDebugger()).find(t=>t.type==='page'&&t.url.startsWith(origin));
 const cdp=createCdpClient(target.webSocketDebuggerUrl); await cdp.ready;
 await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
 const evaluate=async expression=>{let r;try{r=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});}catch(e){throw Error(e.message+' evaluating '+expression.slice(0,250));}if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const wait=async expression=>{const until=Date.now()+30000;while(Date.now()<until){if(await evaluate(`Boolean(${expression})`))return;await delay(120);}throw Error(`UI timeout: ${expression}; ${await evaluate("document.body.innerText.slice(-1600)")}`);};
 const click=async(text,root='#speaking-admin')=>{const matches=`(b.textContent.trim()===${JSON.stringify(text)}||b.getAttribute('aria-label')===${JSON.stringify(text)})&&!b.disabled`;await wait(`[...document.querySelectorAll(${JSON.stringify(root+' button')})].some(b=>${matches})`);await evaluate(`[...document.querySelectorAll(${JSON.stringify(root+' button')})].find(b=>${matches}).click()`);await delay(120);};
 const field=async(label,value,root='#speaking-admin')=>{await evaluate(`(()=>{const l=[...document.querySelectorAll(${JSON.stringify(root+' label')})].find(l=>l.textContent.trim().startsWith(${JSON.stringify(label)}));if(!l)throw Error('Missing label '+${JSON.stringify(label)});const el=l.querySelector('input,select,textarea');Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await delay(120);};
 const viewport=async(width,height=900)=>{await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await delay(150);};
 const shot=async(name,root)=>{const clip=root?await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(root)}).getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()`):undefined;const r=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,...(clip?{clip,captureBeyondViewport:true}:{})});const file=path.join(screenshotDir,name+'.png');writeFileSync(file,Buffer.from(r.data,'base64'));return file;};
 const metrics=async(root)=>evaluate(controlMetricsExpression(root));

 const staffFetch=async(endpoint,method='GET',body)=>{const r=await fetch(origin+endpoint,{method,headers:{Authorization:'Bearer local-test-auth-bypass','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();assert(r.ok,'Fixture API '+endpoint+': '+JSON.stringify(data));return data;};

 await cdp.send('Page.navigate',{url:origin+'/admin'}); await wait("document.querySelector('#tab-speaking')"); await evaluate("document.querySelector('#tab-speaking').click()"); await wait("document.querySelector('#speaking-admin')");
 const beforeEditorTotal=(await staffFetch('/api/speaking/admin/lessons-page')).total;
 await click('Soạn bài'); await field('Tiêu đề','QA twelve speaking questions');
 await field('Dán danh sách',Array.from({length:12},()=>"What's your hobby?").join('\n')); await click('Thêm danh sách');
 await evaluate("document.querySelector('#speaking-admin form button[type=submit]').scrollIntoView({block:'center'})");
 await click('Lưu bản nháp'); await wait("document.querySelector('#speaking-admin [role=alert]')?.textContent.includes('Mục 1')");
 const draftError=await evaluate("(()=>{const el=document.querySelector('#speaking-admin [role=alert]'),r=el.getBoundingClientRect();return{text:el.textContent,y:r.y,bottom:r.bottom,viewport:innerHeight,visible:r.y>=0&&r.bottom<=innerHeight,items:document.querySelectorAll('.speaking-item-editor').length};})()");
 assert((await staffFetch('/api/speaking/admin/lessons-page')).total===beforeEditorTotal,'Invalid word-set save does not write a lesson');
 assert(draftError.visible&&draftError.items===12,'Invalid save feedback is visible beside the action without losing the twelve items: '+JSON.stringify(draftError));
 await field('Dạng bài','sentence'); await click('Lưu bản nháp'); await wait("document.querySelector('#speaking-admin [role=status]')?.textContent.includes('Đã lưu')");
 const savedDraft=(await staffFetch('/api/speaking/admin/lessons')).find(l=>l.title==='QA twelve speaking questions'); assert(savedDraft?.status==='draft'&&savedDraft.items.length===12,'Valid sentence-set save persists a draft');
 await click('Kho bài'); await wait("[...document.querySelectorAll('#speaking-admin article')].some(a=>a.textContent.includes('QA twelve speaking questions')&&a.textContent.includes('Bản nháp'))");
 await cdp.send('Page.reload'); await wait("document.querySelector('#tab-speaking')"); await evaluate("document.querySelector('#tab-speaking').click()"); await wait("[...document.querySelectorAll('#speaking-admin article')].some(a=>a.textContent.includes('QA twelve speaking questions'))");
 await evaluate("[...document.querySelectorAll('#speaking-admin article')].find(a=>a.textContent.includes('QA twelve speaking questions')).querySelector('button').click()"); await wait("document.querySelectorAll('#speaking-admin .speaking-item-editor').length===12");
 assert(await evaluate("[...document.querySelectorAll('#speaking-admin button')].find(b=>b.textContent.trim()==='Xuất bản')?.disabled===false"),'Saved draft can be published');
 reports.editorDraft={invalidErrorVisible:true,persistedAfterReload:true,items:12};
 await click('Bài mới');
 await click('Soạn bài'); await field('Tiêu đề','QA Browser created'); await field('Nội dung cần đọc','apple'); await click('Xuất bản'); await wait("document.querySelector('#speaking-admin [role=status]')?.textContent.includes('Đã xuất bản')");
 const directPublish=(await staffFetch('/api/speaking/admin/lessons')).filter(l=>l.title==='QA Browser created'); assert(directPublish.length===1&&directPublish[0].status==='published','New content is saved once and published without a separate save');
 assert(await evaluate("[...document.querySelectorAll('#speaking-admin button')].find(b=>b.textContent.trim()==='Xuất bản').disabled"),'Unchanged published content cannot be republished');
 await field('Nội dung cần đọc','banana'); await click('Xuất bản'); await wait("document.querySelector('#speaking-admin [role=status]')?.textContent.includes('Đã xuất bản')");
 const updatedPublish=(await staffFetch('/api/speaking/admin/lessons')).filter(l=>l.title==='QA Browser created'); assert(updatedPublish.length===1&&updatedPublish[0].id===directPublish[0].id&&updatedPublish[0].items[0].referenceText==='banana','Changed published content is saved and republished in the same lesson'); reports.directPublish=true;
 await viewport(1440); reports.adminDesktop=await metrics('#speaking-admin'); screenshots.adminDesktop=await shot('admin-desktop'); await viewport(390); reports.adminMobile=await metrics('#speaking-admin'); screenshots.adminMobile=await shot('admin-mobile');
 const vocabSource = await staffFetch('/api/vocab-sets','POST',{title:'QA B vocabulary source',description:'Fixture only',subject:'English',gradeLevel:'Lớp 3',visibility:'draft',ttsSettings:{autoGenerate:false,provider:'ai33',lang:'en-US',voice:'',speed:1},items:['truck','plane'].map((term,index)=>({id:'source-'+index,term,meaning:term,ipa:'',pos:'Noun',example:'',exampleMeaning:'',displayOrder:index,audioUrl:'/audio/speaking-fixture.wav',ttsLang:'en-US',ttsProvider:'ai33',ttsSpeed:1}))});
 const sourceBefore = (await staffFetch('/api/vocab-sets')).find(s=>s.id===vocabSource.id);
 await click('Bài mới'); await field('Tiêu đề','QA Browser transport set'); await field('Dán danh sách','car\nbus\ntrain'); await click('Thêm danh sách'); await wait("document.querySelectorAll('#speaking-admin .speaking-item-editor').length===3");
 await click('Chọn từ bộ từ vựng B'); await wait("document.querySelector('#speaking-admin').textContent.includes('Bộ từ vựng nguồn')"); await field('Bộ từ vựng nguồn',vocabSource.id); await click('Thêm từ của bộ đã chọn'); await wait("document.querySelectorAll('#speaking-admin .speaking-item-editor').length===5");
 assert(await evaluate("[...document.querySelectorAll('#speaking-admin button')].filter(b=>b.textContent.trim()==='Tạo audio mẫu').every(b=>b.disabled)"),'Missing B TTS credentials disable cloud sample generation');
 assert(await evaluate("document.querySelector('#speaking-admin').textContent.includes('Chưa cấu hình TTS của B')"),'Missing TTS is explicit, without generic 500');
 assert(await evaluate("[...document.querySelectorAll('#speaking-admin button')].some(b=>b.textContent.trim()==='Nghe mẫu trên thiết bị')"),'Device sample option is available for items without stored audio');
 await click('Lưu bản nháp'); await wait("document.querySelector('#speaking-admin [role=status]')?.textContent.includes('Đã lưu')"); await click('Xuất bản'); await wait("document.querySelector('#speaking-admin [role=status]')?.textContent.includes('Đã xuất bản')");
 const savedSet=(await staffFetch('/api/speaking/admin/lessons')).find(l=>l.title==='QA Browser transport set'); assert(savedSet.items.length===5&&savedSet.items[3].referenceText==='truck'&&savedSet.items[3].sampleAudioUrl==='/audio/speaking-fixture.wav','Bulk and B source import save per-item content/media');
 assert(JSON.stringify(sourceBefore)===JSON.stringify((await staffFetch('/api/vocab-sets')).find(s=>s.id===vocabSource.id)),'Speaking import preserves B vocabulary source');
 await viewport(1440); reports.setEditorDesktop=await metrics('#speaking-admin'); screenshots.setEditorDesktop=await shot('set-editor-desktop','#speaking-admin'); await viewport(390); reports.setEditorMobile=await metrics('#speaking-admin'); screenshots.setEditorMobile=await shot('set-editor-mobile','#speaking-admin');
 await click('Bài mới'); await field('Dạng bài','sentence'); await field('Tiêu đề','QA Browser sentence set'); await field('Dán danh sách','I go by bus.\nThis is my car.'); await click('Thêm danh sách'); await click('Lưu bản nháp'); await wait("document.querySelector('#speaking-admin [role=status]')?.textContent.includes('Đã lưu')"); await click('Xuất bản'); await wait("document.querySelector('#speaking-admin [role=status]')?.textContent.includes('Đã xuất bản')"); const savedSentences=(await staffFetch('/api/speaking/admin/lessons')).find(l=>l.title==='QA Browser sentence set'); assert(savedSentences.items.length===2&&savedSentences.maxSeconds===30,'Sentence set follows one-sentence-per-recording defaults');
 await click('Cấu hình dịch vụ'); await wait("document.querySelector('#speaking-admin').textContent.includes('AI nhận xét đã tắt')");
 reports.configMobile=await metrics('#speaking-admin'); screenshots.configMobile=await shot('config-mobile'); await viewport(1440); reports.configDesktop=await metrics('#speaking-admin'); screenshots.configDesktop=await shot('config-desktop'); await viewport(390);
 await click('Kết quả'); await wait("document.querySelector('#speaking-admin tbody tr')"); assert(await evaluate("[...document.querySelectorAll('#speaking-admin select')].every(s=>s.value==='')"),'Results filters default to all'); await click('Xem'); await wait("document.querySelector('.speaking-review details')"); await click('Nghe lại bản thu','.speaking-review'); await wait("document.querySelector('.speaking-review audio[src]')");
 reports.resultMobile=await metrics('#speaking-admin'); screenshots.resultMobile=await shot('result-mobile');
 await cdp.send('Page.navigate',{url:origin+'/speaking'}); await wait("document.querySelector('.speaking-lesson-card')");
 for(const width of [1440,390,320]){await viewport(width);reports['catalog'+width]=await metrics('#speaking-student');screenshots['catalog'+width]=await shot('speaking-catalog-'+width);}
 reports.studentTheme=await exerciseStudentModuleTheme({evaluate,cdp,root:'#speaking-student',assert});
 await evaluate("localStorage.setItem('speaking-microphone','qa-disconnected-input')");
 const microphoneScript=await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);window.qaDefaultMicro=original;window.qaMicroCalls=[];navigator.mediaDevices.getUserMedia=async constraints=>{const saved=constraints.audio?.deviceId?.exact;window.qaMicroCalls.push(saved?'saved':'default');if(saved==='qa-disconnected-input')throw new DOMException('Disconnected','OverconstrainedError');const stream=await original(constraints);window.qaCaptureStream=stream;return stream;};})()`});
 await viewport(1440); await cdp.send('Page.navigate',{url:origin+'/speaking/lesson/'+fixtureData.lessons[0].id}); await wait("document.querySelector('#speaking-student')"); await click('Bắt đầu lượt đọc','#speaking-student'); await wait("[...document.querySelectorAll('#speaking-student button')].some(b=>b.textContent.trim()==='Thu âm')");
 await evaluate("document.querySelector('#speaking-student audio').play()"); await click('Thu âm','#speaking-student'); await wait("document.querySelector('#speaking-student [role=status]')?.textContent.includes('Đang thu')"); assert(await evaluate("document.querySelector('#speaking-student audio').paused"),'Sample playback stops before recording');
 for(const width of [1440,390,320]){await viewport(width);await wait("Number(document.querySelector('[data-microphone-level]')?.dataset.microphoneLevel)>0");const bar=await evaluate("(()=>{const b=document.querySelector('.speaking-recording-bar'),s=b.querySelectorAll('.speaking-waveform line');return{width:b.clientWidth,inside:b.scrollWidth<=b.clientWidth+1,hiddenPicker:!document.querySelector('.speaking-microphone select'),realWave:[...s].some(l=>Number(l.getAttribute('y2'))-Number(l.getAttribute('y1'))>3),buttons:[...b.querySelectorAll('button')].map(b=>({label:b.getAttribute('aria-label'),width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height}))}})()");assert(bar.inside&&bar.hiddenPicker&&bar.realWave&&bar.buttons.every(b=>b.width>=44&&b.height>=44),'Compact recording bar is real and accessible at '+width);reports['recordingBar'+width]={...await metrics('#speaking-student'),bar};screenshots['recordingBar'+width]=await shot('recording-bar-'+width,'#speaking-student');}
 assert(await evaluate("window.qaMicroCalls.join(',')==='saved,default'&&!localStorage.getItem('speaking-microphone')"),'Disconnected saved microphone automatically recovers with OS default');reports.microphoneFallback=true;
 await click('Hủy bản thu','#speaking-student');await wait("!document.querySelector('.speaking-recording-bar')");assert(await evaluate("!document.querySelector('#speaking-student a[download]')&&!document.querySelector('#speaking-student [role=alert]')&&window.qaCaptureStream.getTracks().every(t=>t.readyState==='ended')"),'Cancel discards without uploading or creating a WAV and releases the microphone');
 await evaluate("navigator.mediaDevices.getUserMedia=window.qaDefaultMicro");await cdp.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:microphoneScript.identifier});
 await viewport(1440);await click('Thu âm','#speaking-student');await delay(1500);await click('Dừng thu','#speaking-student'); await wait("document.querySelector('#speaking-student a[download]')");
 assert(await evaluate("[...document.querySelectorAll('#speaking-student button')].find(b=>b.textContent.trim()==='Gửi chấm').disabled"),'No credentials disables paid assessment');
 const audioInfo=await evaluate("(async()=>{const blob=await (await fetch(document.querySelector('#speaking-student a[download]').href)).blob();const ctx=new AudioContext();const buffer=await ctx.decodeAudioData(await blob.arrayBuffer());await ctx.close();return{type:blob.type,size:blob.size,seconds:buffer.duration,channels:buffer.numberOfChannels};})()"); assert(audioInfo.type==='audio/wav'&&audioInfo.channels===1&&audioInfo.seconds>=.2&&audioInfo.seconds<=8.1,'AudioWorklet produces bounded mono WAV'); reports.audio=audioInfo;
 reports.studentDesktop=await metrics('#speaking-student'); screenshots.studentDesktop=await shot('student-desktop'); await viewport(390); reports.studentMobile=await metrics('#speaking-student'); screenshots.studentMobile=await shot('student-mobile');
 await evaluate("document.querySelector('#speaking-student button:not(:disabled)').focus()"); await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9}); await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9}); const focus=await evaluate("(()=>{const s=getComputedStyle(document.activeElement);return{tag:document.activeElement.tagName,outline:s.outlineStyle,width:s.outlineWidth}})()"); assert(focus.outline==='solid'&&parseFloat(focus.width)>=3,'Keyboard focus is visible'); reports.keyboardFocus=focus;
 await click('Bỏ bản thu','#speaking-student');
 for (const item of fixtureData.lessons.filter(l=>l.kind!=='word')) { await cdp.send('Page.navigate',{url:origin+'/speaking/lesson/'+item.id}); await wait("document.querySelector('#speaking-student .speaking-reference')"); assert(await evaluate("document.querySelector('#speaking-student .speaking-reference').textContent.length>0"),'Each lesson kind renders'); }
 const partialSet = fixtureData.sets.find(s=>s.title.includes('progress'));
 const expiredItem=await staffFetch('/api/speaking/attempts/'+fixtureData.expiredItem.attemptId);assert(expiredItem.recordingAllowed===false,'Real expired fixture is rejected by the server clock');
 await cdp.send('Page.navigate',{url:origin+'/speaking/lesson/'+partialSet.id}); await wait("document.querySelector('#speaking-student .speaking-reference')?.textContent==='car'"); assert(await evaluate("document.querySelector('#speaking-student').textContent.includes('Đã chấm 1/3 mục')"),'Stored set resumes at the first ungraded item');
 assert(await evaluate("document.querySelectorAll('[data-reading-card]').length===1&&!document.querySelector('#speaking-student .speaking-item-nav')"),'Only the current flashcard is displayed; no grid of all words');
 assert(await evaluate("![...document.querySelectorAll('#speaking-student button')].some(b=>b.textContent==='Đọc lượt mới')&&!document.querySelector('#speaking-student').textContent.includes('24 giờ')"),'Expired restore does not require a manual reset');
 await click('Thu âm','#speaking-student'); await wait("[...document.querySelectorAll('#speaking-student [role=status]')].some(p=>p.textContent.includes('Đang thu'))"); assert(await evaluate("[...document.querySelectorAll('#speaking-student button')].find(b=>b.textContent.trim()==='Mục tiếp theo').disabled"),'Item navigation locks during recording');
 const renewedSet=await staffFetch('/api/speaking/sessions/'+partialSet.sessionId),renewedItem=renewedSet.items.find(i=>i.item.id===fixtureData.expiredItem.itemId).attempt;
 assert(renewedItem.id!==expiredItem.id&&renewedItem.recordingAllowed===true&&renewedSet.completedCount===1&&renewedSet.items[0].score===88,'One Thu âm renews only the expired item and retains the scored item');
 await delay(1100); await click('Dừng thu','#speaking-student'); await wait("document.querySelector('#speaking-student a[download]')");
 assert(await evaluate("[...document.querySelectorAll('#speaking-student button')].find(b=>b.textContent.trim()==='Mục tiếp theo').disabled"),'Unsent recording is protected during navigation'); await click('Bỏ bản thu','#speaking-student'); await click('Mục trước','#speaking-student'); await wait("document.querySelector('#speaking-student .speaking-reference')?.textContent==='apple'"); await click('Mục tiếp theo','#speaking-student'); await wait("document.querySelector('#speaking-student .speaking-reference')?.textContent==='car'");
 await evaluate("window.qaRealNow=Date.now;Date.now=()=>window.qaRealNow()+2*86400000");await click('Mục tiếp theo','#speaking-student');await click('Mục trước','#speaking-student');
 assert(await evaluate("!document.querySelector('#speaking-student').textContent.includes('24 giờ')&&!document.querySelector('#speaking-student [role=alert]')"),'Client clock ahead does not falsely expire the valid server attempt');
 await click('Thu âm','#speaking-student');await wait("[...document.querySelectorAll('#speaking-student [role=status]')].some(p=>p.textContent.includes('Đang thu'))");
 const reusedSet=await staffFetch('/api/speaking/sessions/'+partialSet.sessionId);assert(reusedSet.items.find(i=>i.item.id===fixtureData.expiredItem.itemId).attempt.id===renewedItem.id,'Repeat recording reuses the valid renewed attempt');
 await delay(1100);await click('Dừng thu','#speaking-student');await wait("document.querySelector('#speaking-student a[download]')");await click('Bỏ bản thu','#speaking-student');await evaluate("Date.now=window.qaRealNow");
 reports.attemptRenewal={expiredItemRenewed:true,manualResetRequired:false,validItemReused:true,clientClockAhead:true,scoredItemPreserved:true};
 await viewport(1440); reports.setStudentDesktop=await metrics('#speaking-student'); screenshots.setStudentDesktop=await shot('set-student-desktop','#speaking-student'); await viewport(390); reports.setStudentMobile=await metrics('#speaking-student'); screenshots.setStudentMobile=await shot('set-student-mobile','#speaking-student');
 reports.durableQueue=await exerciseSpeakingQueue({evaluate,wait,click,partialSet,shot});
 // The long sentence uses the actual authoring/reader path and intrinsic card layout.
 const longSentence='Can you tell me about yourself, your school, your favourite subjects and the things you enjoy doing with your friends after school?';
 const longDraft=await staffFetch('/api/speaking/admin/lessons','POST',{title:'QA Flashcard long sentence',kind:'sentence',grade:3,locale:'en-US',provider:'azure',maxSeconds:30,partnerText:'',instructions:'',sampleAudioUrl:'',samplePlaybackRate:1,feedbackEnabled:false,items:[{referenceText:longSentence,sampleAudioUrl:'',samplePlaybackRate:1},{referenceText:'Next short sentence.',sampleAudioUrl:'',samplePlaybackRate:1}]});
 await staffFetch('/api/speaking/admin/lessons/'+longDraft.id+'/publish','POST',{revision:longDraft.revision});
 await cdp.send('Page.navigate',{url:origin+'/speaking/lesson/'+longDraft.id});await click('Bắt đầu bộ luyện đọc','#speaking-student');await wait("document.querySelector('[data-reading-card]')");
 const sample=await evaluate("(()=>{const b=document.querySelector('button[aria-label=\"Nghe phát âm mẫu\"]'),s=window.speechSynthesis,original=s.speak;s.speak=u=>{window.qaSample={text:u.text,lang:u.lang}};b.click();s.speak=original;return{icon:!!b.querySelector('svg'),text:b.textContent,spoken:window.qaSample,hiddenExplanation:!document.querySelector('.speaking-device-sample p')};})()");assert(sample.icon&&!sample.text&&sample.hiddenExplanation&&sample.spoken?.text===longSentence&&sample.spoken?.lang==='en-US','Speaker icon reads the current sentence in the lesson locale');reports.sampleIcon=sample;
 for(const width of [1440,390,320]){await viewport(width);const layout=await evaluate("(()=>{const card=document.querySelector('[data-reading-card]'),text=card.querySelector('.speaking-reference'),r=card.getBoundingClientRect(),t=text.getBoundingClientRect();return{one:document.querySelectorAll('[data-reading-card]').length===1,inside:t.top>=r.top&&t.bottom<=r.bottom&&text.scrollWidth<=text.clientWidth+1,font:parseFloat(getComputedStyle(text).fontSize),cardHeight:r.height};})()");assert(layout.one&&layout.inside&&layout.font<=32,'Flashcard fits long content at '+width);reports['flashcard'+width]={...await metrics('#speaking-student'),layout};screenshots['flashcard'+width]=await shot('flashcard-long-'+width,'#speaking-student');}
 await click('Mục tiếp theo','#speaking-student');assert(await evaluate("document.querySelector('.speaking-reference').textContent==='Next short sentence.'"),'Next moves to exactly one new card');await click('Mục trước','#speaking-student');assert(await evaluate(`document.querySelector('.speaking-reference').textContent===${JSON.stringify(longSentence)}`),'Previous restores the prior card');
 await cdp.send('Page.navigate',{url:origin+'/speaking/lesson/'+partialSet.id});await wait("document.querySelector('.speaking-reference')?.textContent==='car'");
 const oldLesson=await staffFetch('/api/speaking/admin/lessons'); const editingLesson=oldLesson.find(l=>l.id===partialSet.id); await staffFetch('/api/speaking/admin/lessons/'+partialSet.id,'PUT',{...editingLesson,items:[{id:'1',referenceText:'plane',sampleAudioUrl:'',samplePlaybackRate:1}]});
 await cdp.send('Page.reload'); await wait("document.querySelector('#speaking-student .speaking-reference')?.textContent==='car'"); assert(await evaluate("document.querySelector('#speaking-student').textContent.includes('Đã chấm 1/3 mục')"),'Reload preserves frozen server progress even when the teacher edits the lesson to draft'); reports.setResume=true;
 const completedSet=fixtureData.sets.find(s=>s.status==='completed'); await cdp.send('Page.navigate',{url:origin+'/speaking/lesson/'+completedSet.id}); await wait("document.querySelector('[aria-label=\"Kết quả bộ Speaking\"]')"); await click('Xem mục 2','.speaking-review'); await wait("[...document.querySelectorAll('.speaking-review h2')].some(h=>h.textContent==='Mục 2: bus')"); await click('Nghe lại bản thu','.speaking-review'); await wait("document.querySelector('.speaking-review audio[src]')");
 reports.setReviewMobile=await metrics('#speaking-student'); screenshots.setReviewMobile=await shot('set-review-mobile','#speaking-student'); await viewport(1440); reports.setReviewDesktop=await metrics('#speaking-student'); screenshots.setReviewDesktop=await shot('set-review-desktop','#speaking-student');
 await evaluate("(()=>{const input=document.querySelector('#speaking-student input[type=checkbox]');input.click();})()"); await click('Luyện lại mục được chọn','#speaking-student'); await wait("document.querySelector('#speaking-student .speaking-reference')?.textContent==='apple'"); assert(await evaluate("document.querySelector('#speaking-student').textContent.includes('Đã chấm 0/1 mục')"),'Selected-item practice opens a separate set'); const oldSet=await staffFetch('/api/speaking/admin/results/'+completedSet.sessionId); assert(oldSet.status==='completed'&&oldSet.completedCount===3,'Completed set remains immutable after selected practice'); reports.selectedPractice=true;
 await cdp.send('Page.navigate',{url:origin+'/history'}); await wait("document.body.innerText.includes('QA Speaking word')"); const detailButton=await evaluate("[...document.querySelectorAll('button')].find(b=>/chi tiết/i.test(b.textContent))?.textContent.trim()"); if(!detailButton)throw Error('History detail button missing'); await click(detailButton,'body'); await wait("document.querySelector('.speaking-review details')"); reports.history=await metrics('.speaking-review'); screenshots.history=await shot('history-review');
 // Browser-only provider responses exercise automatic upload without paid calls.
 // Real signed upload/persistence/provider jobs are covered by the HTTP/service tests.
 const fixtureResult=await staffFetch('/api/speaking/admin/results/'+fixtureData.attemptId);
 const replayChecks=await exerciseRecordingPlayback({cdp,origin,evaluate,click,wait,viewport,shot,assert,completedSet});reports.recordingReplay=replayChecks.report;Object.assign(screenshots,replayChecks.screenshots);
 const homeChecks=await exerciseHomeLeaderboard({cdp,origin,evaluate,wait,viewport,metrics,shot,assert,names:fixtureData.leaderboardNames});Object.assign(reports,homeChecks.reports);Object.assign(screenshots,homeChecks.screenshots);
 const prosodyChecks=await exerciseProsodyReview({cdp,origin,evaluate,click,wait,viewport,metrics,shot,assert,fixtureResult});Object.assign(reports,prosodyChecks.reports);Object.assign(screenshots,prosodyChecks.screenshots);
 await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
   const realFetch=window.fetch.bind(window);window.qaAudioPosts=0;window.qaRejectUpload=true;window.qaAccepted=false;window.qaPayloads=[];
   window.fetch=async(input,init)=>{
     const url=String(input),json=data=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
     if(url.endsWith('/api/speaking/capabilities')){const r=await realFetch(input,init),data=await r.json();data.providers=data.providers.map(p=>({...p,configured:true}));return json(data);}
     if(/\\/api\\/speaking\\/attempts\\/[^/]+\\/audio$/.test(url)){
       window.qaAudioPosts++;const bytes=await init.body.arrayBuffer(),view=new DataView(bytes);let power=0,peak=0;for(let i=44;i<bytes.byteLength;i+=2){const n=view.getInt16(i,true)/32768;power+=n*n;peak=Math.max(peak,Math.abs(n));}
       window.qaPayloads.push({size:init.body.size,type:init.body.type,ticket:Boolean(init.headers['X-Attempt-Ticket']),rms:Math.sqrt(power/((bytes.byteLength-44)/2)),peak,seconds:(bytes.byteLength-44)/32000});
       if(window.qaRejectUpload){window.qaRejectUpload=false;return new Response(JSON.stringify({error:'Mạng kiểm thử bị ngắt'}),{status:503,headers:{'Content-Type':'application/json'}});}
       window.qaAccepted=true;return json({...window.qaAttempt,status:'queued'});
     }
     if(/\\/api\\/speaking\\/attempts\\/[^/]+$/.test(url)&&window.qaAccepted&&url.endsWith('/'+window.qaAttempt.id))return json({...window.qaAttempt,status:'completed',assessment:${JSON.stringify(fixtureResult.assessment)},feedbackState:'disabled',audioAvailable:false});
     const r=await realFetch(input,init);
     if(url.endsWith('/api/speaking/attempts/prepare')||/\\/api\\/speaking\\/attempts\\/[^/]+$/.test(url)){const data=await r.clone().json();if(data.id&&data.lesson){window.qaAttempt=data;window.qaAccepted=false;}}
     return r;
   };
 })()`});
 await cdp.send('Page.navigate',{url:origin+'/speaking/lesson/'+fixtureData.lessons[0].id});await click('Thu âm','#speaking-student');await delay(800);
 await evaluate("(()=>{const stop=document.querySelector('button[aria-label=\"Dừng thu\"]'),cancel=document.querySelector('button[aria-label=\"Hủy bản thu\"]');stop.click();cancel.click();})()");await delay(1500);assert(await evaluate("window.qaAudioPosts===0&&!document.querySelector('a[download]')"),'Cancel during pending flush never uploads even with assessment enabled');
 await click('Thu âm','#speaking-student');await delay(1200);await click('Gửi bản thu','#speaking-student');
 await wait("document.querySelector('#speaking-student [role=alert]')?.textContent.includes('Mạng kiểm thử')");
 assert(await evaluate("window.qaAudioPosts===1&&Boolean(document.querySelector('a[download]'))"),'Stopping auto-uploads once and preserves WAV on network failure');
 await delay(2300);assert(await evaluate("window.qaAudioPosts===1"),'Failed upload never retries automatically');
 assert(await evaluate("[...document.querySelectorAll('#speaking-student button')].find(b=>b.textContent==='Trang chủ').disabled"),'Unsent recording guards navigation');
 await evaluate("(()=>{const b=[...document.querySelectorAll('#speaking-student button')].find(b=>b.textContent==='Gửi lại bản thu');b.click();b.click();})()");await wait("[...document.querySelectorAll('#speaking-student [role=status]')].some(p=>p.textContent.includes('Đã nhận bản thu'))");
 assert(await evaluate("![...document.querySelectorAll('#speaking-student button')].find(b=>b.textContent==='Trang chủ').disabled&&!document.querySelector('a[download]')"),'Accepted recording can safely leave while the durable job grades');await wait("document.querySelector('.speaking-turn .speaking-score')");
 assert(await evaluate("window.qaAudioPosts===2&&window.qaPayloads.every(p=>p.size>44&&p.type==='audio/wav'&&p.ticket)"),'Explicit double-click retry sends only one signed WAV');
 await click('Đọc lượt mới','#speaking-student');await click('Bắt đầu lượt đọc','#speaking-student');await click('Thu âm','#speaking-student');
 await wait("window.qaAudioPosts===3");await wait("document.querySelector('.speaking-turn .speaking-score')");
 assert(await evaluate("window.qaAudioPosts===3&&!document.querySelector('a[download]')"),'Reaching the recording limit automatically sends exactly once and clears accepted bytes');
 reports.autoSend={manualStop:true,timeLimit:true,networkRetry:true,noDuplicate:true,leaveAfterAccepted:true,provider:'mock'};
 screenshots.autoScore=await shot('flashcard-auto-score','#speaking-student');
 await click('Đọc lượt mới','#speaking-student');await click('Bắt đầu lượt đọc','#speaking-student');
 await evaluate("window.qaRealMicro=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Fixture denied','NotAllowedError')}");await click('Thu âm','#speaking-student');await wait("document.querySelector('#speaking-student [role=alert]')?.textContent.includes('Chưa được phép dùng micro')");assert(await evaluate("window.qaAudioPosts===3"),'Denied microphone does not upload');
 await evaluate("navigator.mediaDevices.getUserMedia=async()=>{const ctx=new AudioContext(),gain=ctx.createGain(),out=ctx.createMediaStreamDestination();gain.gain.value=0;gain.connect(out);window.qaSilentContext=ctx;return out.stream}");await click('Thu âm','#speaking-student');await delay(1000);await click('Dừng thu','#speaking-student');await wait("document.querySelector('#speaking-student [role=alert]')?.textContent.includes('Không nghe rõ lời đọc')");assert(await evaluate("window.qaAudioPosts===3&&!document.querySelector('a[download]')"),'Silent recording never uploads');await evaluate("window.qaSilentContext.close();navigator.mediaDevices.getUserMedia=window.qaRealMicro");reports.autoSend.silenceRejected=true;reports.autoSend.permissionHandled=true;
 // A short quiet utterance through the real AudioWorklet/resampler surrounded
 // by silence used to fail both whole-recording energy gates. No paid API call.
 await evaluate("navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Fixture missing','NotFoundError')}");await click('Thu âm','#speaking-student');await wait("document.querySelector('#speaking-student [role=alert]')?.textContent.includes('cài đặt âm thanh')");assert(await evaluate("window.qaAudioPosts===3"),'Unavailable microphone gives device guidance without uploading');
 await evaluate("navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Fixture busy','NotReadableError')}");await click('Thu âm','#speaking-student');await wait("document.querySelector('#speaking-student [role=alert]')?.textContent.includes('Đóng ứng dụng khác')");assert(await evaluate("window.qaAudioPosts===3"),'Busy microphone gives recovery guidance without uploading');
 await evaluate(`navigator.mediaDevices.getUserMedia=async()=>{const ctx=new AudioContext(),osc=ctx.createOscillator(),gain=ctx.createGain(),out=ctx.createMediaStreamDestination();osc.frequency.value=440;gain.gain.setValueAtTime(0,ctx.currentTime);gain.gain.setValueAtTime(.0085,ctx.currentTime+.25);gain.gain.setValueAtTime(0,ctx.currentTime+.65);osc.connect(gain).connect(out);osc.start();await ctx.resume();window.qaQuietContext=ctx;return out.stream;}`);
 await click('Thu âm','#speaking-student');await wait("Number(document.querySelector('[data-microphone-level]')?.dataset.microphoneLevel)>0");assert(await evaluate("!document.querySelector('.speaking-microphone select')&&Boolean(document.querySelector('.speaking-waveform svg line'))"),'Microphone selection is hidden and live waveform replaces the meter');
 await delay(3700);await click('Dừng thu','#speaking-student');await wait("window.qaAudioPosts===4");await wait("document.querySelector('.speaking-turn .speaking-score')");
 assert(await evaluate("window.qaPayloads.at(-1).seconds>3&&window.qaPayloads.at(-1).rms<.002&&window.qaPayloads.at(-1).peak<.01"),'Manual stop accepts a real short low-gain phrase with surrounding silence');await evaluate("window.qaQuietContext.close()");
 await click('Đọc lượt mới','#speaking-student');await click('Bắt đầu lượt đọc','#speaking-student');await click('Thu âm','#speaking-student');await wait("window.qaAudioPosts===5");await wait("document.querySelector('.speaking-turn .speaking-score')");
 assert(await evaluate("window.qaPayloads.at(-1).seconds>=7&&window.qaPayloads.at(-1).rms<.002&&window.qaPayloads.at(-1).peak<.01"),'Time limit accepts the same short phrase without a duplicate upload');await evaluate("window.qaQuietContext.close();navigator.mediaDevices.getUserMedia=window.qaRealMicro");
 reports.audioSignal={quietPhraseManual:true,quietPhraseTimeout:true,meter:true,microphoneSelectionHidden:true,missingDeviceHandled:true,payloads:await evaluate('window.qaPayloads')};
 screenshots.microphone=await shot('microphone-short-phrase','#speaking-student');
 await cdp.send('Page.navigate',{url:origin+'/ioe-violympic'}); await wait("document.querySelector('#ioe-violympic-student')"); reports.legacyCompetition=true;
 for(const [name,report] of Object.entries(reports)){if(!report.controls)continue;assert(!report.overflow,'Unexpected overflow: '+name);for(const control of report.controls)assert(control.contrast>=4.5,'Low control contrast: '+name+' '+JSON.stringify(control));}
 assert(browserErrors.length===0,'Browser exceptions: '+JSON.stringify(browserErrors));
 mkdirSync('.data/speaking-verification',{recursive:true}); const report={passed:true,origin,fixtureDb,screenshots,reports,browserErrors};writeFileSync('.data/speaking-verification/browser-report.json',JSON.stringify(report,null,2));nodePrint(report);cdp.close();
}
function nodePrint(report){const controls=Object.values(report.reports).flatMap(r=>r.controls||[]);console.log(JSON.stringify({passed:report.passed,screenshots:report.screenshots,setResume:report.reports.setResume,selectedPractice:report.reports.selectedPractice,browserErrors:report.browserErrors.length,minContrast:Math.min(...controls.map(c=>c.contrast))}));}
try{await main();}finally{chrome.kill();appServer.kill();frontend.closeAllConnections();frontend.close();}
