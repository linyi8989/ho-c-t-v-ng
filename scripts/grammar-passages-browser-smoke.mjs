import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const origin = process.env.GRAMMAR_QA_ORIGIN || 'http://127.0.0.1:3187';
const qaUrl = new URL(origin);
if (!['localhost', '127.0.0.1'].includes(qaUrl.hostname) || !qaUrl.port || qaUrl.port === '3000') throw new Error('Use a dedicated loopback server with a copied database, never port 3000.');
const fixtures = JSON.parse(fs.readFileSync('.data/grammar-passages-qa/fixtures.json', 'utf8'));
const screenshots = path.resolve('.data/grammar-passages-qa/screenshots');
fs.mkdirSync(screenshots, { recursive: true });
const port = 11000 + Math.floor(Math.random() * 20000);
const chrome = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${port}`, `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'grammar-passages-chrome-'))}`, '--window-size=1440,1000', origin,
], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
const checks = [], shots = [], errors = [];
function note(value) { checks.push(value); console.log(value); }
try {
  let target;
  for (let count = 0; count < 150 && !target; count++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(tab => tab.type === 'page'); } catch { /* Chrome starting. */ }
    if (!target) await delay(100);
  }
  assert.ok(target, 'Chrome debug target starts');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let nextId = 1; const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Page.javascriptDialogOpening') { socket.send(JSON.stringify({ id: nextId++, method: 'Page.handleJavaScriptDialog', params: { accept: true } })); return; }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (!message.id || !pending.has(message.id)) return;
    const request = pending.get(message.id); pending.delete(message.id); clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout ${method}`)); }, 25000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
  const wait = async expression => { for (let count = 0; count < 200; count++) { if (await evaluate(`Boolean(${expression})`)) return; await delay(100); } throw new Error(`Timeout: ${expression}; ${await evaluate('document.body.innerText.slice(-1000)')}`); };
  const click = async selector => { await wait(`document.querySelector(${JSON.stringify(selector)}) && !document.querySelector(${JSON.stringify(selector)}).disabled`); await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); await delay(50); };
  const button = async text => { await wait(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)}&&!e.disabled); if(!b)return false;b.click();return true;})()`); await delay(80); };
  const navigate = async pathname => { await send('Page.navigate', { url: origin + pathname }); await delay(100); };
  const viewport = async width => { await send('Emulation.setDeviceMetricsOverride', { width, height: width < 640 ? 900 : 1050, deviceScaleFactor: 1, mobile: width < 640 }); await send('Emulation.setTouchEmulationEnabled', { enabled: width < 640, maxTouchPoints: 1 }); };
  const shot = async name => { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); const file = path.join(screenshots, `${name}.png`); fs.writeFileSync(file, Buffer.from(result.data, 'base64')); shots.push(file); };
  const touch = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`); const rect = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`); await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...rect, id: 1 }] }); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await delay(80); };
  const fill = async (selector, text) => { await wait(`document.querySelector(${JSON.stringify(selector)})`); await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.focus();e.select();})()`); await send('Input.insertText', { text }); await delay(80); };
  const idle = () => wait(`document.querySelector('#grammar-passage-run') && !document.querySelector('#grammar-passage-run [role=status]')?.textContent.includes('Đang lưu')`);
  const layout = async () => {
    const result = await evaluate(`(()=>{const root=document.querySelector('.grammar-passage-exercise');const top=root.querySelector('.grammar-word-bank,.grammar-reading-passage');const bottom=root.querySelector('.grammar-cloze-passage,.grammar-reading-questions');return {ordered:top.getBoundingClientRect().bottom<=bottom.getBoundingClientRect().top+1,overflow:document.documentElement.scrollWidth>innerWidth+1,background:getComputedStyle(top).backgroundColor};})()`);
    assert.equal(result.ordered, true); assert.equal(result.overflow, false, 'Page fits the viewport'); return result;
  };
  const contrast = async () => {
    const result = await evaluate(`(()=>{const rgb=v=>(v.match(/[\\d.]+/g)||[]).slice(0,3).map(Number);const lum=v=>rgb(v).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);return [...document.querySelectorAll('.grammar-passage-exercise button')].map(e=>{const s=getComputedStyle(e),a=lum(s.color),b=lum(s.backgroundColor);return {text:e.textContent.trim().slice(0,24),ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});})()`);
    assert.ok(result.length); assert.ok(result.every(item => item.ratio >= 4.5), JSON.stringify(result.filter(item => item.ratio < 4.5))); return Math.min(...result.map(item => item.ratio));
  };
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable'); await viewport(1440);
  await wait('document.querySelector("#tab-grammar-editor")');
  await click('#tab-grammar-editor'); await wait('document.querySelector("#grammar-display-mode")');
  await evaluate(`(()=>{const s=document.querySelector('#grammar-display-mode');s.value='reading_comprehension';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await fill('#grammar-bulk-input', JSON.stringify(fixtures.readingDocument, null, 2)); await button('Ghép dữ liệu vào bảng câu hỏi');
  await wait(`document.querySelector('#grammar-passage-input')?.value.includes('Choosing to volunteer')`);
  assert.equal(await evaluate(`document.querySelector('#grammar-bulk-input').value`), JSON.stringify(fixtures.readingDocument, null, 2));
  await button('Xem trước và thử làm như học sinh'); await wait('document.querySelectorAll("#grammar-passage-preview fieldset").length===6');
  await click('#grammar-passage-preview .grammar-reading-option');
  assert.equal(await evaluate('document.querySelectorAll("#grammar-passage-preview [aria-pressed=true]").length'), 1);
  await button('Đóng xem trước');
  await fill('input[placeholder="Ví dụ: Present Simple - Unit 1"]', 'Grammar UI QA imported reading');
  await delay(1000); await send('Page.reload'); await wait('document.querySelector("#tab-grammar-editor")'); await click('#tab-grammar-editor');
  await button('Khôi phục'); await wait('document.querySelector("#grammar-display-mode").value==="reading_comprehension"');
  assert.equal(await evaluate('document.querySelector("#grammar-passage-input").value'), fixtures.readingDocument.passage);
  await button('Lưu bài ngữ pháp'); await wait('!document.querySelector("#grammar-editor-tab-content") && document.body.innerText.includes("Grammar UI QA imported reading")');
  note('Real authoring UI imports JSON, previews interactive questions, restores its complete draft after reload and saves.');

  await click('#tab-grammar-editor'); await wait('document.querySelector("#grammar-display-mode")');
  await evaluate(`(()=>{const s=document.querySelector('#grammar-display-mode');s.value='passage_drag_drop';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await fill('#grammar-bulk-input', JSON.stringify(fixtures.bankDocument, null, 2)); await button('Ghép dữ liệu vào bảng câu hỏi');
  await wait('document.querySelectorAll("select[aria-label^=\\"Đáp án ô\\"]").length===8');
  await button('Thêm thẻ từ / từ nhiễu'); await fill('input[aria-label="Thẻ từ 11"]', 'beside'); await button('Thêm câu');
  await wait('document.querySelectorAll("select[aria-label^=\\"Đáp án ô\\"]").length===9');
  assert.ok(await evaluate('document.querySelector("#grammar-passage-input").value.endsWith("[[9]]")'));
  await evaluate(`(()=>{const row=document.querySelector('select[aria-label="Đáp án ô 9"]').closest('div.rounded-2xl');[...row.querySelectorAll('button')].find(b=>b.textContent.trim()==='Xóa').click();})()`);
  await wait('document.querySelectorAll("select[aria-label^=\\"Đáp án ô\\"]").length===8');
  assert.equal(await evaluate('document.querySelector("#grammar-passage-input").value.includes("[[9]]")'), false);
  await button('Xem trước và thử làm như học sinh'); await wait('document.querySelectorAll("#grammar-passage-preview .grammar-word-token").length===11');
  await click('#grammar-passage-preview .grammar-word-token'); await click('#grammar-passage-preview .grammar-inline-blank');
  await wait('document.querySelectorAll("#grammar-passage-preview .grammar-word-token").length===10'); await button('Đóng xem trước');
  await fill('input[placeholder="Ví dụ: Present Simple - Unit 1"]', 'Grammar UI QA imported bank'); await button('Lưu bài ngữ pháp'); await wait('document.querySelector("#grammar-sets-tab-content")');
  note('Bank authoring imports all gaps/tokens, adds a distractor, adds/removes an inline gap, previews interactions and saves.');

  await navigate(`/grammar/private/${fixtures.bank.shareToken}`); await wait('document.querySelector("#grammar-start-btn")'); await click('#grammar-start-btn'); await wait('document.querySelectorAll(".grammar-inline-blank").length===8');
  assert.equal(await evaluate('document.querySelectorAll(".grammar-word-token").length'), 10); await layout();
  const initialContrast = await contrast(); await shot('bank-desktop-empty');
  await click('.grammar-word-token'); await click('.grammar-inline-blank[data-blank-number="1"]'); await idle();
  await wait('document.querySelectorAll(".grammar-word-token").length===9');
  // Move a placed token by the same drag/drop events used by the browser.
  await evaluate(`(()=>{const source=document.querySelector('[data-blank-number="1"]'),target=document.querySelector('[data-blank-number="2"]'),transfer=new DataTransfer();source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:transfer}));target.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer}));source.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:transfer}));})()`);
  await idle(); await wait('document.querySelector("[data-blank-number=\\"1\\"]").textContent.trim()===""');
  assert.equal(await evaluate('document.querySelector("[data-blank-number=\\"2\\"]").textContent.trim()'), 'their');
  await evaluate('document.querySelector("[data-blank-number=\\"2\\"]").focus()'); await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 }); await idle();
  await wait('document.querySelectorAll(".grammar-word-token").length===10');
  note('Student bank UI renders all 10 tokens and 8 inline gaps; select/place, drag-move and keyboard clear persist.');
  await viewport(390); await layout();
  await touch('.grammar-word-token'); await touch('.grammar-inline-blank[data-blank-number="1"]'); await idle();
  await wait('document.querySelectorAll(".grammar-word-token").length===9');
  await evaluate('scrollTo(0,0)'); await shot('bank-mobile-filled');
  // Failed network mutation survives page reload and can be retried unchanged.
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await touch('.grammar-word-token'); await touch('.grammar-inline-blank[data-blank-number="2"]'); await wait('document.querySelector("#grammar-retry-answer")');
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await send('Page.reload'); await wait('document.querySelector("#grammar-start-btn")');
  assert.equal(await evaluate('document.querySelector("#grammar-start-btn").textContent.trim()'), 'Tiếp tục bài đang làm');
  await click('#grammar-start-btn'); await wait('document.querySelector("#grammar-retry-answer")'); await click('#grammar-retry-answer'); await idle();
  await wait('document.querySelectorAll(".grammar-word-token").length===8');
  await viewport(320); await layout(); await contrast(); await viewport(1440);
  await click('#grammar-submit-btn'); await wait('document.querySelector(".grammar-review .grammar-cloze-passage")');
  assert.equal(await evaluate('document.querySelectorAll(".grammar-review .grammar-blank-result").length'), 8); await shot('bank-review');
  note('Mobile touch placement, 320px layout, offline retry across reload, resume and full inline review pass.');

  await navigate(`/grammar/private/${fixtures.reading.shareToken}`); await wait('document.querySelector("#grammar-start-btn")'); await click('#grammar-start-btn'); await wait('document.querySelectorAll(".grammar-reading-question").length===6');
  await layout(); await contrast(); await shot('reading-desktop');
  await click('.grammar-reading-option'); await idle(); await send('Page.reload'); await wait('document.querySelector("#grammar-start-btn")'); await click('#grammar-start-btn'); await wait('document.querySelectorAll(".grammar-reading-option[aria-pressed=true]").length===1');
  await viewport(390); await layout(); await shot('reading-mobile'); await viewport(320); await layout();
  await click('#grammar-submit-btn'); await wait('document.querySelector(".grammar-review .grammar-reading-passage")');
  note('Reading keeps passage above all six questions on desktop/mobile, restores selections and renders post-submit review.');
  if (fixtures.immediate) {
    await navigate(`/grammar/private/${fixtures.immediate.shareToken}`); await wait('document.querySelector("#grammar-start-btn")'); await click('#grammar-start-btn'); await wait('document.querySelector(".grammar-reading-option")');
    await click('.grammar-reading-option'); await idle(); await wait('document.querySelector(".grammar-reading-option[data-answer-state=incorrect]")');
    await send('Page.reload'); await wait('document.querySelector("#grammar-start-btn")'); await click('#grammar-start-btn'); await wait('document.querySelector(".grammar-reading-option[data-answer-state=incorrect]")');
    assert.equal(await evaluate('[...document.querySelectorAll(".grammar-reading-option")].every(button=>button.disabled)'), true);
    await click('#grammar-submit-btn'); await wait('document.querySelector(".grammar-review")');
    assert.equal(await evaluate('document.querySelectorAll(".grammar-review [data-answer-state=correct],.grammar-review .grammar-reading-explanation").length'), 0);
    note('Immediate-feedback reading restores locked answers after reload and obeys hidden post-submit review.');
  }
  await viewport(1440); await navigate('/history'); await wait('document.querySelector(".history-detail-button")');
  await wait(`(()=>{const row=[...document.querySelectorAll('tr')].find(row=>row.textContent.includes(${JSON.stringify(fixtures.bank.title)})&&row.querySelector('.history-detail-button'));if(!row)return false;row.querySelector('.history-detail-button').click();return true;})()`);
  await wait('document.querySelector(".history-modal .grammar-cloze-passage")'); await contrast(); await shot('bank-history'); await click('#student-history-modal-close-btn');
  note('The actual History detail modal reuses the full bank passage review with readable student answers.');
  await navigate(`/grammar/private/${fixtures.dynamic.shareToken}`); await wait('document.querySelector("#grammar-start-btn")'); await click('#grammar-start-btn'); await wait('document.querySelectorAll(".grammar-reading-question").length===9');
  assert.equal(await evaluate('document.querySelector(".grammar-reading-question:last-child").querySelectorAll(".grammar-reading-option").length'), 28);
  assert.equal(await evaluate('document.querySelector(".grammar-reading-question:last-child .grammar-reading-option:last-child .grammar-reading-option-label").textContent'), 'AB.');
  await layout(); await contrast();
  note(`Dynamic UI shows all 9 questions and all 28 choices in the last question; minimum initial button contrast ${initialContrast.toFixed(2)}:1.`);
  assert.deepEqual(errors, []);
  fs.writeFileSync('.data/grammar-passages-qa/browser-report.json', JSON.stringify({ passed: true, checks, screenshots: shots, errors }, null, 2));
} finally { socket?.close(); chrome.kill(); }
