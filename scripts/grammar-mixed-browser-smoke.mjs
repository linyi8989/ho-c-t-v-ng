import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const origin = process.env.GRAMMAR_MIXED_QA_ORIGIN || 'http://127.0.0.1:3188';
const targetUrl = new URL(origin);
if (!['127.0.0.1', 'localhost'].includes(targetUrl.hostname) || !targetUrl.port || targetUrl.port === '3000') throw new Error('Use a copied-database loopback fixture, never the user database or port 3000.');
const evidence = '.data/grammar-mixed-qa';
const fixtures = JSON.parse(fs.readFileSync(`${evidence}/fixtures.json`, 'utf8'));
const screenshots = path.resolve(evidence, 'screenshots');
fs.mkdirSync(screenshots, { recursive: true });
const debugPort = 11000 + Math.floor(Math.random() * 20000);
const chrome = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${debugPort}`, `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'grammar-mixed-chrome-'))}`,
  '--window-size=1440,1000', origin,
], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [], shots = [], errors = [], writes = [];
const note = message => { checks.push(message); console.log(message); };
let socket;
try {
  let target;
  for (let count = 0; count < 150 && !target; count++) {
    try { target = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(tab => tab.type === 'page'); } catch { /* Chrome startup. */ }
    if (!target) await delay(100);
  }
  assert.ok(target, 'Chrome starts a private QA profile.');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let nextId = 1; const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Page.javascriptDialogOpening') { socket.send(JSON.stringify({ id: nextId++, method: 'Page.handleJavaScriptDialog', params: { accept: true } })); return; }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Network.requestWillBeSent') {
      const { url, method } = message.params.request;
      if (url.startsWith(origin + '/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(method)) writes.push({ path: new URL(url).pathname, method });
    }
    if (!message.id || !pending.has(message.id)) return;
    const request = pending.get(message.id); pending.delete(message.id); clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout ${method}`)); }, 25000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const wait = async expression => {
    for (let count = 0; count < 250; count++) { if (await evaluate(`Boolean(${expression})`)) return; await delay(100); }
    throw new Error(`Timeout ${expression}: ${await evaluate('document.body.innerText.slice(-1200)')}`);
  };
  const click = async selector => {
    await wait(`document.querySelector(${JSON.stringify(selector)}) && !document.querySelector(${JSON.stringify(selector)}).disabled`);
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); await delay(80);
  };
  const fill = async (selector, text) => {
    await wait(`document.querySelector(${JSON.stringify(selector)})`);
    await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.focus();e.select();})()`);
    await send('Input.insertText', { text }); await delay(100);
  };
  const buttonIn = async (selector, text) => {
    await wait(`(()=>{const root=document.querySelector(${JSON.stringify(selector)});const b=root&&[...root.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}&&!b.disabled);if(!b)return false;b.click();return true;})()`); await delay(100);
  };
  const navigate = async pathname => { await send('Page.navigate', { url: origin + pathname }); await delay(100); };
  const viewport = async width => {
    await send('Emulation.setDeviceMetricsOverride', { width, height: width < 640 ? 900 : 1050, deviceScaleFactor: 1, mobile: width < 640 });
    await send('Emulation.setTouchEmulationEnabled', { enabled: width < 640, maxTouchPoints: 1 });
  };
  const shot = async (name, selector) => {
    if (selector) await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start'})`);
    const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const file = path.join(screenshots, `${name}.png`); fs.writeFileSync(file, Buffer.from(result.data, 'base64')); shots.push(file);
  };
  const touch = async selector => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
    const point = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await delay(100);
  };
  const drag = async (source, destination) => evaluate(`(()=>{const source=document.querySelector(${JSON.stringify(source)}),target=document.querySelector(${JSON.stringify(destination)}),transfer=new DataTransfer();source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:transfer}));target.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer}));source.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:transfer}));})()`);
  const assertFit = async () => assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'), false, 'No document overflow.');
  const contrast = async selector => {
    const rows = await evaluate(`(()=>{const rgb=v=>(v.match(/[\\d.]+/g)||[]).slice(0,3).map(Number);const lum=v=>rgb(v).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);return [...document.querySelectorAll(${JSON.stringify(selector)})].filter(e=>e.getBoundingClientRect().width>0).map(e=>{const s=getComputedStyle(e),a=lum(s.color),b=lum(s.backgroundColor);return {text:e.textContent.trim().slice(0,30),ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),opacity:s.opacity};});})()`);
    assert.ok(rows.length, 'Controls exist.'); assert.ok(rows.every(row => row.ratio >= 4.5), JSON.stringify(rows.filter(row => row.ratio < 4.5))); return Math.min(...rows.map(row => row.ratio));
  };
  const idle = () => wait(`document.querySelector('#grammar-passage-run [role=status]')?.textContent.includes('đã được lưu') && !document.querySelector('#grammar-retry-answer')`);
  const group = index => `.grammar-mixed-block[data-grammar-block-id="${fixtures.mixed.blocks[index].id}"]`;
  const filled = index => evaluate(`[...document.querySelectorAll(${JSON.stringify(group(index) + ' .grammar-inline-blank')})].map(e=>e.textContent.trim())`);
  const previewRoot = '#grammar-passage-preview';
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable'); await viewport(1440);
  await wait('document.querySelector("#tab-grammar-editor")');
  await click('#tab-grammar-editor'); await wait('document.querySelector("#grammar-mixed-editor")');
  assert.equal(await evaluate('document.querySelector("#grammar-display-mode")'), null);
  for (const type of ['multiple_choice', 'passage_drag_drop', 'reading_comprehension']) await click(`[data-add-grammar-block="${type}"]`);
  assert.equal(await evaluate('document.querySelectorAll("#grammar-mixed-editor > article[data-grammar-block-id]").length'), 3);
  await fill('#grammar-bulk-input', JSON.stringify(fixtures.document, null, 2)); await click('#grammar-import-replace');
  await wait('document.querySelectorAll("#grammar-mixed-editor > article[data-grammar-block-id]").length===4');
  assert.equal(await evaluate('document.querySelectorAll("#grammar-mixed-editor [data-grammar-question-id]").length'), 8);
  assert.equal(await evaluate('document.querySelectorAll("input[aria-label^=\\"Lựa chọn \\"][aria-label$=\\"câu 2\\"]").length'), 28);
  await click('button[aria-label="Nhân bản câu 3"]');
  await wait('document.querySelectorAll("#grammar-mixed-editor [data-grammar-question-id]").length===9');
  assert.deepEqual(await evaluate(`(()=>{const group=document.querySelector('#grammar-mixed-editor > article[data-grammar-block-id]:nth-of-type(2)');return [...group.querySelectorAll('label')].filter(label=>label.textContent.trim()==='Số ô trống').map(label=>Number(label.querySelector('input').value));})()`), [1, 2, 3]);
  await click('button[aria-label="Xóa câu 5"]');
  await wait('document.querySelectorAll("#grammar-mixed-editor [data-grammar-question-id]").length===8');
  const initialOrder = await evaluate('[...document.querySelectorAll("#grammar-mixed-editor > article[data-grammar-block-id]")].map(e=>e.dataset.grammarBlockId)');
  await click('button[aria-label="Đưa nhóm 1 xuống"]');
  assert.deepEqual(await evaluate('[...document.querySelectorAll("#grammar-mixed-editor > article[data-grammar-block-id]")].map(e=>e.dataset.grammarBlockId)'), [initialOrder[1], initialOrder[0], initialOrder[2], initialOrder[3]]);
  await click('button[aria-label="Đưa nhóm 2 lên"]');
  await buttonIn('#grammar-mixed-editor > article[data-grammar-block-id]:nth-of-type(2)', 'Nhân bản nhóm');
  await wait('document.querySelectorAll("#grammar-mixed-editor > article[data-grammar-block-id]").length===5');
  assert.equal(await evaluate('(()=>{const ids=[...document.querySelectorAll("#grammar-mixed-editor [data-grammar-question-id]")].map(e=>e.dataset.grammarQuestionId);return new Set(ids).size===ids.length})()'), true);
  await buttonIn('#grammar-mixed-editor > article[data-grammar-block-id]:nth-of-type(3)', 'Xóa nhóm');
  await fill('#grammar-bulk-input', JSON.stringify(fixtures.legacyDocuments[0])); await click('#grammar-import-append');
  await wait('document.querySelectorAll("#grammar-mixed-editor > article[data-grammar-block-id]").length===5');
  await buttonIn('#grammar-mixed-editor > article[data-grammar-block-id]:last-of-type', 'Xóa nhóm');
  const beforeInvalid = await evaluate('[...document.querySelectorAll("#grammar-mixed-editor > article[data-grammar-block-id]")].map(e=>e.dataset.grammarBlockId)');
  await fill('#grammar-bulk-input', '{"format":"grammar-mixed-v1","blocks":[{"type":"unknown"}]}'); await click('#grammar-import-replace');
  assert.deepEqual(await evaluate('[...document.querySelectorAll("#grammar-mixed-editor > article[data-grammar-block-id]")].map(e=>e.dataset.grammarBlockId)'), beforeInvalid);
  await fill('#grammar-bulk-input', JSON.stringify(fixtures.document, null, 2));
  const previewWrites = writes.length;
  await click('#grammar-mixed-preview-toggle'); await wait('document.querySelectorAll("#grammar-passage-preview .grammar-mixed-block").length===4');
  await click('#grammar-passage-preview .grammar-mixed-block:first-child .grammar-reading-option');
  const previewBank = '#grammar-passage-preview .grammar-mixed-block:nth-child(2)';
  await click(previewBank + ' .grammar-word-token'); await click(previewBank + ' .grammar-inline-blank');
  assert.equal(await evaluate(`document.querySelectorAll(${JSON.stringify(previewBank + ' .grammar-word-token')}).length`), 2);
  assert.equal(writes.length, previewWrites, 'Preview creates no server attempt/result.');
  await contrast('#grammar-mixed-editor .grammar-mixed-control'); await shot('authoring-desktop', '#grammar-mixed-editor');
  await viewport(390); await assertFit(); await shot('authoring-mobile', '#grammar-mixed-editor'); await viewport(1440);
  await click('#grammar-mixed-preview-toggle');
  await fill('input[placeholder="Ví dụ: Present Simple - Unit 1"]', 'Mixed Grammar UI QA restored draft');
  await delay(1500); await send('Page.reload'); await wait('document.querySelector("#tab-grammar-editor")'); await click('#tab-grammar-editor');
  await buttonIn('body', 'Khôi phục'); await wait('document.querySelectorAll("#grammar-mixed-editor > article[data-grammar-block-id]").length===4');
  assert.equal(await evaluate('document.querySelectorAll("#grammar-mixed-editor [data-grammar-question-id]").length'), 8);
  assert.equal(await evaluate('document.querySelector("#grammar-bulk-input").value'), JSON.stringify(fixtures.document, null, 2));
  await evaluate('window.__mixedCopied="";Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async text=>{window.__mixedCopied=text}}})');
  await buttonIn('#grammar-editor-tab-content', 'Sao chép prompt nhiều dạng cho ChatGPT');
  assert.match(await evaluate('window.__mixedCopied'), /grammar-mixed-v1/);
  assert.match(await evaluate('window.__mixedCopied'), /```json/);
  await click('#grammar-save-btn'); await wait('document.querySelector("#grammar-sets-tab-content") && !document.querySelector("#grammar-editor-tab-content")');
  note('Actual authoring UI adds/imports/appends/reorders/duplicates/deletes groups, rejects invalid input atomically, keeps 28 choices, previews without writes, restores complete drafts, copies the versioned prompt and saves.');

  await navigate(`/grammar/private/${fixtures.mixed.shareToken}`); await wait('document.querySelector("#grammar-start-btn")');
  await click('#grammar-start-btn'); await wait('document.querySelectorAll("#grammar-passage-run .grammar-mixed-block").length===4');
  assert.deepEqual(await evaluate('[...document.querySelectorAll("#grammar-passage-run .grammar-mixed-block")].map(e=>e.dataset.grammarBlockType)'), fixtures.document.blocks.map(block => block.type));
  assert.equal(await evaluate('document.querySelectorAll("#grammar-submit-btn").length'), 1);
  assert.equal(await evaluate(`document.querySelectorAll(${JSON.stringify(group(0) + ' fieldset:last-child .grammar-reading-option')}).length`), 28);
  for (const index of [1, 2, 3]) {
    const order = await evaluate(`(()=>{const root=document.querySelector(${JSON.stringify(group(index))});const top=root.querySelector('.grammar-word-bank,.grammar-reading-passage'),bottom=root.querySelector('.grammar-cloze-passage,.grammar-reading-questions');return top.getBoundingClientRect().bottom<=bottom.getBoundingClientRect().top+1;})()`);
    assert.equal(order, true, `Block ${index + 1} keeps its source layout.`);
  }
  await click(group(0) + ' .grammar-reading-option'); await idle();
  await click(group(3) + ' .grammar-word-token'); await click(group(3) + ' .grammar-inline-blank[data-blank-number="1"]'); await idle();
  const bankBBefore = await filled(3);
  await click(group(1) + ' .grammar-word-token'); await click(group(1) + ' .grammar-inline-blank[data-blank-number="1"]'); await idle();
  const bankAToken = (await filled(1))[0];
  await drag(group(1) + ' .grammar-inline-blank[data-blank-number="1"]', group(1) + ' .grammar-inline-blank[data-blank-number="2"]'); await idle();
  assert.deepEqual(await filled(1), ['', bankAToken]); assert.deepEqual(await filled(3), bankBBefore);
  assert.equal(await evaluate(`document.querySelectorAll(${JSON.stringify(group(0) + ' .grammar-reading-option[aria-pressed=true]')}).length`), 1);
  await evaluate(`document.querySelector(${JSON.stringify(group(1) + ' .grammar-inline-blank[data-blank-number="2"]')}).focus()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 }); await idle();
  assert.deepEqual(await filled(1), ['', '']); assert.deepEqual(await filled(3), bankBBefore);
  await drag(group(1) + ' .grammar-word-token', group(3) + ' .grammar-inline-blank[data-blank-number="1"]'); await delay(200);
  assert.deepEqual(await filled(3), bankBBefore, 'A token from bank A cannot replace an answer in bank B.');
  const minimumContrast = await contrast('#grammar-passage-run .grammar-reading-option,#grammar-passage-run .grammar-word-token,#grammar-submit-btn');
  await assertFit(); await shot('mixed-desktop-top', group(0)); await shot('mixed-desktop-bank-reading', group(1));
  note('One student page renders all ordered groups with one Submit; separate banks may both use blank 1. Select/place, drag move, keyboard clear and cross-bank drag preserve answers in all other groups.');

  await viewport(390); await assertFit();
  await touch(group(1) + ' .grammar-word-token'); await touch(group(1) + ' .grammar-inline-blank[data-blank-number="1"]'); await idle();
  await touch(group(2) + ' .grammar-reading-option'); await idle();
  await shot('mixed-mobile-bank', group(1)); await shot('mixed-mobile-reading', group(2));
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await touch(group(1) + ' .grammar-word-token'); await touch(group(1) + ' .grammar-inline-blank[data-blank-number="2"]'); await wait('document.querySelector("#grammar-retry-answer")');
  assert.equal(await evaluate('document.querySelector("#grammar-submit-btn").disabled'), true);
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await send('Page.reload'); await wait('document.querySelector("#grammar-start-btn")');
  assert.match(await evaluate('document.querySelector("#grammar-start-btn").textContent'), /Tiếp tục/);
  await click('#grammar-start-btn'); await wait('document.querySelector("#grammar-retry-answer")'); await click('#grammar-retry-answer'); await idle();
  assert.equal((await filled(1)).filter(Boolean).length, 2); assert.deepEqual(await filled(3), bankBBefore);
  assert.equal(await evaluate(`document.querySelectorAll(${JSON.stringify(group(0) + ' .grammar-reading-option[aria-pressed=true]')}).length`), 1);
  assert.equal(await evaluate(`document.querySelectorAll(${JSON.stringify(group(2) + ' .grammar-reading-option[aria-pressed=true]')}).length`), 1);
  await viewport(320); await assertFit(); await shot('mixed-mobile-320', group(3));
  await viewport(1440); await click('#grammar-submit-btn'); await wait('document.querySelectorAll(".grammar-review .grammar-mixed-block").length===4');
  assert.equal(await evaluate('document.querySelectorAll(".grammar-review .grammar-blank-result").length'), 4);
  await shot('mixed-review', '.grammar-review .grammar-mixed-block:nth-child(2)');
  note(`Mobile touch, 390/320px layout, offline pending-save disable/reload/resume/retry, all previous selections and full one-page review pass; sampled control contrast >=${minimumContrast.toFixed(2)}:1.`);

  await navigate('/history'); await wait('document.querySelector(".history-detail-button")');
  await wait(`(()=>{const row=[...document.querySelectorAll('tr')].find(row=>row.textContent.includes(${JSON.stringify(fixtures.mixed.title)})&&row.querySelector('.history-detail-button'));if(!row)return false;row.querySelector('.history-detail-button').click();return true;})()`);
  await wait('document.querySelectorAll(".history-modal .grammar-mixed-block").length===4');
  assert.equal(await evaluate('document.querySelectorAll(".history-modal .grammar-blank-result").length'), 4);
  await shot('mixed-history', '.history-modal .grammar-mixed-block:nth-child(2)');
  await click('#student-history-modal-close-btn');
  note('The actual SQLite-backed History modal renders all mixed groups and both separate bank reviews.');
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${evidence}/browser-report.json`, JSON.stringify({ passed: true, origin, checks, screenshots: shots, errors, writePaths: writes }, null, 2));
} finally { socket?.close(); chrome.kill(); }
