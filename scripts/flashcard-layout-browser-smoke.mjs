import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';

// Render the real game with the shipped global CSS, without auth/API writes or TTS calls.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flashcard-layout-qa-'));
const output = path.join(root, 'fixture.js');
const svg = (width, height) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#dbeafe"/><rect x="8" y="8" width="${width - 16}" height="${height - 16}" fill="none" stroke="#1e3a8a" stroke-width="8"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#172554" font-family="sans-serif" font-size="${Math.min(width, height) / 9}">Vocabulary picture</text></svg>`);
const base = { id: 'long', term: 'Can you tell me about yourself?', meaning: 'Bạn có thể giới thiệu về bản thân mình được không?', ipa: '/kæn juː tel miː əˈbaʊt jɔːˈself/', pos: 'Sentence', example: '', exampleMeaning: '', notes: '', displayOrder: 0 };
const cases = [
  { name: 'reported', item: { ...base, imageUrl: svg(640, 480) }, config: { front: 'term', back: 'meaning', imagePolicy: 'prompt' } },
  { name: 'portrait-both', item: { ...base, term: 'Please tell me about your family, your favourite school subjects and the things you enjoy doing with your friends after school.', meaning: 'Em hãy giới thiệu về gia đình, các môn học yêu thích và những điều em thích làm cùng bạn bè sau giờ học.', example: 'I enjoy learning new words and reading stories with my friends. '.repeat(6), exampleMeaning: 'Em thích học từ mới và đọc truyện cùng bạn bè. '.repeat(6), notes: 'Đọc rõ, nghỉ đúng dấu câu và giữ nhịp tự nhiên. '.repeat(10), imageUrl: svg(300, 900) }, config: { front: 'meaning', back: 'both', imagePolicy: 'answer' } },
  { name: 'wide', item: { ...base, term: 'When you travel to a new place, what do you like to learn about the people who live there?', imageUrl: svg(1200, 200) }, config: { front: 'term', back: 'term', imagePolicy: 'prompt' } },
  { name: 'unbroken', item: { ...base, term: 'Vocabulary'.repeat(24), meaning: 'Nội dung dài cần xuống dòng trong khung.', imageUrl: '' }, config: { front: 'term', back: 'meaning', imagePolicy: 'none' } },
  { name: 'broken-image', item: { ...base, imageUrl: '/missing-image.svg' }, config: { front: 'term', back: 'meaning', imagePolicy: 'prompt' } },
  { name: 'sound-answer', item: { ...base, imageUrl: svg(640, 640) }, config: { front: 'sound_only', back: 'both', imagePolicy: 'answer' } },
];
await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import FlashcardGame from './src/components/games/FlashcardGame';
import './src/components/games/VocabularyTheme.css';
const cases = ${JSON.stringify(cases)};
window.fixtureEvents = []; window.fixtureComplete = null;
function Fixture() {
  const [index, setIndex] = useState(0), [muted, setMuted] = useState(true), [random, setRandom] = useState(false), [fullscreen, setFullscreen] = useState(false);
  const config = useMemo(() => cases[index].config, [index]);
  const items = useMemo(() => [cases[index].item, {...cases[index].item,id:'short',term:'apple',meaning:'quả táo',ipa:'',imageUrl:'',example:'',exampleMeaning:'',notes:''}], [index]);
  window.setFixtureCase = setIndex;
  return <main id="student-area-root" data-vocab-theme="storybook"><div id="game-stage" className="p-6 md:p-8"><FlashcardGame items={items} config={config} onComplete={(...args)=>window.fixtureComplete=args} onAction={action=>window.fixtureEvents.push(action)} isMuted={muted} setIsMuted={setMuted} isRandomized={random} onToggleRandom={()=>setRandom(v=>!v)} isFullscreen={fullscreen} onToggleFullscreen={()=>setFullscreen(v=>!v)} /></div></main>;
}
createRoot(document.getElementById('fixture')).render(<Fixture/>);
` }, outfile: output, bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', external: ['/assets/*'], define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
const indexHtml = fs.readFileSync('dist/client/index.html', 'utf8');
const globalCss = indexHtml.match(/href="(\/assets\/[^" ]+\.css)"/)?.[1];
assert.ok(globalCss, 'Canonical build CSS is required');
const server = http.createServer((req, res) => {
  if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(fs.readFileSync(output)); }
  if (req.url === '/fixture.css' && fs.existsSync(path.join(root, 'fixture.css'))) { res.setHeader('Content-Type', 'text/css'); return res.end(fs.readFileSync(path.join(root, 'fixture.css'))); }
  // The app's optional remote font import can block module execution offline.
  // Exercise the shipped rules and system-font fallback without network latency.
  if (req.url === globalCss) { res.setHeader('Content-Type', 'text/css'); return res.end(fs.readFileSync(path.join('dist/client', globalCss), 'utf8').replace(/@import\s*(?:url\([^)]*\)|"[^"]*"|'[^']*')\s*;/g, '')); }
  if (req.url.startsWith('/assets/') && !req.url.includes('..')) { const file=path.join('public',req.url); if(fs.existsSync(file)) { res.setHeader('Content-Type',file.endsWith('.webp')?'image/webp':'font/ttf');return res.end(fs.readFileSync(file)); } }
  if (req.url !== '/') { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', 'text/html'); res.end(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${globalCss}">${fs.existsSync(path.join(root, 'fixture.css')) ? '<link rel="stylesheet" href="/fixture.css">' : ''}</head><body><div id="app-root"><div id="fixture"></div></div><script type="module" src="/fixture.js"></script></body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`, port = 10000 + Math.floor(Math.random() * 20000);
const chrome = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new','--disable-gpu','--no-sandbox','--no-first-run',`--remote-debugging-port=${port}`,`--user-data-dir=${path.join(root, 'profile')}`,'about:blank'], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket; const browserErrors = [], browserDiagnostics = [];
try {
  let tab; for (let n = 0; n < 200; n++) { try { tab = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); if (tab) break; } catch {} await delay(100); }
  assert.ok(tab, 'Chrome debugger did not start'); socket = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0; const requests = new Map();
  socket.onmessage = event => { const data = JSON.parse(event.data); if (!data.id) { if (data.method === 'Runtime.exceptionThrown') browserErrors.push(data.params.exceptionDetails); if (['Log.entryAdded','Network.loadingFailed'].includes(data.method)) browserDiagnostics.push(data.params); return; } const request = requests.get(data.id); if (!request) return; requests.delete(data.id); clearTimeout(request.timer); data.error ? request.reject(Error(data.error.message)) : request.resolve(data.result); };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence, timer = setTimeout(() => { requests.delete(id); reject(Error('CDP timeout: ' + method)); }, 15000); requests.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
  const wait = async expression => { for (let n = 0; n < 100; n++) { if (await evaluate(`Boolean(${expression})`)) return; await delay(80); } throw Error('UI timeout: ' + expression + '; ' + JSON.stringify({browserErrors,browserDiagnostics}) + '; ' + await evaluate('document.body.innerHTML.slice(0,1000)')); };
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable'); await send('Page.navigate',{url:origin}); await wait("document.querySelector('#flashcard-card-flipper')");
  const metrics = async () => evaluate(`(() => {
    const card=document.querySelector('#flashcard-card-flipper'), faces=[...card.children].filter(el=>el.classList.contains('backface-hidden'));
    return {width:innerWidth,cardHeight:card.offsetHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,faces:faces.map(face=>{
      const body=face.children[1],text=body.querySelector('h2'),img=body.querySelector('img');
      const textWidth=text?.clientWidth||0;
      return {height:face.clientHeight,scrollHeight:face.scrollHeight,bodyHeight:body.clientHeight,bodyScrollHeight:body.scrollHeight,fontSize:text?parseFloat(getComputedStyle(text).fontSize):null,textOverflow:text?text.scrollWidth>textWidth+1:false,bodyOverflow:body.scrollHeight>body.clientHeight+2,img:img?{width:parseFloat(getComputedStyle(img).width),height:parseFloat(getComputedStyle(img).height),naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,frameWidth:img.parentElement.clientWidth,frameHeight:img.parentElement.clientHeight}:null};
    })};
  })()`);
  const contrast = async () => evaluate(`(() => {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
    const rgba=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].map((v,i)=>i===3?v/255:v);};
    const blend=(fg,bg)=>fg.slice(0,3).map((v,i)=>v*fg[3]+bg[i]*(1-fg[3]));
    const background=el=>{const chain=[];for(let p=el;p;p=p.parentElement)chain.unshift(p);return chain.reduce((bg,p)=>blend(rgba(getComputedStyle(p).backgroundColor),bg),[255,255,255]);};
    const lum=color=>color.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    return [...document.querySelectorAll('#flashcard-game-root *')].filter(el=>[...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim())&&el.getBoundingClientRect().width>0).map(el=>{const s=getComputedStyle(el),bg=background(el);let gradients=[];for(let p=el;p;p=p.parentElement){gradients=getComputedStyle(p).backgroundImage.match(/rgba?\\([^)]+\\)/g)||[];if(gradients.length)break;}const backgrounds=gradients.length?gradients.map(c=>blend(rgba(c),bg)):[bg];const ratio=Math.min(...backgrounds.map(b=>{const a=lum(blend(rgba(s.color),b)),v=lum(b);return (Math.max(a,v)+.05)/(Math.min(a,v)+.05);}));return {text:el.textContent.trim().slice(0,45),fg:s.color,backgrounds,ratio};});
  })()`);
  const settle = async flipped => wait(`(()=>{const m=new DOMMatrix(getComputedStyle(document.querySelector('#flashcard-card-flipper')).transform);return Math.abs(m.m11-(${flipped ? -1 : 1}))<.001&&Math.abs(m.m13)<.001;})()`);
  const assertVisibleFace = async flipped => { const hit=await evaluate(`(()=>{const card=document.querySelector('#flashcard-card-flipper'),face=card.children[${flipped ? 1 : 0}],r=face.firstElementChild.getBoundingClientRect(),el=document.elementFromPoint(r.x+r.width/2,r.y+8);return {valid:face.contains(el),width:innerWidth,flipped:${flipped},rect:{x:r.x,y:r.y,width:r.width,height:r.height},hit:el?.outerHTML.slice(0,500),transform:getComputedStyle(card).transform};})()`); if(!hit.valid){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(root,'failed-hit.png'),Buffer.from(shot.data,'base64'));} assert.ok(hit.valid,'The correct face receives pointer input: '+JSON.stringify({...hit,screenshot:path.join(root,'failed-hit.png')})); };
  const shots = {}, reports = [];
  for (const width of [1440, 620, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 950, deviceScaleFactor: 1, mobile: width < 600 });
    for (let index = 0; index < cases.length; index++) {
      await evaluate(`window.setFixtureCase(${index})`); await delay(150); await wait("[...document.querySelectorAll('#flashcard-card-flipper img')].every(img=>img.complete)");
      await delay(100); await settle(false); const front = await metrics();
      assert.equal(front.overflow, false, `Page overflow: ${width}/${cases[index].name}`);
      for (const face of front.faces) { assert.ok(!face.bodyOverflow && !face.textOverflow && face.scrollHeight <= face.height + 2, `Clipped content: ${width}/${cases[index].name} ${JSON.stringify(face)}`); if (face.fontSize) assert.ok(face.fontSize >= 20 && face.fontSize <= 32, 'Readable reduced type size'); if (face.img) { const image=face.img; assert.ok(Math.abs(image.width/image.height-image.naturalWidth/image.naturalHeight)<.025,`Image aspect ratio: ${width}/${cases[index].name} ${JSON.stringify(image)}`); assert.ok(image.width<=image.frameWidth+1&&image.height<=image.frameHeight+1,'Image fits its natural-size frame'); } }
      await assertVisibleFace(false); const textContrast=await contrast(); for(const item of textContrast) assert.ok(item.ratio>=4.5,'Text contrast: '+JSON.stringify(item));
      await evaluate("document.querySelector('#flashcard-card-flipper').click()"); await settle(true); const back=await metrics(); await assertVisibleFace(true); assert.ok(await evaluate("Boolean(document.querySelector('#mark-known-btn'))"), 'Flip still reveals rating buttons'); assert.ok(!back.faces.some(f=>f.bodyOverflow),'Back content also fits'); reports.push({case:cases[index].name,width,front,back,minTextContrast:Math.min(...textContrast.map(item=>item.ratio))});
      assert.ok(await evaluate("document.querySelector('#premium-slider-controls').getBoundingClientRect().top>=document.querySelector('#flashcard-card-flipper').getBoundingClientRect().bottom"),'Controls remain below the card');
      if ([1440,620,390].includes(width) && ['reported','portrait-both'].includes(cases[index].name)) { if(cases[index].name==='reported'){await evaluate("document.querySelector('#flashcard-card-flipper').click()");await settle(false);} const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});const file=path.join(root,`${cases[index].name}-${width}.png`);fs.writeFileSync(file,Buffer.from(shot.data,'base64'));shots[cases[index].name+'-'+width]=file; }
    }
  }
  {
    await evaluate('window.setFixtureCase(0)'); await delay(100); await settle(false);
    await evaluate("document.querySelector('#premium-speak-btn').focus()");
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    const focus=await evaluate("(()=>{const el=document.activeElement,s=getComputedStyle(el);return{id:el.id,outline:s.outlineStyle,width:parseFloat(s.outlineWidth)};})()");
    assert.equal(focus.id,'premium-next-btn'); assert.ok(focus.outline==='solid'&&focus.width>=3,'Navigation has visible keyboard focus');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await wait("document.querySelector('.flashcard-text')?.textContent==='apple'");
    await evaluate("document.querySelector('#premium-prev-btn').click()"); await wait("document.querySelector('.flashcard-text')?.textContent===\"Can you tell me about yourself?\"");
    await evaluate("document.querySelector('#toggle-random').click();document.querySelector('#toggle-autonext').click()");
    assert.ok(await evaluate("['#toggle-random','#toggle-autonext'].every(s=>document.querySelector(s).getAttribute('aria-pressed')==='true')"),'Selected toggles remain available');
    await evaluate("document.querySelector('#toggle-random').click();document.querySelector('#toggle-autonext').click()");
    await evaluate('window.setFixtureCase(0)'); await delay(100); await settle(false); await evaluate("document.querySelector('#flashcard-card-flipper').click()"); await settle(true); await evaluate("document.querySelector('#mark-known-btn').click()"); await delay(150); await settle(false); await evaluate("document.querySelector('#flashcard-card-flipper').click()"); await settle(true); await evaluate("document.querySelector('#mark-unknown-btn').click()"); await delay(100);
    const completed=await evaluate('window.fixtureComplete'); assert.deepEqual(completed.slice(0,3),[50,1,1]); assert.equal(completed[3].answerDetails.length,2); assert.equal((await evaluate('window.fixtureEvents')).length,2);
    assert.equal(browserErrors.length,0,'No browser exceptions'); const report={passed:true,reports,shots,completion:completed.slice(0,3),keyboardFocus:focus,browserErrors};fs.mkdirSync('.data/flashcard-verification',{recursive:true});fs.writeFileSync('.data/flashcard-verification/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,cases:reports.length,shots,completion:report.completion,keyboardFocus:focus,minTextContrast:Math.min(...reports.map(r=>r.minTextContrast))}));
  }
} finally { socket?.close(); chrome.kill(); server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
