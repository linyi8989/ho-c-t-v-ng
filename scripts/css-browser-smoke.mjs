import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = Number(process.env.CSS_QA_DEBUG_PORT || (10_000 + Math.floor(Math.random() * 20_000)));
const origin = process.env.CSS_QA_ORIGIN || 'http://127.0.0.1:3000';
const qaRoot = mkdtempSync(path.join(os.tmpdir(), 'vhomework-css-qa-'));
const profileDir = path.join(qaRoot, 'profile');
const screenshotDir = path.join(qaRoot, 'screenshots');
mkdirSync(profileDir, { recursive: true });
mkdirSync(screenshotDir, { recursive: true });

const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const targets = await waitForDebugger();
  const target = targets.find(item => item.type === 'page' && item.url.startsWith(origin));
  if (!target?.webSocketDebuggerUrl) throw new Error('Localhost page target was not created.');

  const cdp = createCdpClient(target.webSocketDebuggerUrl);
  await Promise.race([
    cdp.ready,
    delay(5_000).then(() => {
      throw new Error('Timed out opening the Chrome DevTools WebSocket.');
    }),
  ]);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  const evaluate = async expression => {
    const result = await cdp.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  };

  const waitFor = async expression => {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      if (await evaluate(`Boolean(${expression})`)) return;
      await delay(100);
    }
    throw new Error(`Timed out waiting for ${expression}`);
  };

  const viewport = async (width, height, mobile = false) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    });
    await delay(100);
  };

  const screenshot = async name => {
    const result = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    const filePath = path.join(screenshotDir, `${name}.png`);
    writeFileSync(filePath, Buffer.from(result.data, 'base64'));
    return filePath;
  };

  const surfaceMetricsExpression = rootSelector => `(() => {
    const root = document.querySelector(${JSON.stringify(rootSelector)});
    if (!root) return null;
    const rootStyle = getComputedStyle(root);
    const buttons = [...root.querySelectorAll('button')];
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      rootWidth: root.scrollWidth,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      backgroundColor: rootStyle.backgroundColor,
      backgroundImage: rootStyle.backgroundImage,
      backdropFilters: [...new Set(buttons.map(button => getComputedStyle(button).backdropFilter))],
      beforeContent: getComputedStyle(document.body, '::before').content,
      buttonCount: buttons.length,
    };
  })()`;

  await viewport(1440, 1000, false);
  await waitFor(`document.readyState === 'complete' && document.querySelector('#admin-dashboard-container')`);
  const adminDesktop = await evaluate(surfaceMetricsExpression('#admin-dashboard-container'));
  assert(adminDesktop && !adminDesktop.overflowX, 'Admin desktop has horizontal document overflow.');
  assert(adminDesktop.backdropFilters.every(value => value === 'none'), 'Admin button inherited a blur layer.');
  const adminScreenshot = await screenshot('admin-desktop');

  await viewport(390, 844, true);
  await delay(150);
  const adminMobile = await evaluate(surfaceMetricsExpression('#admin-dashboard-container'));
  assert(adminMobile && !adminMobile.overflowX, 'Admin 390px has horizontal document overflow.');
  const adminMobileScreenshot = await screenshot('admin-mobile-390');

  await evaluate(`document.querySelector('#view-student-page-btn')?.click()`);
  await waitFor(`document.querySelector('#app-root')`);
  await viewport(1440, 1000, false);
  const homeDesktop = await evaluate(`(() => {
    const metrics = ${surfaceMetricsExpression('#app-root')};
    const hero = document.querySelector('#home-hero');
    const heroStyle = hero ? getComputedStyle(hero) : null;
    return {
      ...metrics,
      heroBackground: heroStyle?.backgroundImage || '',
      heroBackdrop: heroStyle?.backdropFilter || '',
    };
  })()`);
  assert(homeDesktop && !homeDesktop.overflowX, 'Home desktop has horizontal document overflow.');
  assert(homeDesktop.backdropFilters.every(value => value === 'none'), 'Home button inherited a blur layer.');
  assert(homeDesktop.heroBackdrop === 'none', 'Home hero inherited a blur layer.');
  const homeScreenshot = await screenshot('home-desktop');

  await viewport(390, 844, true);
  await delay(150);
  const homeMobile = await evaluate(`(() => {
    const metrics = ${surfaceMetricsExpression('#app-root')};
    const hero = document.querySelector('#home-hero')?.getBoundingClientRect();
    const heading = document.querySelector('#home-hero h1')?.getBoundingClientRect();
    return { ...metrics, hero: hero && { left: hero.left, right: hero.right, width: hero.width }, headingWidth: heading?.width || 0 };
  })()`);
  assert(homeMobile && !homeMobile.overflowX, 'Home 390px has horizontal document overflow.');
  assert(homeMobile.hero && homeMobile.hero.left >= -1 && homeMobile.hero.right <= 391, 'Home hero leaves the 390px viewport.');
  const homeMobileScreenshot = await screenshot('home-mobile-390');

  const openedStudent = await evaluate(`(() => {
    const button = document.querySelector('#home-sets-grid button');
    if (!button) return false;
    button.click();
    return true;
  })()`);
  let student = { skipped: true, reason: 'No vocabulary set button in local fixture.' };
  let studentScreenshot = null;
  let studentMobileScreenshot = null;
  if (openedStudent) {
    await waitFor(`document.querySelector('#student-area-root')`);
    await viewport(1440, 1000, false);
    const toggleCenter = await evaluate(`(() => {
      const rect = document.querySelector('#learning-golden-toggle')?.getBoundingClientRect();
      return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
    })()`);
    if (toggleCenter) {
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: toggleCenter.x,
        y: toggleCenter.y,
      });
    }
    student = await evaluate(`(() => {
      const metrics = ${surfaceMetricsExpression('#student-area-root')};
      const goldenToggle = document.querySelector('#learning-golden-toggle');
      const hoverBackgroundColor = goldenToggle ? getComputedStyle(goldenToggle).backgroundColor : null;
      goldenToggle?.focus();
      const toggleStyle = goldenToggle ? getComputedStyle(goldenToggle) : null;
      const disabledButton = [...document.querySelectorAll('#student-area-root button:disabled')]
        .find(button => button.getBoundingClientRect().width > 0);
      const disabledStyle = disabledButton ? getComputedStyle(disabledButton) : null;
      return {
        ...metrics,
        skipped: false,
        gameStageBackdrop: getComputedStyle(document.querySelector('#game-stage')).backdropFilter,
        goldenToggleHoverBackgroundColor: hoverBackgroundColor,
        goldenToggle: toggleStyle && {
          color: toggleStyle.color,
          backgroundColor: toggleStyle.backgroundColor,
          outlineStyle: toggleStyle.outlineStyle,
          outlineWidth: toggleStyle.outlineWidth,
        },
        disabledButton: disabledStyle && {
          color: disabledStyle.color,
          backgroundColor: disabledStyle.backgroundColor,
          opacity: disabledStyle.opacity,
        },
      };
    })()`);
    assert(!student.overflowX, 'Student desktop has horizontal document overflow.');
    assert(student.backdropFilters.every(value => value === 'none'), 'Student button inherited a blur layer.');
    assert(student.gameStageBackdrop === 'none', 'Game stage inherited a blur layer.');
    assert(student.goldenToggleHoverBackgroundColor === 'rgb(146, 64, 14)', 'Golden-board hover state is not visible.');
    assert(student.goldenToggle?.outlineStyle !== 'none', 'Golden-board focus state is not visible.');
    studentScreenshot = await screenshot('student-desktop');
    await viewport(390, 844, true);
    await delay(150);
    const studentMobile = await evaluate(surfaceMetricsExpression('#student-area-root'));
    assert(studentMobile && !studentMobile.overflowX, 'Student 390px has horizontal document overflow.');
    student.mobile = studentMobile;
    studentMobileScreenshot = await screenshot('student-mobile-390');
  }

  const report = {
    qaRoot,
    screenshots: {
      adminDesktop: adminScreenshot,
      adminMobile: adminMobileScreenshot,
      homeDesktop: homeScreenshot,
      homeMobile: homeMobileScreenshot,
      studentDesktop: studentScreenshot,
      studentMobile: studentMobileScreenshot,
    },
    adminDesktop,
    adminMobile,
    homeDesktop,
    homeMobile,
    student,
  };
  writeFileSync(path.join(qaRoot, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  cdp.close();
}

try {
  await main();
} catch (error) {
  console.error(error);
  if (chromeError.trim()) console.error(chromeError.slice(-2_000));
  process.exitCode = 1;
} finally {
  chrome.kill('SIGTERM');
}
